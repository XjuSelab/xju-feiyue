"""AI compose route — calls services.ai_compose.compose()."""
import json
from collections.abc import AsyncIterator

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from app.db.models import User
from app.deps import get_current_user
from app.schemas.ai import AIComposeIn, AIComposeOut, GreetingOut
from app.services import ai_compose, greeting

router = APIRouter(prefix="/ai", tags=["ai"])


@router.post("/compose", response_model=AIComposeOut)
async def compose(body: AIComposeIn) -> AIComposeOut:
    return await ai_compose.compose(body)


@router.get("/greeting", response_model=GreetingOut)
async def home_greeting(user: User = Depends(get_current_user)) -> GreetingOut:
    """One-line personalized homepage hello (logged-in users only).

    Derives the address from the user's legal name, blends in time + locale
    weather, and has DeepSeek write the line. On model failure this raises 503
    so the frontend keeps its plain ``Hi <nickname>，`` fallback.
    """
    return GreetingOut(text=await greeting.compose_greeting(user.name))


@router.post("/compose/stream")
async def compose_stream(body: AIComposeIn) -> StreamingResponse:
    """Stream the model's reply as `text/event-stream` SSE.

    Each event payload is JSON: `{chunk: str}` for partial deltas,
    `{done: true}` when the stream finishes, `{error: str}` on upstream
    failure (so the frontend doesn't have to interpret HTTP status mid-stream).
    """

    async def event_gen() -> AsyncIterator[str]:
        # Prime the response with an SSE comment so nginx (even with
        # X-Accel-Buffering: no) actually flushes the first packet
        # immediately — DeepSeek's first delta can be 1-2 s away and we
        # don't want the client's read() blocked waiting for it.
        yield ": ready\n\n"
        try:
            async for chunk in ai_compose.stream_chunks(body):
                yield f"data: {json.dumps({'chunk': chunk}, ensure_ascii=False)}\n\n"
            yield 'data: {"done": true}\n\n'
        except Exception as e:  # noqa: BLE001 — funnel any failure into the stream
            payload = {"error": getattr(e, "detail", None) or str(e) or "AI 上游异常"}
            yield f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        event_gen(),
        media_type="text/event-stream",
        headers={
            # Tell nginx not to buffer this response — otherwise the client
            # only sees chunks after the whole stream finishes.
            "X-Accel-Buffering": "no",
            "Cache-Control": "no-cache",
        },
    )
