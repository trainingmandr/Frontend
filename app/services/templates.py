from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.org import OrgTemplate, TemplateType

# Placeholders in {{double_braces}} are filled when payslips are generated
DEFAULT_TEMPLATES: dict[TemplateType, dict[str, str | None]] = {
    TemplateType.PAYSLIP: {
        "subject": None,
        "body": """<div class="payslip">
  <h2>{{org_name}}</h2>
  <p>{{org_address}}</p>
  <h3>Payslip for {{month_label}}</h3>
  <table class="employee">
    <tr><td>Employee Code</td><td>{{emp_code}}</td><td>Name</td><td>{{emp_name}}</td></tr>
    <tr><td>Designation</td><td>{{designation_name}}</td><td>Date of Joining</td><td>{{date_of_joining}}</td></tr>
    <tr><td>Bank A/c</td><td>{{bank_ac_no}}</td><td>PAN</td><td>{{pan_no}}</td></tr>
    <tr><td>Paid Days</td><td>{{paid_days}}</td><td>Location</td><td>{{location}}</td></tr>
  </table>
  {{attendance_table}}
  {{earnings_table}}
  {{deductions_table}}
  <p>Gross Earnings: {{gross_earnings}} | Total Deductions: {{total_deductions}}</p>
  <p><strong>Net Pay: {{net_pay}}</strong> ({{net_pay_words}})</p>
</div>""",
    },
    TemplateType.EMAIL: {
        "subject": "Payslip for {{month_label}} - {{org_name}}",
        "body": """Dear {{emp_name}},

Please find attached your payslip for {{month_label}}.

Regards,
{{org_name}}""",
    },
}


def ensure_templates(db: Session, org_code: str) -> list[OrgTemplate]:
    """Return the org's templates, creating any missing ones from the defaults (caller commits)."""
    existing = {t.template_type: t for t in db.scalars(select(OrgTemplate).where(OrgTemplate.org_code == org_code))}
    for template_type, default in DEFAULT_TEMPLATES.items():
        if template_type.value not in existing:
            template = OrgTemplate(
                org_code=org_code,
                template_type=template_type.value,
                subject=default["subject"],
                body=default["body"],
            )
            db.add(template)
            existing[template_type.value] = template
    db.flush()
    return [existing[t.value] for t in TemplateType]
