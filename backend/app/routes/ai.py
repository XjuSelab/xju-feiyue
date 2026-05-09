"""AI compose route — calls services.ai_compose.compose()."""
from fastapi import APIRouter

from app.schemas.ai import AIComposeIn, AIComposeOut
from app.services import ai_compose

router = APIRouter(prefix="/ai", tags=["ai"])


@router.post("/compose", response_model=AIComposeOut)
async def compose(body: AIComposeIn) -> AIComposeOut:
    return await ai_compose.compose(body)
