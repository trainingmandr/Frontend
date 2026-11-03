from fastapi import APIRouter

from app.api.v1.endpoints import (
    audit,
    auth,
    components,
    dashboard,
    designations,
    employees,
    health,
    orgs,
    payroll,
    payslips,
    salary,
    templates,
    transactions,
    users,
)

ORG = "/orgs/{org_code}"

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])

# Page 1: Dashboard
api_router.include_router(dashboard.router, prefix=f"{ORG}/dashboard", tags=["dashboard"])

# Page 2: Organization Setup
api_router.include_router(orgs.router, prefix="/orgs", tags=["organizations"])
api_router.include_router(designations.router, prefix="/designations", tags=["designations"])
api_router.include_router(designations.org_router, prefix=f"{ORG}/designations", tags=["designations"])
api_router.include_router(templates.router, prefix=f"{ORG}/templates", tags=["templates"])

# Page 3: Employee Master
api_router.include_router(employees.router, prefix=f"{ORG}/employees", tags=["employees"])
api_router.include_router(
    salary.router, prefix=f"{ORG}/employees/{{emp_code}}/salary-components", tags=["salary structure"]
)

# Page 4: Salary Components
api_router.include_router(components.router, prefix="/components", tags=["components"])

# Page 5: Transactions
api_router.include_router(transactions.router, prefix=f"{ORG}/transactions", tags=["transactions"])
api_router.include_router(payroll.router, prefix=f"{ORG}/payroll", tags=["payroll"])

# Page 6: Payslip Processor
api_router.include_router(payslips.router, prefix=f"{ORG}/payslips", tags=["payslips"])

api_router.include_router(audit.router, prefix=f"{ORG}/audit-log", tags=["audit"])
