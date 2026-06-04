#!/usr/bin/env bash
# Install (or refresh) the */30 sync-push-quiet entry in the user's crontab.
# Idempotent: removes any prior 'make sync-push-quiet' line before appending.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
LOG="$HOME/.cache/labnotes-sync.log"

# cron runs with a stripped environment. Bake in everything the push needs:
#   - PATH so uv/git/age/sqlite3 resolve (uv installs to ~/.local/bin; `make` is
#     /usr/bin/make on Debian/Ubuntu).
#   - any proxy vars currently exported: GFW-side hosts (e.g. huawei2) reach
#     huggingface.co ONLY through a local proxy, and cron has none of it — without
#     this the push hangs until it times out. Captured verbatim at install time
#     and single-quoted so cron's /bin/sh doesn't glob `no_proxy`'s `*`. On a
#     proxy-less host the loop adds nothing. Re-run this installer if the proxy
#     address ever changes.
# The assignments prefix `make` (an external command — they propagate to it and
# its uv/python children) rather than `cd` (a regular builtin, where POSIX sh does
# not guarantee a prefix assignment persists to the following `&&` command).
ENV_PREFIX="PATH=$HOME/.local/bin:/usr/local/bin:/usr/bin:/bin"
for v in http_proxy https_proxy no_proxy HTTP_PROXY HTTPS_PROXY NO_PROXY all_proxy ALL_PROXY; do
    if [ -n "${!v:-}" ]; then
        ENV_PREFIX="$ENV_PREFIX ${v}='${!v}'"
    fi
done

ENTRY="*/30 * * * * cd $REPO_ROOT && $ENV_PREFIX make sync-push-quiet >> $LOG 2>&1"

# 1) Pull current crontab (empty if none), 2) drop our prior entry, 3) append fresh.
# `|| true` guards the read+filter: on a machine with no/empty crontab, `crontab
# -l` exits 1 and `grep -v` emits nothing (also exit 1), which under
# `set -euo pipefail` would abort the subshell BEFORE the `echo "$ENTRY"` append
# — clobbering the install with an empty crontab. Swallow that so we always
# append our entry.
( crontab -l 2>/dev/null | grep -v 'make sync-push-quiet' || true ; echo "$ENTRY" ) | crontab -

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
