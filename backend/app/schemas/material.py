"""Pydantic schemas for the /materials/* domain.

Wire format is camelCase (see app/schemas/_base.py::CamelModel) — the
materials page is regular Aurash UGC, unlike the snake_case /schools
domain. Mirrors frontend src/api/schemas/material.ts.

The file tree is recursive: ``FileOut.children`` is a list of ``FileOut``,
so the model needs a forward reference + ``model_rebuild()`` to resolve it.
``FileOut`` instances are always built from plain Python dicts assembled by
the service's flat-SELECT grouping — **never** ``from_attributes`` mapping
of the ORM ``.children``/``.files`` relationships (those are ``lazy="raise"``
and would blow up off the event loop). See plan-materials §4.
"""
from __future__ import annotations

from typing import Literal

from pydantic import Field

from app.schemas._base import CamelModel, UtcDateTime

# Course type — shown as the resource card's corner badge and used as the
# list-page filter tabs. NULL = unclassified (no badge). Only these three
# values can ever be stored (Create/Update validate against this Literal).
MaterialTag = Literal["专业课", "通识课", "实验课"]
# Where the dragged node lands relative to the drop target.
ReorderPosition = Literal["before", "after", "inside"]


class FileOut(CamelModel):
    """A node in the resource file tree — a file or a folder.

    Folders carry ``isFolder=True`` and a ``children`` list; files carry
    ``ext``/``mime``/``size``/``sizeBytes``/``url`` and an empty ``children``.
    ``size`` is a human-readable string ("1.2 MB"); ``sizeBytes`` is the raw
    count for the client to format/sort on if it prefers.
    """

    id: str
    name: str
    is_folder: bool
    ext: str | None = None
    mime: str | None = None
    # Human-readable size ("1.2 MB"); None for folders.
    size: str | None = None
    size_bytes: int | None = None
    url: str | None = None
    children: list[FileOut] = Field(default_factory=list)


class ResourceOut(CamelModel):
    """A material resource card + (optionally) its assembled file tree."""

    id: str
    title: str
    description: str = ""
    tag: MaterialTag | None = None
    owner_sid: str
    # `onupdate=now` mirror — the card's "更新于" timestamp.
    update_date: UtcDateTime
    created_at: UtcDateTime
    files: list[FileOut] = Field(default_factory=list)


class ResourceCreateIn(CamelModel):
    title: str
    description: str | None = None
    tag: MaterialTag | None = None


class ResourceUpdateIn(CamelModel):
    """Partial update body for PATCH /materials/resources/{rid}."""

    title: str | None = None
    description: str | None = None
    # `tag` is deliberately required-optional: omitting it leaves the tag
    # unchanged; the client clears a tag by sending `tag=null` explicitly.
    tag: MaterialTag | None = None


class FolderCreateIn(CamelModel):
    name: str
    # Parent folder id; null/omitted = create at the resource root.
    parent_id: str | None = None


class RenameIn(CamelModel):
    name: str


class ReorderIn(CamelModel):
    """Body for POST /materials/files/reorder.

    Move ``dragId`` relative to ``dropId``: ``before``/``after`` make them
    siblings, ``inside`` makes ``dragId`` a child of the (folder) ``dropId``.
    """

    drag_id: str
    drop_id: str
    position: ReorderPosition


# ---------------------------------------------------------------------------
# Acknowledgment notice (the credits bar on the materials list page)
# ---------------------------------------------------------------------------


class NoticeOut(CamelModel):
    """The materials-page acknowledgment bar.

    ``content`` is plain text (the client linkifies any bare ``http(s)`` URL).
    ``visible=False`` means an admin has hidden it — the client renders nothing
    for regular users, and an "add" affordance for admins.
    """

    content: str
    visible: bool
    update_date: UtcDateTime


class NoticeUpdateIn(CamelModel):
    """Body for PUT /materials/notice (admin only). Sets content + shows it."""

    content: str


# Resolve the recursive `FileOut.children` forward reference.
FileOut.model_rebuild()
