"""Shared helpers: sqlite snapshot, age encrypt/decrypt, sha256, manifest, flock.

Used by bootstrap.py / push.py / pull.py. Stdlib + huggingface_hub only.

age passphrase scripting: age 1.x reads the passphrase from /dev/tty, so we
allocate a pty via util-linux's `script -qec` and feed both the passphrase
prompt(s) and the payload through it. `script` is in every base WSL/Ubuntu
install so this is portable enough for our targets.
"""

from __future__ import annotations

import contextlib
import errno
import fcntl
import hashlib
import json
import os
import shutil
import socket
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterator

from config import (
    AGE_PASSPHRASE_FILE,
    DATASET_DB_PATH,
    DATASET_MANIFEST_PATH,
    DATASET_SECRETS_PATH,
    LOCK_FILE,
    MANIFEST_SCHEMA_VERSION,
    REPO_ROOT,
    SECRETS_PATHS,
)


# ---------- shell helpers ---------------------------------------------------


def have_cmd(cmd: str) -> bool:
    return shutil.which(cmd) is not None


def shq(s: str) -> str:
    """POSIX single-quote escaper for embedding in /bin/sh -c strings."""
    return "'" + s.replace("'", "'\\''") + "'"


# ---------- file flock ------------------------------------------------------


@contextlib.contextmanager
def file_lock(timeout_s: float = 30.0) -> Iterator[None]:
    """Single-machine mutex. Cross-host coordination is intentionally absent —
    manifest.pushed_by gives a soft warning instead.
    """
    LOCK_FILE.parent.mkdir(parents=True, exist_ok=True)
    fd = os.open(LOCK_FILE, os.O_RDWR | os.O_CREAT, 0o600)
    deadline = time.monotonic() + timeout_s
    try:
        while True:
            try:
                fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
                break
            except OSError as e:
                if e.errno not in (errno.EAGAIN, errno.EACCES):
                    raise
                if time.monotonic() >= deadline:
                    raise TimeoutError(
                        f"Another labnotes-sync run holds {LOCK_FILE} after {timeout_s:.0f}s"
                    ) from e
                time.sleep(0.5)
        yield
    finally:
        try:
            fcntl.flock(fd, fcntl.LOCK_UN)
        finally:
            os.close(fd)


# ---------- hashing / size --------------------------------------------------


