from fastapi import APIRouter, Query
from sqlalchemy import func, select

from app.api.deps import CurrentOrg, CurrentUser, DbSession
from app.models.employee import EmpDetails, EmploymentStatus
from app.models.org import Designation
from app.models.payroll import PayrollStatus, PayrollSummary, PayslipEmail
from app.schemas.common import MONTH_YEAR_PATTERN
from app.schemas.payroll import CountItem, DashboardRead, EmailStats, MonthTrend
from app.services.payroll import ZERO, compute_month, current_month, month_bounds, recent_months

# Mounted at /orgs/{org_code}/dashboard
router = APIRouter()

TREND_MONTHS = 6


@router.get("", response_model=DashboardRead)
def dashboard(
    org: CurrentOrg,
    db: DbSession,
    _: CurrentUser,
    month_year: str | None = Query(None, pattern=MONTH_YEAR_PATTERN, description="YYYY-MM, default current month"),
) -> DashboardRead:
    month_year = month_year or current_month()
    start, end = month_bounds(month_year)
    org_filter = EmpDetails.org_code == org.org_code

    by_status = dict(
        db.execute(select(EmpDetails.employment_status, func.count()).where(org_filter).group_by(EmpDetails.employment_status)).all()
    )
    by_designation = db.execute(
        select(EmpDetails.designation_code, Designation.designation_name, func.count())
        .outerjoin(Designation, Designation.designation_code == EmpDetails.designation_code)
        .where(org_filter, EmpDetails.employment_status == EmploymentStatus.ACTIVE.value)
        .group_by(EmpDetails.designation_code, Designation.designation_name)
        .order_by(func.count().desc())
    ).all()
    new_joiners = db.scalar(
        select(func.count()).select_from(EmpDetails).where(org_filter, EmpDetails.date_of_joining.between(start, end))
    )
    leavers = db.scalar(
        select(func.count()).select_from(EmpDetails).where(org_filter, EmpDetails.date_of_leaving.between(start, end))
    )

    months = recent_months(month_year, TREND_MONTHS)
    summaries = {
        s.month_year: s
        for s in db.scalars(
            select(PayrollSummary).where(PayrollSummary.org_code == org.org_code, PayrollSummary.month_year.in_(months))
        )
    }
    trend = [
        MonthTrend(
            month_year=m,
            gross_payroll=summaries[m].gross_payroll if m in summaries else ZERO,
            total_deductions=summaries[m].total_deductions if m in summaries else ZERO,
            net_payroll=summaries[m].net_payroll if m in summaries else ZERO,
            status=summaries[m].status if m in summaries else None,
        )
        for m in months
    ]

    current = trend[-1]
    if month_year not in summaries:
        # Not processed yet: show live totals from the transactions entered so far
        _, lines = compute_month(db, org.org_code, month_year)
        gross = sum((l.gross for l in lines), ZERO)
        deductions = sum((l.deductions for l in lines), ZERO)
        if any(l.amounts for l in lines):
            current = MonthTrend(
                month_year=month_year, gross_payroll=gross, total_deductions=deductions,
                net_payroll=gross - deductions, status=PayrollStatus.DRAFT,
            )

    email_counts = dict(
        db.execute(
            select(PayslipEmail.status, func.count())
            .where(PayslipEmail.org_code == org.org_code, PayslipEmail.month_year == month_year)
            .group_by(PayslipEmail.status)
        ).all()
    )

    return DashboardRead(
        org_code=org.org_code,
        org_name=org.org_name,
        month_year=month_year,
        active_employees=by_status.get(EmploymentStatus.ACTIVE.value, 0),
        total_employees=sum(by_status.values()),
        employees_by_status=[
            CountItem(key=s.value, label=s.value.title(), count=by_status.get(s.value, 0)) for s in EmploymentStatus
        ],
        employees_by_designation=[
            CountItem(key=code or "NONE", label=name or "No designation", count=count)
            for code, name, count in by_designation
        ],
        payroll=current,
        payroll_trend=trend,
        emails=EmailStats(
            pending=email_counts.get("PENDING", 0), sent=email_counts.get("SENT", 0), failed=email_counts.get("FAILED", 0)
        ),
        new_joiners=new_joiners or 0,
        leavers=leavers or 0,
    )
