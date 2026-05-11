"""LabNotes API entrypoint.

Routes registered here mirror BACKEND_SPEC.md §2 exactly. JSON wire format
is camelCase (see app/schemas/_base.py).
"""
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.routes import ai, auth, drafts, interactions, notes
from app.settings import settings

UPLOAD_DIR = Path(__file__).resolve().parent.parent / "uploads"


@asynccontextmanager
async def lifespan(app: FastAPI):  # noqa: ARG001 - signature required
    # Engine ping happens lazily on first request; nothing to do at boot.
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    yield


app = FastAPI(title="LabNotes API", version="1.0", lifespan=lifespan)

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
app.include_router(drafts.router)
app.include_router(interactions.router)
app.include_router(ai.router)


@app.get("/health", tags=["meta"])
async def health() -> dict[str, str]:
    return {"status": "ok"}
