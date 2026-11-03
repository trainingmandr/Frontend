from datetime import date
from typing import Literal

from fastapi import APIRouter, File, HTTPException, Query, Response, UploadFile, status
from pydantic import ValidationError
from sqlalchemy import Select, func, or_, select

from app.api.deps import CurrentOrg, CurrentUser, DbSession, EditorUser, is_masked
from app.models.employee import EmpDetails, EmploymentStatus
from app.models.org import Designation, OrgDesignation
from app.schemas.employee import (
    EmployeeCreate,
    EmployeeList,
    EmployeeRead,
    EmployeeUpdate,
    ImportResult,
    ImportRowError,
)
from app.services import spreadsheet
from app.services.employees import (
    EMPLOYEE_HEADERS,
    apply_employee,
    designation_error,
    employee_query,
    export_rows,
    get_employee,
    read_upload,
    row_to_payload,
    to_read,
)

# Mounted at /orgs/{org_code}/employees
router = APIRouter()

SortField = Literal["emp_code", "emp_name", "designation_code", "location", "gross_salary", "date_of_joining"]


_masked = is_masked


def _filtered(
    org_code: str,
    search: str | None,
    employment_status: EmploymentStatus | None,
    designation_code: str | None,
    emp_codes: list[str] | None = None,
) -> Select:
    query = employee_query(org_code)
    if search:
        pattern = f"%{search.strip()}%"
        designation_match = (
            select(Designation.designation_code).where(Designation.designation_name.ilike(pattern)).scalar_subquery()
        )
        query = query.where(
            or_(
                EmpDetails.emp_code.ilike(pattern),
                EmpDetails.emp_name.ilike(pattern),
                EmpDetails.email.ilike(pattern),
                EmpDetails.location.ilike(pattern),
                EmpDetails.contact.ilike(pattern),
                EmpDetails.designation_code.in_(designation_match),
            )
        )
    if employment_status:
        query = query.where(EmpDetails.employment_status == employment_status.value)
    if designation_code:
        query = query.where(EmpDetails.designation_code == designation_code.upper())
    if emp_codes:
        query = query.where(EmpDetails.emp_code.in_([c.upper() for c in emp_codes]))
    return query


@router.get("", response_model=EmployeeList)
def list_employees(
    org: CurrentOrg,
    db: DbSession,
    user: CurrentUser,
    search: str | None = Query(None, description="Matches code, name, email, designation, location or contact"),
    employment_status: EmploymentStatus | None = None,
    designation_code: str | None = None,
    sort_by: SortField = "emp_code",
    sort_dir: Literal["asc", "desc"] = "asc",
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
) -> EmployeeList:
    query = _filtered(org.org_code, search, employment_status, designation_code)
    total = db.scalar(select(func.count()).select_from(query.order_by(None).subquery())) or 0
    column = getattr(EmpDetails, sort_by)
    query = query.order_by(column.desc() if sort_dir == "desc" else column.asc(), EmpDetails.emp_code)
    employees = db.scalars(query.offset(skip).limit(limit)).unique().all()
    return EmployeeList(
        items=[to_read(e, _masked(user)) for e in employees], total=total, skip=skip, limit=limit
    )


@router.get("/export")
def export_employees(
    org: CurrentOrg,
    db: DbSession,
    user: CurrentUser,
    file_format: Literal["xlsx", "csv"] = Query("xlsx", alias="format"),
    emp_codes: list[str] | None = Query(None, description="Selected rows; omit to export everything that matches"),
    search: str | None = None,
    employment_status: EmploymentStatus | None = None,
    designation_code: str | None = None,
) -> Response:
    query = _filtered(org.org_code, search, employment_status, designation_code, emp_codes)
    employees = db.scalars(query.order_by(EmpDetails.emp_code)).unique().all()
    # Export the same (possibly masked) values the user sees on screen
    rows = export_rows([to_read(e, _masked(user)) for e in employees])
    filename = f"employees_{org.org_code}_{date.today():%Y%m%d}.{file_format}"
    if file_format == "csv":
        content, media_type = spreadsheet.to_csv(EMPLOYEE_HEADERS, rows), spreadsheet.CSV_MEDIA_TYPE
    else:
        content, media_type = spreadsheet.to_xlsx(EMPLOYEE_HEADERS, rows, "Employees"), spreadsheet.XLSX_MEDIA_TYPE
    return Response(content, media_type=media_type, headers=spreadsheet.file_response_headers(filename))


@router.get("/import-template")
def import_template(org: CurrentOrg, _: CurrentUser) -> Response:
    """Empty spreadsheet with the columns the import accepts."""
    return Response(
        spreadsheet.to_xlsx(EMPLOYEE_HEADERS, [], "Employees"),
        media_type=spreadsheet.XLSX_MEDIA_TYPE,
        headers=spreadsheet.file_response_headers(f"employee_import_template_{org.org_code}.xlsx"),
    )


