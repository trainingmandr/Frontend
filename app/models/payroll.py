import enum
from datetime import datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, ForeignKeyConstraint, Integer, Numeric, String, Text, Uuid, func, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, CreatedAtMixin, TimestampMixin


class ComponentType(str, enum.Enum):
    ATTENDANCE = "ATTENDANCE"
    EARNING = "EARNING"
    DEDUCTION = "DEDUCTION"
    SPECIAL_EARNING = "SPECIAL_EARNING"
    SPECIAL_DEDUCTION = "SPECIAL_DEDUCTION"

    @classmethod
    def _missing_(cls, value: object):
        if isinstance(value, str):
            return cls.__members__.get(value.strip().upper().replace(" ", "_"))
        return None


EARNING_TYPES = {ComponentType.EARNING.value, ComponentType.SPECIAL_EARNING.value}
DEDUCTION_TYPES = {ComponentType.DEDUCTION.value, ComponentType.SPECIAL_DEDUCTION.value}
# Types that can be part of an employee's fixed monthly salary structure
STRUCTURE_TYPES = {ComponentType.EARNING.value, ComponentType.DEDUCTION.value}
# Display order: attendance, earnings, deductions
TYPE_ORDER = {t.value: i for i, t in enumerate(
    [ComponentType.ATTENDANCE, ComponentType.EARNING, ComponentType.SPECIAL_EARNING,
     ComponentType.DEDUCTION, ComponentType.SPECIAL_DEDUCTION]
)}

# Attendance component codes the calculation engine understands
PAID_DAYS_CODE = "PAID_DAYS"
LOP_DAYS_CODE = "LOP_DAYS"


class PayrollStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    PROCESSED = "PROCESSED"
    LOCKED = "LOCKED"


class EmailStatus(str, enum.Enum):
    PENDING = "PENDING"
    SENT = "SENT"
    FAILED = "FAILED"


class Component(CreatedAtMixin, Base):
    __tablename__ = "components"

    comp_code: Mapped[str] = mapped_column(String(30), primary_key=True)
    comp_name: Mapped[str] = mapped_column(String(150), nullable=False)
    comp_type: Mapped[str] = mapped_column(String(30), nullable=False)


class EmpSalaryComponent(TimestampMixin, Base):
    """Employee's standard monthly amount per component (used by CALCULATE policy mode)."""

    __tablename__ = "emp_salary_components"
    __table_args__ = (
        ForeignKeyConstraint(["org_code", "emp_code"], ["emp_details.org_code", "emp_details.emp_code"]),
    )

    org_code: Mapped[str] = mapped_column(String(30), primary_key=True)
    emp_code: Mapped[str] = mapped_column(String(30), primary_key=True)
    comp_code: Mapped[str] = mapped_column(String(30), ForeignKey("components.comp_code"), primary_key=True)
    monthly_amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False, default=0)


class Transaction(CreatedAtMixin, Base):
    __tablename__ = "transactions"
    __table_args__ = (
        ForeignKeyConstraint(["org_code", "emp_code"], ["emp_details.org_code", "emp_details.emp_code"]),
    )

    org_code: Mapped[str] = mapped_column(String(30), primary_key=True)
    emp_code: Mapped[str] = mapped_column(String(30), primary_key=True)
    comp_code: Mapped[str] = mapped_column(String(30), ForeignKey("components.comp_code"), primary_key=True)
    month_year: Mapped[str] = mapped_column(String(7), primary_key=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False, default=0)
    created_on: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class PayrollSummary(TimestampMixin, Base):
    __tablename__ = "payroll_summary"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, server_default=text("gen_random_uuid()"))
    org_code: Mapped[str] = mapped_column(String(30), ForeignKey("org_setup.org_code"), nullable=False)
    month_year: Mapped[str] = mapped_column(String(7), nullable=False)
    gross_payroll: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False, default=0)
    total_deductions: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False, default=0)
    net_payroll: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False, default=0)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default=PayrollStatus.DRAFT.value)


class PayslipEmail(CreatedAtMixin, Base):
    __tablename__ = "payslip_email"
    __table_args__ = (
        ForeignKeyConstraint(["org_code", "emp_code"], ["emp_details.org_code", "emp_details.emp_code"]),
    )

    org_code: Mapped[str] = mapped_column(String(30), primary_key=True)
    emp_code: Mapped[str] = mapped_column(String(30), primary_key=True)
    month_year: Mapped[str] = mapped_column(String(7), primary_key=True)
    # Recipient email address
    email_name: Mapped[str] = mapped_column(String(255), nullable=False)
    sent_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(20), nullable=False, default=EmailStatus.PENDING.value)
    error_message: Mapped[str | None] = mapped_column(Text)


class AuditLog(Base):
    __tablename__ = "audit_log"

    # Column name from the supplied schema
    uuid: Mapped[UUID] = mapped_column(Uuid, primary_key=True, server_default=text("gen_random_uuid()"))
    org_code: Mapped[str | None] = mapped_column(String(30), ForeignKey("org_setup.org_code"))
    table_name: Mapped[str] = mapped_column(String(100), nullable=False)
    record_key: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    action: Mapped[str] = mapped_column(String(20), nullable=False)
    before_image: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    after_image: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    changed_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_on: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
