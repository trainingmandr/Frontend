"""employee salary structure

Per-employee standard monthly amount per component, used by CALCULATE policy mode
("component-wise salary amounts" on the Employee Master page).

Revision ID: 0003
Revises: 0002
Create Date: 2026-11-03

"""
from typing import Sequence, Union

from alembic import op

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE emp_salary_components (
            org_code VARCHAR(30) NOT NULL,
            emp_code VARCHAR(30) NOT NULL,
            comp_code VARCHAR(30) NOT NULL,
            monthly_amount NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (monthly_amount >= 0),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            PRIMARY KEY (org_code, emp_code, comp_code),
            CONSTRAINT fk_salary_employee FOREIGN KEY (org_code, emp_code)
                REFERENCES emp_details(org_code, emp_code),
            CONSTRAINT fk_salary_component FOREIGN KEY (comp_code) REFERENCES components(comp_code)
        )
        """
    )
    op.execute("ALTER TABLE transactions ADD CONSTRAINT chk_transactions_amount CHECK (amount >= 0)")


def downgrade() -> None:
    op.execute("ALTER TABLE transactions DROP CONSTRAINT IF EXISTS chk_transactions_amount")
    op.execute("DROP TABLE IF EXISTS emp_salary_components")
