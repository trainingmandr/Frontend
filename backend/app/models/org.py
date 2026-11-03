import enum
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, CreatedAtMixin, TimestampMixin


class PolicyMode(str, enum.Enum):
    FINAL = "FINAL"
    CALCULATE = "CALCULATE"


class PayslipLayout(str, enum.Enum):
    SIMPLE = "SIMPLE"
    DETAILED = "DETAILED"


class TemplateType(str, enum.Enum):
    # The email subject and message are not stored; they are sent with each send request
    PAYSLIP = "PAYSLIP"

    @classmethod
    def _missing_(cls, value: object):
        # Accept "payslip", "Payslip" etc. in URLs
        if isinstance(value, str):
            return cls.__members__.get(value.upper())
        return None


class OrgSetup(TimestampMixin, Base):
    __tablename__ = "org_setup"

    org_code: Mapped[str] = mapped_column(String(30), primary_key=True)
    org_name: Mapped[str] = mapped_column(String(150), nullable=False)
    org_address: Mapped[str | None] = mapped_column(Text)
    org_location: Mapped[str | None] = mapped_column(String(150))
    org_email: Mapped[str | None] = mapped_column(String(150))
    # Maintained by the trg_sync_active_employee_count trigger; never written by the API
    active_emp_count: Mapped[int] = mapped_column(Integer, server_default="0", nullable=False)
    policy_mode: Mapped[str] = mapped_column(String(20), server_default=PolicyMode.FINAL.value, nullable=False)
    payslip_template: Mapped[str] = mapped_column(
        String(20), server_default=PayslipLayout.SIMPLE.value, nullable=False
    )
    created_on: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class Designation(CreatedAtMixin, Base):
    __tablename__ = "designation"

    designation_code: Mapped[str] = mapped_column(String(30), primary_key=True)
    designation_name: Mapped[str] = mapped_column(String(100), nullable=False)


class OrgDesignation(CreatedAtMixin, Base):
    __tablename__ = "org_designation"

    org_code: Mapped[str] = mapped_column(String(30), ForeignKey("org_setup.org_code"), primary_key=True)
    designation_code: Mapped[str] = mapped_column(
        String(30), ForeignKey("designation.designation_code"), primary_key=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, server_default="true", default=True, nullable=False)
    effective_from: Mapped[date | None] = mapped_column(Date)
    effective_to: Mapped[date | None] = mapped_column(Date)


class OrgTemplate(TimestampMixin, Base):
    __tablename__ = "org_template"

    org_code: Mapped[str] = mapped_column(String(30), ForeignKey("org_setup.org_code"), primary_key=True)
    template_type: Mapped[str] = mapped_column(String(20), primary_key=True)
    subject: Mapped[str | None] = mapped_column(String(255))
    body: Mapped[str] = mapped_column(Text, nullable=False)
    is_locked: Mapped[bool] = mapped_column(Boolean, server_default="false", default=False, nullable=False)
    locked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    locked_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
