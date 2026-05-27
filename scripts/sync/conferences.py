"""Mirror the CCF conferences reference data to the `conferences/` namespace.

Exact copy of the schools.py pattern (same HF dataset, different prefix).
See schools.py docstring for the full design rationale.

Commands:
  python scripts/sync/conferences.py push
  python scripts/sync/conferences.py pull [--force]
  python scripts/sync/conferences.py status
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import tempfile
import time
from pathlib import Path

from rich.console import Console

from _common import file_lock, humanize_bytes, sha256_of
from config import (
    CONFERENCES_DATA_DIR,
    CONFERENCES_FILES,
    CONFERENCES_MANIFEST,
    CONFERENCES_PREFIX,
    CONFERENCES_SQLITE,
    SyncConfig,
)

console = Console()


def info(msg: str, *, quiet: bool = False) -> None:
    if not quiet:
        console.print(msg)


def err(msg: str) -> None:
    console.print(f"[bold red]✗[/bold red] {msg}")


def _manifest_sha(manifest_path: Path) -> tuple[str | None, int | None]:
    if not manifest_path.exists():
        return None, None
    try:
        m = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (ValueError, OSError):
        return None, None
    sha = m.get("conferences_sqlite_sha256")
    size = m.get("conferences_sqlite_bytes")
    return (sha if isinstance(sha, str) else None, size if isinstance(size, int) else None)


def _verify(sqlite_path: Path, manifest_path: Path) -> str | None:
    sha, size = _manifest_sha(manifest_path)
    if sha is None:
        return None
    actual = sha256_of(sqlite_path)
    if actual != sha:
        return f"sha256 mismatch vs manifest\n  manifest: {sha}\n  sqlite:   {actual}"
    if isinstance(size, int) and sqlite_path.stat().st_size != size:
        return f"size mismatch: manifest={size}, sqlite={sqlite_path.stat().st_size}"
    return None


def cmd_push(cfg: SyncConfig, *, quiet: bool) -> int:
    from huggingface_hub import HfApi

    if not CONFERENCES_SQLITE.exists():
        err(f"{CONFERENCES_SQLITE} not present — nothing to push")
        return 2
    bad = _verify(CONFERENCES_SQLITE, CONFERENCES_MANIFEST)
    if bad:
        info(f"[yellow]![/yellow] local integrity warning: {bad}", quiet=quiet)
    size = CONFERENCES_SQLITE.stat().st_size
    info(
        f"[cyan]→[/cyan] conf-push to {cfg.repo_id} ({CONFERENCES_PREFIX}/, "
        f"sqlite {humanize_bytes(size)})",
        quiet=quiet,
    )
    with file_lock(timeout_s=30.0):
        api = HfApi()
        api.create_repo(repo_id=cfg.repo_id, repo_type="dataset", private=True, exist_ok=True)
        with tempfile.TemporaryDirectory(prefix="conf-sync-push-") as td:
            stage = Path(td) / CONFERENCES_PREFIX
            stage.mkdir(parents=True)
            for name in CONFERENCES_FILES:
                src = CONFERENCES_DATA_DIR / name
                if src.exists():
                    shutil.copy2(src, stage / name)
            delay = 2.0
            last: Exception | None = None
            for attempt in range(1, 4):
                try:
                    api.upload_folder(
                        folder_path=td,
                        repo_id=cfg.repo_id,
                        repo_type="dataset",
                        allow_patterns=[f"{CONFERENCES_PREFIX}/*"],
                        delete_patterns=[f"{CONFERENCES_PREFIX}/*"],
                        commit_message=f"conferences data sync ({humanize_bytes(size)})",
                    )
                    info(f"[green]✓[/green] pushed {CONFERENCES_PREFIX}/ to {cfg.repo_id}", quiet=quiet)
                    return 0
                except Exception as e:  # noqa: BLE001
                    last = e
                    if attempt == 3:
                        break
                    info(f"[yellow]upload attempt {attempt} failed: {e}[/yellow] — retry in {delay:.0f}s", quiet=quiet)
                    time.sleep(delay)
                    delay *= 2
            err(f"upload failed after retries: {last}")
            return 3


def cmd_pull(cfg: SyncConfig, *, force: bool, quiet: bool) -> int:
    from huggingface_hub import snapshot_download
    from huggingface_hub.errors import HfHubHTTPError

    info(f"[cyan]→[/cyan] conf-pull from {cfg.repo_id} ({CONFERENCES_PREFIX}/)", quiet=quiet)
    with file_lock(timeout_s=30.0):
        with tempfile.TemporaryDirectory(prefix="conf-sync-pull-") as td:
            stage = Path(td)
            try:
                snapshot_download(
                    repo_id=cfg.repo_id,
                    repo_type="dataset",
                    local_dir=str(stage),
                    allow_patterns=[f"{CONFERENCES_PREFIX}/*"],
                )
            except HfHubHTTPError as e:
                err(f"snapshot_download failed: {e}")
                return 1
            new_sqlite = stage / CONFERENCES_PREFIX / "conferences.sqlite"
            new_manifest = stage / CONFERENCES_PREFIX / "manifest.json"
            if not new_sqlite.exists():
                err(f"remote dataset has no {CONFERENCES_PREFIX}/conferences.sqlite — nothing to pull")
                return 1
            bad = _verify(new_sqlite, new_manifest)
            if bad:
                err(f"downloaded sqlite failed integrity check: {bad}")
                return 1
            if CONFERENCES_SQLITE.exists() and sha256_of(CONFERENCES_SQLITE) == sha256_of(new_sqlite):
                info("[green]✓[/green] local conferences.sqlite already up to date", quiet=quiet)
                return 0
            if not force and CONFERENCES_SQLITE.exists():
                ans = (
                    input(
                        f"overwrite {CONFERENCES_SQLITE} "
                        f"({humanize_bytes(CONFERENCES_SQLITE.stat().st_size)} → "
                        f"{humanize_bytes(new_sqlite.stat().st_size)})? [y/N]: "
                    ).strip().lower()
                )
                if ans != "y":
                    info("aborted by user")
                    return 0
            CONFERENCES_DATA_DIR.mkdir(parents=True, exist_ok=True)
            for name in CONFERENCES_FILES:
                src = stage / CONFERENCES_PREFIX / name
                if not src.exists():
                    continue
                tmp_dst = CONFERENCES_DATA_DIR / f".{name}.incoming"
                shutil.copy2(src, tmp_dst)
                os.replace(tmp_dst, CONFERENCES_DATA_DIR / name)
            info(
                f"[green]✓[/green] conferences data restored ({humanize_bytes(CONFERENCES_SQLITE.stat().st_size)})",
                quiet=quiet,
            )
    return 0


def cmd_status(cfg: SyncConfig) -> int:
    from huggingface_hub import hf_hub_download
    from huggingface_hub.errors import EntryNotFoundError, HfHubHTTPError

    try:
        path = hf_hub_download(
            repo_id=cfg.repo_id, repo_type="dataset",
            filename=f"{CONFERENCES_PREFIX}/manifest.json",
        )
    except EntryNotFoundError:
        console.print("[yellow]no manifest yet — conf-push hasn't run on this dataset[/yellow]")
        return 0
    except HfHubHTTPError as e:
        err(f"could not fetch manifest: {e}")
        return 1
    m = json.loads(Path(path).read_text(encoding="utf-8"))
    console.print(f"repo:         {cfg.repo_id} ({CONFERENCES_PREFIX}/)")
    console.print(f"claw_version: {m.get('claw_version')}")
    console.print(f"exported_at:  {m.get('exported_at')}")
    console.print(
        f"sqlite:       {humanize_bytes(m.get('conferences_sqlite_bytes', 0))}  "
        f"sha256:{str(m.get('conferences_sqlite_sha256'))[:12]}"
    )
    counts = m.get("counts") or {}
    if counts:
        console.print("counts:       " + ", ".join(f"{k}={v}" for k, v in counts.items()))
    return 0


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="conferences-sync")
    sub = p.add_subparsers(dest="cmd", required=True)
    p_push = sub.add_parser("push")
    p_push.add_argument("--quiet", action="store_true")
    p_pull = sub.add_parser("pull")
    p_pull.add_argument("--force", action="store_true")
    p_pull.add_argument("--quiet", action="store_true")
    sub.add_parser("status")
    args = p.parse_args(argv)
    try:
        cfg = SyncConfig.load()
    except (FileNotFoundError, ValueError) as e:
        err(str(e))
        return 1
    if args.cmd == "push":
        return cmd_push(cfg, quiet=args.quiet)
    if args.cmd == "pull":
        return cmd_pull(cfg, force=args.force, quiet=args.quiet)
    if args.cmd == "status":
        return cmd_status(cfg)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
