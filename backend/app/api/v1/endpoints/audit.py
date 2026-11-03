from typing import Literal

from fastapi import APIRouter, Query
from sqlalchemy import func, or_, select

from app.api.deps import AdminUser, CurrentOrg, DbSession
from app.models.payroll import AuditLog
from app.schemas.payroll import AuditLogList, AuditLogRead

# Mounted at /orgs/{org_code}/audit-log
router = APIRouter()


@router.get("", response_model=AuditLogList)
def list_audit_log(
    org: CurrentOrg,
    db: DbSession,
    _: AdminUser,
    table_name: str | None = None,
    action: Literal["INSERT", "UPDATE", "DELETE"] | None = None,
    include_global: bool = Query(False, description="Also include changes to shared masters (designations, components)"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
) -> AuditLogList:
    org_filter = or_(AuditLog.org_code == org.org_code, AuditLog.org_code.is_(None)) if include_global else (
        AuditLog.org_code == org.org_code
    )
    query = select(AuditLog).where(org_filter)
    if table_name:
        query = query.where(AuditLog.table_name == table_name)
    if action:
        query = query.where(AuditLog.action == action)
    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    items = db.scalars(query.order_by(AuditLog.created_at.desc()).offset(skip).limit(limit)).all()
    return AuditLogList(items=[AuditLogRead.model_validate(i) for i in items], total=total, skip=skip, limit=limit)
