"""Payslip email delivery. Runs as a background task with its own DB session."""

import logging
import re
import smtplib
from dataclasses import dataclass
from datetime import datetime, timezone
from email.message import EmailMessage
from pathlib import Path

from app.core.config import settings
from app.db.session import SessionLocal
from app.models.org import OrgSetup, TemplateType
from app.models.payroll import EmailStatus, PayslipEmail
from app.services.payroll import compute_month, get_summary, status_of
from app.services.payslips import build_payslip, payslip_filename, render_email, render_payslip_html
from app.services.templates import ensure_templates

logger = logging.getLogger(__name__)


@dataclass
class Attachment:
    filename: str
    content: bytes
    mime_type: str


def send_email(sender: str, to: str, subject: str, body: str, attachments: list[Attachment] = ()) -> None:
    message = EmailMessage()
    message["From"] = sender
    message["To"] = to
    message["Subject"] = subject
    message.set_content(body)
    for attachment in attachments:
        maintype, subtype = attachment.mime_type.split("/", 1)
        message.add_attachment(attachment.content, maintype=maintype, subtype=subtype, filename=attachment.filename)

    if settings.EMAIL_BACKEND == "smtp":
        if not settings.SMTP_HOST:
            raise RuntimeError("SMTP_HOST is not configured")
        smtp_class = smtplib.SMTP_SSL if settings.SMTP_SSL else smtplib.SMTP
        with smtp_class(settings.SMTP_HOST, settings.SMTP_PORT, timeout=30) as smtp:
            if settings.SMTP_STARTTLS and not settings.SMTP_SSL:
                smtp.starttls()
            if settings.SMTP_USERNAME:
                smtp.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            smtp.send_message(message)
        return

    outbox = Path(settings.EMAIL_OUTBOX_DIR)
    outbox.mkdir(parents=True, exist_ok=True)
    safe_to = re.sub(r"[^A-Za-z0-9@._-]", "_", to)
    path = outbox / f"{datetime.now():%Y%m%d_%H%M%S_%f}_{safe_to}.eml"
    path.write_bytes(message.as_bytes())
    logger.info("Email to %s written to %s", to, path)


def send_payslips_job(org_code: str, month_year: str, emp_codes: list[str]) -> None:
    """Send each queued (PENDING) payslip and record SENT / FAILED in payslip_email."""
    with SessionLocal() as db:
        org = db.get(OrgSetup, org_code)
        if org is None:
            return
        templates = {t.template_type: t for t in ensure_templates(db, org_code)}
        db.commit()
        payslip_template = templates[TemplateType.PAYSLIP.value]
        email_template = templates[TemplateType.EMAIL.value]
        payroll_status = status_of(get_summary(db, org_code, month_year))
        sender = org.org_email or settings.EMAIL_FROM

        components, lines = compute_month(db, org_code, month_year, emp_codes)
        for line in lines:
            record = db.get(PayslipEmail, (org_code, line.employee.emp_code, month_year))
            if record is None or record.status != EmailStatus.PENDING.value:
                continue
            try:
                slip = build_payslip(org, line, components, month_year, payroll_status)
                page = render_payslip_html(org, payslip_template.body, slip)
                subject, body = render_email(email_template.subject, email_template.body, org, slip)
                send_email(
                    sender,
                    record.email_name,
                    subject,
                    body,
                    [Attachment(payslip_filename(slip), page.encode("utf-8"), "text/html")],
                )
                record.status = EmailStatus.SENT.value
                record.sent_date = datetime.now(timezone.utc)
                record.error_message = None
            except Exception as exc:
                logger.exception("Payslip email to %s failed", record.email_name)
                record.status = EmailStatus.FAILED.value
                record.error_message = str(exc)[:1000]
            db.commit()
