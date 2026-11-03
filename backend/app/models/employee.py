import enum
from datetime import date
from decimal import Decimal

from sqlalchemy import Date, ForeignKey, ForeignKeyConstraint, Numeric, SmallInteger, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, CreatedAtMixin, TimestampMixin
from app.models.org import Designation


class EmploymentStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    RESIGNED = "RESIGNED"
    TERMINATED = "TERMINATED"

    @classmethod
    def _missing_(cls, value: object):
        if isinstance(value, str):
            return cls.__members__.get(value.strip().upper())
        return None


class EmpDetails(TimestampMixin, Base):
    __tablename__ = "emp_details"
    __table_args__ = (
        ForeignKeyConstraint(
            ["org_code", "designation_code"],
            ["org_designation.org_code", "org_designation.designation_code"],
        ),
    )

    org_code: Mapped[str] = mapped_column(String(30), ForeignKey("org_setup.org_code"), primary_key=True)
    emp_code: Mapped[str] = mapped_column(String(30), primary_key=True)
    emp_name: Mapped[str] = mapped_column(String(150), nullable=False)
    email: Mapped[str | None] = mapped_column(String(150))
    designation_code: Mapped[str | None] = mapped_column(String(30))
    location: Mapped[str | None] = mapped_column(String(150))
    dob: Mapped[date | None] = mapped_column(Date)
    address: Mapped[str | None] = mapped_column(Text)
    contact: Mapped[str | None] = mapped_column(String(20))
    emergency_contact: Mapped[str | None] = mapped_column(String(20))
    blood_group: Mapped[str | None] = mapped_column(String(10))
    date_of_joining: Mapped[date | None] = mapped_column(Date)
    pan_no: Mapped[str | None] = mapped_column(String(20))
    aadhar_no: Mapped[str | None] = mapped_column(String(20))
    date_of_leaving: Mapped[date | None] = mapped_column(Date)
    gross_salary: Mapped[Decimal] = mapped_column(Numeric(15, 2), server_default="0", default=0, nullable=False)
    employment_status: Mapped[str] = mapped_column(
        String(20), server_default=EmploymentStatus.ACTIVE.value, default=EmploymentStatus.ACTIVE.value, nullable=False
    )

    designation: Mapped[Designation | None] = relationship(
        primaryjoin="foreign(EmpDetails.designation_code) == Designation.designation_code",
        viewonly=True,
        lazy="joined",
    )
    bank: Mapped["BankDetails | None"] = relationship(cascade="all, delete-orphan", lazy="selectin")
    education: Mapped[list["EducationDetails"]] = relationship(
        cascade="all, delete-orphan", lazy="selectin", order_by="EducationDetails.entry_no"
    )

    @property
    def designation_name(self) -> str | None:
        return self.designation.designation_name if self.designation else None


class BankDetails(CreatedAtMixin, Base):
    __tablename__ = "bank_details"
    __table_args__ = (
        ForeignKeyConstraint(["org_code", "emp_code"], ["emp_details.org_code", "emp_details.emp_code"]),
    )

    org_code: Mapped[str] = mapped_column(String(30), primary_key=True)
    emp_code: Mapped[str] = mapped_column(String(30), primary_key=True)
    bank_name: Mapped[str | None] = mapped_column(String(150))
    bank_ac_no: Mapped[str | None] = mapped_column(String(50))
    branch_name: Mapped[str | None] = mapped_column(String(150))
    ifsc_code: Mapped[str | None] = mapped_column(String(20))


class EducationDetails(CreatedAtMixin, Base):
    __tablename__ = "education_details"
    __table_args__ = (
        ForeignKeyConstraint(["org_code", "emp_code"], ["emp_details.org_code", "emp_details.emp_code"]),
    )

    org_code: Mapped[str] = mapped_column(String(30), primary_key=True)
    emp_code: Mapped[str] = mapped_column(String(30), primary_key=True)
    # 1, 2, 3... in the order the entries were entered; an employee can have several
    entry_no: Mapped[int] = mapped_column(SmallInteger, primary_key=True, default=1)
    qualification: Mapped[str | None] = mapped_column(String(100))
    school_college_name: Mapped[str | None] = mapped_column(String(200))
    course_name: Mapped[str | None] = mapped_column(String(150))
    duration: Mapped[str | None] = mapped_column(String(50))
    cgpa_percentage: Mapped[str | None] = mapped_column(String(30))
