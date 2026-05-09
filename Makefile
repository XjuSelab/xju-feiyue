# LabNotes — repo-root convenience targets.
#
# Sync targets shell out to scripts/sync/. They use `uv run --project` so the
# sync venv stays isolated under scripts/sync/.venv and never pollutes
# backend/.venv or the system Python.

.PHONY: sync-bootstrap sync-push sync-push-quiet sync-pull sync-status sync-cron-install

SYNC_DIR := scripts/sync
SYNC_RUN := uv run --project $(SYNC_DIR) python $(SYNC_DIR)

sync-bootstrap:
	$(SYNC_RUN)/bootstrap.py

sync-push:
	$(SYNC_RUN)/push.py

sync-push-quiet:
	$(SYNC_RUN)/push.py --quiet

sync-pull:
	$(SYNC_RUN)/pull.py

sync-status:
	$(SYNC_RUN)/push.py --status-only

sync-cron-install:
	bash $(SYNC_DIR)/cron_install.sh
