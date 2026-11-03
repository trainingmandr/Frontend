"""drop stored email template

The payslip email subject and message are entered when sending and are not stored,
so org_template keeps only the PAYSLIP template.

Revision ID: 0004
Revises: 0003
Create Date: 2026-11-03

"""
from typing import Sequence, Union

from alembic import op

revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("DELETE FROM org_template WHERE template_type = 'EMAIL'")
    op.execute("ALTER TABLE org_template DROP CONSTRAINT chk_org_template_type")
    op.execute("ALTER TABLE org_template ADD CONSTRAINT chk_org_template_type CHECK (template_type IN ('PAYSLIP'))")


def downgrade() -> None:
    # Deleted email templates are not restored
    op.execute("ALTER TABLE org_template DROP CONSTRAINT chk_org_template_type")
    op.execute(
        "ALTER TABLE org_template ADD CONSTRAINT chk_org_template_type CHECK (template_type IN ('PAYSLIP', 'EMAIL'))"
    )
