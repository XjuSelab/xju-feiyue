"""AI compose schemas — mirrors frontend src/api/schemas/ai.ts."""
from typing import Any, Literal

from pydantic import Field

from app.schemas._base import CamelModel

AIComposeMode = Literal["polish", "shorten", "expand", "tone", "translate", "custom"]
DiffType = Literal["equal", "add", "del"]


class DiffSegment(CamelModel):
    type: DiffType
    text: str


class AIComposeIn(CamelModel):
    mode: AIComposeMode
    text: str = Field(min_length=1)
    options: dict[str, Any] | None = None


class AIComposeOut(CamelModel):
    segments: list[DiffSegment]
    before: str
    after: str
    elapsed_ms: int = Field(ge=0)
