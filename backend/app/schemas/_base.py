"""Shared pydantic config — wire format is camelCase JSON."""
from datetime import datetime, timezone
from typing import Annotated

from pydantic import BaseModel, ConfigDict, PlainSerializer


def to_camel(s: str) -> str:
    head, *tail = s.split("_")
    return head + "".join(p.title() for p in tail)


def _utc_iso_z(v: datetime) -> str:
    """Always emit ISO 8601 UTC with the `Z` suffix (per BACKEND_SPEC §1).

    SQLite drops timezone info on `DateTime(timezone=True)` columns, so a value
    written as tz-aware comes back naive. We treat naive datetimes as UTC.
    """
    if v.tzinfo is None:
        v = v.replace(tzinfo=timezone.utc)
    return v.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


UtcDateTime = Annotated[datetime, PlainSerializer(_utc_iso_z, return_type=str)]


class CamelModel(BaseModel):
    """Base schema that emits camelCase JSON but accepts both casings on input."""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )
