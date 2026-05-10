"""Take each `content/notes/<slug>.md.body` produced by notion_to_md.py and
write `content/notes/<slug>.md` with a YAML frontmatter header.

Frontmatter fields:
  id, slug, title, summary, category, tags, author, createdAt, readMinutes, notionUuid

After this runs, `content/notes/*.md` is the source of truth for the seed
pipeline. The `.md.body` files are intermediate and get deleted at the end.
"""
from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = REPO_ROOT / "scripts" / "notion_raw"
NOTES_DIR = REPO_ROOT / "content" / "notes"

# Title-keyword → tag list. First match wins; fallback is just the slug.
TAG_RULES: list[tuple[str, list[str]]] = [
    ("nginx",        ["Nginx", "服务器", "部署"]),
    ("ssl",          ["SSL", "服务器"]),
    ("vim",          ["Vim", "编辑器"]),
    ("neovim",       ["NeoVim", "编辑器"]),
    ("vue",          ["Vue", "前端"]),
    ("matlab",       ["MatLab", "科学计算"]),
    ("flash-attn",   ["PyTorch", "GPU", "故障排查"]),
    ("hailo",        ["Hailo8", "AI 硬件", "树莓派"]),
    ("hailo8",       ["Hailo8", "AI 硬件", "树莓派"]),
    ("树莓派",       ["树莓派", "硬件"]),
    ("raspberry",    ["树莓派", "硬件"]),
    ("rpi5",         ["树莓派", "硬件"]),
    ("lidar",        ["激光雷达", "传感器"]),
    ("alphadog",     ["AlphaDog", "网络"]),
    ("tailscale",    ["Tailscale", "VPN", "网络"]),
    ("xray",         ["Xray", "代理", "网络"]),
    ("frp",          ["frp", "内网穿透"]),
    ("ssh",          ["SSH", "网络"]),
    ("docker",       ["Docker", "容器"]),
    ("cuda",         ["CUDA", "GPU", "深度学习"]),
    ("jupyter",      ["Jupyter", "深度学习"]),
    ("dl-jupyter",   ["Jupyter", "深度学习"]),
    ("git",          ["Git", "工具"]),
    ("hugging",      ["HuggingFace", "认证"]),
    ("token",        ["认证", "安全"]),
    ("tinystories",  ["LLM", "训练", "GPU"]),
    ("l40",          ["GPU", "训练"]),
    ("uv",           ["uv", "Python", "工具"]),
    ("pnpm",         ["pnpm", "Node.js", "前端"]),
    ("node",         ["Node.js", "前端"]),
    ("spring",       ["Spring-Boot", "Java", "后端"]),
    ("sql",          ["SQL", "PostgreSQL", "数据库"]),
    ("postgres",     ["SQL", "PostgreSQL", "数据库"]),
    ("usb",          ["USB", "WSL", "硬件"]),
    ("wsl",          ["WSL", "工具"]),
    ("ubuntu",       ["Ubuntu", "Linux"]),
    ("systemctl",    ["Linux", "systemctl"]),
    ("打印机",       ["硬件", "故障排查"]),
    ("printer",      ["硬件", "故障排查"]),
    ("esp32",        ["ESP32", "嵌入式"]),
    ("vps",          ["VPS", "服务器"]),
    ("代理",         ["代理", "网络"]),
    ("anyrouter",    ["Anthropic", "API"]),
    ("claude",       ["Claude", "工具"]),
    ("self-forcing", ["AI 训练", "工程"]),
    ("google",       ["Google", "AI 工具"]),
    ("tmp",          ["速记"]),
    ("正在开发",     ["WIP"]),
    ("server-setup", ["服务器", "Linux"]),
    ("服务器配置",   ["服务器", "Linux"]),
]


def derive_tags(title: str, slug: str) -> list[str]:
    seen: list[str] = []
    text = (title + " " + slug).lower()
    for keyword, tags in TAG_RULES:
        if keyword.lower() in text:
            for t in tags:
                if t not in seen:
                    seen.append(t)
    if not seen:
        seen = ["工具"]
    return seen[:4]  # cap at 4 to keep cards tidy


