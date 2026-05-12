#!/usr/bin/env bash
# Manual deploy: optionally pull main, then always sync deps / run migrations /
# restart backend / health-check.
#
# Why no early-exit on HEAD==REMOTE: it's bitten us when someone (or an agent)
# git-pull'd manually first, then ran ./deploy.sh expecting the side effects.
# uv sync + alembic upgrade + systemctl restart are all cheap & idempotent,
# so we just always run them. Use --dry-run to check status without restarting.
set -euo pipefail
cd "$(dirname "$0")"

DRY_RUN=0
for arg in "$@"; do
    case "$arg" in
        --dry-run) DRY_RUN=1 ;;
        *) echo "unknown flag: $arg" >&2; exit 2 ;;
    esac
done

git fetch origin main
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)
if [ "$LOCAL" = "$REMOTE" ]; then
    echo "== HEAD already at $LOCAL"
else
    echo "== updating $LOCAL → $REMOTE"
    git pull --ff-only origin main
fi

if [ "$DRY_RUN" = "1" ]; then
    echo "== dry-run: skipping sync/migrate/restart"
    exit 0
fi

cd backend
/home/winbeau/.local/bin/uv sync --quiet
/home/winbeau/.local/bin/uv run alembic upgrade head

sudo systemctl restart aurash-backend.service
sleep 3
# --noproxy 127.0.0.1: this shell often has http_proxy=http://127.0.0.1:10808
# exported for GFW-aware tooling, which makes curl route the health probe
# through a proxy that (rightly) refuses localhost — producing a false
# "!! health check failed" even though uvicorn is fine.
curl -sf --noproxy 127.0.0.1 http://127.0.0.1:8001/health > /dev/null \
    && echo "== backend healthy" \
    || { echo "!! health check failed"; sudo journalctl -u aurash-backend.service -n 30 --no-pager; exit 1; }
