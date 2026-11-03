"""Loads demo data through the API so the app has several months of payroll history.

Run from the backend folder, after `alembic upgrade head`:

    .venv\\Scripts\\python -m app.seed_demo

Creates two organisations (MRA, FINAL mode; ETPL, CALCULATE mode) with designations, employees and
six months of transactions ending with DEMO_LAST_MONTH. Earlier months are processed and locked; the
last month is processed but left open. Requests go through the real endpoints, so validation and the
audit trail apply. It stops without changes if MRA already exists, so it is safe to run twice.
"""

import logging
import sys
from datetime import date

from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app
from app.services.payroll import recent_months

logger = logging.getLogger(__name__)

DEMO_LAST_MONTH = "2026-10"
MONTHS = recent_months(DEMO_LAST_MONTH, 6)

ORGS = [
    {
        "org_code": "MRA",
        "org_name": "Manian & Rao",
        "org_address": "Madurai, Tamil Nadu",
        "org_location": "Madurai",
        "org_email": "payroll@company.example",
        "policy_mode": "FINAL",
        "payslip_template": "SIMPLE",
    },
    {
        "org_code": "ETPL",
        "org_name": "Example Technologies Pvt Ltd",
        "org_address": "Bengaluru, Karnataka",
        "org_location": "Bengaluru",
        "org_email": "payroll@example.example",
        "policy_mode": "CALCULATE",
        "payslip_template": "DETAILED",
    },
]

DESIGNATIONS = {
    "MRA": [
        ("SR_AUDITOR", "Senior Auditor"),
        ("JR_AUDITOR", "Junior Auditor"),
        ("AUDIT_ASSOC", "Audit Associate"),
        ("TAX_CONSULT", "Tax Consultant"),
        ("ARTICLE_ASST", "Article Assistant"),
        ("HR_MANAGER", "HR Manager"),
        ("INTERN", "Intern"),
    ],
    "ETPL": [
        ("SW_ENGINEER", "Software Engineer"),
        ("ACCOUNTANT", "Accountant"),
        ("HR_MANAGER", "HR Manager"),
        ("INTERN", "Intern"),
    ],
}

# MRA (FINAL mode): code, name, designation, joined, basic, conveyance, TDS (whole rupees).
# EMP-12 joins in August, so earlier months have 11 employees.
MRA_EMPLOYEES = [
    ("EMP-01", "Arjun Sharma", "SR_AUDITOR", "2022-04-01", 28000, 3000, 2400),
    ("EMP-02", "Priya Nair", "HR_MANAGER", "2021-07-12", 24500, 2500, 1900),
    ("EMP-03", "Ravi Kumar", "SR_AUDITOR", "2023-01-09", 26000, 3000, 2100),
    ("EMP-04", "Sunita Menon", "JR_AUDITOR", "2024-06-03", 22000, 2000, 1700),
    ("EMP-05", "Deepak Iyer", "TAX_CONSULT", "2022-11-21", 27500, 3000, 2300),
    ("EMP-06", "Kavitha Rao", "AUDIT_ASSOC", "2023-08-14", 25000, 2500, 2000),
    ("EMP-07", "Mohan Das", "ARTICLE_ASST", "2025-02-17", 21000, 2000, 1600),
    ("EMP-08", "Ananya Pillai", "SR_AUDITOR", "2021-03-01", 29000, 3000, 2500),
    ("EMP-09", "Suresh Babu", "AUDIT_ASSOC", "2024-01-08", 23500, 2500, 1900),
    ("EMP-10", "Meena Krishnan", "TAX_CONSULT", "2023-05-22", 26000, 3000, 2200),
    ("EMP-11", "Rahul Gupta", "INTERN", "2025-12-01", 20500, 2000, 1500),
    ("EMP-12", "Lalitha Bose", "JR_AUDITOR", "2026-08-01", 24000, 2500, 1900),
]

# ETPL (CALCULATE mode): code, name, designation, joined, monthly structure.
ETPL_EMPLOYEES = [
    ("ET-001", "Karthik Raj", "SW_ENGINEER", "2023-02-01", {"BASIC": 40000, "HRA": 16000, "SPECIAL_ALLOWANCE": 9000, "PF": 4800, "PT": 200}),
    ("ET-002", "Divya Shankar", "SW_ENGINEER", "2024-07-15", {"BASIC": 36000, "HRA": 14400, "SPECIAL_ALLOWANCE": 7600, "PF": 4320, "PT": 200}),
    ("ET-003", "Farhan Ali", "ACCOUNTANT", "2022-09-05", {"BASIC": 30000, "HRA": 12000, "SPECIAL_ALLOWANCE": 5000, "PF": 3600, "PT": 200}),
    ("ET-004", "Nisha Varghese", "HR_MANAGER", "2021-11-22", {"BASIC": 34000, "HRA": 13600, "SPECIAL_ALLOWANCE": 6400, "PF": 4080, "PT": 200}),
]


