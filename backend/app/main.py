"""LabNotes API entrypoint.

Routes registered here mirror BACKEND_SPEC.md §2 exactly. JSON wire format
is camelCase (see app/schemas/_base.py).
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes import ai, auth, drafts, interactions, notes
from app.settings import settings


@asynccontextmanager
async def lifespan(app: FastAPI):  # noqa: ARG001 - signature required
    # Engine ping happens lazily on first request; nothing to do at boot.
    yield


app = FastAPI(title="LabNotes API", version="1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(notes.router)
app.include_router(drafts.router)
app.include_router(interactions.router)
app.include_router(ai.router)


@app.get("/health", tags=["meta"])
async def health() -> dict[str, str]:
    return {"status": "ok"}
