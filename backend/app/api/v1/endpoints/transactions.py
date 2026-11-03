import re
from decimal import Decimal
from typing import Literal

from fastapi import APIRouter, File, HTTPException, Query, Response, UploadFile, status
from pydantic import TypeAdapter, ValidationError

from app.api.deps import CurrentOrg, CurrentUser, DbSession, EditorUser, MonthPath
from app.core.errors import UnprocessableError
from app.models.org import OrgSetup
from app.models.payroll import Component, PayrollStatus
from app.schemas.common import Money
from app.schemas.payroll import (
    CalculateResult,
    ComponentRead,
    EntryError,
    GridRow,
    GridTotals,
    TransactionBulkUpdate,
    TransactionGrid,
    TransactionImportResult,
)
from app.services import spreadsheet
from app.services.employees import normalize_header
from app.services.payroll import (
    ZERO,
    PayLine,
    apply_entries,
    calculate_month,
    compute_month,
    get_summary,
    load_components,
    status_of,
)

# Mounted at /orgs/{org_code}/transactions
router = APIRouter()

_money = TypeAdapter(Money)
_FIXED_HEADERS = ["Employee Code", "Name", "Designation"]
_TOTAL_HEADERS = ["Gross Earnings", "Total Deductions", "Net Pay"]
_EMP_CODE_HEADERS = {"employee_code", "emp_code", "employee_id", "emp_id"}
_IGNORED_HEADERS = {normalize_header(h) for h in _FIXED_HEADERS[1:] + _TOTAL_HEADERS} | {"employee_name", "emp_name"}


def _grid(db: DbSession, org: OrgSetup, month_year: str, search: str | None = None) -> TransactionGrid:
    components, lines = compute_month(db, org.org_code, month_year)
    if search:
        needle = search.strip().lower()
        lines = [
            l for l in lines
            if needle in l.employee.emp_code.lower()
            or needle in l.employee.emp_name.lower()
            or needle in (l.employee.designation_name or "").lower()
        ]
    payroll_status = status_of(get_summary(db, org.org_code, month_year))
    column_totals: dict[str, Decimal] = {}
    for line in lines:
        for code, amount in line.amounts.items():
            column_totals[code] = column_totals.get(code, ZERO) + amount
    gross = sum((l.gross for l in lines), ZERO)
    deductions = sum((l.deductions for l in lines), ZERO)
    return TransactionGrid(
        org_code=org.org_code,
        month_year=month_year,
        policy_mode=org.policy_mode,
        payroll_status=payroll_status,
        editable=payroll_status != PayrollStatus.LOCKED,
        components=[ComponentRead.model_validate(c) for c in components],
        rows=[_row(l) for l in lines],
        totals=GridTotals(values=column_totals, gross_earnings=gross, total_deductions=deductions, net_pay=gross - deductions),
    )


def _row(line: PayLine) -> GridRow:
    emp = line.employee
    return GridRow(
        emp_code=emp.emp_code,
        emp_name=emp.emp_name,
        designation_name=emp.designation_name,
        employment_status=emp.employment_status,
        values=line.amounts,
        gross_earnings=line.gross,
        total_deductions=line.deductions,
        net_pay=line.net,
    )


@router.get("/{month_year}", response_model=TransactionGrid)
def get_month(
    month_year: MonthPath, org: CurrentOrg, db: DbSession, _: CurrentUser, search: str | None = None
) -> TransactionGrid:
    """Monthly grid: one row per employee on the month's payroll, one value per component."""
    return _grid(db, org, month_year, search)


@router.put("/{month_year}", response_model=TransactionGrid)
def update_month(
    month_year: MonthPath, body: TransactionBulkUpdate, org: CurrentOrg, db: DbSession, _: EditorUser
) -> TransactionGrid:
    """Save edited cells. `amount: null` clears a cell. All-or-nothing: any invalid entry rejects the request."""
    apply_entries(db, org.org_code, month_year, [(e.emp_code, e.comp_code, e.amount) for e in body.entries])
    db.commit()
    return _grid(db, org, month_year)


@router.post("/{month_year}/calculate", response_model=CalculateResult)
def calculate(month_year: MonthPath, org: CurrentOrg, db: DbSession, _: EditorUser) -> dict:
    """CALCULATE policy mode: generate earnings/deductions from salary structures, prorated by paid days."""
    result = calculate_month(db, org, month_year)
    db.commit()
    return result


def _export_headers(components: list[Component]) -> list[str]:
    return _FIXED_HEADERS + [f"{c.comp_name} [{c.comp_code}]" for c in components] + _TOTAL_HEADERS


