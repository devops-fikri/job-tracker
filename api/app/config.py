from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://jobtracker:jobtracker@db:5432/jobtracker"
    redis_url: str = "redis://redis:6379/0"
    upload_dir: str = "/data/uploads"
    backup_dir: str = "/backups"
    max_upload_mb: int = 10

    timezone: str = "Asia/Kuala_Lumpur"
    session_days: int = 30
    cookie_secure: bool = False  # set true once served over HTTPS (e.g. Tailscale Serve)

    # Follow-up / ghosting rules (days)
    followup_after_applied_days: int = 7
    followup_no_response_days: int = 14
    followup_after_interview_days: int = 7
    ghosted_after_days: int = 30


@lru_cache
def get_settings() -> Settings:
    return Settings()
