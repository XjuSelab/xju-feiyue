"""Concatenate each course's MkDocs subpages into a single markdown body
and write the result to scripts/xju_wiki_raw/_bodies/<slug>.body.md.

Per subpage:
  - drop the leading `# 标题` (it's redundant with the H2 we wrap below)
  - wrap under an H2 section named after the subpage type
    (intro/main → 课程介绍, note/main → 学习笔记, lab → 实验, ...)
  - demote inner headings by one level (## → ###, ### → ####, etc.) so the
    wrapper H2 stays the highest level inside the section
  - strip giscus comment <script> blocks (they're MkDocs-only widgets)
  - convert `!!! note "Title"` admonitions to GFM `> [!NOTE]` callouts
  - rewrite relative image links to upstream raw URLs (so the frontend can
    actually load them without us mirroring 36MB of PNGs)
"""
from __future__ import annotations

import json
import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = REPO_ROOT / "scripts" / "xju_wiki_raw"
DOCS = RAW_DIR / "docs"
OUT_DIR = RAW_DIR / "_bodies"
INDEX_PATH = RAW_DIR / "_index.json"

UPSTREAM_RAW = "https://raw.githubusercontent.com/SunSeaLucky/xju-course-wiki/main"

# subpage relative path → H2 wrapper title
SECTION_TITLES: list[tuple[str, str]] = [
    ("intro/main.md",      "课程评价 / 推荐资源"),
    ("note/main.md",       "学习笔记"),
    ("note/my-main.md",    "学习笔记（补充）"),
    ("note/important.md",  "重点回顾"),
    ("note/temp.md",       "速记 / 草稿"),
    ("lab/main.md",        "实验"),
    ("experiment/main.md", "实验"),
    ("experiment/code.md", "实验代码"),
    ("pre/main.md",        "课前准备"),
]

ADMONITION_TYPE_MAP = {
    "note": "NOTE",
    "info": "NOTE",
    "tip": "TIP",
    "hint": "TIP",
    "warning": "WARNING",
    "caution": "WARNING",
    "danger": "CAUTION",
    "important": "IMPORTANT",
    "abstract": "NOTE",
    "summary": "NOTE",
    "example": "NOTE",
    "quote": "NOTE",
}


def section_title(subpath: str) -> str:
    for key, title in SECTION_TITLES:
        if subpath == key:
            return title
    # generic fallback: derive from path
    return subpath.replace("/", " · ").replace(".md", "")


_FRONTMATTER_RE = re.compile(r"\A---\s*\n.*?\n---\s*\n+", re.DOTALL)
_STYLE_RE = re.compile(r"<style\b[^>]*>.*?</style>", re.DOTALL | re.IGNORECASE)
_SCRIPT_RE = re.compile(r"<script\b[^>]*>.*?</script>", re.DOTALL | re.IGNORECASE)
_ATTR_LIST_RE = re.compile(r"\s*\{[#.][^}]*\}\s*$", re.MULTILINE)
_IMG_RE = re.compile(r"(!\[[^\]]*\])\(([^)]+)\)")
_LEADING_H1_RE = re.compile(r"\A#\s+[^\n]*\n+", re.DOTALL)


def strip_html_chrome(text: str) -> str:
    """Drop <style> / <script> blocks (giscus widget, MkDocs counter CSS, etc.)
    that the upstream wiki uses for layout but that have no place inside a
    plain LabNotes article."""
    text = _SCRIPT_RE.sub("", text)
    text = _STYLE_RE.sub("", text)
    return text


def strip_attr_lists(text: str) -> str:
    return _ATTR_LIST_RE.sub("", text)


def demote_headings(text: str) -> str:
    """Lower every ATX heading by one level (## → ###, etc.). Cap at h6."""
    out_lines: list[str] = []
    in_fence = False
    for line in text.splitlines():
        if line.lstrip().startswith("```"):
            in_fence = not in_fence
            out_lines.append(line)
            continue
        if not in_fence:
            m = re.match(r"^(#{1,5})(\s)", line)
            if m:
                line = "#" + line  # promote # count by one (i.e. demote level)
        out_lines.append(line)
    return "\n".join(out_lines)


