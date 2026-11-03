"""Payroll engine: monthly totals, transaction entry, CALCULATE-mode generation, process / lock."""

import calendar
from dataclasses import dataclass, field
from datetime import date
from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session

from app.core.errors import ConflictError, UnprocessableError
from app.models.employee import EmpDetails, EmploymentStatus
from app.models.org import OrgSetup, PolicyMode
from app.models.payroll import (
    DEDUCTION_TYPES,
    EARNING_TYPES,
    LOP_DAYS_CODE,
    PAID_DAYS_CODE,
    TYPE_ORDER,
    Component,
    ComponentType,
    EmpSalaryComponent,
    PayrollStatus,
    PayrollSummary,
    Transaction,
)
from app.services.employees import employee_query

ZERO = Decimal("0")
CENT = Decimal("0.01")


def money(value: Decimal | int | float) -> Decimal:
    return Decimal(value).quantize(CENT, rounding=ROUND_HALF_UP)


# ---------- Months ----------

def month_bounds(month_year: str) -> tuple[date, date]:
    year, month = (int(p) for p in month_year.split("-"))
    return date(year, month, 1), date(year, month, calendar.monthrange(year, month)[1])


def month_label(month_year: str) -> str:
    return month_bounds(month_year)[0].strftime("%B %Y")


def current_month() -> str:
    return date.today().strftime("%Y-%m")


def recent_months(month_year: str, count: int) -> list[str]:
    """`count` months ending with month_year, oldest first."""
    year, month = (int(p) for p in month_year.split("-"))
    months = []
    for _ in range(count):
        months.append(f"{year:04d}-{month:02d}")
        month -= 1
        if month == 0:
            year, month = year - 1, 12
    return months[::-1]


# ---------- Components ----------

def load_components(db: Session) -> list[Component]:
    components = db.scalars(select(Component)).all()
    return sorted(components, key=lambda c: (TYPE_ORDER.get(c.comp_type, 99), c.comp_code))


# ---------- Monthly calculation ----------

@dataclass
class PayLine:
    employee: EmpDetails
    amounts: dict[str, Decimal] = field(default_factory=dict)
    gross: Decimal = ZERO
    deductions: Decimal = ZERO

    @property
    def net(self) -> Decimal:
        return self.gross - self.deductions


def month_employees(
    db: Session, org_code: str, month_year: str, emp_codes: list[str] | None = None
) -> list[EmpDetails]:
    """Employees on the month's payroll: anyone with transactions that month, plus active employees
    who had joined by the end of the month."""
    start, end = month_bounds(month_year)
    with_transactions = (
        select(Transaction.emp_code)
        .where(Transaction.org_code == org_code, Transaction.month_year == month_year)
        .distinct()
    )
    query = employee_query(org_code).where(
        or_(
            EmpDetails.emp_code.in_(with_transactions),
            and_(
                EmpDetails.employment_status == EmploymentStatus.ACTIVE.value,
                or_(EmpDetails.date_of_joining.is_(None), EmpDetails.date_of_joining <= end),
                or_(EmpDetails.date_of_leaving.is_(None), EmpDetails.date_of_leaving >= start),
            ),
        )
    )
    if emp_codes:
        query = query.where(EmpDetails.emp_code.in_(emp_codes))
    return list(db.scalars(query.order_by(EmpDetails.emp_code)).unique())


def compute_month(
    db: Session, org_code: str, month_year: str, emp_codes: list[str] | None = None
) -> tuple[list[Component], list[PayLine]]:
    components = load_components(db)
    comp_types = {c.comp_code: c.comp_type for c in components}
    lines = {e.emp_code: PayLine(employee=e) for e in month_employees(db, org_code, month_year, emp_codes)}
    if not lines:
        return components, []

    rows = db.execute(
        select(Transaction.emp_code, Transaction.comp_code, Transaction.amount).where(
            Transaction.org_code == org_code,
            Transaction.month_year == month_year,
            Transaction.emp_code.in_(list(lines)),
        )
    )
    for emp_code, comp_code, amount in rows:
        line = lines[emp_code]
        line.amounts[comp_code] = amount
        if comp_types.get(comp_code) in EARNING_TYPES:
            line.gross += amount
        elif comp_types.get(comp_code) in DEDUCTION_TYPES:
            line.deductions += amount
    return components, list(lines.values())


# ---------- Payroll status ----------

