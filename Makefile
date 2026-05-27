# xju-feiyue — repo-root convenience targets.
#
# Sync targets shell out to scripts/sync/. They use `uv run --project` so the
# sync venv stays isolated under scripts/sync/.venv and never pollutes
# backend/.venv or the system Python.
#
# One HF dataset, two namespaces: `state/` (runtime DB + uploads + secrets, via
# sync-*) and `schools/` (advisor reference data, via schools-*). `data-*` does
# both — the one-command path for a fresh-machine restore.

.PHONY: sync-bootstrap sync-push sync-push-quiet sync-pull sync-status sync-cron-install \
        schools-push schools-pull schools-pull-force schools-status \
        conf-push conf-pull conf-pull-force conf-status \
        data-push data-pull

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

# --- schools advisor reference data (schools/ namespace) --------------------

schools-push:
	$(SYNC_RUN)/schools.py push

schools-pull:
	$(SYNC_RUN)/schools.py pull

schools-pull-force:
	$(SYNC_RUN)/schools.py pull --force --quiet

schools-status:
	$(SYNC_RUN)/schools.py status

# --- conferences reference data (conferences/ namespace) --------------------

conf-push:
	$(SYNC_RUN)/conferences.py push

conf-pull:
	$(SYNC_RUN)/conferences.py pull

conf-pull-force:
	$(SYNC_RUN)/conferences.py pull --force --quiet

conf-status:
	$(SYNC_RUN)/conferences.py status

# --- umbrella: all data (state/ + schools/ + conferences/) ------------------

data-push:
	$(MAKE) sync-push && $(MAKE) schools-push && $(MAKE) conf-push

data-pull:
	$(MAKE) sync-pull && $(MAKE) schools-pull && $(MAKE) conf-pull
