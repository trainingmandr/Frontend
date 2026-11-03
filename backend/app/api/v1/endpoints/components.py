from fastapi import APIRouter, HTTPException, status
from sqlalchemy import func, select

from app.api.deps import CurrentUser, DbSession, EditorUser
from app.models.payroll import Component, ComponentType, EmpSalaryComponent, Transaction
from app.schemas.payroll import ComponentCreate, ComponentRead, ComponentUpdate, ComponentUsage
from app.services.payroll import load_components

# Global component master: /components
router = APIRouter()


def _usage(db: DbSession, comp_code: str | None = None) -> dict[str, tuple[int, int]]:
    """comp_code -> (transaction count, employees with it in their salary structure)."""
    tx_query = select(Transaction.comp_code, func.count()).group_by(Transaction.comp_code)
    emp_query = select(EmpSalaryComponent.comp_code, func.count()).group_by(EmpSalaryComponent.comp_code)
    if comp_code:
        tx_query = tx_query.where(Transaction.comp_code == comp_code)
        emp_query = emp_query.where(EmpSalaryComponent.comp_code == comp_code)
    tx_counts = dict(db.execute(tx_query).all())
    emp_counts = dict(db.execute(emp_query).all())
    return {code: (tx_counts.get(code, 0), emp_counts.get(code, 0)) for code in set(tx_counts) | set(emp_counts)}


def _get_or_404(db: DbSession, comp_code: str) -> Component:
    component = db.get(Component, comp_code.upper())
    if component is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Component '{comp_code}' not found")
    return component


def _with_usage(component: Component, usage: dict[str, tuple[int, int]]) -> ComponentUsage:
    tx_count, emp_count = usage.get(component.comp_code, (0, 0))
    return ComponentUsage(
        **ComponentRead.model_validate(component).model_dump(), transaction_count=tx_count, employee_count=emp_count
    )


@router.get("", response_model=list[ComponentUsage])
def list_components(db: DbSession, _: CurrentUser, comp_type: ComponentType | None = None) -> list[ComponentUsage]:
    """All components ordered attendance, earnings, special earnings, deductions, special deductions."""
    usage = _usage(db)
    return [
        _with_usage(c, usage) for c in load_components(db) if comp_type is None or c.comp_type == comp_type.value
    ]


@router.post("", response_model=ComponentRead, status_code=status.HTTP_201_CREATED)
def create_component(body: ComponentCreate, db: DbSession, _: EditorUser) -> Component:
    if db.get(Component, body.comp_code) is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Component '{body.comp_code}' already exists")
    component = Component(comp_code=body.comp_code, comp_name=body.comp_name, comp_type=body.comp_type.value)
    db.add(component)
    db.commit()
    db.refresh(component)
    return component


@router.put("/{comp_code}", response_model=ComponentUsage)
def update_component(comp_code: str, body: ComponentUpdate, db: DbSession, _: EditorUser) -> ComponentUsage:
    component = _get_or_404(db, comp_code)
    usage = _usage(db, component.comp_code)
    if body.comp_type is not None and body.comp_type.value != component.comp_type:
        if component.comp_code in usage:
            # Changing earning <-> deduction would silently change existing payrolls
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Component type cannot be changed once it is used in transactions or salary structures",
            )
        component.comp_type = body.comp_type.value
    if body.comp_name is not None:
        component.comp_name = body.comp_name
    db.commit()
    db.refresh(component)
    return _with_usage(component, usage)


@router.delete("/{comp_code}", status_code=status.HTTP_204_NO_CONTENT)
def delete_component(comp_code: str, db: DbSession, _: EditorUser) -> None:
    component = _get_or_404(db, comp_code)
    tx_count, emp_count = _usage(db, component.comp_code).get(component.comp_code, (0, 0))
    if tx_count or emp_count:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Component is used in {tx_count} transaction(s) and {emp_count} salary structure(s)",
        )
    db.delete(component)
    db.commit()
