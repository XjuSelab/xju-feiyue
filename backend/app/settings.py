from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration loaded from .env.local / environment variables."""

    database_url: str = "sqlite+aiosqlite:///./labnotes.db"
    jwt_secret: str = "dev-only-change-in-prod"
    jwt_expire_minutes: int = 60 * 24 * 7  # 7 days

    deepseek_api_key: str = ""
    deepseek_base_url: str = "https://api.deepseek.com"
    deepseek_model: str = "deepseek-v4-flash"
    deepseek_dry_run: bool = False
    deepseek_timeout_s: float = 30.0

    cors_origins: list[str] = ["http://localhost:5173"]

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_cors(cls, v: object) -> object:
        # pydantic-settings v2 tries json.loads on list[str] env vars; we want
        # plain comma-separated strings (`CORS_ORIGINS=a,b`). Pre-split here.
        if isinstance(v, str):
            return [s.strip() for s in v.split(",") if s.strip()]
        return v

    model_config = SettingsConfigDict(
        env_file=(".env", ".env.local"),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )


settings = Settings()