def get_summary(db: Session, org_code: str, month_year: str) -> PayrollSummary | None:
    return db.scalar(
        select(PayrollSummary).where(PayrollSummary.org_code == org_code, PayrollSummary.month_year == month_year)
    )


def status_of(summary: PayrollSummary | None) -> PayrollStatus:
    return PayrollStatus(summary.status) if summary else PayrollStatus.DRAFT


def ensure_editable(db: Session, org_code: str, month_year: str) -> PayrollSummary | None:
    summary = get_summary(db, org_code, month_year)
    if summary is not None and summary.status == PayrollStatus.LOCKED.value:
        raise ConflictError(f"Payroll for {month_year} is locked. Unlock it to make changes.")
    return summary


def mark_changed(summary: PayrollSummary | None) -> None:
    """Edits after processing send the month back to DRAFT so it must be processed again."""
    if summary is not None and summary.status == PayrollStatus.PROCESSED.value:
        summary.status = PayrollStatus.DRAFT.value


# ---------- Transaction entry ----------

def apply_entries(
    db: Session, org_code: str, month_year: str, entries: list[tuple[str, str, Decimal | None]]
) -> int:
    """Upsert (emp_code, comp_code, amount) values for a month; amount None deletes the value.

    Validates everything first and raises UnprocessableError with all problems, so nothing is half-saved.
    """
    summary = ensure_editable(db, org_code, month_year)
    components = {c.comp_code: c for c in load_components(db)}
    emp_codes = {code for code, _, _ in entries}
    known_employees = set(
        db.scalars(select(EmpDetails.emp_code).where(EmpDetails.org_code == org_code, EmpDetails.emp_code.in_(emp_codes)))
    )
    days_in_month = month_bounds(month_year)[1].day

    errors = []
    for emp_code, comp_code, amount in entries:
        if emp_code not in known_employees:
            errors.append({"emp_code": emp_code, "comp_code": comp_code, "message": "Employee not found"})
        component = components.get(comp_code)
        if component is None:
            errors.append({"emp_code": emp_code, "comp_code": comp_code, "message": "Component not found"})
        elif (
            component.comp_type == ComponentType.ATTENDANCE.value
            and amount is not None
            and amount > days_in_month
        ):
            errors.append(
                {"emp_code": emp_code, "comp_code": comp_code,
                 "message": f"Cannot exceed {days_in_month} days in {month_year}"}
            )
    if errors:
        raise UnprocessableError(errors)

    existing = {
        (t.emp_code, t.comp_code): t
        for t in db.scalars(
            select(Transaction).where(
                Transaction.org_code == org_code,
                Transaction.month_year == month_year,
                Transaction.emp_code.in_(emp_codes),
            )
        )
    }
    changed = 0
    for emp_code, comp_code, amount in entries:
        transaction = existing.get((emp_code, comp_code))
        if amount is None:
            if transaction is not None:
                db.delete(transaction)
                existing.pop((emp_code, comp_code))
                changed += 1
        elif transaction is None:
            transaction = Transaction(
                org_code=org_code, emp_code=emp_code, comp_code=comp_code, month_year=month_year, amount=money(amount)
            )
            db.add(transaction)
            existing[(emp_code, comp_code)] = transaction
            changed += 1
        elif transaction.amount != money(amount):
            transaction.amount = money(amount)
            changed += 1
    if changed:
        mark_changed(summary)
    return changed


# ---------- CALCULATE policy mode ----------

def _employed_days(emp: EmpDetails, start: date, end: date) -> int:
    first = max(start, emp.date_of_joining) if emp.date_of_joining else start
    last = min(end, emp.date_of_leaving) if emp.date_of_leaving else end
    return max((last - first).days + 1, 0)


