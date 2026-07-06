from __future__ import annotations

import re
import shutil
from datetime import datetime
from pathlib import Path

from docx import Document


ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"
COURSEWORK = DOCS / "coursework"
TARGET = DOCS / "赵文彪-飞跃 .docx"

CHAPTERS = [
    COURSEWORK / "ch4-需求分析-笔记系统与社区互动.md",
    COURSEWORK / "ch5-概要设计-笔记系统与社区互动.md",
    COURSEWORK / "ch6-详细设计-笔记系统与社区互动.md",
    COURSEWORK / "ch7-系统测试-笔记系统与社区互动.md",
]


def remove_paragraph(paragraph) -> None:
    element = paragraph._element
    element.getparent().remove(element)


def insert_element_before(anchor, element) -> None:
    anchor._element.addprevious(element)


def add_before(doc: Document, anchor, text: str = "", style: str | None = None):
    paragraph = doc.add_paragraph(text)
    if style:
        paragraph.style = style
    insert_element_before(anchor, paragraph._element)
    return paragraph


def add_table_before(doc: Document, anchor, rows: list[list[str]]) -> None:
    if not rows:
        return
    width = max(len(row) for row in rows)
    table = doc.add_table(rows=len(rows), cols=width)
    table.style = "Table Grid"
    for r_idx, row in enumerate(rows):
        for c_idx in range(width):
            table.cell(r_idx, c_idx).text = row[c_idx].strip() if c_idx < len(row) else ""
    insert_element_before(anchor, table._element)
    add_before(doc, anchor, "")


def parse_table(lines: list[str], start: int) -> tuple[list[list[str]], int]:
    rows: list[list[str]] = []
    i = start
    while i < len(lines) and lines[i].strip().startswith("|"):
        line = lines[i].strip()
        parts = [p.strip() for p in line.strip("|").split("|")]
        if not all(re.fullmatch(r":?-{3,}:?", p.replace(" ", "")) for p in parts):
            rows.append(parts)
        i += 1
    return rows, i


def clean_inline(text: str) -> str:
    text = text.replace("**", "")
    text = text.replace("`", "")
    text = text.replace("<br>", "\n")
    text = re.sub(r"<!--.*?-->", "", text)
    return text.strip()


def insert_markdown(doc: Document, anchor, md_text: str) -> None:
    lines = md_text.splitlines()
    i = 0
    while i < len(lines):
        raw = lines[i]
        line = raw.strip()
        if not line:
            add_before(doc, anchor, "")
            i += 1
            continue
        if line.startswith("|"):
            rows, i = parse_table(lines, i)
            add_table_before(doc, anchor, rows)
            continue
        if line.startswith("# "):
            add_before(doc, anchor, clean_inline(line[2:]), "Heading 1")
        elif line.startswith("## "):
            add_before(doc, anchor, clean_inline(line[3:]), "Heading 2")
        elif line.startswith("### "):
            add_before(doc, anchor, clean_inline(line[4:]), "Heading 3")
        elif line.startswith("#### "):
            add_before(doc, anchor, clean_inline(line[5:]), "Heading 4")
        elif line.startswith(">"):
            add_before(doc, anchor, clean_inline(line.lstrip("> ")), "Quote")
        elif line.startswith("- "):
            add_before(doc, anchor, clean_inline(line[2:]), "List Bullet")
        elif re.match(r"^\d+\.\s+", line):
            add_before(doc, anchor, clean_inline(re.sub(r"^\d+\.\s+", "", line)), "List Number")
        elif line.startswith("```"):
            block: list[str] = []
            i += 1
            while i < len(lines) and not lines[i].strip().startswith("```"):
                block.append(lines[i])
                i += 1
            add_before(doc, anchor, "\n".join(block))
        else:
            add_before(doc, anchor, clean_inline(line))
        i += 1


def looks_like_coursework_chapter_4(text: str) -> bool:
    return (
        "四" in text
        or "�ġ�" in text
        or "系统需求" in text
        or "ϵͳ�������" in text
    )


def looks_like_chapter_8(text: str) -> bool:
    return "八" in text or "�ˡ�" in text or "用户" in text


def main() -> None:
    if not TARGET.exists():
        raise FileNotFoundError(TARGET)

    backup = TARGET.with_name(
        f"{TARGET.stem}.backup-{datetime.now().strftime('%Y%m%d-%H%M%S')}{TARGET.suffix}"
    )
    shutil.copy2(TARGET, backup)

    doc = Document(TARGET)
    start = None
    end = None
    for idx, paragraph in enumerate(doc.paragraphs):
        text = paragraph.text.strip()
        if (
            start is None
            and idx > 240
            and paragraph.style.name == "Heading 1"
            and looks_like_coursework_chapter_4(text)
        ):
            start = idx
        if (
            start is not None
            and idx > start
            and paragraph.style.name == "Heading 1"
            and looks_like_chapter_8(text)
        ):
            end = idx
            break

    if start is None or end is None or start >= end:
        raise RuntimeError(f"Could not locate chapter 4-7 range: start={start}, end={end}")

    anchor = doc.paragraphs[end]
    for paragraph in list(doc.paragraphs[start:end]):
        remove_paragraph(paragraph)

    combined = "\n\n".join(path.read_text(encoding="utf-8") for path in CHAPTERS)
    insert_markdown(doc, anchor, combined)

    doc.save(TARGET)
    print(f"updated {TARGET}")
    print(f"backup {backup}")


if __name__ == "__main__":
    main()
