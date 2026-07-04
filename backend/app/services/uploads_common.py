"""Shared upload infrastructure — reused by `/notes/files` and `/materials`.

Consolidates the upload primitives that both the writing-pane attachment
feature (`docs/plan-file-upload.md`) and the materials page
(`docs/plan-materials-integration.md`) need, so neither route hand-rolls
its own validation / disk-write logic:

- extension allowlists (doc + image) and the canonical ext→MIME table;
- a unified 50 MB cap (`MAX_UPLOAD_BYTES`);
- an explicit deny-list (`DENY_EXTS`) for browser-executable types;
- `sniff_magic(ext, head_bytes)` — pure-stdlib magic-byte cross-check
  (no new dependency: OOXML is validated with `zipfile`);
- `save_upload(file, dest_dir)` — streaming chunked write that aborts
  *before* the bytes are fully read once `MAX_UPLOAD_BYTES` is exceeded
  (never `await file.read()` first);
- `safe_display_name(raw)` — strips control chars, escapes markdown
  meta-characters, truncates to 200.

`dest_dir` is always passed in by the caller so tests can monkeypatch the
target directory (each route owns its own `<sid>/...` layout).

------------------------------------------------------------------------
`/uploads` static hardening (plan §5 — done once, here documented)
------------------------------------------------------------------------
The StaticFiles mount at `/uploads` (app/main.py) serves these files as
public direct links. Two defenses, both required:

  1. *Deny at upload time* — `DENY_EXTS` rejects `.svg/.html/.htm/.xml`
     so a browser can never be tricked into executing an uploaded file
     as a page/script (stored XSS). This module enforces it.

  2. *Harden the static response* — doc-class responses MUST carry
     `X-Content-Type-Options: nosniff` (stop MIME-sniffing a payload
     into HTML) + `Content-Disposition: attachment` (force download
     rather than inline render).

     DECISION (plan §5: "二选一并在产物注释写清"): defense #2 is
     implemented at the **nginx** layer in production, NOT in the
     FastAPI StaticFiles mount. The `location /uploads/` block on
     huawei2 must add:

         location /uploads/ {
             add_header X-Content-Type-Options "nosniff" always;
             # doc-class extensions: force download, never inline
             location ~* \\.(pdf|docx?|pptx?|xlsx?)$ {
                 add_header X-Content-Type-Options "nosniff" always;
                 add_header Content-Disposition "attachment" always;
             }
         }

     Rationale for nginx over a custom StaticFiles subclass: the mount
     in main.py is shared by avatars/images (which we *want* inline),
     prod already terminates these requests at nginx (winbeau.top is
     served by huawei2 nginx), and keeping the header policy in nginx
     avoids per-response Python overhead. The deny-list (#1) is the
     in-app half and lives here; #2 is the ops half and is documented
     here so the PR/runbook can carry it to the prod nginx config.
"""
from __future__ import annotations

import io
import secrets
import time
import zipfile
from dataclasses import dataclass
from pathlib import Path

from fastapi import HTTPException, UploadFile
from PIL import Image

# ---------------------------------------------------------------------------
# Limits
# ---------------------------------------------------------------------------

# Unified upload cap across `/notes/files` and `/materials` (course decks
# can be large). HF `dir_tar` bloat is bounded by this per-file ceiling plus
# the single-writer push/pull discipline.
MAX_UPLOAD_BYTES = 50 * 1024 * 1024  # 50 MB

# Streamed in 1 MiB chunks; the running total is checked per chunk so an
# over-size upload is aborted before its bytes are ever fully buffered.
_CHUNK_SIZE = 1024 * 1024  # 1 MiB

# Display-name truncation ceiling.
_MAX_NAME_LEN = 200

# ---------------------------------------------------------------------------
# Extension allowlists + canonical MIME table
# ---------------------------------------------------------------------------

ALLOWED_DOC_EXTS = {
    ".pdf",
    ".doc",
    ".docx",
    ".ppt",
    ".pptx",
    ".xls",
    ".xlsx",
}

ALLOWED_IMAGE_EXTS = {
    ".png",
    ".jpg",
    ".jpeg",
    ".webp",
    ".gif",
}

# ext → canonical MIME. We serve/store *this* rather than the
# client-supplied (and forgeable) Content-Type.
EXT_TO_MIME = {
    ".pdf": "application/pdf",
    ".doc": "application/msword",
    ".docx": (
        "application/vnd.openxmlformats-officedocument"
        ".wordprocessingml.document"
    ),
    ".ppt": "application/vnd.ms-powerpoint",
    ".pptx": (
        "application/vnd.openxmlformats-officedocument"
        ".presentationml.presentation"
    ),
    ".xls": "application/vnd.ms-excel",
    ".xlsx": (
        "application/vnd.openxmlformats-officedocument"
        ".spreadsheetml.sheet"
    ),
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
}

