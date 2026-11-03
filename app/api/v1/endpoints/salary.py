from decimal import Decimal

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.api.deps import CurrentOrg, CurrentUser, DbSession, EditorUser
from app.models.employee import EmpDetails
from app.models.payroll import EARNING_TYPES, STRUCTURE_TYPES, EmpSalaryComponent
from app.schemas.payroll import SalaryItemRead, SalaryStructureRead, SalaryStructureUpdate
from app.services.payroll import ZERO, load_components, money

# Mounted at /orgs/{org_code}/employees/{emp_code}/salary-components
router = APIRouter()


def _employee_or_404(db: DbSession, org_code: str, emp_code: str) -> EmpDetails:
    emp = db.get(EmpDetails, (org_code, emp_code.upper()))
    if emp is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Employee '{emp_code}' not found")
    return emp


def _structure(db: DbSession, emp: EmpDetails) -> SalaryStructureRead:
    amounts = {
        item.comp_code: item.monthly_amount
        for item in db.scalars(
            select(EmpSalaryComponent).where(
                EmpSalaryComponent.org_code == emp.org_code, EmpSalaryComponent.emp_code == emp.emp_code
            )
        )
    }
    items = [
        SalaryItemRead(comp_code=c.comp_code, comp_name=c.comp_name, comp_type=c.comp_type, monthly_amount=amounts[c.comp_code])
        for c in load_components(db)
        if c.comp_code in amounts
    ]
    earnings = sum((i.monthly_amount for i in items if i.comp_type.value in EARNING_TYPES), ZERO)
    deductions = sum((i.monthly_amount for i in items if i.comp_type.value not in EARNING_TYPES), ZERO)
    return SalaryStructureRead(
        org_code=emp.org_code,
        emp_code=emp.emp_code,
        items=items,
        monthly_earnings=earnings,
        monthly_deductions=deductions,
        monthly_net=earnings - deductions,
    )


@router.get("", response_model=SalaryStructureRead)
def get_salary_structure(emp_code: str, org: CurrentOrg, db: DbSession, _: CurrentUser) -> SalaryStructureRead:
    return _structure(db, _employee_or_404(db, org.org_code, emp_code))


@router.put("", response_model=SalaryStructureRead)
def replace_salary_structure(
    emp_code: str, body: SalaryStructureUpdate, org: CurrentOrg, db: DbSession, _: EditorUser
) -> SalaryStructureRead:
    """Replace the employee's monthly component amounts. The employee's gross_salary is set to the
    sum of the earning components."""
    emp = _employee_or_404(db, org.org_code, emp_code)
    components = {c.comp_code: c for c in load_components(db)}

    errors, seen = [], set()
    for item in body.items:
        component = components.get(item.comp_code)
        if component is None:
            errors.append(f"{item.comp_code}: component not found")
        elif component.comp_type not in STRUCTURE_TYPES:
            errors.append(f"{item.comp_code}: only EARNING and DEDUCTION components can be in a salary structure")
        if item.comp_code in seen:
            errors.append(f"{item.comp_code}: listed more than once")
        seen.add(item.comp_code)
    if errors:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=errors)

    existing = {
        item.comp_code: item
        for item in db.scalars(
            select(EmpSalaryComponent).where(
                EmpSalaryComponent.org_code == emp.org_code, EmpSalaryComponent.emp_code == emp.emp_code
            )
        )
    }
    for comp_code, item in existing.items():
        if comp_code not in seen:
            db.delete(item)
    for item in body.items:
        row = existing.get(item.comp_code)
        if row is None:
            db.add(EmpSalaryComponent(
                org_code=emp.org_code, emp_code=emp.emp_code, comp_code=item.comp_code, monthly_amount=money(item.monthly_amount)
            ))
        else:
            row.monthly_amount = money(item.monthly_amount)

    emp.gross_salary = money(sum(
        (i.monthly_amount for i in body.items if components[i.comp_code].comp_type in EARNING_TYPES), Decimal(0)
    ))
    db.commit()
    return _structure(db, emp)


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
def clear_salary_structure(emp_code: str, org: CurrentOrg, db: DbSession, _: EditorUser) -> None:
    emp = _employee_or_404(db, org.org_code, emp_code)
    for item in db.scalars(
        select(EmpSalaryComponent).where(
            EmpSalaryComponent.org_code == emp.org_code, EmpSalaryComponent.emp_code == emp.emp_code
        )
    ):
        db.delete(item)
    db.commit()
