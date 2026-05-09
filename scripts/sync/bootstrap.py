"""One-time per-machine setup for labnotes-sync.

Steps:
  1. Verify `age` and `script` are on PATH.
  2. Verify HF token is present (~/.cache/huggingface/token); guide the user
     to `huggingface-cli login` if missing.
  3. Capture an age passphrase (twice for confirmation), write to a 600 file.
  4. Capture HF repo_id and machine_id, write config.toml.
  5. Idempotently create the private HF dataset.
"""

from __future__ import annotations

import getpass
import os
import sys
from pathlib import Path

from rich.console import Console
from rich.panel import Panel

from _common import have_cmd
from config import (
    AGE_PASSPHRASE_FILE,
    CONFIG_FILE,
    SyncConfig,
    USER_CFG_DIR,
)

console = Console()


def step(msg: str) -> None:
    console.print(f"[bold cyan]→[/bold cyan] {msg}")


def ok(msg: str) -> None:
    console.print(f"[bold green]✓[/bold green] {msg}")


def warn(msg: str) -> None:
    console.print(f"[bold yellow]![/bold yellow] {msg}")


def fail(msg: str) -> None:
    console.print(f"[bold red]✗[/bold red] {msg}")


def check_system_deps() -> None:
    step("Checking system dependencies")
    missing: list[tuple[str, str]] = []
    if not have_cmd("age"):
        missing.append(("age", "apt install age   # or: brew install age"))
    if not have_cmd("script"):
        missing.append(
            (
                "script (util-linux)",
                "apt install bsdextrautils   # provides /usr/bin/script",
            )
        )
    if not have_cmd("sqlite3"):
        # sqlite3 CLI is preferred for VACUUM INTO; we have a cp -p fallback,
        # so this is a soft warning rather than a hard fail.
        warn("`sqlite3` CLI not on PATH — push will fall back to cp (less safe).")
    if not have_cmd("uv"):
        missing.append(("uv", "curl -LsSf https://astral.sh/uv/install.sh | sh"))
    if missing:
        for name, install in missing:
            fail(f"missing: {name}")
            console.print(f"    install: [dim]{install}[/dim]")
        sys.exit(1)
    ok("system deps look good")


def check_hf_token() -> None:
    step("Checking Hugging Face token")
    # huggingface_hub stores tokens at ~/.cache/huggingface/token by default.
    # The hub Python client also checks HF_TOKEN env var.
    token_file = Path.home() / ".cache" / "huggingface" / "token"
    if os.environ.get("HF_TOKEN") or token_file.exists():
        ok(f"token present ({'env' if os.environ.get('HF_TOKEN') else token_file})")
        return
    fail("no HF token found")
    console.print(
        Panel(
            "Run this in another shell to log in:\n\n"
            "  [bold]uv run --project scripts/sync python -m huggingface_hub.commands.huggingface_cli login[/bold]\n\n"
            "Use a token with [bold]write[/bold] scope. Generate one at:\n"
            "  https://huggingface.co/settings/tokens\n\n"
            "Then re-run [bold]make sync-bootstrap[/bold].",
            title="HF login required",
            border_style="yellow",
        )
    )
    sys.exit(2)


def setup_passphrase() -> None:
    step("Configuring age passphrase")
    USER_CFG_DIR.mkdir(parents=True, exist_ok=True)
    if AGE_PASSPHRASE_FILE.exists():
        # Don't silently overwrite — the existing passphrase decrypts secrets
        # already on HF, and rotating it strands those uploads.
        warn(f"{AGE_PASSPHRASE_FILE} already exists; keeping it.")
        warn("   To rotate: delete the file manually, then re-run bootstrap.")
        return
    while True:
        pp1 = getpass.getpass("Enter a passphrase to encrypt .env.local files: ")
        if len(pp1) < 12:
            warn("passphrase must be at least 12 characters; try again.")
            continue
        pp2 = getpass.getpass("Confirm passphrase: ")
        if pp1 != pp2:
            warn("passphrases didn't match; try again.")
            continue
        break
    AGE_PASSPHRASE_FILE.write_text(pp1 + "\n", encoding="utf-8")
    AGE_PASSPHRASE_FILE.chmod(0o600)
    ok(f"passphrase saved to {AGE_PASSPHRASE_FILE} (mode 600)")
    console.print(
        "[dim]   Back this up to a password manager — losing it means losing access "
        "to encrypted secrets on HF.[/dim]"
    )


def prompt_default(label: str, default: str) -> str:
    raw = input(f"{label} [{default}]: ").strip()
    return raw or default


def setup_config_and_repo() -> SyncConfig:
    step("Configuring HF dataset")
    if CONFIG_FILE.exists():
        cfg = SyncConfig.load()
        ok(f"existing config: repo_id={cfg.repo_id}, machine_id={cfg.machine_id}")
        keep = prompt_default("Keep this config? [y/n]", "y").lower()
        if keep == "y":
            return cfg

    # Suggest "<hf_user>/labnotes-state" if we can read the username.
    default_repo = "your-hf-username/labnotes-state"
    try:
        from huggingface_hub import whoami

        info = whoami()
        if info and info.get("name"):
            default_repo = f"{info['name']}/labnotes-state"
    except Exception:  # noqa: BLE001
        pass

    repo_id = prompt_default("HF dataset repo_id", default_repo)
    if "/" not in repo_id or repo_id.startswith("/") or repo_id.endswith("/"):
        fail(f"invalid repo_id: {repo_id!r} (expected `<user-or-org>/<name>`)")
        sys.exit(3)

    default_machine = os.environ.get("HOSTNAME") or os.uname().nodename or "this-host"
    machine_id = prompt_default("Machine label (lands in manifest.pushed_by)", default_machine)

    cfg = SyncConfig.write(repo_id=repo_id, machine_id=machine_id)
    ok(f"wrote {CONFIG_FILE}")

    step(f"Creating private HF dataset {cfg.repo_id} (idempotent)")
    from huggingface_hub import HfApi
    from huggingface_hub.errors import HfHubHTTPError

    api = HfApi()
    try:
        api.create_repo(
            repo_id=cfg.repo_id,
            repo_type="dataset",
            private=True,
            exist_ok=True,
        )
        ok(f"dataset ready: https://huggingface.co/datasets/{cfg.repo_id} (private)")
    except HfHubHTTPError as e:
        fail(f"create_repo failed: {e}")
        console.print(
            "[dim]   Common causes: token lacks `write` scope, or repo_id namespace "
            "isn't yours.[/dim]"
        )
        sys.exit(4)

    return cfg


def main() -> int:
    console.print(
        Panel(
            "labnotes-sync bootstrap — sets up encrypted state sync to a private HF Dataset.",
            border_style="cyan",
        )
    )
    check_system_deps()
    check_hf_token()
    setup_passphrase()
    cfg = setup_config_and_repo()
    console.print()
    ok("bootstrap complete")
    console.print(
        f"[dim]   Next: [bold]make sync-push[/bold] to upload current state to {cfg.repo_id}.[/dim]"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
