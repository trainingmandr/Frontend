"""Payslip data, rupee formatting and template rendering."""

import html
import re
from datetime import date
from decimal import Decimal

from app.models.org import OrgSetup, PayslipLayout
from app.models.payroll import DEDUCTION_TYPES, EARNING_TYPES, Component, ComponentType, PayrollStatus, PayslipEmail
from app.schemas.payroll import PayslipLine, PayslipRead
from app.services.employees import mask
from app.services.payroll import PayLine, month_label, money

# ---------- Formatting ----------

_ONES = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve",
    "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen",
]
_TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]


def format_inr(value: Decimal | int | float, symbol: bool = True) -> str:
    """Indian digit grouping: 1234567.5 -> ₹ 12,34,567.50"""
    amount = money(value)
    sign = "-" if amount < 0 else ""
    whole, fraction = f"{abs(amount):.2f}".split(".")
    if len(whole) > 3:
        head, tail = whole[:-3], whole[-3:]
        groups = []
        while len(head) > 2:
            groups.insert(0, head[-2:])
            head = head[:-2]
        if head:
            groups.insert(0, head)
        whole = ",".join(groups + [tail])
    return f"{sign}{'₹ ' if symbol else ''}{whole}.{fraction}"


def _below_hundred(n: int) -> str:
    if n < 20:
        return _ONES[n]
    return _TENS[n // 10] + (f" {_ONES[n % 10]}" if n % 10 else "")


def _below_thousand(n: int) -> str:
    parts = []
    if n >= 100:
        parts.append(f"{_ONES[n // 100]} Hundred")
    if n % 100:
        parts.append(_below_hundred(n % 100))
    return " ".join(parts)


def number_to_words(n: int) -> str:
    """Indian numbering system (Thousand, Lakh, Crore)."""
    if n == 0:
        return "Zero"
    if n < 0:
        return f"Minus {number_to_words(-n)}"
    parts = []
    crore, n = divmod(n, 10**7)
    lakh, n = divmod(n, 10**5)
    thousand, n = divmod(n, 1000)
    if crore:
        parts.append(f"{number_to_words(crore)} Crore")
    if lakh:
        parts.append(f"{_below_hundred(lakh)} Lakh")
    if thousand:
        parts.append(f"{_below_hundred(thousand)} Thousand")
    if n:
        parts.append(_below_thousand(n))
    return " ".join(parts)


def amount_in_words(value: Decimal | int | float) -> str:
    amount = money(value)
    rupees = int(abs(amount))
    paise = int((abs(amount) - rupees) * 100)
    words = f"Rupees {number_to_words(rupees)}"
    if paise:
        words += f" and {number_to_words(paise)} Paise"
    return ("Minus " if amount < 0 else "") + words + " Only"


def _format_date(value: date | None) -> str:
    return value.strftime("%d/%m/%Y") if value else ""


def _format_quantity(value: Decimal) -> str:
    return f"{value.normalize():f}"


# ---------- Payslip data ----------

def build_payslip(
    org: OrgSetup,
    line: PayLine,
    components: list[Component],
    month_year: str,
    payroll_status: PayrollStatus,
    email: PayslipEmail | None = None,
    mask_sensitive: bool = False,
) -> PayslipRead:
    emp = line.employee

    def lines_for(types: set[str]) -> list[PayslipLine]:
        return [
            PayslipLine(comp_code=c.comp_code, comp_name=c.comp_name, amount=line.amounts[c.comp_code])
            for c in components
            if c.comp_type in types and c.comp_code in line.amounts
        ]

    bank_ac_no = emp.bank.bank_ac_no if emp.bank else None
    return PayslipRead(
        org_code=org.org_code,
        org_name=org.org_name,
        month_year=month_year,
        month_label=month_label(month_year),
        payroll_status=payroll_status,
        emp_code=emp.emp_code,
        emp_name=emp.emp_name,
        email=emp.email,
        designation_name=emp.designation_name,
        location=emp.location,
        date_of_joining=emp.date_of_joining,
        pan_no=mask(emp.pan_no) if mask_sensitive else emp.pan_no,
        bank_name=emp.bank.bank_name if emp.bank else None,
        bank_ac_no=mask(bank_ac_no) if mask_sensitive else bank_ac_no,
        ifsc_code=emp.bank.ifsc_code if emp.bank else None,
        attendance=lines_for({ComponentType.ATTENDANCE.value}),
        earnings=lines_for(EARNING_TYPES),
        deductions=lines_for(DEDUCTION_TYPES),
        gross_earnings=money(line.gross),
        total_deductions=money(line.deductions),
        net_pay=money(line.net),
        net_pay_words=amount_in_words(line.net),
        email_status=email.status if email else None,
        email_sent_date=email.sent_date if email else None,
    )


# ---------- Rendering ----------

_PLACEHOLDER = re.compile(r"\{\{\s*(\w+)\s*\}\}")


def render_text(template: str, values: dict[str, str], raw_html_keys: frozenset[str] = frozenset(), escape: bool = True) -> str:
    """Replace {{key}} placeholders. Values are HTML-escaped unless escape=False or the key is raw HTML.
    Unknown placeholders become empty."""

    def replace(match: re.Match) -> str:
        key = match.group(1)
        value = values.get(key, "")
        return value if (not escape or key in raw_html_keys) else html.escape(value)

    return _PLACEHOLDER.sub(replace, template)


def _amount_table(title: str, items: list[PayslipLine], total_label: str, total: Decimal) -> str:
    rows = "".join(
        f"<tr><td>{html.escape(i.comp_name)}</td><td class=\"amount\">{format_inr(i.amount)}</td></tr>" for i in items
    )
    return (
        f"<table class=\"{html.escape(title.lower())}\"><thead><tr><th>{html.escape(title)}</th>"
        f"<th class=\"amount\">Amount</th></tr></thead><tbody>{rows}</tbody>"
        f"<tfoot><tr><th>{html.escape(total_label)}</th><th class=\"amount\">{format_inr(total)}</th></tr></tfoot></table>"
    )


def _attendance_table(items: list[PayslipLine]) -> str:
    if not items:
        return ""
    rows = "".join(
        f"<tr><td>{html.escape(i.comp_name)}</td><td class=\"amount\">{_format_quantity(i.amount)}</td></tr>"
        for i in items
    )
    return f"<table class=\"attendance\"><thead><tr><th>Attendance</th><th class=\"amount\">Days</th></tr></thead><tbody>{rows}</tbody></table>"


_TABLE_KEYS = frozenset({"earnings_table", "deductions_table", "attendance_table"})


def payslip_values(org: OrgSetup, slip: PayslipRead) -> dict[str, str]:
    detailed = org.payslip_template == PayslipLayout.DETAILED.value
    paid_days = next((a.amount for a in slip.attendance if a.comp_code == "PAID_DAYS"), None)
    return {
        "org_code": org.org_code,
        "org_name": org.org_name,
        "org_address": org.org_address or "",
        "org_location": org.org_location or "",
        "org_email": org.org_email or "",
        "month_year": slip.month_year,
        "month_label": slip.month_label,
        "emp_code": slip.emp_code,
        "emp_name": slip.emp_name,
        "email": slip.email or "",
        "designation_name": slip.designation_name or "",
        "location": slip.location or "",
        "date_of_joining": _format_date(slip.date_of_joining),
        "pan_no": slip.pan_no or "",
        "bank_name": slip.bank_name or "",
        "bank_ac_no": slip.bank_ac_no or "",
        "ifsc_code": slip.ifsc_code or "",
        "paid_days": _format_quantity(paid_days) if paid_days is not None else "",
        # SIMPLE layout leaves out the attendance breakdown
        "attendance_table": _attendance_table(slip.attendance) if detailed else "",
        "earnings_table": _amount_table("Earnings", slip.earnings, "Gross Earnings", slip.gross_earnings),
        "deductions_table": _amount_table("Deductions", slip.deductions, "Total Deductions", slip.total_deductions),
        "gross_earnings": format_inr(slip.gross_earnings),
        "total_deductions": format_inr(slip.total_deductions),
        "net_pay": format_inr(slip.net_pay),
        "net_pay_words": slip.net_pay_words,
    }


_PAGE_STYLE = """
body { font-family: Arial, Helvetica, sans-serif; color: #1f2937; margin: 24px; }
.payslip { max-width: 800px; margin: 0 auto; }
h2, h3 { margin: 4px 0; } table { width: 100%; border-collapse: collapse; margin: 12px 0; }
td, th { border: 1px solid #d1d5db; padding: 6px 8px; text-align: left; font-size: 13px; }
thead th, tfoot th { background: #f3f4f6; } .amount { text-align: right; }
.draft { color: #b91c1c; font-weight: bold; text-align: center; letter-spacing: 2px; }
"""


def render_payslip_html(org: OrgSetup, template_body: str, slip: PayslipRead) -> str:
    content = render_text(template_body, payslip_values(org, slip), _TABLE_KEYS)
    draft = "" if slip.payroll_status != PayrollStatus.DRAFT else '<p class="draft">DRAFT - PAYROLL NOT PROCESSED</p>'
    title = html.escape(f"Payslip {slip.emp_code} {slip.month_label}")
    return (
        f"<!doctype html><html><head><meta charset=\"utf-8\"><title>{title}</title>"
        f"<style>{_PAGE_STYLE}</style></head><body>{draft}{content}</body></html>"
    )


def render_email(subject_template: str | None, body_template: str, org: OrgSetup, slip: PayslipRead) -> tuple[str, str]:
    values = payslip_values(org, slip)
    subject = render_text(subject_template or "Payslip for {{month_label}}", values, escape=False)
    return subject, render_text(body_template, values, escape=False)


def payslip_filename(slip: PayslipRead) -> str:
    return f"Payslip_{slip.emp_code}_{slip.month_year}.html"
