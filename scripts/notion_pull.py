"""Pull all 44 Notion sub-pages from `经验汇总` to disk as raw JSON.

Source page: https://hollow-garden-1c8.notion.site/94cfed6af36f82068c3c0145efc1e417
API: POST <site>/api/v3/loadPageChunk (no auth required for public sites)

Output:
  scripts/notion_raw/<slug>.json   one full recordMap per page
  scripts/notion_raw/_index.json   slug ↔ uuid ↔ title ↔ captured_at

Run with:
  uv run --project scripts/sync python scripts/notion_pull.py

(re-uses scripts/sync's venv only because it already has Python available;
 it doesn't actually need huggingface_hub or rich. We could also call it
 with system python3 + urllib if uv weren't around.)
"""
from __future__ import annotations

import datetime as dt
import json
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = REPO_ROOT / "scripts" / "notion_raw"
INDEX_PATH = RAW_DIR / "_index.json"

SITE = "https://hollow-garden-1c8.notion.site"
API = f"{SITE}/api/v3/loadPageChunk"

# Hardcoded enumeration from the root page's child blocks (44 entries).
# (slug, uuid, title)  — slug is the on-disk filename.
PAGES: list[tuple[str, str, str]] = [
    ("dl-jupyter",                  "e43fed6a-f36f-82d2-8417-016516f8a4b1", "dl-jupyter"),
    ("nginx",                       "0a6fed6a-f36f-83f2-aa0d-816354a6029f", "Nginx"),
    ("esp32s3-board-dev",           "73bfed6a-f36f-8335-bab2-819a35d46a6a", "ESP32S3 板开发流程"),
    ("wip-placeholder",             "212fed6a-f36f-82e1-a7f5-0188f046dfc4", "正在开发…"),
    ("sql-postgresql",              "281fed6a-f36f-8312-8c7e-01520ef634f5", "SQL [PostgreSQL]"),
    ("vue",                         "a55fed6a-f36f-82ee-9ba7-81003cc634ba", "Vue"),
    ("vim-vimrc-detail",            "458fed6a-f36f-838d-8a77-815ca1128100", "Vim 配置文件 (.vimrc) 详细分析"),
    ("wsl-git-ssh-cheatsheet",      "426fed6a-f36f-835e-8939-0118b7a9c01c", "WSL Git(SSH) 操作速查表"),
    ("matlab",                      "03bfed6a-f36f-8320-8d33-8150fd0d0025", "MatLab"),
    ("anyrouter-claude",            "f96fed6a-f36f-82c2-949f-019940f82666", "anyrouter-Claude"),
    ("systemctl-restart",           "ff3fed6a-f36f-832c-b974-01dd0aa39adc", "systemctl 重启"),
    ("raspberry-pi",                "33afed6a-f36f-838f-9e84-01c1215289ff", "树莓派"),
    ("hp-printer-stable",           "01cfed6a-f36f-83a1-b448-014ce96e2711", "惠普打印机电脑稳定链接"),
    ("neovim-install",              "b71fed6a-f36f-8329-80e0-8174345c49ce", "NeoVim 下载及配置"),
    ("frp-tunnel",                  "299fed6a-f36f-82c1-8967-01026857d4ce", "frp 内网穿透"),
    ("uv-install",                  "f63fed6a-f36f-82b3-9377-01726db5a444", "uv 安装"),
    ("ssh-docker-jupyter",          "606fed6a-f36f-8367-9133-0112f2f58e41", "SSH 连接 Docker 中的 Jupyter"),
    ("vps-node-setup",              "a16fed6a-f36f-8233-9285-818195c2916d", "VPS 结点配置"),
    ("docker-gpu-missing",          "e38fed6a-f36f-833f-b601-81f34e151ad3", "Docker 出现显卡丢失"),
    ("google-studio",               "d7bfed6a-f36f-8240-84cc-01f623ad0823", "google studio"),
    ("xray",                        "04bfed6a-f36f-83b5-9d24-010b41228e88", "Xray"),
    ("spring-boot-deploy",          "cfdfed6a-f36f-8249-9c0d-017c12f9b2f1", "Spring-Boot 服务器部署"),
    ("self-forcing-code-handover",  "77efed6a-f36f-8277-9459-81e76f0e76b0", "Self-Forcing Code Handover"),
    ("flash-attn-install-fail",     "19dfed6a-f36f-820e-8abe-81e68fa1d22d", "flash-attn 2.8.3安装失败"),
    # ("git-hf-https-token",        "62dfed6a-f36f-825c-a5f9-81696ae1b17d", "git/huggingface-https token"),
    # — skipped: page contains live HF / GitHub tokens, kept out of repo to
    #   avoid re-leaking on every notion_pull.
    ("node-pnpm-install",           "831fed6a-f36f-82c9-aecb-8111a973a3e5", "node-pnpm 安装"),
    ("l40-tinystories",             "320fed6a-f36f-8231-9184-8158443e49dd", "L40 - TinyStories"),
    ("server-setup",                "afcfed6a-f36f-826e-a5bd-813e56672378", "服务器配置"),
    ("wsl-usb-passthrough",         "12cfed6a-f36f-8320-91db-814ee39d4fde", "Windows USB 设备透传至 WSL 配置指南"),
    ("cuda-install",                "165fed6a-f36f-82c9-882e-8165ffda72ae", "CUDA 安装"),
    ("docker-container-setup",      "ce5fed6a-f36f-8309-8ace-81932f6ddfb6", "Docker 容器配置"),
    ("git-docker-https-tokens",     "635fed6a-f36f-829a-ac3d-0199bca85831", "Git(docker tokens - https)"),
    ("claude-code-install",         "337fed6a-f36f-832a-9b42-01b26f23d19f", "Claude Code 下载"),
    ("token-and-password",          "761fed6a-f36f-8340-bdd2-01d0d86ac711", "Token & Password"),
    ("tailscale-lan",               "31efed6a-f36f-80cf-9c67-c742970a4af0", "Tailscale-服务器建立局域网"),
    ("tmp",                         "325fed6a-f36f-80d5-b1c8-dd0af93e83e2", "tmp"),
    ("tailscale-install",           "328fed6a-f36f-8010-b573-f8c69df33182", "Tailscale 安装"),
    ("ubuntu-add-pubkey",           "329fed6a-f36f-8065-9c1b-c5f5aa798807", "Ubuntu 添加公钥"),
    ("rpi5-hailo8-driver",          "329fed6a-f36f-8078-a33d-f5bb7dff7110", "Raspberry Pi5 + Hailo8 环境驱动配置"),
    ("rpi5-ai-hat-hailo8",          "329fed6a-f36f-8048-aa19-fc2044069ffc", "Raspberry Pi5 + AI HAT(Hailo8)"),
    ("rpi5-hailo8-usb-camera",      "32afed6a-f36f-80c9-a429-fd9f36f5079d", "Raspberry Pi5 + Haili8 + USB Camera"),
    ("rpi5-lidar",                  "332fed6a-f36f-8097-9e46-dfa0c7884ef8", "Raspberry Pi5 + 激光雷达"),
    ("rpi5-alphadog-hotspot",       "336fed6a-f36f-8060-9d91-e8ac4fdf71ee", "Raspberry Pi5 + Windows 宿主机 + AlphaDog 热点网络共享配置"),
    ("docker-install-general",      "33efed6a-f36f-80d3-971a-e22873c67643", "docker 安装-普适"),
]