def rewrite_images(text: str, subdir_in_docs: str) -> str:
    """Relative image refs (`image.png`, `./assets/x.jpg`) → upstream raw URLs.
    Absolute (`http(s)://`, `/`) and protocol-relative ones are left alone.
    """
    base = f"{UPSTREAM_RAW}/docs/{subdir_in_docs}".rstrip("/")

    def repl(m: re.Match[str]) -> str:
        alt = m.group(1)
        url = m.group(2).strip()
        if url.startswith(("http://", "https://", "//", "data:")):
            return f"{alt}({url})"
        if url.startswith("/"):
            return f"{alt}({UPSTREAM_RAW}{url})"
        # strip leading "./" if any
        clean = url[2:] if url.startswith("./") else url
        return f"{alt}({base}/{clean})"

    return _IMG_RE.sub(repl, text)


def convert_admonitions(text: str) -> str:
    """Convert MkDocs Material admonitions to GFM callouts.

    Handles the spaced form  `!!! note "Title"` and the upstream's quirky
    glued form `!!!"warning"`. Indented body lines (4-space indent) become
    `> ` quoted lines until the indent ends.
    """
    # Body = zero or more lines that are EITHER blank OR indented ≥4 spaces.
    # Greedy: stops naturally at the first dedented non-blank line.
    pattern = re.compile(
        r'^(?P<lead>!!!|\?\?\?)\s*"?(?P<type>[a-zA-Z]+)"?\s*(?P<title>[^\n]*)\n'
        r'(?P<body>(?:[ \t]*\n|    [^\n]*\n)*)',
        re.MULTILINE,
    )

    def repl(m: re.Match[str]) -> str:
        atype = m.group("type").lower()
        gh_type = ADMONITION_TYPE_MAP.get(atype, "NOTE")
        title = m.group("title").strip().strip('"')
        body = m.group("body")
        body_lines = []
        for ln in body.splitlines():
            if ln.startswith("    "):
                body_lines.append("> " + ln[4:])
            elif not ln.strip():
                body_lines.append(">")
            else:
                body_lines.append("> " + ln)
        head = f"> [!{gh_type}]"
        if title:
            head += f" {title}"
        return head + "\n" + "\n".join(body_lines).rstrip() + "\n\n"

    return pattern.sub(repl, text)


def normalize_subpage(text: str, subdir_in_docs: str) -> str:
    text = _FRONTMATTER_RE.sub("", text, count=1)
    text = strip_html_chrome(text)
    text = _LEADING_H1_RE.sub("", text.lstrip("\n"), count=1)
    text = strip_attr_lists(text)
    text = convert_admonitions(text)
    text = rewrite_images(text, subdir_in_docs)
    text = demote_headings(text)
    return text.strip()


def main() -> int:
    index = json.loads(INDEX_PATH.read_text(encoding="utf-8"))
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    written = 0
    for entry in index:
        slug = entry["slug"]
        course_dir = DOCS / slug
        sections: list[str] = []
        for subpath in entry["subpages"]:
            full = course_dir / subpath
            if not full.is_file():
                continue
            raw = full.read_text(encoding="utf-8")
            # subdir_in_docs is the directory containing the .md, used as
            # base for image URL rewrites.
            subdir = f"{slug}/{subpath.rsplit('/', 1)[0]}" if "/" in subpath else slug
            normalized = normalize_subpage(raw, subdir)
            if not normalized:
                continue
            heading = f"## {section_title(subpath)}"
            sections.append(f"{heading}\n\n{normalized}\n")

        if not sections:
            print(f"  ! {slug}: no usable subpages, skipped")
            continue

        body = "\n".join(sections).rstrip() + "\n"
        out_path = OUT_DIR / f"{slug}.body.md"
        out_path.write_text(body, encoding="utf-8")
        written += 1
        print(f"  ✓ {slug}: {len(sections)} sections, {len(body)} chars")

    print(f"[ok] wrote {written}/{len(index)} bodies in {OUT_DIR.relative_to(REPO_ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
