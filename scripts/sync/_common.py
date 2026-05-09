"""Shared helpers: sqlite snapshot, age encrypt/decrypt, sha256, manifest, flock.

Used by bootstrap.py / push.py / pull.py. Stdlib + huggingface_hub only.

age passphrase scripting: age opens /dev/tty for the passphrase prompt and
reads ciphertext from stdin. We give it a private pty as its controlling tty
(for the prompt) and a regular pipe for stdin (for the data) — that way the
binary tar bytes never traverse the pty's line discipline, which would echo
them back and deadlock the pipeline.
"""

from __future__ import annotations

import contextlib
import errno
import fcntl
import hashlib
import json
import os
import pty
import shutil
import socket
import subprocess
import termios
import threading
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


def _spawn_with_split_io(
    args: list[str],
) -> tuple[int, int, int]:
    """fork+exec args with passphrase prompt over a pty, stdin over a pipe.

    age opens /dev/tty for the passphrase prompt; we make a fresh pty the
    child's controlling tty so writes to that pty's master fd reach the
    prompt. age reads ciphertext/plaintext from stdin; we give it an
    ordinary pipe so binary data doesn't traverse the pty's line discipline.

    Returns (pid, stdin_pipe_write_fd, pty_master_fd). The caller is
    responsible for writing/closing both fds and waitpid'ing the child.
    """
    master_fd, slave_fd = pty.openpty()
    stdin_r, stdin_w = os.pipe()

    pid = os.fork()
    if pid == 0:
        # child
        try:
            os.close(master_fd)
            os.close(stdin_w)

            # Detach from parent's controlling tty so we can claim slave_fd.
            os.setsid()
            try:
                fcntl.ioctl(slave_fd, termios.TIOCSCTTY, 0)
            except OSError:
                pass

            os.dup2(stdin_r, 0)
            os.dup2(slave_fd, 1)
            os.dup2(slave_fd, 2)
            if stdin_r > 2:
                os.close(stdin_r)
            if slave_fd > 2:
                os.close(slave_fd)

            os.execvp(args[0], args)
        except Exception:
            os._exit(127)

    # parent
    os.close(slave_fd)
    os.close(stdin_r)
    return pid, stdin_w, master_fd


def _drain(fd: int, into: bytearray) -> None:
    """Continuously read from fd until EOF; used to keep age's prompt writes
    from blocking the pty buffer. Errors after EOF (EIO on closed pty) end
    the loop cleanly."""
    while True:
        try:
            chunk = os.read(fd, 4096)
        except OSError as e:
            if e.errno == errno.EIO:
                return
            raise
        if not chunk:
            return
        into.extend(chunk)


def _run_age(
    *,
    args: list[str],
    passphrase: str,
    passphrase_repeat: int,
    payload_path: Path,
) -> None:
    """Spawn `age` via _spawn_with_split_io, feed the passphrase + payload, wait."""
    pid, stdin_w, master_fd = _spawn_with_split_io(args)
    prompt_buf = bytearray()
    drainer = threading.Thread(target=_drain, args=(master_fd, prompt_buf), daemon=True)
    drainer.start()

    try:
        # Write passphrase the right number of times (encrypt prompts twice
        # for confirmation; decrypt prompts once).
        line = (passphrase + "\n").encode("utf-8")
        for _ in range(passphrase_repeat):
            os.write(master_fd, line)

        # Stream payload to age's stdin pipe.
        with payload_path.open("rb") as f:
            while True:
                chunk = f.read(64 * 1024)
                if not chunk:
                    break
                # os.write on a pipe is blocking; pty drain thread keeps
                # the prompt fd from filling. age handles backpressure on
                # stdin via its own scrypt-based read loop.
                view = memoryview(chunk)
                while view:
                    written = os.write(stdin_w, view)
                    view = view[written:]
        os.close(stdin_w)
        stdin_w = -1

        _, status = os.waitpid(pid, 0)
        rc = os.waitstatus_to_exitcode(status)
        if rc != 0:
            raise RuntimeError(
                f"age failed (exit={rc}); prompt buffer={bytes(prompt_buf)!r}"
            )
    finally:
        with contextlib.suppress(OSError):
            os.close(master_fd)
        if stdin_w >= 0:
            with contextlib.suppress(OSError):
                os.close(stdin_w)
        drainer.join(timeout=2.0)


def encrypt_secrets(repo_root: Path, dst: Path) -> list[Path]:
    """tar the existing SECRETS_PATHS, encrypt with `age -p`, write `dst`.

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

        _run_age(
            args=["age", "-p", "--armor", "-o", str(dst)],
            passphrase=pp,
            passphrase_repeat=2,
            payload_path=tar_tmp,
        )
        if not dst.exists() or dst.stat().st_size == 0:
            raise RuntimeError("age produced an empty output file")
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
        _run_age(
            args=["age", "-d", "-o", str(tar_tmp)],
            passphrase=pp,
            passphrase_repeat=1,
            payload_path=src,
        )
        if not tar_tmp.exists() or tar_tmp.stat().st_size == 0:
            raise RuntimeError("age decryption produced an empty tar")

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
