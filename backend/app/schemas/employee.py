from datetime import date, datetime
from typing import Annotated, Any, Literal

from pydantic import BaseModel, BeforeValidator, ConfigDict, EmailStr, Field, StringConstraints, model_validator

from app.models.employee import EmploymentStatus
from app.schemas.common import (
    Code,
    FlexibleDate,
    FormModel,
    Money,
    MoneyOut,
    NonEmptyStr,
    compact_number,
    upper_strip,
)


def _normalize_blood_group(value: Any) -> Any:
    return value.replace(" ", "").upper() if isinstance(value, str) else value


BloodGroup = Annotated[
    Literal["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"], BeforeValidator(_normalize_blood_group)
]
Phone = Annotated[
    str,
    BeforeValidator(lambda v: str(int(v)) if isinstance(v, (int, float)) else v),
    StringConstraints(strip_whitespace=True, max_length=20, pattern=r"^\+?[0-9][0-9 \-]{5,19}$"),
]
PAN = Annotated[str, BeforeValidator(upper_strip), StringConstraints(pattern=r"^[A-Z]{5}[0-9]{4}[A-Z]$")]
Aadhaar = Annotated[str, BeforeValidator(compact_number), StringConstraints(pattern=r"^[0-9]{12}$")]
IFSC = Annotated[str, BeforeValidator(upper_strip), StringConstraints(pattern=r"^[A-Z]{4}0[A-Z0-9]{6}$")]
AccountNo = Annotated[str, BeforeValidator(compact_number), StringConstraints(pattern=r"^[A-Za-z0-9]{4,50}$")]


class BankDetailsIn(FormModel):
    bank_name: str | None = Field(default=None, max_length=150)
    bank_ac_no: AccountNo | None = None
    branch_name: str | None = Field(default=None, max_length=150)
    ifsc_code: IFSC | None = None


class EducationIn(FormModel):
    qualification: str | None = Field(default=None, max_length=100)
    school_college_name: str | None = Field(default=None, max_length=200)
    course_name: str | None = Field(default=None, max_length=150)
    duration: str | None = Field(default=None, max_length=50)
    cgpa_percentage: str | None = Field(default=None, max_length=30)


class EmployeeBase(FormModel):
    emp_name: NonEmptyStr = Field(max_length=150)
    email: EmailStr | None = None
    designation_code: Code | None = None
    location: str | None = Field(default=None, max_length=150)
    dob: FlexibleDate | None = None
    address: str | None = None
    contact: Phone | None = None
    emergency_contact: Phone | None = None
    blood_group: BloodGroup | None = None
    date_of_joining: FlexibleDate | None = None
    pan_no: PAN | None = None
    aadhar_no: Aadhaar | None = None
    date_of_leaving: FlexibleDate | None = None
    # Blank/null means 0 and ACTIVE respectively
    gross_salary: Money | None = None
    employment_status: EmploymentStatus | None = None
    bank: BankDetailsIn | None = None
    # Every education entry, in order; sending a list replaces the saved ones. Empty entries are dropped.
    education: list[EducationIn] | None = Field(default=None, max_length=20)

    @model_validator(mode="after")
    def check_dates(self):
        if self.dob and self.dob >= date.today():
            raise ValueError("Date of birth must be in the past")
        if self.date_of_joining and self.date_of_leaving and self.date_of_leaving < self.date_of_joining:
            raise ValueError("Date of leaving cannot be before date of joining")
        return self


class EmployeeCreate(EmployeeBase):
    emp_code: Code


class EmployeeUpdate(EmployeeBase):
    """Edit form. Fields that are not sent keep their current value; emp_code cannot change."""


class BankDetailsRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    bank_name: str | None
    bank_ac_no: str | None
    branch_name: str | None
    ifsc_code: str | None


class EducationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    qualification: str | None
    school_college_name: str | None
    course_name: str | None
    duration: str | None
    cgpa_percentage: str | None


class EmployeeRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    org_code: str
    emp_code: str
    emp_name: str
    email: str | None
    designation_code: str | None
    designation_name: str | None
    location: str | None
    dob: date | None
    address: str | None
    contact: str | None
    emergency_contact: str | None
    blood_group: str | None
    date_of_joining: date | None
    pan_no: str | None
    aadhar_no: str | None
    date_of_leaving: date | None
    gross_salary: MoneyOut
    employment_status: str
    bank: BankDetailsRead | None
    education: list[EducationRead]
    created_at: datetime
    updated_at: datetime


class EmployeeList(BaseModel):
    items: list[EmployeeRead]
    total: int
    skip: int
    limit: int


class ImportRowError(BaseModel):
    row: int
    emp_code: str | None
    errors: list[str]


class ImportResult(BaseModel):
    saved: bool
    dry_run: bool
    total_rows: int
    created: int
    updated: int
    errors: list[ImportRowError]
