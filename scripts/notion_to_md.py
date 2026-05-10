"""Deterministic Notion recordMap → markdown converter.

Reads scripts/notion_raw/<slug>.json (the raw API response from notion_pull.py)
and emits a clean GFM markdown body to stdout (or writes to content/notes/<slug>.md
when invoked as `python notion_to_md.py write <slug>`).

By design, this is a pure JSON walker — no LLM. Each block type is mapped
1:1 from the recordMap. Use the agent QA pass on top of this for spot-checks.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = REPO_ROOT / "scripts" / "notion_raw"
OUT_DIR = REPO_ROOT / "content" / "notes"

# Notion language strings → fenced-code language hint (lowercase). Empty for
# anything that should be a plain code block (no syntax highlight).
LANG_MAP = {
    "bash": "bash",
    "shell": "bash",
    "zsh": "bash",
    "python": "python",
    "javascript": "js",
    "typescript": "ts",
    "json": "json",
    "yaml": "yaml",
    "toml": "toml",
    "ini": "ini",
    "markdown": "md",
    "plain text": "",
    "c": "c",
    "c++": "cpp",
    "cpp": "cpp",
    "java": "java",
    "go": "go",
    "rust": "rust",
    "ruby": "ruby",
    "html": "html",
    "css": "css",
    "scss": "scss",
    "sass": "sass",
    "vue": "vue",
    "sql": "sql",
    "diff": "diff",
    "docker": "dockerfile",
    "dockerfile": "dockerfile",
    "nginx": "nginx",
    "vim": "vim",
    "vimscript": "vim",
    "vim script": "vim",
}


def load(slug: str) -> tuple[str, dict]:
    """Return (page_uuid, blocks dict). page_uuid is the root page in this JSON."""
    path = RAW_DIR / f"{slug}.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    blocks = data["recordMap"]["block"]
    # The first chunk's first page-typed block is the root.
    page_uuid = None
    for bid, b in blocks.items():
        v = _block_value(blocks, bid)
        if v and v.get("type") == "page":
            page_uuid = bid
            break
    if not page_uuid:
        raise SystemExit(f"{slug}: no page block in recordMap")
    return page_uuid, blocks


def _block_value(blocks: dict, bid: str) -> dict | None:
    b = blocks.get(bid)
    if not b:
        return None
    v = b.get("value")
    if isinstance(v, dict) and "value" in v:
        return v["value"]
    return v


def _rt_to_md(runs: list | None) -> str:
    """Notion rich-text → inline markdown (handles b/i/c/s/_/a + plain text)."""
    if not runs:
        return ""
    out: list[str] = []
    for run in runs:
        if not run:
            continue
        text = run[0] if len(run) > 0 else ""
        fmts = run[1] if len(run) > 1 else []
        # Apply outermost formatting last.
        s = text
        link_url = None
        bold = italic = code = strike = under = False
        for fmt in fmts or []:
            if not fmt:
                continue
            tag = fmt[0]
            if tag == "b":
                bold = True
            elif tag == "i":
                italic = True
            elif tag == "c":
                code = True
            elif tag == "s":
                strike = True
            elif tag == "_":
                under = True
            elif tag == "a":
                link_url = fmt[1] if len(fmt) > 1 else None
        if code:
            s = f"`{s}`"
        if bold:
            s = f"**{s}**"
        if italic:
            s = f"*{s}*"
        if strike:
            s = f"~~{s}~~"
        if under:
            s = f"<u>{s}</u>"
        if link_url:
            s = f"[{s}]({link_url})"
        out.append(s)
    return "".join(out)


def _title(v: dict) -> str:
    return _rt_to_md(v.get("properties", {}).get("title"))


def _plain_title(v: dict) -> str:
    """Like _title but strips all inline formatting — for code blocks."""
    runs = v.get("properties", {}).get("title") or []
    return "".join(run[0] for run in runs if run and len(run) > 0)


def _lang(v: dict) -> str:
    raw = v.get("properties", {}).get("language") or [["plain text"]]
    val = (raw[0][0] if raw and raw[0] else "plain text").strip().lower()
    return LANG_MAP.get(val, val)


def render(blocks: dict, root_uuid: str) -> str:
    out: list[str] = []
    page = _block_value(blocks, root_uuid)
    for child_id in page.get("content") or []:
        _emit_block(blocks, child_id, out, depth=0, list_kind=None, list_index=[1])
    md = "\n".join(out)
    # collapse 3+ blank lines into 2
    while "\n\n\n\n" in md:
        md = md.replace("\n\n\n\n", "\n\n\n")
    return md.strip() + "\n"


def _emit_block(
    blocks: dict,
    bid: str,
    out: list[str],
    *,
    depth: int,
    list_kind: str | None,
    list_index: list[int],
) -> None:
    v = _block_value(blocks, bid)
    if not v:
        return
    btype = v.get("type")
    indent = "    " * depth

    # Downshift headers by one level: the page title renders as <h1> in the
    # frontend detail view, so body content starts at <h2>. Notion's "header"
    # is the page-level top heading, "sub_header" is a section, etc.
    if btype == "header":
        out.append("")
        out.append(f"## {_title(v)}".rstrip())
        out.append("")

    elif btype == "sub_header":
        out.append("")
        out.append(f"### {_title(v)}".rstrip())
        out.append("")

    elif btype == "sub_sub_header":
        out.append("")
        out.append(f"#### {_title(v)}".rstrip())
        out.append("")

    elif btype == "text":
        title = _title(v)
        if title.strip():
            out.append(f"{indent}{title}")
            out.append("")
        # text blocks can have children (indented continuations)
        for c in v.get("content") or []:
            _emit_block(
                blocks, c, out, depth=depth + (1 if title.strip() else 0),
                list_kind=None, list_index=[1],
            )

    elif btype == "bulleted_list":
        title = _title(v)
        out.append(f"{indent}- {title}".rstrip())
        for c in v.get("content") or []:
            _emit_block(blocks, c, out, depth=depth + 1, list_kind="ul", list_index=[1])

    elif btype == "numbered_list":
        # Note: Notion stores numbered list items in document order, so we
        # restart numbering at every group. Markdown happily renumbers `1.`
        # entries automatically, so we just emit `1. ` for every item.
        title = _title(v)
        out.append(f"{indent}1. {title}".rstrip())
        for c in v.get("content") or []:
            _emit_block(blocks, c, out, depth=depth + 1, list_kind="ol", list_index=[1])

    elif btype == "to_do":
        title = _title(v)
        checked = bool((v.get("properties", {}).get("checked") or [["No"]])[0][0] == "Yes")
        box = "[x]" if checked else "[ ]"
        out.append(f"{indent}- {box} {title}".rstrip())
        for c in v.get("content") or []:
            _emit_block(blocks, c, out, depth=depth + 1, list_kind=None, list_index=[1])

    elif btype == "code":
        # Notion stores code body in properties.title as rich-text runs, but
        # any inline link/bold formatting is meaningless inside a fence —
        # strip it so we don't emit `[label](url)` mid-code-block.
        body = _plain_title(v)
        lang = _lang(v)
        out.append("")
        out.append(f"```{lang}")
        out.append(body)
        out.append("```")
        out.append("")

    elif btype == "quote":
        title = _title(v)
        for line in title.split("\n"):
            out.append(f"{indent}> {line}".rstrip())
        out.append("")
        for c in v.get("content") or []:
            _emit_block(blocks, c, out, depth=depth, list_kind=None, list_index=[1])

    elif btype == "divider":
        out.append("")
        out.append("---")
        out.append("")

    elif btype == "callout":
        # Notion callout: header text in properties.title (often empty) +
        # children blocks with the body content. We render it as a blockquote
        # so the icon + body group together visually.
        icon_raw = (v.get("format") or {}).get("page_icon") or ""
        # Skip notion:// internal emoji URLs — they only resolve inside Notion.
        icon = icon_raw if icon_raw and not icon_raw.startswith("notion://") else ""
        title = _title(v)
        head = f"{icon} {title}".strip() if icon or title else ""
        if head:
            out.append(f"> {head}")
        # Capture children rendered into a temp list so we can prefix `> `.
        sub: list[str] = []
        for c in v.get("content") or []:
            _emit_block(blocks, c, sub, depth=0, list_kind=None, list_index=[1])
        for line in sub:
            if line == "":
                out.append(">")
            else:
                out.append(f"> {line}")
        out.append("")

    elif btype == "bookmark":
        link = ((v.get("properties") or {}).get("link") or [[""]])[0][0]
        title = ((v.get("properties") or {}).get("title") or [[""]])[0][0] or link
        if link:
            out.append("")
            out.append(f"[{title}]({link})")
            out.append("")

    elif btype in ("collection_view", "collection_view_page"):
        # Inline / referenced Notion database. The collection schema lives in
        # recordMap.collection (not loaded by loadPageChunk's first call), and
        # rows are separate block entries. Rendering full tables requires a
        # second API endpoint (queryCollection). For now leave a marker so the
        # reader can jump back to Notion for the data table.
        out.append("")
        out.append("> *（此节为 Notion 内嵌数据库 / 视图 — 详见 Notion 原页）*")
        out.append("")

    elif btype == "toggle":
        title = _title(v)
        out.append("")
        out.append(f"<details><summary>{title}</summary>")
        out.append("")
        for c in v.get("content") or []:
            _emit_block(blocks, c, out, depth=0, list_kind=None, list_index=[1])
        out.append("")
        out.append("</details>")
        out.append("")

    elif btype == "image":
        src_run = (v.get("properties", {}).get("source") or [[""]])[0]
        src = src_run[0] if src_run else ""
        alt = _title(v) or "image"
        if src:
            out.append("")
            out.append(f"![{alt}]({src})")
            out.append("")

    elif btype == "page":
        # Sub-page reference inside a page (rare for our content). Render as
        # a stub link.
        out.append(f"{indent}- [{_title(v)}](#)  *(子页)*")

    elif btype in ("column_list", "column"):
        for c in v.get("content") or []:
            _emit_block(blocks, c, out, depth=depth, list_kind=list_kind, list_index=list_index)

    elif btype == "table":
        _emit_table(blocks, v, out)

    elif btype == "table_row":
        # Should be consumed by table emitter, but fall through:
        pass

    elif btype == "equation":
        expr = (v.get("properties", {}).get("title") or [[""]])[0][0]
        out.append("")
        out.append("$$")
        out.append(expr)
        out.append("$$")
        out.append("")

    else:
        # Unknown: emit the title text if any, descend into children.
        title = _title(v)
        if title.strip():
            out.append(f"{indent}{title}")
        for c in v.get("content") or []:
            _emit_block(blocks, c, out, depth=depth, list_kind=None, list_index=[1])


def _emit_table(blocks: dict, table_v: dict, out: list[str]) -> None:
    # Notion table:
    #   table block has format.table_block_column_order = [colId1, colId2, ...]
    #   children are table_row blocks
    #   each row's properties has keys = colId, values = rich-text array
    fmt = table_v.get("format", {}) or {}
    col_ids = fmt.get("table_block_column_order") or []
    if not col_ids:
        return
    rows = []
    for row_id in table_v.get("content") or []:
        rv = _block_value(blocks, row_id)
        if not rv or rv.get("type") != "table_row":
            continue
        props = rv.get("properties", {}) or {}
        row = [_rt_to_md(props.get(cid)) for cid in col_ids]
        rows.append(row)
    if not rows:
        return
    has_header = bool(fmt.get("table_block_column_header"))
    out.append("")
    if has_header:
        header, body = rows[0], rows[1:]
    else:
        header = ["" for _ in col_ids]
        body = rows
    out.append("| " + " | ".join(c.replace("\n", " ").replace("|", "\\|") for c in header) + " |")
    out.append("| " + " | ".join("---" for _ in col_ids) + " |")
    for row in body:
        out.append("| " + " | ".join(c.replace("\n", " ").replace("|", "\\|") for c in row) + " |")
    out.append("")


def slug_to_md(slug: str) -> str:
    page_uuid, blocks = load(slug)
    return render(blocks, page_uuid)


def main(argv: list[str]) -> int:
    if len(argv) < 2:
        print("usage: notion_to_md.py <slug>          # print to stdout", file=sys.stderr)
        print("       notion_to_md.py write <slug>   # write to content/notes/<slug>.md.body", file=sys.stderr)
        print("       notion_to_md.py write all      # walk _index.json, write all bodies", file=sys.stderr)
        return 2
    if argv[1] == "write":
        target = argv[2] if len(argv) > 2 else "all"
        OUT_DIR.mkdir(parents=True, exist_ok=True)
        if target == "all":
            index = json.loads((RAW_DIR / "_index.json").read_text(encoding="utf-8"))
            slugs = [e["slug"] for e in index]
        else:
            slugs = [target]
        for slug in slugs:
            md = slug_to_md(slug)
            (OUT_DIR / f"{slug}.md.body").write_text(md, encoding="utf-8")
            print(f"wrote {OUT_DIR / f'{slug}.md.body'}: {len(md)} B")
        return 0
    print(slug_to_md(argv[1]))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
