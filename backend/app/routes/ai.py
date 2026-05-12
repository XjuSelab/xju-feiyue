"""AI compose route — calls services.ai_compose.compose()."""
import json
from collections.abc import AsyncIterator

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from app.schemas.ai import AIComposeIn, AIComposeOut
from app.services import ai_compose

router = APIRouter(prefix="/ai", tags=["ai"])


@router.post("/compose", response_model=AIComposeOut)
async def compose(body: AIComposeIn) -> AIComposeOut:
    return await ai_compose.compose(body)


@router.post("/compose/stream")
async def compose_stream(body: AIComposeIn) -> StreamingResponse:
    """Stream the model's reply as `text/event-stream` SSE.

    Each event payload is JSON: `{chunk: str}` for partial deltas,
    `{done: true}` when the stream finishes, `{error: str}` on upstream
    failure (so the frontend doesn't have to interpret HTTP status mid-stream).
    """

    async def event_gen() -> AsyncIterator[str]:
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