@router.post("/import", response_model=ImportResult)
async def import_employees(
    org: CurrentOrg,
    db: DbSession,
    _: EditorUser,
    file: UploadFile = File(..., description=".xlsx or .csv using the import template columns"),
    dry_run: bool = Query(False, description="Only validate; nothing is saved"),
    update_existing: bool = Query(True, description="Update employees whose code already exists"),
) -> ImportResult:
    """All-or-nothing: if any row has an error, nothing is saved and every error is reported."""
    content = await file.read()
    if len(content) > spreadsheet.MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=status.HTTP_413_CONTENT_TOO_LARGE, detail="File is larger than 5 MB")
    try:
        rows = read_upload(file.filename or "", content)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(exc))

    designation_names = {
        name.lower(): code
        for code, name in db.execute(
            select(Designation.designation_code, Designation.designation_name)
            .join(OrgDesignation, OrgDesignation.designation_code == Designation.designation_code)
            .where(OrgDesignation.org_code == org.org_code)
        )
    }
    existing = {
        e.emp_code: e for e in db.scalars(employee_query(org.org_code)).unique().all()
    }

    errors: list[ImportRowError] = []
    valid: list[EmployeeCreate] = []
    seen: dict[str, int] = {}
    for row_number, record in rows:
        payload = row_to_payload(record, designation_names)
        raw_code = str(payload.get("emp_code") or "").strip().upper() or None
        try:
            employee = EmployeeCreate.model_validate(payload)
        except ValidationError as exc:
            messages = [f"{'.'.join(str(p) for p in err['loc']) or 'row'}: {err['msg']}" for err in exc.errors()]
            errors.append(ImportRowError(row=row_number, emp_code=raw_code, errors=messages))
            continue

        row_errors: list[str] = []
        if employee.emp_code in seen:
            row_errors.append(f"Duplicate employee code (also on row {seen[employee.emp_code]})")
        seen.setdefault(employee.emp_code, row_number)
        current = existing.get(employee.emp_code)
        if current is not None and not update_existing:
            row_errors.append("Employee code already exists")
        if message := designation_error(
            db, org.org_code, employee.designation_code, current.designation_code if current else None
        ):
            row_errors.append(message)
        if row_errors:
            errors.append(ImportRowError(row=row_number, emp_code=employee.emp_code, errors=row_errors))
        else:
            valid.append(employee)

    created = sum(1 for e in valid if e.emp_code not in existing)
    result = ImportResult(
        saved=False,
        dry_run=dry_run,
        total_rows=len(rows),
        created=created,
        updated=len(valid) - created,
        errors=errors,
    )
    if errors or dry_run or not valid:
        return result

    for employee in valid:
        emp = existing.get(employee.emp_code)
        if emp is None:
            emp = EmpDetails(org_code=org.org_code, emp_code=employee.emp_code)
            db.add(emp)
            apply_employee(emp, employee.model_dump())
        else:
            # Only overwrite the columns present in the file
            apply_employee(emp, employee.model_dump(exclude_unset=True))
    db.commit()
    result.saved = True
    return result


@router.post("", response_model=EmployeeRead, status_code=status.HTTP_201_CREATED)
def create_employee(body: EmployeeCreate, org: CurrentOrg, db: DbSession, user: EditorUser) -> EmployeeRead:
    if db.get(EmpDetails, (org.org_code, body.emp_code)) is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Employee '{body.emp_code}' already exists")
    if message := designation_error(db, org.org_code, body.designation_code):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=message)
    emp = EmpDetails(org_code=org.org_code, emp_code=body.emp_code)
    db.add(emp)
    apply_employee(emp, body.model_dump())
    db.commit()
    db.expire_all()
    return to_read(get_employee(db, org.org_code, body.emp_code), _masked(user))


@router.get("/{emp_code}", response_model=EmployeeRead)
def get_employee_detail(emp_code: str, org: CurrentOrg, db: DbSession, user: CurrentUser) -> EmployeeRead:
    emp = get_employee(db, org.org_code, emp_code)
    if emp is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Employee '{emp_code}' not found")
    return to_read(emp, _masked(user))


@router.put("/{emp_code}", response_model=EmployeeRead)
def update_employee(
    emp_code: str, body: EmployeeUpdate, org: CurrentOrg, db: DbSession, user: EditorUser
) -> EmployeeRead:
    emp = get_employee(db, org.org_code, emp_code)
    if emp is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Employee '{emp_code}' not found")
    data = body.model_dump(exclude_unset=True)
    if message := designation_error(db, org.org_code, data.get("designation_code"), emp.designation_code):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=message)
    apply_employee(emp, data)
    db.commit()
    db.expire_all()
    return to_read(get_employee(db, org.org_code, emp.emp_code), _masked(user))
