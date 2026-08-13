from __future__ import annotations

from functools import cached_property
from typing import Literal

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        env_prefix="TT_",
        extra="ignore",
    )

    environment: Literal["development", "test", "staging", "production"] = "development"
    app_version: str = "0.1.0"
    log_level: str = "INFO"
    database_url: str = "postgresql+asyncpg://toptrainers:toptrainers@localhost:5432/toptrainers"
    redis_url: str = "redis://localhost:6379/0"
    jwt_signing_key: str = "development-only-key-change-before-deploy"
    openapi_enabled: bool = True
    allowed_hosts_csv: str = Field(
        default="localhost,127.0.0.1,testserver",
        validation_alias="TT_ALLOWED_HOSTS",
    )
    cors_origins_csv: str = Field(default="", validation_alias="TT_CORS_ORIGINS")
    public_app_url: str = "http://app.toptrainers.localhost:8080"
    auth_cookie_name: str = "tt_session"
    auth_session_days: int = Field(default=7, ge=1, le=30)
    smtp_host: str | None = Field(default=None, validation_alias="SMTP_SERVER")
    smtp_port: int = Field(default=465, ge=1, le=65535)
    smtp_username: str | None = Field(default=None, validation_alias="ADMIN_MAIL")
    smtp_password: str | None = Field(default=None, validation_alias="ADMIN_MAIL_PASSWORD")
    smtp_from_email: str | None = Field(default=None, validation_alias="ADMIN_MAIL")
    smtp_use_starttls: bool = False
    s3_endpoint_url: str | None = None
    s3_bucket: str | None = None
    s3_region: str | None = None
    s3_access_key_id: str | None = None
    s3_secret_access_key: str | None = None

    @cached_property
    def allowed_hosts(self) -> list[str]:
        return [host.strip() for host in self.allowed_hosts_csv.split(",") if host.strip()]

    @cached_property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins_csv.split(",") if origin.strip()]

    @model_validator(mode="after")
    def validate_production_requirements(self) -> "Settings":
        if self.environment != "production":
            return self

        missing: list[str] = []
        if not self.allowed_hosts:
            missing.append("TT_ALLOWED_HOSTS")
        if not self.cors_origins:
            missing.append("TT_CORS_ORIGINS")
        if len(self.jwt_signing_key) < 48:
            missing.append("TT_JWT_SIGNING_KEY (at least 48 characters)")
        if not self.public_app_url.startswith("https://"):
            missing.append("TT_PUBLIC_APP_URL (HTTPS URL)")
        if not all([self.smtp_host, self.smtp_username, self.smtp_password, self.smtp_from_email]):
            missing.append("SMTP_SERVER, ADMIN_MAIL, ADMIN_MAIL_PASSWORD")
        if "change-me" in self.database_url or self.database_url.endswith(
            "@localhost:5432/toptrainers"
        ):
            missing.append("TT_DATABASE_URL")
        if missing:
            joined = ", ".join(missing)
            raise ValueError(f"Production configuration is incomplete: {joined}")
        return self


settings = Settings()