# Explicitly refused, even though some could pass a naive image/doc check.
# A browser renders these as *executable pages* when fetched from the public
# /uploads mount, so an attacker uploading `payload.svg`/`payload.html` gets
# stored XSS. First line of defense (the second is the nginx nosniff +
# Content-Disposition header, documented in the module docstring).
DENY_EXTS = {".svg", ".html", ".htm", ".xml"}

# OOXML subtype → required directory prefix inside the zip. A real .docx
# always contains `word/` entries, .xlsx `xl/`, .pptx `ppt/`. Catches a
# .xlsx renamed to .docx etc.
_OOXML_DIR_PREFIX = {
    ".docx": "word/",
    ".xlsx": "xl/",
    ".pptx": "ppt/",
}

# Legacy OLE2 compound-file family (old binary .doc/.xls/.ppt).
_OLE2_EXTS = {".doc", ".xls", ".ppt"}

# Magic byte signatures.
_PDF_MAGIC = b"%PDF-"
_ZIP_MAGICS = (b"PK\x03\x04", b"PK\x05\x06", b"PK\x07\x08")
_OLE2_MAGIC = b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"

# Image magic signatures (header-only; a full PIL decode is the caller's
# job — image routes already run PIL). Cheap pre-screen so a renamed
# executable can't masquerade as an image purely by extension.
_PNG_MAGIC = b"\x89PNG\r\n\x1a\n"
_GIF_MAGICS = (b"GIF87a", b"GIF89a")
_JPEG_MAGIC = b"\xff\xd8\xff"
_WEBP_RIFF = b"RIFF"
_WEBP_TAG = b"WEBP"


@dataclass(frozen=True)
class SavedFile:
    """Result of a successful `save_upload`.

    `fname` is the on-disk basename (`<ts>-<rand>.<ext>`); the caller
    composes the public URL and persists it. `ext` is the lowercased
    extension (with leading dot); `mime` is the canonical MIME from
    `EXT_TO_MIME` (never the client-supplied Content-Type).
    """

    fname: str
    size: int
    mime: str
    ext: str


def normalize_ext(filename: str | None) -> str:
    """Lowercased extension (with leading dot) from a filename, or ``""``."""
    if not filename:
        return ""
    return Path(filename).suffix.lower()


def make_thumbnail(data: bytes, out_path: Path, px: int = 160) -> None:
    """Decode an uploaded image, downscale to `px` long-edge, write JPEG.

    Shared by user avatars (routes/auth.py) and group logos
    (routes/groups.py). Raises ``PIL.UnidentifiedImageError`` on undecodable
    bytes — callers translate that into their 400. 160 px covers 2x DPR on an
    80 px chip and weighs only ~5 KB as JPEG.
    """
    img = Image.open(io.BytesIO(data))
    img.load()  # force decode now so bad files raise here, not later
    if img.mode not in ("RGB", "L"):
        img = img.convert("RGB")
    img.thumbnail((px, px))
    img.save(out_path, "JPEG", quality=85, optimize=True)


def sniff_magic(ext: str, head_bytes: bytes) -> bool:
    """Cross-check a file's leading bytes against its claimed extension.

    Pure stdlib (no python-magic / libmagic dependency). `head_bytes`
    should be the first chunk of the file; for OOXML the *whole* file may
    be needed to open the zip central directory, so callers pass enough
    bytes (in practice the entire payload, which is already buffered for
    images and capped at `MAX_UPLOAD_BYTES`).

    Returns True when the magic bytes are consistent with `ext`'s family.
    Unknown / denied extensions return False (caller already rejects them
    on the allowlist, but defensive).
    """
    ext = ext.lower()

    if ext == ".pdf":
        return head_bytes[:5] == _PDF_MAGIC

    if ext in _OOXML_DIR_PREFIX:
        # Must be a zip *and* contain the OOXML manifest + the subtype's
        # directory prefix. Rejects a plain zip or a cross-renamed OOXML.
        if head_bytes[:4] not in _ZIP_MAGICS:
            return False
        try:
            with zipfile.ZipFile(io.BytesIO(head_bytes)) as zf:
                names = zf.namelist()
        except (zipfile.BadZipFile, OSError, ValueError):
            return False
        if "[Content_Types].xml" not in names:
            return False
        prefix = _OOXML_DIR_PREFIX[ext]
        return any(n.startswith(prefix) for n in names)

    if ext in _OLE2_EXTS:
        return head_bytes[:8] == _OLE2_MAGIC

    if ext == ".png":
        return head_bytes[:8] == _PNG_MAGIC
    if ext == ".gif":
        return head_bytes[:6] in _GIF_MAGICS
    if ext in (".jpg", ".jpeg"):
        return head_bytes[:3] == _JPEG_MAGIC
    if ext == ".webp":
        return head_bytes[:4] == _WEBP_RIFF and head_bytes[8:12] == _WEBP_TAG

    return False


