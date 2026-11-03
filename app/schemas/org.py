from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator

from app.models.org import PayslipLayout, PolicyMode, TemplateType
from app.schemas.common import Code, NonEmptyStr


# ---------- Organisation ----------

class OrgBase(BaseModel):
    org_name: NonEmptyStr = Field(max_length=150)
    org_address: str | None = None
    org_location: str | None = Field(default=None, max_length=150)
    org_email: EmailStr | None = None
    policy_mode: PolicyMode = PolicyMode.FINAL
    payslip_template: PayslipLayout = PayslipLayout.SIMPLE


class OrgCreate(OrgBase):
    org_code: Code


class OrgUpdate(BaseModel):
    """All fields optional; org_code cannot be changed."""

    org_name: NonEmptyStr | None = Field(default=None, max_length=150)
    org_address: str | None = None
    org_location: str | None = Field(default=None, max_length=150)
    org_email: EmailStr | None = None
    policy_mode: PolicyMode | None = None
    payslip_template: PayslipLayout | None = None


class OrgRead(OrgBase):
    model_config = ConfigDict(from_attributes=True)

    org_code: str
    org_email: str | None = None
    active_emp_count: int
    created_at: datetime
    updated_at: datetime


# ---------- Designations ----------

class DesignationCreate(BaseModel):
    designation_code: Code
    designation_name: NonEmptyStr = Field(max_length=100)


class DesignationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    designation_code: str
    designation_name: str
    created_at: datetime


class OrgDesignationAssign(BaseModel):
    """Assign a designation to an org. If the code is new, designation_name is required and it is created."""

    designation_code: Code
    designation_name: NonEmptyStr | None = Field(default=None, max_length=100)
    effective_from: date | None = None
    effective_to: date | None = None

    @model_validator(mode="after")
    def check_dates(self):
        if self.effective_from and self.effective_to and self.effective_to < self.effective_from:
            raise ValueError("effective_to must be on or after effective_from")
        return self


class OrgDesignationToggle(BaseModel):
    is_active: bool


class OrgDesignationRead(BaseModel):
    designation_code: str
    designation_name: str
    is_active: bool
    effective_from: date | None
    effective_to: date | None
    employee_count: int


class DesignationAvailability(BaseModel):
    designation_code: str
    designation_name: str
    assigned: bool
    is_active: bool


# ---------- Templates ----------

class TemplateUpdate(BaseModel):
    subject: str | None = Field(default=None, max_length=255)
    body: NonEmptyStr | None = None


class TemplateRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    org_code: str
    template_type: TemplateType
    subject: str | None
    body: str
    is_locked: bool
    locked_at: datetime | None
    locked_by: int | None
    updated_at: datetime
