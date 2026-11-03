"""Writes an audit_log row for every insert/update/delete of audited tables made through the ORM.

The acting user's id is taken from session.info["user_id"] (set by get_current_user).
"""

import enum
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import event, inspect
from sqlalchemy.orm import Session
from sqlalchemy.orm.base import NO_VALUE

from app.models.payroll import AuditLog

AUDITED_TABLES = {
    "org_setup",
    "designation",
    "org_designation",
    "org_template",
    "emp_details",
    "bank_details",
    "education_details",
    "components",
    "emp_salary_components",
    "transactions",
    "payroll_summary",
}
# Never copied into audit images
IGNORED_COLUMNS = {"created_at", "updated_at", "created_on"}


def _json(value: Any) -> Any:
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, enum.Enum):
        return value.value
    if isinstance(value, uuid.UUID):
        return str(value)
    return value


def _record_key(obj: Any) -> dict[str, Any]:
    mapper = inspect(obj).mapper
    return {col.key: _json(getattr(obj, col.key)) for col in mapper.primary_key}


def _snapshot(obj: Any) -> dict[str, Any]:
    state = inspect(obj)
    image = {}
    for attr in state.mapper.column_attrs:
        if attr.key in IGNORED_COLUMNS:
            continue
        value = state.attrs[attr.key].loaded_value
        if value is not NO_VALUE:
            image[attr.key] = _json(value)
    return image


def _changes(obj: Any) -> tuple[dict[str, Any], dict[str, Any]]:
    state = inspect(obj)
    before, after = {}, {}
    for attr in state.mapper.column_attrs:
        if attr.key in IGNORED_COLUMNS:
            continue
        history = state.attrs[attr.key].history
        if not history.has_changes():
            continue
        old = history.deleted[0] if history.deleted else None
        new = history.added[0] if history.added else None
        if _json(old) == _json(new):
            continue
        before[attr.key] = _json(old)
        after[attr.key] = _json(new)
    return before, after


def _after_flush(session: Session, _flush_context) -> None:
    user_id = session.info.get("user_id")
    rows: list[dict[str, Any]] = []

    def add(obj: Any, action: str, before: dict | None, after: dict | None) -> None:
        rows.append(
            {
                "org_code": getattr(obj, "org_code", None),
                "table_name": obj.__tablename__,
                "record_key": _record_key(obj),
                "action": action,
                "before_image": before,
                "after_image": after,
                "changed_by": user_id,
            }
        )

    for obj in session.new:
        if getattr(obj, "__tablename__", None) in AUDITED_TABLES:
            add(obj, "INSERT", None, _snapshot(obj))
    for obj in session.dirty:
        if getattr(obj, "__tablename__", None) in AUDITED_TABLES and session.is_modified(obj):
            before, after = _changes(obj)
            if after:
                add(obj, "UPDATE", before, after)
    for obj in session.deleted:
        if getattr(obj, "__tablename__", None) in AUDITED_TABLES:
            add(obj, "DELETE", _snapshot(obj), None)

    if rows:
        session.connection().execute(AuditLog.__table__.insert(), rows)


def register(session_factory) -> None:
    event.listen(session_factory, "after_flush", _after_flush)
