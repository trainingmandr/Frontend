from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import and_, func, select

from app.api.deps import CurrentOrg, CurrentUser, DbSession, EditorUser
from app.models.employee import EmpDetails
from app.models.org import Designation, OrgDesignation
from app.schemas.org import (
    DesignationAvailability,
    DesignationCreate,
    DesignationRead,
    OrgDesignationAssign,
    OrgDesignationRead,
    OrgDesignationToggle,
)

# Global designation master: /designations
router = APIRouter()
# Per-organisation designations: /orgs/{org_code}/designations
org_router = APIRouter()


@router.get("", response_model=list[DesignationRead])
def list_designations(db: DbSession, _: CurrentUser) -> list[Designation]:
    return list(db.scalars(select(Designation).order_by(Designation.designation_name)))


@router.post("", response_model=DesignationRead, status_code=status.HTTP_201_CREATED)
def create_designation(body: DesignationCreate, db: DbSession, _: EditorUser) -> Designation:
    if db.get(Designation, body.designation_code) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail=f"Designation '{body.designation_code}' already exists"
        )
    designation = Designation(**body.model_dump())
    db.add(designation)
    db.commit()
    db.refresh(designation)
    return designation


def _org_designations(db: DbSession, org_code: str, designation_code: str | None = None) -> list[OrgDesignationRead]:
    emp_counts = (
        select(EmpDetails.designation_code, func.count().label("employee_count"))
        .where(EmpDetails.org_code == org_code)
        .group_by(EmpDetails.designation_code)
        .subquery()
    )
    query = (
        select(OrgDesignation, Designation.designation_name, func.coalesce(emp_counts.c.employee_count, 0))
        .join(Designation, Designation.designation_code == OrgDesignation.designation_code)
        .outerjoin(emp_counts, emp_counts.c.designation_code == OrgDesignation.designation_code)
        .where(OrgDesignation.org_code == org_code)
        .order_by(Designation.designation_name)
    )
    if designation_code is not None:
        query = query.where(OrgDesignation.designation_code == designation_code)
    return [
        OrgDesignationRead(
            designation_code=od.designation_code,
            designation_name=name,
            is_active=od.is_active,
            effective_from=od.effective_from,
            effective_to=od.effective_to,
            employee_count=count,
        )
        for od, name, count in db.execute(query)
    ]


def _get_mapping(db: DbSession, org_code: str, designation_code: str) -> OrgDesignation:
    mapping = db.get(OrgDesignation, (org_code, designation_code.upper()))
    if mapping is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Designation '{designation_code}' is not assigned to '{org_code}'",
        )
    return mapping


@org_router.get("", response_model=list[OrgDesignationRead])
def list_org_designations(
    org: CurrentOrg, db: DbSession, _: CurrentUser, active_only: bool = Query(False)
) -> list[OrgDesignationRead]:
    """Designations assigned to this organisation ("Designation for {org}")."""
    items = _org_designations(db, org.org_code)
    return [d for d in items if d.is_active] if active_only else items


@org_router.get("/available", response_model=list[DesignationAvailability])
def list_available_designations(org: CurrentOrg, db: DbSession, _: CurrentUser) -> list[DesignationAvailability]:
    """Every designation in the master, with its toggle state for this organisation."""
    rows = db.execute(
        select(Designation, OrgDesignation.is_active)
        .outerjoin(
            OrgDesignation,
            and_(
                OrgDesignation.designation_code == Designation.designation_code,
                OrgDesignation.org_code == org.org_code,
            ),
        )
        .order_by(Designation.designation_name)
    )
    return [
        DesignationAvailability(
            designation_code=d.designation_code,
            designation_name=d.designation_name,
            assigned=is_active is not None,
            is_active=bool(is_active),
        )
        for d, is_active in rows
    ]


@org_router.post("", response_model=OrgDesignationRead, status_code=status.HTTP_201_CREATED)
def assign_designation(
    body: OrgDesignationAssign, org: CurrentOrg, db: DbSession, _: EditorUser
) -> OrgDesignationRead:
    """Custom designation card: creates the designation if the code is new, then assigns it to the org."""
    designation = db.get(Designation, body.designation_code)
    if designation is None:
        if not body.designation_name:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="designation_name is required for a new designation",
            )
        designation = Designation(designation_code=body.designation_code, designation_name=body.designation_name)
        db.add(designation)
        db.flush()
    elif body.designation_name and body.designation_name != designation.designation_name:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Designation code '{body.designation_code}' already exists as '{designation.designation_name}'",
        )

    if db.get(OrgDesignation, (org.org_code, body.designation_code)) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Designation '{body.designation_code}' is already assigned to '{org.org_code}'",
        )

    db.add(
        OrgDesignation(
            org_code=org.org_code,
            designation_code=body.designation_code,
            effective_from=body.effective_from,
            effective_to=body.effective_to,
        )
    )
    db.commit()
    return _org_designations(db, org.org_code, body.designation_code)[0]


@org_router.patch("/{designation_code}", response_model=OrgDesignationRead)
def toggle_designation(
    designation_code: str, body: OrgDesignationToggle, org: CurrentOrg, db: DbSession, _: EditorUser
) -> OrgDesignationRead:
    """Toggle a designation on/off for the org. Turning on an unassigned designation assigns it."""
    code = designation_code.upper()
    mapping = db.get(OrgDesignation, (org.org_code, code))
    if mapping is None:
        if db.get(Designation, code) is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Designation '{code}' not found")
        mapping = OrgDesignation(org_code=org.org_code, designation_code=code)
        db.add(mapping)
    mapping.is_active = body.is_active
    db.commit()
    return _org_designations(db, org.org_code, code)[0]


@org_router.delete("/{designation_code}", status_code=status.HTTP_204_NO_CONTENT)
def remove_designation(designation_code: str, org: CurrentOrg, db: DbSession, _: EditorUser) -> None:
    mapping = _get_mapping(db, org.org_code, designation_code)
    in_use = db.scalar(
        select(func.count())
        .select_from(EmpDetails)
        .where(EmpDetails.org_code == org.org_code, EmpDetails.designation_code == mapping.designation_code)
    )
    if in_use:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"{in_use} employee(s) have this designation. Deactivate it instead of removing it.",
        )
    db.delete(mapping)
    db.commit()
