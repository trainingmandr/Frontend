import re
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.employee import BankDetails, EducationDetails, EmpDetails, EmploymentStatus
from app.models.org import OrgDesignation
from app.schemas.employee import EmployeeRead
from app.services import spreadsheet

BANK_FIELDS = ("bank_name", "bank_ac_no", "branch_name", "ifsc_code")
EDUCATION_FIELDS = ("qualification", "school_college_name", "course_name", "duration", "cgpa_percentage")

# Column order for export, import and the import template
EMPLOYEE_COLUMNS: list[tuple[str, str]] = [
    ("emp_code", "Employee Code"),
    ("emp_name", "Name"),
    ("designation_code", "Designation Code"),
    ("designation_name", "Designation"),
    ("email", "Email"),
    ("location", "Location"),
    ("gross_salary", "Monthly Gross Salary"),
    ("employment_status", "Status"),
    ("date_of_joining", "Date of Joining"),
    ("date_of_leaving", "Date of Leaving"),
    ("dob", "Date of Birth"),
    ("contact", "Contact Number"),
    ("emergency_contact", "Emergency Contact Number"),
    ("blood_group", "Blood Group"),
    ("address", "Address"),
    ("pan_no", "PAN"),
    ("aadhar_no", "Aadhaar"),
    ("bank_name", "Bank Name"),
    ("bank_ac_no", "Bank Account No"),
    ("branch_name", "Branch Name"),
    ("ifsc_code", "IFSC"),
    ("qualification", "Qualification"),
    ("school_college_name", "School / College"),
    ("course_name", "Course"),
    ("duration", "Duration"),
    ("cgpa_percentage", "CGPA / Percentage"),
]
EMPLOYEE_HEADERS = [label for _, label in EMPLOYEE_COLUMNS]

HEADER_ALIASES = {
    "employee_id": "emp_code",
    "emp_id": "emp_code",
    "employee_name": "emp_name",
    "monthly_components": "gross_salary",
    "gross_salary": "gross_salary",
    "salary": "gross_salary",
    "aadhar": "aadhar_no",
    "aadhaar_no": "aadhar_no",
    "account_no": "bank_ac_no",
    "contact": "contact",
    "mobile": "contact",
    "phone": "contact",
}


def normalize_header(header: Any) -> str:
    return re.sub(r"[^a-z0-9]+", "_", str(header).strip().lower()).strip("_")


HEADER_MAP: dict[str, str] = {}
for _key, _label in EMPLOYEE_COLUMNS:
    HEADER_MAP[normalize_header(_key)] = _key
    HEADER_MAP[normalize_header(_label)] = _key
HEADER_MAP.update(HEADER_ALIASES)


def employee_query(org_code: str):
    return (
        select(EmpDetails)
        .options(selectinload(EmpDetails.bank), selectinload(EmpDetails.education))
        .where(EmpDetails.org_code == org_code)
    )


def get_employee(db: Session, org_code: str, emp_code: str) -> EmpDetails | None:
    return db.scalar(employee_query(org_code).where(EmpDetails.emp_code == emp_code.upper()))


def mask(value: str | None) -> str | None:
    if not value or len(value) <= 4:
        return value
    return "X" * (len(value) - 4) + value[-4:]


def to_read(emp: EmpDetails, mask_sensitive: bool = False) -> EmployeeRead:
    read = EmployeeRead.model_validate(emp)
    if not mask_sensitive:
        return read
    update: dict[str, Any] = {"pan_no": mask(read.pan_no), "aadhar_no": mask(read.aadhar_no)}
    if read.bank:
        update["bank"] = read.bank.model_copy(update={"bank_ac_no": mask(read.bank.bank_ac_no)})
    return read.model_copy(update=update)


def designation_error(db: Session, org_code: str, designation_code: str | None, current: str | None = None) -> str | None:
    """Return an error message if the designation can't be given to an employee of this org."""
    if designation_code is None or designation_code == current:
        return None
    mapping = db.get(OrgDesignation, (org_code, designation_code))
    if mapping is None:
        return f"Designation '{designation_code}' is not assigned to organisation '{org_code}'"
    if not mapping.is_active:
        return f"Designation '{designation_code}' is inactive for organisation '{org_code}'"
    return None


