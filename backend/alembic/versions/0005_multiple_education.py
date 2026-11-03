"""multiple education entries per employee

education_details gets an entry_no (1, 2, 3...) and it joins the primary key, so an
employee can have several qualifications. Existing rows become entry 1.

Revision ID: 0005
Revises: 0004
Create Date: 2026-11-03

"""
from typing import Sequence, Union

from alembic import op

revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE education_details ADD COLUMN entry_no SMALLINT NOT NULL DEFAULT 1 CHECK (entry_no >= 1)")
    op.execute("ALTER TABLE education_details DROP CONSTRAINT education_details_pkey")
    op.execute("ALTER TABLE education_details ADD PRIMARY KEY (org_code, emp_code, entry_no)")


def downgrade() -> None:
    # Only the first entry of each employee fits the old one-row-per-employee key
    op.execute("DELETE FROM education_details WHERE entry_no > 1")
    op.execute("ALTER TABLE education_details DROP CONSTRAINT education_details_pkey")
    op.execute("ALTER TABLE education_details ADD PRIMARY KEY (org_code, emp_code)")
    op.execute("ALTER TABLE education_details DROP COLUMN entry_no")
