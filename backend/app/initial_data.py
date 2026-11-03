"""Creates the default admin account and the standard salary components if they do not exist."""

import logging

from sqlalchemy import select

from app.core.config import settings
from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models.payroll import LOP_DAYS_CODE, PAID_DAYS_CODE, Component, ComponentType
from app.models.user import Role, User

logger = logging.getLogger(__name__)

DEFAULT_COMPONENTS: list[tuple[str, str, ComponentType]] = [
    (PAID_DAYS_CODE, "Paid Days", ComponentType.ATTENDANCE),
    (LOP_DAYS_CODE, "Loss of Pay Days", ComponentType.ATTENDANCE),
    ("BASIC", "Basic Salary", ComponentType.EARNING),
    ("HRA", "House Rent Allowance", ComponentType.EARNING),
    ("CONVEYANCE", "Conveyance Allowance", ComponentType.EARNING),
    ("SPECIAL_ALLOWANCE", "Special Allowance", ComponentType.EARNING),
    ("PF", "Provident Fund", ComponentType.DEDUCTION),
    ("ESI", "Employee State Insurance", ComponentType.DEDUCTION),
    ("PT", "Professional Tax", ComponentType.DEDUCTION),
    ("TDS", "Income Tax (TDS)", ComponentType.DEDUCTION),
    ("BONUS", "Bonus", ComponentType.SPECIAL_EARNING),
    ("INCENTIVE", "Incentive", ComponentType.SPECIAL_EARNING),
    ("ADVANCE", "Salary Advance Recovery", ComponentType.SPECIAL_DEDUCTION),
]


def seed_admin() -> None:
    email = settings.ADMIN_EMAIL.lower()
    with SessionLocal() as db:
        if db.scalar(select(User).where(User.email == email)) is not None:
            return
        db.add(
            User(
                email=email,
                full_name=settings.ADMIN_FULL_NAME,
                hashed_password=hash_password(settings.ADMIN_PASSWORD),
                role=Role.ADMIN,
            )
        )
        db.commit()
        logger.info("Created default admin user %s", email)


def seed_components() -> None:
    """Only seeds an empty components table, so deleted/renamed components are not recreated."""
    with SessionLocal() as db:
        if db.scalar(select(Component.comp_code).limit(1)) is not None:
            return
        db.add_all(Component(comp_code=c, comp_name=n, comp_type=t.value) for c, n, t in DEFAULT_COMPONENTS)
        db.commit()
        logger.info("Created %d default salary components", len(DEFAULT_COMPONENTS))


def seed_initial_data() -> None:
    seed_admin()
    seed_components()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    seed_initial_data()