def fetch_chunk(page_id: str, cursor_stack: list) -> dict:
    payload = json.dumps(
        {
            "pageId": page_id,
            "limit": 200,
            "chunkNumber": 0,
            "cursor": {"stack": cursor_stack},
            "verticalColumns": False,
        }
    ).encode("utf-8")
    req = urllib.request.Request(
        API,
        data=payload,
        headers={
            "content-type": "application/json",
            "accept": "*/*",
            "user-agent": "labnotes-notion-pull/1.0",
        },
        method="POST",
    )
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except (urllib.error.URLError, TimeoutError) as e:
            if attempt == 2:
                raise
            print(f"    retry {attempt+1} after {e}", file=sys.stderr)
            time.sleep(2 ** attempt)
    raise RuntimeError("unreachable")


def fetch_full_page(page_id: str) -> dict:
    """Loop loadPageChunk until cursor.stack is empty; merge recordMaps."""
    merged: dict = {"recordMap": {}, "chunks": []}
    cursor_stack: list = []
    while True:
        chunk = fetch_chunk(page_id, cursor_stack)
        merged["chunks"].append(chunk)
        # merge recordMap (later chunks add new blocks; preserve all)
        for key, value in chunk.get("recordMap", {}).items():
            if key == "__version__":
                merged["recordMap"][key] = value
                continue
            bucket = merged["recordMap"].setdefault(key, {})
            if isinstance(value, dict):
                bucket.update(value)
        next_stack = chunk.get("cursor", {}).get("stack") or []
        if not next_stack:
            break
        cursor_stack = next_stack
    return merged


def main() -> int:
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    index = []
    started = time.monotonic()
    for i, (slug, uuid, title) in enumerate(PAGES, start=1):
        dst = RAW_DIR / f"{slug}.json"
        print(f"[{i:2d}/{len(PAGES)}] {slug:32s}  {uuid}  {title}")
        if dst.exists():
            data = json.loads(dst.read_text(encoding="utf-8"))
            print(f"    cached: {dst.name} ({dst.stat().st_size} B)")
        else:
            data = fetch_full_page(uuid)
            dst.write_text(
                json.dumps(data, ensure_ascii=False, separators=(",", ":")),
                encoding="utf-8",
            )
            print(f"    saved:  {dst.name} ({dst.stat().st_size} B, {len(data['chunks'])} chunks)")
        # Pull last_edited_time from the page block (if present in any chunk).
        last_edited = None
        for chunk in data.get("chunks", []):
            blocks = chunk.get("recordMap", {}).get("block", {})
            page_block = blocks.get(uuid)
            if page_block:
                v = page_block.get("value", {}).get("value", {}) or page_block.get("value", {})
                last_edited = v.get("last_edited_time") or last_edited
        index.append({
            "slug": slug,
            "uuid": uuid,
            "title": title,
            "last_edited_ms": last_edited,
            "captured_at": dt.datetime.now(tz=dt.timezone.utc).isoformat(timespec="seconds"),
        })
        time.sleep(0.2)  # be polite to Notion
    INDEX_PATH.write_text(
        json.dumps(index, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"\n✓ wrote {len(PAGES)} JSONs + _index.json in {time.monotonic()-started:.1f}s")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
