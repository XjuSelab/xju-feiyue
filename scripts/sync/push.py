"""Snapshot DB + secrets, upload to the HF Dataset as a single mirrored commit.

Flags:
  --quiet         : only emit on error (cron-friendly)
  --status-only   : print last manifest summary without snapshotting/uploading
"""

from __future__ import annotations

import argparse
import tempfile
import time
from pathlib import Path

from rich.console import Console

from _common import (
    archive_dir,
    build_manifest,
    encrypt_secrets,
    file_lock,
    humanize_bytes,
    read_manifest,
    sha256_of,
    snapshot_db,
    write_manifest,
)
from config import (
    ALERT_FILE,
    ARTIFACTS,
    DATASET_MANIFEST_PATH,
    REPO_ROOT,
    STATE_PREFIX,
    SyncConfig,
)

console = Console()


def info(msg: str, *, quiet: bool) -> None:
    if not quiet:
        console.print(msg)


def err(msg: str) -> None:
    console.print(f"[bold red]✗[/bold red] {msg}")


def upload_with_retries(
    api,
    *,
    folder_path: Path,
    repo_id: str,
    commit_message: str,
    quiet: bool,
) -> None:
    delay = 2.0
    last: Exception | None = None
    for attempt in range(1, 4):
        try:
            api.upload_folder(
                folder_path=str(folder_path),
                repo_id=repo_id,
                repo_type="dataset",
                # Scoped mirror: only `state/*` remote files absent from the
                # staging dir are removed — the `schools/` namespace (pushed by
                # schools.py) is left untouched in the same shared dataset.
                delete_patterns=[f"{STATE_PREFIX}/*"],
                commit_message=commit_message,
            )
            return
        except Exception as e:  # noqa: BLE001
            last = e
            if attempt == 3:
                break
            info(
                f"[yellow]upload attempt {attempt} failed: {e}[/yellow] — retrying in {delay:.0f}s",
                quiet=quiet,
            )
            time.sleep(delay)
            delay *= 2
    assert last is not None
    raise last


def cmd_status(cfg: SyncConfig) -> int:
    """Show the most recent manifest from the HF dataset, no upload."""
    from huggingface_hub import hf_hub_download
    from huggingface_hub.errors import EntryNotFoundError, HfHubHTTPError

    try:
        path = hf_hub_download(
            repo_id=cfg.repo_id,
            repo_type="dataset",
            filename=DATASET_MANIFEST_PATH,
        )
    except EntryNotFoundError:
        console.print("[yellow]no manifest yet — push hasn't run on this dataset[/yellow]")
        return 0
    except HfHubHTTPError as e:
        err(f"could not fetch manifest: {e}")
        return 1

    m = read_manifest(Path(path))
    console.print(f"repo:        {cfg.repo_id}")
    console.print(f"last push:   {m.get('pushed_at')}")
    console.print(f"pushed by:   {m.get('pushed_by')}")
    console.print(f"git ref:     {m.get('git_ref')} (dirty={m.get('git_dirty')})")
    console.print("files:")
    for name, meta in (m.get("files") or {}).items():
        size = meta.get("size") if isinstance(meta, dict) else None
        sha = meta.get("sha256") if isinstance(meta, dict) else None
        sha_short = sha[:12] if isinstance(sha, str) else "—"
        size_h = humanize_bytes(size) if isinstance(size, int) else "—"
        console.print(f"  {name:<24}  {size_h:>9}  sha256:{sha_short}")
    if ALERT_FILE.exists():
        console.print()
        console.print(
            f"[red]! cron sync alert active: see {ALERT_FILE} and the log "
            f"({ALERT_FILE.parent / 'labnotes-sync.log'}).[/red]"
        )
    return 0


