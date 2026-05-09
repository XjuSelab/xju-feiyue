# labnotes-sync

Encrypts the runtime state that doesn't belong in git — the local sqlite DB
(`backend/labnotes.db`) and `.env.local` files — and mirrors it to a private
Hugging Face Dataset so the same state can be restored on a fresh machine.

Source code lives in `scripts/sync/`; everyday commands run from the repo
root via `make`.

## What gets synced

| Artifact | Local path | In dataset as |
|---|---|---|
| sqlite DB | `backend/labnotes.db` | `data/labnotes.db` (VACUUM INTO snapshot) |
| backend env | `backend/.env.local` | tar + age → `secrets.age` |
| frontend env | `frontend/.env.local` | tar + age → `secrets.age` |
| metadata | (generated) | `manifest.json` |

The HF dataset is a strict mirror — each `make sync-push` rewrites all three
files in one commit (`upload_folder(delete_patterns="*")`), so old artifacts
don't accumulate.

## Why HF Dataset

- Private datasets are free, git-LFS underneath, well-supported by the
  `huggingface_hub` SDK
- Single command on a fresh machine: `git clone && make sync-bootstrap && make sync-pull`
- No S3 / IAM setup, no VPN, no rsync (which is forbidden in this repo —
  see `MEMORY.md`)

## First-time setup (per machine)

1. Install OS deps: `sudo apt install age bsdextrautils sqlite3` (the
   `script` tool comes from `bsdextrautils` on Debian/Ubuntu)
2. Make sure `uv` is on `PATH` (`~/.local/bin/uv`)
3. Log in to Hugging Face once:
   ```
   uv run --project scripts/sync python -m huggingface_hub.commands.huggingface_cli login
   ```
   Use a token with **write** scope.
4. Run bootstrap:
   ```
   make sync-bootstrap
   ```
   It will:
   - verify deps and HF token
   - prompt twice for an age passphrase (saved 0600 to
     `~/.config/labnotes-sync/age.passphrase` — back this up to a password
     manager, you cannot decrypt without it)
   - prompt for `repo_id` (default: `<your-hf-user>/labnotes-state`) and a
     machine label
   - `create_repo(private=True, exist_ok=True)`

## Daily use

```
make sync-push       # snapshot + encrypt + upload (mirror commit)
make sync-pull       # download + verify sha256 + restore (with .bak.<ts>)
make sync-status     # print last manifest from HF, no upload
```

`sync-pull` defaults to non-destructive: any existing local file is renamed
to `<file>.bak.<UTC-stamp>` before being overwritten. Pass `--force` to
skip the y/N prompt (used by bootstrap-style flows).

## Background sync

```
make sync-cron-install
```

Adds a `*/30 * * * *` entry that runs `make sync-push-quiet`, logging to
`~/.cache/labnotes-sync.log`. The script is idempotent — re-run it any time
to update the entry.

WSL caveat: cron isn't enabled by default. After install, run:
```
sudo service cron start
```
(or set up a systemd-user timer instead, if you prefer).

To remove the cron entry:
```
crontab -l | grep -v 'make sync-push-quiet' | crontab -
```

## Debugging

```
make sync-status                                   # last push summary
tail -f ~/.cache/labnotes-sync.log                 # cron output
cat ~/.cache/labnotes-sync.alert 2>/dev/null       # set after consecutive cron failures
```

If push fails with HTTP 401, your HF token expired:
```
uv run --project scripts/sync python -m huggingface_hub.commands.huggingface_cli login
```

## Layout

```
scripts/sync/
├── pyproject.toml      # uv subproject (huggingface_hub + rich)
├── config.py           # path constants + on-disk config loader
├── _common.py          # snapshot / age / sha256 / manifest / flock
├── bootstrap.py        # one-shot setup
├── push.py             # snapshot → encrypt → upload
├── pull.py             # download → verify → decrypt → restore
├── cron_install.sh     # idempotent crontab installer
└── README.md           # this file
```

## Constraints

- **No automatic two-way merge.** Manifest records `pushed_by` so a stale
  pull is visible, but the pattern assumes one writer at a time.
- **Passphrase is irrecoverable.** Lose it → encrypted secrets are gone.
- **Single private dataset per user.** That's HF's free-tier limit.
- **WSL ↔ VPS code sync still goes through GitHub push/pull.** This system
  is exclusively for state (DB + secrets); the codebase itself is
  managed by git, per `MEMORY.md`.
