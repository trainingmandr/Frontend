from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.api.deps import CurrentOrg, CurrentUser, DbSession, EditorUser
from app.models.org import OrgSetup
from app.schemas.org import OrgCreate, OrgRead, OrgUpdate
from app.services.templates import ensure_templates

router = APIRouter()


@router.get("", response_model=list[OrgRead])
def list_orgs(db: DbSession, _: CurrentUser) -> list[OrgSetup]:
    """All organisations (the "Available Organizations" table and the header org selector)."""
    return list(db.scalars(select(OrgSetup).order_by(OrgSetup.org_code)))


@router.post("", response_model=OrgRead, status_code=status.HTTP_201_CREATED)
def create_org(body: OrgCreate, db: DbSession, _: EditorUser) -> OrgSetup:
    if db.get(OrgSetup, body.org_code) is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Organisation '{body.org_code}' already exists")
    org = OrgSetup(**body.model_dump(mode="json"))
    db.add(org)
    db.flush()
    ensure_templates(db, org.org_code)
    db.commit()
    db.refresh(org)
    return org


@router.get("/{org_code}", response_model=OrgRead)
def get_org(org: CurrentOrg, _: CurrentUser) -> OrgSetup:
    return org


@router.put("/{org_code}", response_model=OrgRead)
def update_org(body: OrgUpdate, org: CurrentOrg, db: DbSession, _: EditorUser) -> OrgSetup:
    """Save Organization. Only the fields sent are changed."""
    for field, value in body.model_dump(mode="json", exclude_unset=True).items():
        if field == "org_name" and value is None:
            continue
        setattr(org, field, value)
    db.commit()
    db.refresh(org)
    return org