@router.get("/{month_year}/export")
def export_month(
    month_year: MonthPath,
    org: CurrentOrg,
    db: DbSession,
    _: CurrentUser,
    file_format: Literal["xlsx", "csv"] = Query("xlsx", alias="format"),
) -> Response:
    """Grid as a spreadsheet. The same file (with values filled in) can be imported back."""
    components, lines = compute_month(db, org.org_code, month_year)
    rows = [
        [l.employee.emp_code, l.employee.emp_name, l.employee.designation_name]
        + [float(l.amounts[c.comp_code]) if c.comp_code in l.amounts else None for c in components]
        + [float(l.gross), float(l.deductions), float(l.net)]
        for l in lines
    ]
    headers = _export_headers(components)
    filename = f"transactions_{org.org_code}_{month_year}.{file_format}"
    if file_format == "csv":
        content, media_type = spreadsheet.to_csv(headers, rows), spreadsheet.CSV_MEDIA_TYPE
    else:
        content, media_type = spreadsheet.to_xlsx(headers, rows, month_year), spreadsheet.XLSX_MEDIA_TYPE
    return Response(content, media_type=media_type, headers=spreadsheet.file_response_headers(filename))


def _component_columns(header_row: list, components: list[Component]) -> tuple[int, dict[int, str], list[str]]:
    by_key: dict[str, str] = {}
    for c in components:
        by_key[normalize_header(c.comp_code)] = c.comp_code
        by_key[normalize_header(c.comp_name)] = c.comp_code
    emp_col, columns, unknown = -1, {}, []
    for index, header in enumerate(header_row):
        if header is None or not str(header).strip():
            continue
        key = normalize_header(header)
        bracket = re.search(r"\[([^\]]+)\]\s*$", str(header))
        if key in _EMP_CODE_HEADERS:
            emp_col = index
        elif bracket and bracket.group(1).strip().upper() in {c.comp_code for c in components}:
            columns[index] = bracket.group(1).strip().upper()
        elif key in by_key:
            columns[index] = by_key[key]
        elif key not in _IGNORED_HEADERS:
            unknown.append(str(header))
    return emp_col, columns, unknown


@router.post("/{month_year}/import", response_model=TransactionImportResult)
async def import_month(
    month_year: MonthPath,
    org: CurrentOrg,
    db: DbSession,
    _: EditorUser,
    file: UploadFile = File(..., description="Grid spreadsheet: Employee Code column plus one column per component"),
    dry_run: bool = Query(False, description="Only validate; nothing is saved"),
) -> TransactionImportResult:
    """Blank cells are left unchanged. All-or-nothing: any error and nothing is saved."""
    content = await file.read()
    if len(content) > spreadsheet.MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=status.HTTP_413_CONTENT_TOO_LARGE, detail="File is larger than 5 MB")
    try:
        header_row, rows = spreadsheet.read_table(file.filename or "", content)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(exc))

    emp_col, columns, unknown = _component_columns(header_row, load_components(db))
    if emp_col < 0:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="The file needs an 'Employee Code' column")

    errors = [EntryError(message=f"Unknown column '{h}'") for h in unknown]
    entries: list[tuple[str, str, Decimal]] = []
    seen_rows: dict[str, int] = {}
    for row_number, cells in rows:
        raw_code = cells[emp_col] if emp_col < len(cells) else None
        if raw_code is None:
            errors.append(EntryError(row=row_number, message="Employee code is empty"))
            continue
        emp_code = str(int(raw_code) if isinstance(raw_code, float) else raw_code).strip().upper()
        if emp_code in seen_rows:
            errors.append(EntryError(row=row_number, emp_code=emp_code, message=f"Employee also on row {seen_rows[emp_code]}"))
            continue
        seen_rows[emp_code] = row_number
        for index, comp_code in columns.items():
            value = cells[index] if index < len(cells) else None
            if value is None:
                continue
            try:
                entries.append((emp_code, comp_code, _money.validate_python(value)))
            except ValidationError as exc:
                errors.append(EntryError(row=row_number, emp_code=emp_code, comp_code=comp_code, message=exc.errors()[0]["msg"]))

    result = TransactionImportResult(saved=False, dry_run=dry_run, total_rows=len(rows), values_set=0, errors=errors)
    if errors or not entries:
        return result
    try:
        result.values_set = apply_entries(db, org.org_code, month_year, entries)
    except UnprocessableError as exc:
        db.rollback()
        result.errors = [
            EntryError(row=seen_rows.get(e["emp_code"]), **e) for e in exc.detail
        ]
        return result
    if dry_run:
        db.rollback()
        return result
    db.commit()
    result.saved = True
    return result
