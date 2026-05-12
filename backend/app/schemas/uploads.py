"""Upload schemas — mirrors frontend src/api/endpoints/uploads.ts."""
from app.schemas._base import CamelModel


class UploadedImage(CamelModel):
    """Response from POST /notes/images: served-back absolute URL the
    frontend writes into the markdown body as `![](url)`."""

    url: str
