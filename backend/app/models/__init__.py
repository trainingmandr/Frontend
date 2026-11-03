# Import every model here so Alembic autogenerate can see it
from app.models.employee import BankDetails, EducationDetails, EmpDetails, EmploymentStatus
from app.models.org import Designation, OrgDesignation, OrgSetup, OrgTemplate, PayslipLayout, PolicyMode, TemplateType
from app.models.payroll import (
    AuditLog,
    Component,
    ComponentType,
    EmailStatus,
    EmpSalaryComponent,
    PayrollStatus,
    PayrollSummary,
    PayslipEmail,
    Transaction,
)
from app.models.user import Role, User

__all__ = [
    "AuditLog",
    "BankDetails",
    "Component",
    "ComponentType",
    "Designation",
    "EducationDetails",
    "EmailStatus",
    "EmpDetails",
    "EmpSalaryComponent",
    "EmploymentStatus",
    "OrgDesignation",
    "OrgSetup",
    "OrgTemplate",
    "PayrollStatus",
    "PayrollSummary",
    "PayslipEmail",
    "PayslipLayout",
    "PolicyMode",
    "Role",
    "TemplateType",
    "Transaction",
    "User",
]