def safe_display_name(raw: str | None) -> str:
    """Sanitize a user-supplied filename for safe markdown/UI display.

    The on-disk name is always server-generated (`<ts>-<rand>.<ext>`); this
    only governs the *display* name persisted/returned. We:

    - strip control characters (incl. CR/LF/TAB) that could break the link
      line or smuggle terminal escapes;
    - escape markdown meta-characters ``[ ] ( ) ` * < >`` so a crafted name
      like ``a](http://evil)`` can't break out of a ``[name](url)`` link or
      inject markup;
    - collapse leading/trailing whitespace and truncate to 200 chars.

    A blank result falls back to ``"file"`` so the UI never renders an
    empty link label.
    """
    if not raw:
        return "file"

    # Drop control chars (C0 + DEL). `str.isprintable()` would also nuke
    # spaces; we keep spaces and only filter the dangerous range.
    cleaned = "".join(ch for ch in raw if ch == " " or (ord(ch) >= 0x20 and ord(ch) != 0x7F))

    # Escape markdown meta-characters with a backslash. Order doesn't
    # matter since each is replaced independently.
    for meta in ("\\", "[", "]", "(", ")", "`", "*", "<", ">"):
        # Escape backslash first (it's in the loop head) so we don't
        # double-escape the escapes we add afterwards.
        cleaned = cleaned.replace(meta, "\\" + meta)

    cleaned = cleaned.strip()
    if len(cleaned) > _MAX_NAME_LEN:
        cleaned = cleaned[:_MAX_NAME_LEN].rstrip()

    return cleaned or "file"


async def save_upload(file: UploadFile, dest_dir: Path) -> SavedFile:
    """Stream an upload to ``dest_dir/<ts>-<rand>.<ext>`` with validation.

    Validation order (each raises ``HTTPException(400)`` with a Chinese
    detail, matching the existing image route):

    1. extension on the doc/image allowlist and **not** on `DENY_EXTS`;
    2. streamed chunked write — the running byte total is checked per
       chunk, so an over-`MAX_UPLOAD_BYTES` upload aborts *before* the
       whole body is read (no `await file.read()` of the full payload);
    3. empty body rejected;
    4. magic-byte sniff (`sniff_magic`) against the claimed extension.

    On any failure the partially written temp file is unlinked. On success
    returns a `SavedFile`. `dest_dir` is created (parents=True) and is
    passed in by the caller so tests can monkeypatch the target.
    """
    ext = normalize_ext(file.filename)

    # 1. allowlist + explicit deny.
    if ext in DENY_EXTS:
        raise HTTPException(status_code=400, detail="该文件类型不被允许")
    allowed = ALLOWED_DOC_EXTS | ALLOWED_IMAGE_EXTS
    if ext not in allowed:
        raise HTTPException(
            status_code=400, detail="仅支持 pdf / word / ppt / excel / 图片"
        )

    dest_dir.mkdir(parents=True, exist_ok=True)
    fname = f"{int(time.time())}-{secrets.token_hex(4)}{ext}"
    target = dest_dir / fname

    size = 0
    # Buffer the leading bytes for the magic sniff. OOXML needs the whole
    # file to read the zip central directory, so we accumulate the full
    # payload in memory only up to the (already enforced) size cap.
    sniff_buf = bytearray()
    try:
        with target.open("wb") as out:
            while True:
                chunk = await file.read(_CHUNK_SIZE)
                if not chunk:
                    break
                size += len(chunk)
                # 2. abort before reading the rest of an over-size body.
                if size > MAX_UPLOAD_BYTES:
                    raise HTTPException(
                        status_code=400, detail="文件不能超过 50 MB"
                    )
                out.write(chunk)
                sniff_buf.extend(chunk)

        # 3. empty body.
        if size == 0:
            raise HTTPException(status_code=400, detail="文件为空")

        # 4. magic sniff against the claimed extension.
        if not sniff_magic(ext, bytes(sniff_buf)):
            raise HTTPException(status_code=400, detail="文件内容与类型不符")
    except BaseException:
        # Clean up the partial/invalid temp file on any error (incl. the
        # HTTPExceptions raised above) so we never leave orphans on disk.
        target.unlink(missing_ok=True)
        raise

    return SavedFile(
        fname=fname,
        size=size,
        mime=EXT_TO_MIME.get(ext, "application/octet-stream"),
        ext=ext,
    )