def sha256_of(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        while chunk := f.read(1 << 20):
            h.update(chunk)
    return h.hexdigest()


def humanize_bytes(n: int) -> str:
    units = ["B", "KB", "MB", "GB"]
    size = float(n)
    for u in units:
        if size < 1024.0 or u == units[-1]:
            return f"{size:.1f}{u}"
        size /= 1024.0
    return f"{size:.1f}{units[-1]}"


# ---------- sqlite snapshot -------------------------------------------------


def snapshot_db(src: Path, dst: Path) -> tuple[bool, str]:
    """VACUUM INTO with cp -p fallback. Returns (used_fallback, note)."""
    dst.parent.mkdir(parents=True, exist_ok=True)
    if dst.exists():
        dst.unlink()
    if have_cmd("sqlite3"):
        try:
            subprocess.run(
                ["sqlite3", str(src), f"VACUUM INTO '{dst}'"],
                check=True,
                capture_output=True,
            )
            return False, "vacuum-into"
        except subprocess.CalledProcessError as e:
            stderr = (e.stderr or b"").decode("utf-8", errors="replace").strip()
            note = f"vacuum-fallback: {stderr or e}"
    else:
        note = "vacuum-fallback: sqlite3 cli not on PATH"
    shutil.copy2(src, dst)
    return True, note


# ---------- age encryption --------------------------------------------------


def _read_passphrase() -> str:
    if not AGE_PASSPHRASE_FILE.exists():
        raise FileNotFoundError(
            f"{AGE_PASSPHRASE_FILE} missing — run `make sync-bootstrap`."
        )
    return AGE_PASSPHRASE_FILE.read_text(encoding="utf-8").rstrip("\n")


def _ensure_age_deps() -> None:
    if not have_cmd("age"):
        raise RuntimeError("`age` not on PATH (apt install age / brew install age).")
    if not have_cmd("script"):
        raise RuntimeError(
            "`script` (util-linux) not on PATH — needed to allocate a pty for age. "
            "Install with: apt install bsdextrautils (or util-linux)."
        )


def encrypt_secrets(repo_root: Path, dst: Path) -> list[Path]:
    """tar the existing SECRETS_PATHS, pipe through `age -p`, write `dst`.

    Skips members that don't exist locally; raises if none exist. Returns the
    list of relative paths actually included (lands in manifest.files).
    """
    _ensure_age_deps()

    included = [rel for rel in SECRETS_PATHS if (repo_root / rel).exists()]
    if not included:
        raise RuntimeError(
            "No secrets to encrypt — neither backend/.env.local nor frontend/.env.local exists."
        )

    pp = _read_passphrase()
    dst.parent.mkdir(parents=True, exist_ok=True)
    if dst.exists():
        dst.unlink()

    # Stage the tar to a tempfile so we can drive age's tty cleanly.
    tar_tmp = dst.with_suffix(dst.suffix + ".tar.tmp")
    if tar_tmp.exists():
        tar_tmp.unlink()
    try:
        with tar_tmp.open("wb") as tf:
            subprocess.run(
                ["tar", "-cf", "-", "-C", str(repo_root), *[str(m) for m in included]],
                stdout=tf,
                check=True,
            )

        # Pipeline:
        #   ( printf "$PP\n$PP\n"; cat "$TAR" ) | script -qec "age -p --armor -o DST" /dev/null
        # `script` allocates a pty so age reads its prompt; we feed both the
        # passphrase confirmation (twice) and the binary archive on stdin.
        env = {**os.environ, "PP": pp, "TAR": str(tar_tmp)}
        glue = 'printf "%s\\n%s\\n" "$PP" "$PP"; cat "$TAR"'
        age_cmd = f"age -p --armor -o {shq(str(dst))}"
        proc = subprocess.run(
            ["bash", "-c", f"({glue}) | script -qec {shq(age_cmd)} /dev/null"],
            env=env,
            capture_output=True,
        )
        if proc.returncode != 0 or not dst.exists() or dst.stat().st_size == 0:
            stderr = (proc.stderr or b"").decode("utf-8", errors="replace")
            stdout = (proc.stdout or b"").decode("utf-8", errors="replace")
            raise RuntimeError(
                f"age encryption failed (rc={proc.returncode})\nstdout: {stdout}\nstderr: {stderr}"
            )
    finally:
        if tar_tmp.exists():
            tar_tmp.unlink()

    return included


def decrypt_secrets(src: Path, repo_root: Path) -> list[Path]:
    """Decrypt `src` and untar into `repo_root`. Returns restored relative paths."""
    _ensure_age_deps()
    pp = _read_passphrase()

    tar_tmp = src.with_suffix(src.suffix + ".decrypted.tar.tmp")
    if tar_tmp.exists():
        tar_tmp.unlink()
    try:
        # age -d asks for the passphrase exactly once.
        env = {**os.environ, "PP": pp, "ENC": str(src)}
        glue = 'printf "%s\\n" "$PP"; cat "$ENC"'
        age_cmd = f"age -d -o {shq(str(tar_tmp))}"
        proc = subprocess.run(
            ["bash", "-c", f"({glue}) | script -qec {shq(age_cmd)} /dev/null"],
            env=env,
            capture_output=True,
        )
        if proc.returncode != 0 or not tar_tmp.exists() or tar_tmp.stat().st_size == 0:
            stderr = (proc.stderr or b"").decode("utf-8", errors="replace")
            raise RuntimeError(f"age decryption failed (rc={proc.returncode}): {stderr}")

        listing = subprocess.run(
            ["tar", "-tf", str(tar_tmp)], capture_output=True, check=True
        )
        members = [
            Path(line)
            for line in listing.stdout.decode("utf-8").splitlines()
            if line.strip() and not line.endswith("/")
        ]
        subprocess.run(["tar", "-xf", str(tar_tmp), "-C", str(repo_root)], check=True)
        return members
    finally:
        if tar_tmp.exists():
            tar_tmp.unlink()


def encrypt_decrypt_roundtrip(repo_root: Path, dst: Path) -> bool:
    """Smoke check before upload: encrypt → decrypt-to-tempdir → tar list non-empty.

    Pure read-only on the workspace (decrypt extracts to a tempdir, not the
    real paths). Returns True if round-trip works; raises on failure.
    """
    import tempfile

    encrypt_secrets(repo_root, dst)
    with tempfile.TemporaryDirectory() as td:
        members = decrypt_secrets(dst, Path(td))
    if not members:
        raise RuntimeError("encrypt/decrypt round-trip produced empty member list")
    return True


# ---------- manifest --------------------------------------------------------


def utc_now_z() -> str:
    return datetime.now(tz=timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def git_ref(repo_root: Path) -> tuple[str, bool]:
    try:
        sha = (
            subprocess.run(
                ["git", "rev-parse", "--short", "HEAD"],
                cwd=repo_root,
                check=True,
                capture_output=True,
            )
            .stdout.decode()
            .strip()
        )
        status = subprocess.run(
            ["git", "status", "--porcelain"],
            cwd=repo_root,
            check=True,
            capture_output=True,
        ).stdout.decode()
        return sha, bool(status.strip())
    except (subprocess.CalledProcessError, FileNotFoundError):
        return "unknown", False


def hostname_default() -> str:
    return socket.gethostname() or "unknown-host"


def build_manifest(
    *,
    machine_id: str,
    files: dict[str, dict[str, object]],
    repo_root: Path,
    extras: dict[str, object] | None = None,
) -> dict[str, object]:
    sha, dirty = git_ref(repo_root)
    return {
        "schema_version": MANIFEST_SCHEMA_VERSION,
        "pushed_at": utc_now_z(),
        "pushed_by": machine_id,
        "git_ref": sha,
        "git_dirty": dirty,
        "files": files,
        **({} if extras is None else extras),
    }


def write_manifest(manifest: dict[str, object], dst: Path) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    dst.write_text(json.dumps(manifest, indent=2, sort_keys=True), encoding="utf-8")


def read_manifest(src: Path) -> dict[str, object]:
    return json.loads(src.read_text(encoding="utf-8"))


# ---------- exports ---------------------------------------------------------


__all__ = [
    "have_cmd",
    "shq",
    "file_lock",
    "sha256_of",
    "humanize_bytes",
    "snapshot_db",
    "encrypt_secrets",
    "decrypt_secrets",
    "encrypt_decrypt_roundtrip",
    "utc_now_z",
    "git_ref",
    "hostname_default",
    "build_manifest",
    "write_manifest",
    "read_manifest",
    "DATASET_DB_PATH",
    "DATASET_SECRETS_PATH",
    "DATASET_MANIFEST_PATH",
    "REPO_ROOT",
    "AGE_PASSPHRASE_FILE",
]
