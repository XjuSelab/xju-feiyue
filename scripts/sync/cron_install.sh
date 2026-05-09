#!/usr/bin/env bash
# Install (or refresh) the */30 sync-push-quiet entry in the user's crontab.
# Idempotent: removes any prior 'make sync-push-quiet' line before appending.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
LOG="$HOME/.cache/labnotes-sync.log"

# Pin a sane PATH so cron's stripped env can still find uv/git/age.
# `make` itself is /usr/bin/make on Debian/Ubuntu; uv installs to ~/.local/bin.
PATH_PREFIX="PATH=$HOME/.local/bin:/usr/local/bin:/usr/bin:/bin"

ENTRY="*/30 * * * * $PATH_PREFIX cd $REPO_ROOT && /usr/bin/env make sync-push-quiet >> $LOG 2>&1"

# 1) Pull current crontab (empty if none), 2) drop our prior entry, 3) append fresh.
( crontab -l 2>/dev/null | grep -v 'make sync-push-quiet' ; echo "$ENTRY" ) | crontab -

mkdir -p "$(dirname "$LOG")"
touch "$LOG"

cat <<EOF

✓ cron entry installed:
  $ENTRY

  log:    $LOG
  view:   crontab -l | grep sync
  remove: crontab -l | grep -v 'make sync-push-quiet' | crontab -

WSL note: cron is not enabled by default. If \`service cron status\`
reports inactive, run:
  sudo service cron start
  sudo systemctl enable cron     # may require WSL boot config

EOF