def calculate_month(db: Session, org: OrgSetup, month_year: str) -> dict:
    """Generate EARNING / DEDUCTION transactions from each employee's salary structure.

    Earnings are prorated by paid days. Paid days come from the PAID_DAYS attendance value if entered,
    else days employed in the month minus LOP_DAYS. Deductions are taken at their monthly amount
    (zero when there are no paid days). Special earnings/deductions and attendance entries are untouched.
    """
    if org.policy_mode != PolicyMode.CALCULATE.value:
        raise ConflictError(
            f"Organisation '{org.org_code}' uses the FINAL policy mode: enter final amounts in transactions instead"
        )
    summary = ensure_editable(db, org.org_code, month_year)
    start, end = month_bounds(month_year)
    days_in_month = end.day
    components = {c.comp_code: c for c in load_components(db)}
    employees = month_employees(db, org.org_code, month_year)

    structures: dict[str, list[EmpSalaryComponent]] = {}
    for item in db.scalars(select(EmpSalaryComponent).where(EmpSalaryComponent.org_code == org.org_code)):
        structures.setdefault(item.emp_code, []).append(item)
    existing = {
        (t.emp_code, t.comp_code): t
        for t in db.scalars(
            select(Transaction).where(Transaction.org_code == org.org_code, Transaction.month_year == month_year)
        )
    }

    def put(emp_code: str, comp_code: str, amount: Decimal) -> None:
        transaction = existing.get((emp_code, comp_code))
        if transaction is None:
            transaction = Transaction(org_code=org.org_code, emp_code=emp_code, comp_code=comp_code, month_year=month_year)
            db.add(transaction)
            existing[(emp_code, comp_code)] = transaction
        transaction.amount = money(amount)

    warnings: list[str] = []
    calculated = written = 0
    for emp in employees:
        items = structures.get(emp.emp_code)
        if not items:
            warnings.append(f"{emp.emp_code}: no salary structure, skipped")
            continue

        employed = _employed_days(emp, start, end)
        paid_entry = existing.get((emp.emp_code, PAID_DAYS_CODE))
        lop_entry = existing.get((emp.emp_code, LOP_DAYS_CODE))
        if paid_entry is not None:
            paid_days = paid_entry.amount
            if paid_days > employed:
                warnings.append(f"{emp.emp_code}: paid days {paid_days} exceed {employed} days employed this month")
        else:
            paid_days = Decimal(max(employed - (lop_entry.amount if lop_entry else 0), 0))
            if PAID_DAYS_CODE in components:
                put(emp.emp_code, PAID_DAYS_CODE, paid_days)
                written += 1

        ratio = paid_days / Decimal(days_in_month)
        for item in items:
            comp_type = components[item.comp_code].comp_type
            if comp_type == ComponentType.EARNING.value:
                amount = item.monthly_amount * ratio
            else:
                amount = item.monthly_amount if paid_days > 0 else ZERO
            put(emp.emp_code, item.comp_code, amount)
            written += 1
        calculated += 1

    mark_changed(summary)
    return {
        "month_year": month_year,
        "days_in_month": days_in_month,
        "employees_calculated": calculated,
        "transactions_written": written,
        "warnings": warnings,
    }


# ---------- Process / lock ----------

def process_payroll(db: Session, org: OrgSetup, month_year: str) -> tuple[PayrollSummary, list[PayLine], list[str]]:
    summary = ensure_editable(db, org.org_code, month_year)
    _, lines = compute_month(db, org.org_code, month_year)
    lines = [line for line in lines if line.amounts]
    if not lines:
        raise UnprocessableError(f"No transactions entered for {month_year}")

    negative = [f"{l.employee.emp_code}: deductions exceed earnings (net {l.net})" for l in lines if l.net < 0]
    if negative:
        raise UnprocessableError(negative)

    warnings = [f"{l.employee.emp_code}: no earnings" for l in lines if l.gross == 0]
    warnings += [f"{l.employee.emp_code}: no email address, payslip cannot be emailed" for l in lines if not l.employee.email]

    gross = sum((l.gross for l in lines), ZERO)
    deductions = sum((l.deductions for l in lines), ZERO)
    if summary is None:
        summary = PayrollSummary(org_code=org.org_code, month_year=month_year)
        db.add(summary)
    summary.gross_payroll = money(gross)
    summary.total_deductions = money(deductions)
    summary.net_payroll = summary.gross_payroll - summary.total_deductions
    summary.status = PayrollStatus.PROCESSED.value
    return summary, lines, warnings


def lock_payroll(db: Session, org_code: str, month_year: str) -> PayrollSummary:
    summary = get_summary(db, org_code, month_year)
    if summary is None or summary.status == PayrollStatus.DRAFT.value:
        raise ConflictError(f"Process the payroll for {month_year} before locking it")
    summary.status = PayrollStatus.LOCKED.value
    return summary


def unlock_payroll(db: Session, org_code: str, month_year: str) -> PayrollSummary:
    summary = get_summary(db, org_code, month_year)
    if summary is None or summary.status != PayrollStatus.LOCKED.value:
        raise ConflictError(f"Payroll for {month_year} is not locked")
    summary.status = PayrollStatus.PROCESSED.value
    return summary
