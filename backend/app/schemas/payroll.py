from datetime import date, datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.payroll import ComponentType, EmailStatus, PayrollStatus
from app.schemas.common import Code, Money, MoneyOut, NonEmptyStr


# ---------- Components (page 4) ----------

class ComponentCreate(BaseModel):
    comp_code: Code
    comp_name: NonEmptyStr = Field(max_length=150)
    comp_type: ComponentType


class ComponentUpdate(BaseModel):
    comp_name: NonEmptyStr | None = Field(default=None, max_length=150)
    comp_type: ComponentType | None = None


class ComponentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    comp_code: str
    comp_name: str
    comp_type: ComponentType
    created_at: datetime


class ComponentUsage(ComponentRead):
    transaction_count: int
    employee_count: int


# ---------- Employee salary structure ----------

class SalaryItem(BaseModel):
    comp_code: Code
    monthly_amount: Money


class SalaryStructureUpdate(BaseModel):
    """Replaces the employee's whole structure. Only EARNING and DEDUCTION components are allowed."""

    items: list[SalaryItem]


class SalaryItemRead(BaseModel):
    comp_code: str
    comp_name: str
    comp_type: ComponentType
    monthly_amount: MoneyOut


class SalaryStructureRead(BaseModel):
    org_code: str
    emp_code: str
    items: list[SalaryItemRead]
    monthly_earnings: MoneyOut
    monthly_deductions: MoneyOut
    monthly_net: MoneyOut


# ---------- Transactions (page 5) ----------

class TransactionEntry(BaseModel):
    emp_code: Code
    comp_code: Code
    # null removes the value
    amount: Money | None


class TransactionBulkUpdate(BaseModel):
    entries: list[TransactionEntry] = Field(min_length=1)


class GridRow(BaseModel):
    emp_code: str
    emp_name: str
    designation_name: str | None
    employment_status: str
    values: dict[str, MoneyOut]
    gross_earnings: MoneyOut
    total_deductions: MoneyOut
    net_pay: MoneyOut


class GridTotals(BaseModel):
    values: dict[str, MoneyOut]
    gross_earnings: MoneyOut
    total_deductions: MoneyOut
    net_pay: MoneyOut


class TransactionGrid(BaseModel):
    org_code: str
    month_year: str
    policy_mode: str
    payroll_status: PayrollStatus
    editable: bool
    components: list[ComponentRead]
    rows: list[GridRow]
    totals: GridTotals


class EntryError(BaseModel):
    emp_code: str | None = None
    comp_code: str | None = None
    row: int | None = None
    message: str


class TransactionImportResult(BaseModel):
    saved: bool
    dry_run: bool
    total_rows: int
    values_set: int
    errors: list[EntryError]


class CalculateResult(BaseModel):
    month_year: str
    days_in_month: int
    employees_calculated: int
    transactions_written: int
    warnings: list[str]


# ---------- Payroll (process / lock) ----------

class PayrollSummaryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    org_code: str
    month_year: str
    gross_payroll: MoneyOut
    total_deductions: MoneyOut
    net_payroll: MoneyOut
    status: PayrollStatus
    created_at: datetime
    updated_at: datetime


class PayrollProcessResult(BaseModel):
    summary: PayrollSummaryRead
    employee_count: int
    warnings: list[str]


# ---------- Payslips (page 6) ----------

class PayslipLine(BaseModel):
    comp_code: str
    comp_name: str
    amount: MoneyOut


class PayslipRead(BaseModel):
    org_code: str
    org_name: str
    month_year: str
    month_label: str
    payroll_status: PayrollStatus
    emp_code: str
    emp_name: str
    email: str | None
    designation_name: str | None
    location: str | None
    date_of_joining: date | None
    pan_no: str | None
    bank_name: str | None
    bank_ac_no: str | None
    ifsc_code: str | None
    attendance: list[PayslipLine]
    earnings: list[PayslipLine]
    deductions: list[PayslipLine]
    gross_earnings: MoneyOut
    total_deductions: MoneyOut
    net_pay: MoneyOut
    net_pay_words: str
    email_status: EmailStatus | None = None
    email_sent_date: datetime | None = None


class SendPayslipsRequest(BaseModel):
    # Selected employees; omit or empty to send to everyone in the month
    emp_codes: list[Code] | None = None
    # Re-send to employees whose payslip was already sent
    resend: bool = False
    # Email entered on the send screen, with {{placeholders}}; not stored. Omit to use the default text.
    # from_email falls back to the organisation's email, then EMAIL_FROM.
    from_email: EmailStr | None = None
    subject: str | None = Field(default=None, max_length=255)
    body: str | None = None


class SendPayslipsResult(BaseModel):
    queued: int
    skipped: list[EntryError]


class PayslipEmailRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    org_code: str
    emp_code: str
    month_year: str
    email_name: str
    sent_date: datetime | None
    status: EmailStatus
    error_message: str | None
    created_at: datetime


# ---------- Dashboard (page 1) ----------

class CountItem(BaseModel):
    key: str
    label: str
    count: int


class MonthTrend(BaseModel):
    month_year: str
    gross_payroll: MoneyOut
    total_deductions: MoneyOut
    net_payroll: MoneyOut
    status: PayrollStatus | None


class EmailStats(BaseModel):
    pending: int = 0
    sent: int = 0
    failed: int = 0


class DashboardRead(BaseModel):
    org_code: str
    org_name: str
    month_year: str
    active_employees: int
    total_employees: int
    employees_by_status: list[CountItem]
    employees_by_designation: list[CountItem]
    payroll: MonthTrend
    payroll_trend: list[MonthTrend]
    emails: EmailStats
    new_joiners: int
    leavers: int


# ---------- Audit ----------

class AuditLogRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    uuid: UUID
    org_code: str | None
    table_name: str
    record_key: dict[str, Any]
    action: str
    before_image: dict[str, Any] | None
    after_image: dict[str, Any] | None
    changed_by: int | None
    created_at: datetime


class AuditLogList(BaseModel):
    items: list[AuditLogRead]
    total: int
    skip: int
    limit: int
