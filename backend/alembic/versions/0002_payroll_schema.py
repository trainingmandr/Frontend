"""payroll schema

Based on the supplied PAYROLL GENERATOR DATABASE script, with these additions:
- org_setup: org_address, policy_mode, payslip_template, updated_at
- emp_details: employment_status / leaving-date checks
- payroll_summary: status (DRAFT / PROCESSED / LOCKED)
- audit_log: changed_by (user id)
- org_template: per-org PAYSLIP / EMAIL templates with lock flag
- timestamps NOT NULL; redundant indexes dropped; pgcrypto not needed (gen_random_uuid is built in since PG13)

Revision ID: 0002
Revises: 0001
Create Date: 2026-11-03

"""
from typing import Sequence, Union

from alembic import op

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

MONTH_YEAR_CHECK = (
    "month_year ~ '^[0-9]{4}-(0[1-9]|1[0-2])$' AND LEFT(month_year, 4)::INTEGER BETWEEN 2000 AND 9999"
)

UPGRADE = [
    """
    CREATE TABLE org_setup (
        org_code VARCHAR(30) PRIMARY KEY,
        org_name VARCHAR(150) NOT NULL,
        org_address TEXT,
        org_location VARCHAR(150),
        org_email VARCHAR(150),
        active_emp_count INTEGER NOT NULL DEFAULT 0,
        policy_mode VARCHAR(20) NOT NULL DEFAULT 'FINAL',
        payslip_template VARCHAR(20) NOT NULL DEFAULT 'SIMPLE',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_on TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT chk_org_policy_mode CHECK (policy_mode IN ('FINAL', 'CALCULATE')),
        CONSTRAINT chk_org_payslip_template CHECK (payslip_template IN ('SIMPLE', 'DETAILED'))
    )
    """,
    """
    CREATE TABLE designation (
        designation_code VARCHAR(30) PRIMARY KEY,
        designation_name VARCHAR(100) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    """,
    """
    CREATE TABLE org_designation (
        org_code VARCHAR(30) NOT NULL,
        designation_code VARCHAR(30) NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        effective_from DATE,
        effective_to DATE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (org_code, designation_code),
        CONSTRAINT fk_org_designation_org FOREIGN KEY (org_code) REFERENCES org_setup(org_code),
        CONSTRAINT fk_org_designation_designation
            FOREIGN KEY (designation_code) REFERENCES designation(designation_code),
        CONSTRAINT chk_org_designation_dates
            CHECK (effective_to IS NULL OR effective_from IS NULL OR effective_to >= effective_from)
    )
    """,
    """
    CREATE TABLE emp_details (
        org_code VARCHAR(30) NOT NULL,
        emp_code VARCHAR(30) NOT NULL,
        emp_name VARCHAR(150) NOT NULL,
        email VARCHAR(150),
        designation_code VARCHAR(30),
        location VARCHAR(150),
        dob DATE,
        address TEXT,
        contact VARCHAR(20),
        emergency_contact VARCHAR(20),
        blood_group VARCHAR(10),
        date_of_joining DATE,
        pan_no VARCHAR(20),
        aadhar_no VARCHAR(20),
        date_of_leaving DATE,
        gross_salary NUMERIC(15,2) NOT NULL DEFAULT 0,
        employment_status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (org_code, emp_code),
        CONSTRAINT fk_emp_org FOREIGN KEY (org_code) REFERENCES org_setup(org_code),
        CONSTRAINT fk_emp_designation FOREIGN KEY (org_code, designation_code)
            REFERENCES org_designation(org_code, designation_code),
        CONSTRAINT chk_emp_status
            CHECK (employment_status IN ('ACTIVE', 'INACTIVE', 'RESIGNED', 'TERMINATED')),
        CONSTRAINT chk_emp_leaving_date
            CHECK (date_of_leaving IS NULL OR date_of_joining IS NULL OR date_of_leaving >= date_of_joining)
    )
    """,
    """
    CREATE TABLE education_details (
        org_code VARCHAR(30) NOT NULL,
        emp_code VARCHAR(30) NOT NULL,
        qualification VARCHAR(100),
        school_college_name VARCHAR(200),
        course_name VARCHAR(150),
        duration VARCHAR(50),
        cgpa_percentage VARCHAR(30),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (org_code, emp_code),
        CONSTRAINT fk_education_employee FOREIGN KEY (org_code, emp_code)
            REFERENCES emp_details(org_code, emp_code)
    )
    """,
    """
    CREATE TABLE bank_details (
        org_code VARCHAR(30) NOT NULL,
        emp_code VARCHAR(30) NOT NULL,
        bank_name VARCHAR(150),
        bank_ac_no VARCHAR(50),
        branch_name VARCHAR(150),
        ifsc_code VARCHAR(20),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (org_code, emp_code),
        CONSTRAINT fk_bank_employee FOREIGN KEY (org_code, emp_code)
            REFERENCES emp_details(org_code, emp_code)
    )
    """,
    """
    CREATE TABLE components (
        comp_code VARCHAR(30) PRIMARY KEY,
        comp_name VARCHAR(150) NOT NULL,
        comp_type VARCHAR(30) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT chk_component_type CHECK (
            comp_type IN ('ATTENDANCE', 'EARNING', 'DEDUCTION', 'SPECIAL_EARNING', 'SPECIAL_DEDUCTION')
        )
    )
    """,
    f"""
    CREATE TABLE transactions (
        org_code VARCHAR(30) NOT NULL,
        emp_code VARCHAR(30) NOT NULL,
        comp_code VARCHAR(30) NOT NULL,
        month_year VARCHAR(7) NOT NULL,
        amount NUMERIC(15,2) NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_on TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (org_code, emp_code, comp_code, month_year),
        CONSTRAINT chk_transactions_month_year CHECK ({MONTH_YEAR_CHECK}),
        CONSTRAINT fk_transactions_employee FOREIGN KEY (org_code, emp_code)
            REFERENCES emp_details(org_code, emp_code),
        CONSTRAINT fk_transactions_component FOREIGN KEY (comp_code) REFERENCES components(comp_code)
    )
    """,
    f"""
    CREATE TABLE payroll_summary (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_code VARCHAR(30) NOT NULL,
        month_year VARCHAR(7) NOT NULL,
        gross_payroll NUMERIC(15,2) NOT NULL DEFAULT 0,
        total_deductions NUMERIC(15,2) NOT NULL DEFAULT 0,
        net_payroll NUMERIC(15,2) NOT NULL DEFAULT 0,
        status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_payroll_org_month UNIQUE (org_code, month_year),
        CONSTRAINT chk_payroll_month_year CHECK ({MONTH_YEAR_CHECK}),
        CONSTRAINT chk_payroll_net CHECK (net_payroll = gross_payroll - total_deductions),
        CONSTRAINT chk_payroll_status CHECK (status IN ('DRAFT', 'PROCESSED', 'LOCKED')),
        CONSTRAINT fk_payroll_org FOREIGN KEY (org_code) REFERENCES org_setup(org_code)
    )
    """,
    f"""
    CREATE TABLE payslip_email (
        org_code VARCHAR(30) NOT NULL,
        emp_code VARCHAR(30) NOT NULL,
        month_year VARCHAR(7) NOT NULL,
        email_name VARCHAR(255) NOT NULL,
        sent_date TIMESTAMPTZ,
        status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
        error_message TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (org_code, emp_code, month_year),
        CONSTRAINT chk_payslip_email_month_year CHECK ({MONTH_YEAR_CHECK}),
        CONSTRAINT chk_payslip_email_status CHECK (status IN ('PENDING', 'SENT', 'FAILED')),
        CONSTRAINT fk_payslip_email_employee FOREIGN KEY (org_code, emp_code)
            REFERENCES emp_details(org_code, emp_code)
    )
    """,
    """
    CREATE TABLE audit_log (
        uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_code VARCHAR(30),
        table_name VARCHAR(100) NOT NULL,
        record_key JSONB NOT NULL,
        action VARCHAR(20) NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
        before_image JSONB,
        after_image JSONB,
        changed_by INTEGER REFERENCES users(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_on TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT fk_audit_org FOREIGN KEY (org_code) REFERENCES org_setup(org_code)
    )
    """,
    """
    CREATE TABLE org_template (
        org_code VARCHAR(30) NOT NULL,
        template_type VARCHAR(20) NOT NULL,
        subject VARCHAR(255),
        body TEXT NOT NULL,
        is_locked BOOLEAN NOT NULL DEFAULT FALSE,
        locked_at TIMESTAMPTZ,
        locked_by INTEGER REFERENCES users(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (org_code, template_type),
        CONSTRAINT fk_org_template_org FOREIGN KEY (org_code) REFERENCES org_setup(org_code),
        CONSTRAINT chk_org_template_type CHECK (template_type IN ('PAYSLIP', 'EMAIL'))
    )
    """,
    # Indexes (PK / unique-constraint prefixes already cover payroll_summary period and transactions employee)
    "CREATE INDEX idx_emp_org_status ON emp_details(org_code, employment_status)",
    "CREATE INDEX idx_emp_designation ON emp_details(org_code, designation_code)",
    "CREATE INDEX idx_transactions_period ON transactions(org_code, month_year)",
    "CREATE INDEX idx_transactions_component ON transactions(comp_code)",
    "CREATE INDEX idx_payslip_email_period ON payslip_email(org_code, month_year)",
    "CREATE INDEX idx_payslip_email_status ON payslip_email(org_code, status)",
    "CREATE INDEX idx_org_designation_active ON org_designation(org_code, is_active)",
    "CREATE INDEX idx_audit_org_date ON audit_log(org_code, created_at)",
    # Automatic active employee count
    """
    CREATE OR REPLACE FUNCTION sync_active_employee_count()
    RETURNS TRIGGER AS $$
    BEGIN
        IF TG_OP = 'INSERT' THEN
            IF UPPER(COALESCE(NEW.employment_status, '')) = 'ACTIVE' THEN
                UPDATE org_setup SET active_emp_count = active_emp_count + 1
                WHERE org_code = NEW.org_code;
            END IF;
            RETURN NEW;

        ELSIF TG_OP = 'DELETE' THEN
            IF UPPER(COALESCE(OLD.employment_status, '')) = 'ACTIVE' THEN
                UPDATE org_setup SET active_emp_count = GREATEST(active_emp_count - 1, 0)
                WHERE org_code = OLD.org_code;
            END IF;
            RETURN OLD;

        ELSIF TG_OP = 'UPDATE' THEN
            IF OLD.org_code = NEW.org_code THEN
                IF UPPER(COALESCE(OLD.employment_status, '')) = 'ACTIVE'
                   AND UPPER(COALESCE(NEW.employment_status, '')) <> 'ACTIVE' THEN
                    UPDATE org_setup SET active_emp_count = GREATEST(active_emp_count - 1, 0)
                    WHERE org_code = OLD.org_code;
                ELSIF UPPER(COALESCE(OLD.employment_status, '')) <> 'ACTIVE'
                   AND UPPER(COALESCE(NEW.employment_status, '')) = 'ACTIVE' THEN
                    UPDATE org_setup SET active_emp_count = active_emp_count + 1
                    WHERE org_code = NEW.org_code;
                END IF;
            ELSE
                IF UPPER(COALESCE(OLD.employment_status, '')) = 'ACTIVE' THEN
                    UPDATE org_setup SET active_emp_count = GREATEST(active_emp_count - 1, 0)
                    WHERE org_code = OLD.org_code;
                END IF;
                IF UPPER(COALESCE(NEW.employment_status, '')) = 'ACTIVE' THEN
                    UPDATE org_setup SET active_emp_count = active_emp_count + 1
                    WHERE org_code = NEW.org_code;
                END IF;
            END IF;
            RETURN NEW;
        END IF;
        RETURN NULL;
    END;
    $$ LANGUAGE plpgsql
    """,
    """
    CREATE TRIGGER trg_sync_active_employee_count
    AFTER INSERT OR UPDATE OR DELETE ON emp_details
    FOR EACH ROW EXECUTE FUNCTION sync_active_employee_count()
    """,
]

DOWNGRADE = [
    "DROP TRIGGER IF EXISTS trg_sync_active_employee_count ON emp_details",
    "DROP FUNCTION IF EXISTS sync_active_employee_count()",
    "DROP TABLE IF EXISTS org_template",
    "DROP TABLE IF EXISTS audit_log",
    "DROP TABLE IF EXISTS payslip_email",
    "DROP TABLE IF EXISTS payroll_summary",
    "DROP TABLE IF EXISTS transactions",
    "DROP TABLE IF EXISTS components",
    "DROP TABLE IF EXISTS bank_details",
    "DROP TABLE IF EXISTS education_details",
    "DROP TABLE IF EXISTS emp_details",
    "DROP TABLE IF EXISTS org_designation",
    "DROP TABLE IF EXISTS designation",
    "DROP TABLE IF EXISTS org_setup",
]


def upgrade() -> None:
    for statement in UPGRADE:
        op.execute(statement)


def downgrade() -> None:
    for statement in DOWNGRADE:
        op.execute(statement)
