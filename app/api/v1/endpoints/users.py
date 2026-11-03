from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, select

from app.api.deps import AdminUser, DbSession
from app.core.security import hash_password
from app.models.user import User
from app.schemas.user import UserCreate, UserList, UserRead, UserUpdate

router = APIRouter()


def _get_or_404(db: DbSession, user_id: int) -> User:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


def _ensure_email_free(db: DbSession, email: str, exclude_id: int | None = None) -> None:
    query = select(User.id).where(User.email == email)
    if exclude_id is not None:
        query = query.where(User.id != exclude_id)
    if db.scalar(query) is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")


@router.get("", response_model=UserList)
def list_users(
    db: DbSession,
    _: AdminUser,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
) -> UserList:
    total = db.scalar(select(func.count()).select_from(User)) or 0
    users = db.scalars(select(User).order_by(User.id).offset(skip).limit(limit)).all()
    return UserList(items=[UserRead.model_validate(u) for u in users], total=total, skip=skip, limit=limit)


@router.post("", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def create_user(body: UserCreate, db: DbSession, _: AdminUser) -> User:
    email = body.email.lower()
    _ensure_email_free(db, email)
    user = User(
        email=email,
        full_name=body.full_name,
        hashed_password=hash_password(body.password),
        role=body.role,
        is_active=body.is_active,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.get("/{user_id}", response_model=UserRead)
def get_user(user_id: int, db: DbSession, _: AdminUser) -> User:
    return _get_or_404(db, user_id)


@router.patch("/{user_id}", response_model=UserRead)
def update_user(user_id: int, body: UserUpdate, db: DbSession, _: AdminUser) -> User:
    user = _get_or_404(db, user_id)
    data = body.model_dump(exclude_unset=True)

    if data.get("email") is not None:
        data["email"] = data["email"].lower()
        _ensure_email_free(db, data["email"], exclude_id=user.id)
    password = data.pop("password", None)
    if password:
        user.hashed_password = hash_password(password)

    for field, value in data.items():
        if value is not None:
            setattr(user, field, value)

    db.commit()
    db.refresh(user)
    return user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: int, db: DbSession, admin: AdminUser) -> None:
    if user_id == admin.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot delete your own account")
    user = _get_or_404(db, user_id)
    db.delete(user)
    db.commit()