def apply_employee(emp: EmpDetails, data: dict[str, Any]) -> None:
    """Copy validated fields (from model_dump) onto the ORM object, including nested bank/education."""
    data = dict(data)
    data.pop("emp_code", None)
    has_bank, bank = "bank" in data, data.pop("bank", None)
    has_education, education = "education" in data, data.pop("education", None)

    for field, value in data.items():
        if field == "gross_salary" and value is None:
            value = 0
        elif field == "employment_status":
            value = EmploymentStatus(value).value if value else EmploymentStatus.ACTIVE.value
        setattr(emp, field, value)

    if has_bank:
        emp.bank = _merge(emp.bank, BankDetails, bank)
    if has_education:
        _replace_education(emp, education or [])


def _replace_education(emp: EmpDetails, entries: list[dict[str, Any]]) -> None:
    """Make the saved entries match `entries`, numbered 1, 2, 3... Existing rows are updated in place
    (not deleted and re-inserted) so their primary keys never collide within one flush."""
    entries = [e for e in entries if any(v is not None for v in e.values())]
    current = list(emp.education)
    for number, values in enumerate(entries, start=1):
        if number <= len(current):
            for field, value in values.items():
                setattr(current[number - 1], field, value)
        else:
            emp.education.append(EducationDetails(entry_no=number, **values))
    del emp.education[len(entries):]


def _merge(current, model, values: dict[str, Any] | None):
    if values is None or not any(v is not None for v in values.values()):
        return None
    if current is None:
        return model(**values)
    for field, value in values.items():
        setattr(current, field, value)
    return current


# ---------- Import ----------

def read_upload(filename: str, content: bytes) -> list[tuple[int, dict[str, Any]]]:
    """Parse an .xlsx or .csv upload into (sheet row number, {field: value}) pairs. Raises ValueError."""
    header_row, raw_rows = spreadsheet.read_table(filename, content)
    headers = [HEADER_MAP.get(normalize_header(h)) if h is not None else None for h in header_row]
    if "emp_code" not in headers or "emp_name" not in headers:
        raise ValueError("The file must have 'Employee Code' and 'Name' columns")
    return [
        (row_number, {key: value for key, value in zip(headers, cells) if key is not None})
        for row_number, cells in raw_rows
    ]


def row_to_payload(record: dict[str, Any], designation_names: dict[str, str]) -> dict[str, Any]:
    """Shape a flat spreadsheet row like the API body (nested bank / education, designation by name)."""
    data = dict(record)
    designation_name = data.pop("designation_name", None)
    if not data.get("designation_code") and designation_name:
        data["designation_code"] = designation_names.get(str(designation_name).strip().lower(), designation_name)
    for key in ("emp_code", "designation_code"):
        if isinstance(data.get(key), (int, float)):
            data[key] = str(int(data[key]))
    bank = {f: data.pop(f) for f in BANK_FIELDS if f in data}
    education = {f: data.pop(f) for f in EDUCATION_FIELDS if f in data}
    if bank:
        data["bank"] = bank
    if education:
        # A spreadsheet row holds one education entry
        data["education"] = [education]
    return data


# ---------- Export ----------

def _export_value(emp: EmployeeRead, key: str) -> Any:
    if key in BANK_FIELDS:
        return getattr(emp.bank, key) if emp.bank else None
    if key in EDUCATION_FIELDS:
        # The sheet has one set of education columns; several entries are joined with " | "
        values = [getattr(entry, key) or "" for entry in emp.education]
        return " | ".join(values) if any(values) else None
    value = getattr(emp, key)
    return float(value) if key == "gross_salary" else value


def export_rows(employees: list[EmployeeRead]) -> list[list[Any]]:
    return [[_export_value(emp, key) for key, _ in EMPLOYEE_COLUMNS] for emp in employees]
