from fastapi import APIRouter, BackgroundTasks, HTTPException, Query, status
from fastapi.responses import HTMLResponse
from sqlalchemy import select

from app.api.deps import CurrentOrg, CurrentUser, DbSession, EditorUser, MonthPath, is_masked
from app.models.org import TemplateType
from app.models.payroll import EmailStatus, PayrollStatus, PayslipEmail
from app.schemas.payroll import EntryError, PayslipEmailRead, PayslipRead, SendPayslipsRequest, SendPayslipsResult
from app.services.email import send_payslips_job
from app.services.payroll import compute_month, get_summary, status_of
from app.services.payslips import build_payslip, payslip_filename, render_payslip_html
from app.services.templates import ensure_templates

# Mounted at /orgs/{org_code}/payslips
router = APIRouter()


def _email_records(db: DbSession, org_code: str, month_year: str) -> dict[str, PayslipEmail]:
    return {
        r.emp_code: r
        for r in db.scalars(
            select(PayslipEmail).where(PayslipEmail.org_code == org_code, PayslipEmail.month_year == month_year)
        )
    }


def _payslips(db: DbSession, org, month_year: str, emp_codes: list[str] | None, masked: bool) -> list[PayslipRead]:
    components, lines = compute_month(db, org.org_code, month_year, emp_codes)
    payroll_status = status_of(get_summary(db, org.org_code, month_year))
    emails = _email_records(db, org.org_code, month_year)
    return [
        build_payslip(org, line, components, month_year, payroll_status, emails.get(line.employee.emp_code), masked)
        for line in lines
        if line.amounts
    ]


@router.get("/{month_year}", response_model=list[PayslipRead])
def list_payslips(
    month_year: MonthPath,
    org: CurrentOrg,
    db: DbSession,
    user: CurrentUser,
    emp_codes: list[str] | None = Query(None, description="Only these employees"),
) -> list[PayslipRead]:
    """Payslip data for every employee with transactions in the month, with email delivery status."""
    codes = [c.upper() for c in emp_codes] if emp_codes else None
    return _payslips(db, org, month_year, codes, is_masked(user))


@router.get("/{month_year}/emails", response_model=list[PayslipEmailRead])
def email_status(
    month_year: MonthPath,
    org: CurrentOrg,
    db: DbSession,
    _: CurrentUser,
    email_status: EmailStatus | None = Query(None, alias="status"),
) -> list[PayslipEmail]:
    records = sorted(_email_records(db, org.org_code, month_year).values(), key=lambda r: r.emp_code)
    return [r for r in records if email_status is None or r.status == email_status.value]


@router.post("/{month_year}/send", response_model=SendPayslipsResult, status_code=status.HTTP_202_ACCEPTED)
def send_payslips(
    month_year: MonthPath,
    body: SendPayslipsRequest,
    background: BackgroundTasks,
    org: CurrentOrg,
    db: DbSession,
    _: EditorUser,
) -> SendPayslipsResult:
    """Queue payslip emails (selected employees, or everyone). Delivery runs in the background;
    poll GET /{month_year}/emails for SENT / FAILED."""
    payroll_status = status_of(get_summary(db, org.org_code, month_year))
    if payroll_status == PayrollStatus.DRAFT:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail=f"Process the payroll for {month_year} before sending payslips"
        )

    _, lines = compute_month(db, org.org_code, month_year, body.emp_codes or None)
    lines = [l for l in lines if l.amounts]
    found = {l.employee.emp_code for l in lines}
    skipped = [
        EntryError(emp_code=code, message="No payslip for this month")
        for code in (body.emp_codes or [])
        if code not in found
    ]
    records = _email_records(db, org.org_code, month_year)
    queued: list[str] = []
    for line in lines:
        emp = line.employee
        record = records.get(emp.emp_code)
        if not emp.email:
            skipped.append(EntryError(emp_code=emp.emp_code, message="Employee has no email address"))
            continue
        if record is not None and record.status == EmailStatus.SENT.value and not body.resend:
            skipped.append(EntryError(emp_code=emp.emp_code, message="Already sent (use resend to send again)"))
            continue
        if record is None:
            record = PayslipEmail(org_code=org.org_code, emp_code=emp.emp_code, month_year=month_year, email_name=emp.email)
            db.add(record)
        record.email_name = emp.email
        record.status = EmailStatus.PENDING.value
        record.error_message = None
        record.sent_date = None
        queued.append(emp.emp_code)

    db.commit()
    if queued:
        background.add_task(send_payslips_job, org.org_code, month_year, queued)
    return SendPayslipsResult(queued=len(queued), skipped=skipped)


@router.get("/{month_year}/{emp_code}", response_model=PayslipRead)
def get_payslip(month_year: MonthPath, emp_code: str, org: CurrentOrg, db: DbSession, user: CurrentUser) -> PayslipRead:
    slips = _payslips(db, org, month_year, [emp_code.upper()], is_masked(user))
    if not slips:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"No payslip for '{emp_code}' in {month_year}")
    return slips[0]


@router.get("/{month_year}/{emp_code}/html", response_class=HTMLResponse)
def payslip_html(
    month_year: MonthPath,
    emp_code: str,
    org: CurrentOrg,
    db: DbSession,
    user: CurrentUser,
    download: bool = False,
) -> HTMLResponse:
    """Payslip rendered with the organisation's PAYSLIP template (printable; DRAFT banner until processed)."""
    slip = get_payslip(month_year, emp_code, org, db, user)
    template = next(t for t in ensure_templates(db, org.org_code) if t.template_type == TemplateType.PAYSLIP.value)
    db.commit()
    headers = {"Content-Disposition": f'attachment; filename="{payslip_filename(slip)}"'} if download else None
    return HTMLResponse(render_payslip_html(org, template.body, slip), headers=headers)
