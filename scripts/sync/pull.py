"""Restore DB + .env.local from the HF Dataset.

Non-destructive by default: existing local files are renamed to
`<file>.bak.<UTC-stamp>` before being overwritten.

Flags:
  --force        : skip the "Proceed? [y/N]" prompt (still keeps .bak.<ts>)
"""

from __future__ import annotations

import argparse
import shutil
import subprocess
import tempfile
from datetime import datetime, timezone
from pathlib import Path

from rich.console import Console

from _common import (
    decrypt_secrets,
    file_lock,
    humanize_bytes,
    read_manifest,
    sha256_of,
)
from config import (
    DATASET_DB_PATH,
    DATASET_MANIFEST_PATH,
    DATASET_SECRETS_PATH,
    DB_PATH,
    MANIFEST_SCHEMA_VERSION,
    REPO_ROOT,
    SECRETS_PATHS,
    SyncConfig,
)

console = Console()


def info(msg: str) -> None:
    console.print(msg)


def err(msg: str) -> None:
    console.print(f"[bold red]✗[/bold red] {msg}")


def _stamp() -> str:
    return datetime.now(tz=timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def _move_aside(path: Path) -> Path | None:
    if not path.exists():
        return None
    bak = path.with_name(f"{path.name}.bak.{_stamp()}")
    path.rename(bak)
    return bak


def _verify_db_readable(db: Path) -> tuple[int, int]:
    """Returns (users, notes). Raises if DB is unreadable."""
    out = subprocess.run(
        ["sqlite3", str(db), "SELECT count(*) FROM users; SELECT count(*) FROM notes;"],
        check=True,
        capture_output=True,
    )
    lines = out.stdout.decode("utf-8").strip().splitlines()
    if len(lines) < 2:
        raise RuntimeError(f"sqlite3 returned unexpected output: {lines!r}")
    return int(lines[0]), int(lines[1])


def cmd_pull(cfg: SyncConfig, *, force: bool) -> int:
    from huggingface_hub import snapshot_download
    from huggingface_hub.errors import HfHubHTTPError

    info(f"[cyan]→[/cyan] sync-pull from {cfg.repo_id}")

    with file_lock(timeout_s=30.0):
        with tempfile.TemporaryDirectory(prefix="labnotes-sync-pull-") as td:
            stage = Path(td)
            try:
                snapshot_download(
                    repo_id=cfg.repo_id,
                    repo_type="dataset",
                    local_dir=str(stage),
                    allow_patterns=[
                        DATASET_MANIFEST_PATH,
                        f"{DATASET_DB_PATH.split('/')[0]}/*",
                        DATASET_SECRETS_PATH,
                    ],
                )
            except HfHubHTTPError as e:
                err(f"snapshot_download failed: {e}")
                return 1

            manifest_path = stage / DATASET_MANIFEST_PATH
            if not manifest_path.exists():
                err(f"remote dataset has no manifest.json — nothing to pull")
                return 1
            manifest = read_manifest(manifest_path)
            schema = manifest.get("schema_version")
            if schema != MANIFEST_SCHEMA_VERSION:
                err(
                    f"manifest schema_version={schema}, expected {MANIFEST_SCHEMA_VERSION}. "
                    f"Update labnotes-sync."
                )
                return 1

            pushed_by = manifest.get("pushed_by")
            if pushed_by and pushed_by != cfg.machine_id:
                info(
                    f"[yellow]![/yellow] last push was from [bold]{pushed_by}[/bold]; "
                    f"this machine is [bold]{cfg.machine_id}[/bold]"
                )

            files_meta = manifest.get("files") or {}

            # ---- sha256 verify ----
            for rel, meta in files_meta.items():
                if not isinstance(meta, dict) or meta.get("omitted"):
                    continue
                local = stage / rel
                if not local.exists():
                    err(f"manifest references {rel} but it isn't in the snapshot")
                    return 1
                expected = meta.get("sha256")
                if isinstance(expected, str):
                    actual = sha256_of(local)
                    if actual != expected:
                        err(
                            f"sha256 mismatch for {rel}\n  expected: {expected}\n  actual:   {actual}"
                        )
                        return 1

            # ---- prompt unless --force ----
            if not force:
                summary = ", ".join(
                    rel
                    for rel, meta in files_meta.items()
                    if isinstance(meta, dict) and not meta.get("omitted")
                )
                info(
                    f"about to restore: {summary}\n"
                    f"  pushed_at: {manifest.get('pushed_at')}\n"
                    f"  pushed_by: {pushed_by}\n"
                    f"  git_ref:   {manifest.get('git_ref')} (dirty={manifest.get('git_dirty')})\n"
                )
                ans = input("Proceed? [y/N]: ").strip().lower()
                if ans != "y":
                    info("aborted by user")
                    return 0

            # ---- secrets ----
            secrets_meta = files_meta.get(DATASET_SECRETS_PATH)
            if isinstance(secrets_meta, dict) and not secrets_meta.get("omitted"):
                # Move-aside existing local copies first so decrypt can write
                # cleanly even if files are present.
                for rel in SECRETS_PATHS:
                    local = REPO_ROOT / rel
                    if local.exists():
                        bak = _move_aside(local)
                        if bak:
                            info(f"  • backed up {rel} → {bak.name}")
                restored = decrypt_secrets(stage / DATASET_SECRETS_PATH, REPO_ROOT)
                # Tighten permissions on .env.local files since they hold creds.
                for rel in restored:
                    p = REPO_ROOT / rel
                    if p.exists():
                        try:
                            p.chmod(0o600)
                        except OSError:
                            pass
                info(
                    f"[green]✓[/green] secrets restored: "
                    f"{', '.join(str(p) for p in restored)}"
                )

            # ---- DB ----
            db_meta = files_meta.get(DATASET_DB_PATH)
            if isinstance(db_meta, dict) and not db_meta.get("omitted"):
                src = stage / DATASET_DB_PATH
                bak = _move_aside(DB_PATH)
                if bak:
                    info(f"  • backed up backend/labnotes.db → {bak.name}")
                DB_PATH.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(src, DB_PATH)
                size = DB_PATH.stat().st_size
                try:
                    users, notes = _verify_db_readable(DB_PATH)
                    info(
                        f"[green]✓[/green] DB restored ({humanize_bytes(size)}, "
                        f"{users} users, {notes} notes)"
                    )
                except (subprocess.CalledProcessError, RuntimeError, FileNotFoundError) as e:
                    info(
                        f"[yellow]![/yellow] DB restored ({humanize_bytes(size)}) "
                        f"but readback failed: {e}"
                    )

            info(
                f"\nlast remote push: {manifest.get('pushed_at')} "
                f"by {pushed_by} @ {manifest.get('git_ref')}"
            )
    return 0


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="sync-pull")
    p.add_argument("--force", action="store_true", help="skip the y/N prompt")
    args = p.parse_args(argv)

    try:
        cfg = SyncConfig.load()
    except (FileNotFoundError, ValueError) as e:
        err(str(e))
        return 1
    return cmd_pull(cfg, force=args.force)


if __name__ == "__main__":
    raise SystemExit(main())
