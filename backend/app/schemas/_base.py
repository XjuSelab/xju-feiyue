"""Shared pydantic config — wire format is camelCase JSON."""
from pydantic import BaseModel, ConfigDict


def to_camel(s: str) -> str:
    head, *tail = s.split("_")
    return head + "".join(p.title() for p in tail)


class CamelModel(BaseModel):
    """Base schema that emits camelCase JSON but accepts both casings on input."""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )
