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

    # Wire as a comma-separated string (e.g. CORS_ORIGINS=a,b,c).
    # pydantic-settings v2 would try JSON-parsing list[str] env vars and
    # crash on plain CSV; sticking to str + a derived list property avoids it.
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    @property
    def cors_origin_list(self) -> list[str]:
        return [s.strip() for s in self.cors_origins.split(",") if s.strip()]

    model_config = SettingsConfigDict(
        env_file=(".env", ".env.local"),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )


settings = Settings()