def _days_in(month: str) -> int:
    year, number = (int(p) for p in month.split("-"))
    next_first = date(year + (number == 12), number % 12 + 1, 1)
    return (next_first - date(year, number, 1)).days


def _email(name: str, domain: str) -> str:
    return f"{name.lower().replace(' ', '.')}@{domain}"


class Api:
    def __init__(self, client: TestClient, token: str):
        self.client = client
        self.headers = {"Authorization": f"Bearer {token}"}

    def call(self, method: str, path: str, json=None):
        response = self.client.request(method, settings.API_V1_PREFIX + path, json=json, headers=self.headers)
        if response.status_code >= 400:
            raise RuntimeError(f"{method} {path} -> {response.status_code}: {response.text[:500]}")
        return response.json() if response.content else None


def seed(api: Api) -> None:
    for org in ORGS:
        api.call("POST", "/orgs", org)
        for code, name in DESIGNATIONS[org["org_code"]]:
            api.call("POST", f"/orgs/{org['org_code']}/designations", {"designation_code": code, "designation_name": name})

    # ---- MRA: final amounts entered each month ----
    for code, name, designation, joined, basic, conveyance, _ in MRA_EMPLOYEES:
        api.call("POST", "/orgs/MRA/employees", {
            "emp_code": code, "emp_name": name, "designation_code": designation,
            "email": _email(name, "company.example"), "location": "Madurai",
            "date_of_joining": joined, "gross_salary": basic + conveyance,
        })
    for index, month in enumerate(MONTHS):
        days = _days_in(month)
        entries = []
        for number, (code, _, _, joined, basic, conveyance, tds) in enumerate(MRA_EMPLOYEES):
            if joined > f"{month}-31":
                continue
            # A little variety: some months have a day or two of loss of pay
            lop_days = (number + index) % 5 == 0 and 1 or 0
            lop_amount = round(basic * lop_days / days, 2)
            entries += [
                {"emp_code": code, "comp_code": "PAID_DAYS", "amount": days - lop_days},
                {"emp_code": code, "comp_code": "LOP_DAYS", "amount": lop_days},
                {"emp_code": code, "comp_code": "BASIC", "amount": round(basic - lop_amount, 2)},
                {"emp_code": code, "comp_code": "CONVEYANCE", "amount": conveyance},
                {"emp_code": code, "comp_code": "TDS", "amount": tds},
            ]
            if month.endswith("-10"):
                entries.append({"emp_code": code, "comp_code": "BONUS", "amount": 2000})
        api.call("PUT", f"/orgs/MRA/transactions/{month}", {"entries": entries})
        api.call("POST", f"/orgs/MRA/payroll/{month}/process")
        if month != DEMO_LAST_MONTH:
            api.call("POST", f"/orgs/MRA/payroll/{month}/lock")
        logger.info("MRA %s: %d employees processed", month, len({e['emp_code'] for e in entries}))

    # ---- ETPL: salary structures, calculated each month ----
    for code, name, designation, joined, structure in ETPL_EMPLOYEES:
        api.call("POST", "/orgs/ETPL/employees", {
            "emp_code": code, "emp_name": name, "designation_code": designation,
            "email": _email(name, "example.example"), "location": "Bengaluru", "date_of_joining": joined,
        })
        api.call("PUT", f"/orgs/ETPL/employees/{code}/salary-components", {
            "items": [{"comp_code": comp, "monthly_amount": amount} for comp, amount in structure.items()],
        })
    for month in MONTHS[-3:]:
        api.call("POST", f"/orgs/ETPL/transactions/{month}/calculate")
        api.call("POST", f"/orgs/ETPL/payroll/{month}/process")
        if month != DEMO_LAST_MONTH:
            api.call("POST", f"/orgs/ETPL/payroll/{month}/lock")
        logger.info("ETPL %s: calculated and processed", month)


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    logging.getLogger("httpx").setLevel(logging.WARNING)
    with TestClient(app) as client:
        login = client.post(
            f"{settings.API_V1_PREFIX}/auth/login",
            json={"email": settings.ADMIN_EMAIL, "password": settings.ADMIN_PASSWORD},
        )
        if login.status_code != 200:
            sys.exit(f"Admin login failed ({login.status_code}). Check ADMIN_EMAIL / ADMIN_PASSWORD in .env.")
        api = Api(client, login.json()["access_token"])
        existing = client.get(f"{settings.API_V1_PREFIX}/orgs", headers=api.headers).json()
        if any(org["org_code"] == "MRA" for org in existing):
            logger.info("Demo data already loaded (MRA exists); nothing changed.")
            return
        seed(api)
        logger.info("Demo data loaded for %s to %s.", MONTHS[0], MONTHS[-1])


if __name__ == "__main__":
    main()
