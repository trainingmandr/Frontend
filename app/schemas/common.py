import re
from datetime import date, datetime
from decimal import Decimal
from typing import Annotated, Any

from pydantic import BaseModel, BeforeValidator, Field, PlainSerializer, StringConstraints, model_validator

def upper_strip(value: Any) -> Any:
    # Runs before the pattern check (StringConstraints' to_upper is applied after it)
    return value.strip().upper() if isinstance(value, str) else value


# Business codes (org_code, emp_code, designation_code, comp_code) are stored upper-case
Code = Annotated[
    str,
    BeforeValidator(upper_strip),
    StringConstraints(min_length=1, max_length=30, pattern=r"^[A-Z0-9_\-]+$"),
]

NonEmptyStr = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]

# YYYY-MM, year 2000-9999 (same rule as the month_year CHECK constraints)
MONTH_YEAR_PATTERN = r"^([2-9][0-9]{3})-(0[1-9]|1[0-2])$"
MonthYear = Annotated[str, StringConstraints(strip_whitespace=True, pattern=MONTH_YEAR_PATTERN)]


def _parse_date(value: Any) -> Any:
    """Accept ISO dates plus DD/MM/YYYY, DD-MM-YYYY (as typed in the UI or found in Excel)."""
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, str):
        text = value.strip()
        for fmt in ("%d/%m/%Y", "%d-%m-%Y", "%d.%m.%Y"):
            try:
                return datetime.strptime(text, fmt).date()
            except ValueError:
                pass
        return text
    return value


FlexibleDate = Annotated[date, BeforeValidator(_parse_date)]


def _parse_money(value: Any) -> Any:
    if isinstance(value, str):
        return value.replace("₹", "").replace(",", "").strip()
    return value


Money = Annotated[Decimal, BeforeValidator(_parse_money), Field(ge=0, max_digits=15, decimal_places=2)]
# Decimals are serialised as JSON numbers, not strings
MoneyOut = Annotated[Decimal, PlainSerializer(float, return_type=float, when_used="json")]


def compact_number(value: Any) -> Any:
    """Excel gives numbers as int/float; strip spaces and hyphens from ID-like numbers."""
    if isinstance(value, float) and value.is_integer():
        value = int(value)
    if isinstance(value, int):
        return str(value)
    if isinstance(value, str):
        return re.sub(r"[\s\-]", "", value)
    return value


class FormModel(BaseModel):
    """Treat blank strings sent by HTML forms as null."""

    @model_validator(mode="before")
    @classmethod
    def blank_strings_to_none(cls, data: Any) -> Any:
        if isinstance(data, dict):
            return {k: (None if isinstance(v, str) and not v.strip() else v) for k, v in data.items()}
        return data
