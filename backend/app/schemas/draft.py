"""Draft schemas — see BACKEND_SPEC.md §3 (Drafts)."""
from pydantic import Field

from app.schemas._base import CamelModel, UtcDateTime
from app.schemas.note import CategoryId


class DraftIn(CamelModel):
    title: str | None = None
    content: str | None = None
    category: CategoryId | None = None
    tags: list[str] | None = None


class DraftOut(CamelModel):
    id: str
    title: str
    content: str
    category: CategoryId | None = None
    tags: list[str] = Field(default_factory=list)
    updated_at: UtcDateTime
