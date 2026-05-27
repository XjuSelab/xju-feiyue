"""xju-feiyue API entrypoint.

Routes registered here mirror BACKEND_SPEC.md §2 exactly. JSON wire format
is camelCase (see app/schemas/_base.py).
"""
import asyncio
import contextlib
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.db.conferences_engine import init_holder as init_conferences_holder
from app.db.schools_engine import init_holder as init_schools_holder
from app.db.session import AsyncSessionLocal
from app.routes import (
    admin,
    ai,
    auth,
    conferences,
    drafts,
    interactions,
    notes,
    schools,
    uploads,
)
from app.services.author_sync import repair
from app.services.conferences_crawler import crawl_sync
from app.settings import settings

_crawl_log = logging.getLogger("xju_feiyue.conf_crawler")

BACKEND_DIR = Path(__file__).resolve().parent.parent
UPLOAD_DIR = BACKEND_DIR / "uploads"


def _resolve_data_dir(value: str) -> Path:
    p = Path(value)
    return p if p.is_absolute() else BACKEND_DIR / p


SCHOOLS_DATA_DIR = _resolve_data_dir(settings.schools_data_dir)
CONFERENCES_DATA_DIR = _resolve_data_dir(settings.conferences_data_dir)

# 24h between scans — drift is rare and a one-day worst-case is fine.
AUTHOR_SYNC_INTERVAL_SECONDS = 24 * 60 * 60
_log = logging.getLogger("xju_feiyue.author_sync")


async def _author_sync_loop() -> None:
    while True:
        try:
            async with AsyncSessionLocal() as db:
                report = await repair(db)
            if report.mismatches:
                _log.info(
                    "author-sync: repaired %d / %d mismatches (unresolvable: %d)",
                    len(report.fixable),
                    len(report.mismatches),
                    len(report.unresolvable),
                )
        except Exception:  # noqa: BLE001 — daily job must not crash the app
            _log.exception("author-sync: pass failed")
        await asyncio.sleep(AUTHOR_SYNC_INTERVAL_SECONDS)


async def _conf_crawl_loop(conf_holder) -> None:  # type: ignore[type-arg]
    interval = settings.conf_crawl_interval_hours * 3600
    first_run = True
    while True:
        if not settings.deepseek_api_key:
            _crawl_log.warning("conf_crawl: DEEPSEEK_API_KEY not set, skipping")
            await asyncio.sleep(interval)
            continue
        try:
            result = await asyncio.to_thread(
                crawl_sync,
                CONFERENCES_DATA_DIR,
                api_key=settings.deepseek_api_key,
                base_url=settings.deepseek_base_url,
                model=settings.deepseek_model,
                dry_run=settings.deepseek_dry_run,
                full_scan=first_run,
            )
            first_run = False
            if result.get("found", 0):
                await conf_holder.force_reload()
            _crawl_log.info("conf_crawl: %s", {k: v for k, v in result.items() if k != "results"})
        except Exception:  # noqa: BLE001
            _crawl_log.exception("conf_crawl: cycle failed")
        await asyncio.sleep(interval)


@asynccontextmanager
async def lifespan(app: FastAPI):  # noqa: ARG001 - signature required
    # Engine ping happens lazily on first request; nothing to do at boot.
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    schools_holder = init_schools_holder(SCHOOLS_DATA_DIR)
    await schools_holder.boot()
    conf_holder = init_conferences_holder(CONFERENCES_DATA_DIR)
    await conf_holder.boot()
    sync_task = asyncio.create_task(_author_sync_loop()) if settings.author_sync_enabled else None
    crawl_task = asyncio.create_task(_conf_crawl_loop(conf_holder)) if settings.conf_crawl_enabled else None
    try:
        yield
    finally:
        for t in (sync_task, crawl_task):
            if t is not None:
                t.cancel()
                with contextlib.suppress(asyncio.CancelledError):
                    await t
        await schools_holder.dispose()
        await conf_holder.dispose()


app = FastAPI(title="xju-feiyue API", version="1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Avatar uploads — file storage backing /auth/me/avatar. `check_dir=False`
# means an empty dir won't 500 on boot; lifespan creates it lazily.
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR, check_dir=False), name="uploads")

app.include_router(auth.router)
app.include_router(notes.router)
app.include_router(uploads.router)
app.include_router(drafts.router)
app.include_router(interactions.router)
app.include_router(ai.router)
app.include_router(admin.router)
app.include_router(schools.router)
app.include_router(conferences.router)


@app.get("/health", tags=["meta"])
async def health() -> dict[str, str]:
    return {"status": "ok"}
