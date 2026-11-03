from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, Path, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import decode_token
from app.db.session import get_db
from app.models.org import OrgSetup
from app.models.user import Role, User
from app.schemas.common import MONTH_YEAR_PATTERN

# tokenUrl points at the form-based endpoint so Swagger's "Authorize" button works
oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_PREFIX}/auth/token")

DbSession = Annotated[Session, Depends(get_db)]


def get_current_user(db: DbSession, token: Annotated[str, Depends(oauth2_scheme)]) -> User:
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_token(token)
        user_id = int(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        raise credentials_error

    user = db.get(User, user_id)
    if user is None or not user.is_active:
        raise credentials_error
    # Picked up by the audit log listener
    db.info["user_id"] = user.id
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def require_roles(*roles: Role):
    """Dependency factory: `Depends(require_roles(Role.ADMIN))` restricts an endpoint to those roles."""

    def checker(user: CurrentUser) -> User:
        if user.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions")
        return user

    return checker


AdminUser = Annotated[User, Depends(require_roles(Role.ADMIN))]
# Can create/modify master data and payroll
EditorUser = Annotated[User, Depends(require_roles(Role.ADMIN, Role.MANAGER))]


def get_org(org_code: str, db: DbSession) -> OrgSetup:
    org = db.get(OrgSetup, org_code.upper())
    if org is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Organisation '{org_code}' not found")
    return org


CurrentOrg = Annotated[OrgSetup, Depends(get_org)]

MonthPath = Annotated[str, Path(pattern=MONTH_YEAR_PATTERN, description="YYYY-MM", examples=["2026-10"])]


def is_masked(user: User) -> bool:
    """Plain users see PAN / Aadhaar / bank account numbers masked."""
    return user.role == Role.USER