def derive_summary(title: str, body: str) -> str:
    """First non-trivial paragraph of body, stripped of markdown, ≤80 chars.

    Falls back to title when the body has no usable text.
    """
    plain_lines: list[str] = []
    in_code = False
    for raw in body.splitlines():
        line = raw.strip()
        if line.startswith("```"):
            in_code = not in_code
            continue
        if in_code:
            continue
        if not line:
            if plain_lines:
                break
            continue
        if line.startswith(("#", ">", "-", "*", "|", "<", "!")):
            continue
        if re.match(r"^\d+\.\s", line):
            continue
        plain_lines.append(line)
        if sum(len(p) for p in plain_lines) > 60:
            break
    raw = " ".join(plain_lines)
    raw = re.sub(r"`([^`]+)`", r"\1", raw)
    raw = re.sub(r"\*\*([^*]+)\*\*", r"\1", raw)
    raw = re.sub(r"\*([^*]+)\*", r"\1", raw)
    raw = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", raw)
    raw = raw.strip()
    if not raw:
        return f"{title} —— 工程速查 / 实操记录。"
    if len(raw) > 80:
        raw = raw[:78] + "…"
    return raw


def derive_read_minutes(body: str) -> int:
    chars = len(body)
    # ~300 chars/min for mixed Chinese+code, with a floor of 1.
    return max(1, min(20, round(chars / 300)))


def yaml_escape(s: str) -> str:
    """Quote-and-escape a YAML scalar conservatively."""
    if not s:
        return '""'
    needs_quote = any(c in s for c in ":#'\"\\-![]{},*&|>%@`?<")
    if needs_quote or s.strip() != s:
        return '"' + s.replace("\\", "\\\\").replace('"', '\\"') + '"'
    return s


def yaml_list(items: list[str]) -> str:
    return "[" + ", ".join(yaml_escape(t) for t in items) + "]"


def build_frontmatter(meta: dict) -> str:
    """Render a YAML frontmatter block from a meta dict.

    Required keys: id, slug, title, summary, category, tags, author,
    createdAt, readMinutes. Optional: notionUuid, upstream.
    Order is fixed so diffs stay tidy across re-runs.
    """
    lines = ["---", f"id: {meta['id']}", f"slug: {meta['slug']}"]
    lines.append(f"title: {yaml_escape(meta['title'])}")
    lines.append(f"summary: {yaml_escape(meta['summary'])}")
    lines.append(f"category: {meta['category']}")
    lines.append(f"tags: {yaml_list(list(meta.get('tags') or []))}")
    lines.append(f"author: {yaml_escape(meta['author'])}")
    lines.append(f"createdAt: {meta['createdAt']}")
    lines.append(f"readMinutes: {meta['readMinutes']}")
    if meta.get("notionUuid"):
        lines.append(f"notionUuid: {meta['notionUuid']}")
    if meta.get("upstream"):
        lines.append(f"upstream: {meta['upstream']}")
    lines.append("---\n\n")
    return "\n".join(lines)


def main() -> int:
    index = json.loads((RAW_DIR / "_index.json").read_text(encoding="utf-8"))
    NOTES_DIR.mkdir(parents=True, exist_ok=True)
    written = 0
    for i, entry in enumerate(index, start=1):
        slug = entry["slug"]
        title = entry["title"]
        uuid = entry["uuid"]
        body_path = NOTES_DIR / f"{slug}.md.body"
        if not body_path.exists():
            print(f"  ! skip {slug}: no body file")
            continue
        body = body_path.read_text(encoding="utf-8")
        last_edited_ms = entry.get("last_edited_ms")
        if last_edited_ms:
            created_iso = datetime.fromtimestamp(
                last_edited_ms / 1000, tz=timezone.utc
            ).isoformat(timespec="seconds").replace("+00:00", "Z")
        else:
            created_iso = "2026-05-09T00:00:00Z"
        front = build_frontmatter({
            "id": f"note_tools_winbeau_{i:03d}",
            "slug": slug,
            "title": title,
            "summary": derive_summary(title, body),
            "category": "tools",
            "tags": derive_tags(title, slug),
            "author": "winbeau",
            "createdAt": created_iso,
            "readMinutes": derive_read_minutes(body),
            "notionUuid": uuid,
        })
        out_path = NOTES_DIR / f"{slug}.md"
        out_path.write_text(front + body.lstrip("\n"), encoding="utf-8")
        # Drop intermediate .md.body now that the canonical file exists.
        body_path.unlink()
        written += 1
    print(f"wrote {written} markdown files in {NOTES_DIR}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
