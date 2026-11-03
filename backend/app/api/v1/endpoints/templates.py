from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, status

from app.api.deps import AdminUser, CurrentOrg, CurrentUser, DbSession, EditorUser
from app.models.org import OrgTemplate, TemplateType
from app.schemas.org import TemplateRead, TemplateUpdate
from app.services.templates import ensure_templates

# Mounted at /orgs/{org_code}/templates
router = APIRouter()


def _get_template(db: DbSession, org_code: str, template_type: TemplateType) -> OrgTemplate:
    templates = ensure_templates(db, org_code)
    db.commit()
    return next(t for t in templates if t.template_type == template_type.value)


@router.get("", response_model=list[TemplateRead])
def list_templates(org: CurrentOrg, db: DbSession, _: CurrentUser) -> list[OrgTemplate]:
    templates = ensure_templates(db, org.org_code)
    db.commit()
    return templates


@router.get("/{template_type}", response_model=TemplateRead)
def view_template(template_type: TemplateType, org: CurrentOrg, db: DbSession, _: CurrentUser) -> OrgTemplate:
    """View button: returns the PAYSLIP template. The email is entered when sending."""
    return _get_template(db, org.org_code, template_type)


@router.put("/{template_type}", response_model=TemplateRead)
def update_template(
    template_type: TemplateType, body: TemplateUpdate, org: CurrentOrg, db: DbSession, _: EditorUser
) -> OrgTemplate:
    template = _get_template(db, org.org_code, template_type)
    if template.is_locked:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Template is locked. Unlock it to edit.")
    for field, value in body.model_dump(exclude_unset=True).items():
        if field == "body" and value is None:
            continue
        setattr(template, field, value)
    db.commit()
    db.refresh(template)
    return template


@router.post("/{template_type}/lock", response_model=TemplateRead)
def lock_template(template_type: TemplateType, org: CurrentOrg, db: DbSession, user: EditorUser) -> OrgTemplate:
    template = _get_template(db, org.org_code, template_type)
    if not template.is_locked:
        template.is_locked = True
        template.locked_at = datetime.now(timezone.utc)
        template.locked_by = user.id
        db.commit()
        db.refresh(template)
    return template


@router.post("/{template_type}/unlock", response_model=TemplateRead)
def unlock_template(template_type: TemplateType, org: CurrentOrg, db: DbSession, _: AdminUser) -> OrgTemplate:
    template = _get_template(db, org.org_code, template_type)
    if template.is_locked:
        template.is_locked = False
        template.locked_at = None
        template.locked_by = None
        db.commit()
        db.refresh(template)
    return template