def cmd_push(cfg: SyncConfig, *, quiet: bool) -> int:
    """Snapshot, encrypt, manifest, upload (mirror)."""
    from huggingface_hub import HfApi

    info(f"[cyan]→[/cyan] sync-push to {cfg.repo_id}", quiet=quiet)

    with file_lock(timeout_s=30.0):
        with tempfile.TemporaryDirectory(prefix="labnotes-sync-push-") as td:
            staging = Path(td)
            files_meta: dict[str, dict[str, object]] = {}

            # Registry-driven: each ARTIFACT produces one staged file under its
            # dataset_path + one files_meta entry. Add future state by appending
            # to config.ARTIFACTS — no change here.
            for art in ARTIFACTS:
                dst = staging / art.dataset_path
                dst.parent.mkdir(parents=True, exist_ok=True)

                if art.kind == "db_snapshot":
                    if art.source is None or not art.source.exists():
                        files_meta[art.dataset_path] = {"omitted": True, "reason": "missing"}
                        info(f"  • {art.name} [yellow]skipped[/yellow] (missing)", quiet=quiet)
                        continue
                    used_fallback, note = snapshot_db(art.source, dst)
                    files_meta[art.dataset_path] = {
                        "size": dst.stat().st_size,
                        "sha256": sha256_of(dst),
                        "method": note,
                    }
                    info(
                        f"  • {art.name} snapshot {humanize_bytes(dst.stat().st_size)} ({note})",
                        quiet=quiet,
                    )
                    if used_fallback:
                        info(
                            "    [yellow]used cp fallback — DB may not be transactionally consistent[/yellow]",
                            quiet=quiet,
                        )

                elif art.kind == "dir_tar":
                    if art.source is None or not art.source.exists():
                        files_meta[art.dataset_path] = {"omitted": True, "reason": "missing"}
                        info(f"  • {art.name} [yellow]skipped[/yellow] (missing)", quiet=quiet)
                        continue
                    n = archive_dir(art.source, dst)
                    files_meta[art.dataset_path] = {
                        "size": dst.stat().st_size,
                        "sha256": sha256_of(dst),
                        "files": n,
                    }
                    info(
                        f"  • {art.name} archived {humanize_bytes(dst.stat().st_size)} ({n} files)",
                        quiet=quiet,
                    )

                elif art.kind == "encrypted_tar":
                    try:
                        included = encrypt_secrets(REPO_ROOT, dst)
                        files_meta[art.dataset_path] = {
                            "size": dst.stat().st_size,
                            "sha256": sha256_of(dst),
                            "members": [str(p) for p in included],
                        }
                        info(
                            f"  • {art.name} encrypted {humanize_bytes(dst.stat().st_size)} "
                            f"({len(included)} files)",
                            quiet=quiet,
                        )
                    except RuntimeError as e:
                        files_meta[art.dataset_path] = {"omitted": True, "reason": str(e)}
                        info(f"  • {art.name} [yellow]skipped[/yellow] ({e})", quiet=quiet)

                else:  # pragma: no cover — guards a malformed registry entry
                    err(f"unknown artifact kind: {art.kind!r}")
                    return 2

            if all(v.get("omitted") for v in files_meta.values()):
                err("nothing to push — every artifact is missing")
                return 2

            # ---- manifest ----
            manifest = build_manifest(
                machine_id=cfg.machine_id, files=files_meta, repo_root=REPO_ROOT
            )
            manifest_dst = staging / DATASET_MANIFEST_PATH
            write_manifest(manifest, manifest_dst)
            info(f"  • manifest written ({manifest['pushed_at']})", quiet=quiet)

            # ---- upload (mirror) ----
            api = HfApi()
            commit_msg = (
                f"sync from {cfg.machine_id} @ {manifest['git_ref']} {manifest['pushed_at']}"
            )
            try:
                upload_with_retries(
                    api,
                    folder_path=staging,
                    repo_id=cfg.repo_id,
                    commit_message=commit_msg,
                    quiet=quiet,
                )
            except Exception as e:  # noqa: BLE001
                err(f"upload failed after retries: {e}")
                _bump_alert(str(e))
                return 3

            info(
                f"[green]✓[/green] pushed {len([k for k,v in files_meta.items() if not v.get('omitted')])} "
                f"file(s) to {cfg.repo_id}",
                quiet=quiet,
            )

    # Clear the alert on a successful push.
    if ALERT_FILE.exists():
        try:
            ALERT_FILE.unlink()
        except FileNotFoundError:
            pass
    return 0


def _bump_alert(reason: str) -> None:
    """Touch the alert file with a counter so sync-status can flag persistent failures."""
    try:
        ALERT_FILE.parent.mkdir(parents=True, exist_ok=True)
        existing = ALERT_FILE.read_text(encoding="utf-8") if ALERT_FILE.exists() else ""
        count = existing.count("\n") + 1 if existing else 1
        with ALERT_FILE.open("a", encoding="utf-8") as f:
            f.write(f"[{count}] {reason}\n")
    except OSError:
        pass


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="sync-push")
    p.add_argument("--quiet", action="store_true", help="suppress non-error output")
    p.add_argument(
        "--status-only", action="store_true", help="print last manifest, do not push"
    )
    args = p.parse_args(argv)

    try:
        cfg = SyncConfig.load()
    except (FileNotFoundError, ValueError) as e:
        err(str(e))
        return 1

    if args.status_only:
        return cmd_status(cfg)
    return cmd_push(cfg, quiet=args.quiet)


if __name__ == "__main__":
    raise SystemExit(main())
