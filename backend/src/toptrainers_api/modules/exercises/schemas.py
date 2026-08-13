from typing import Literal
from urllib.parse import urlparse

from pydantic import BaseModel, Field, field_validator, model_validator

ExerciseDirection = Literal["speed", "strength", "agility", "cardio"]
VideoPlatform = Literal["rutube", "youtube", "vk"]


class ExerciseCreate(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    direction: ExerciseDirection
    muscle_group: str = Field(min_length=1, max_length=64)
    instruction: str = Field(default="", max_length=4_000)
    reference_url: str | None = Field(default=None, max_length=2_048)
    video_platform: VideoPlatform | None = None
    video_url: str | None = Field(default=None, max_length=2_048)
    video_file_url: str | None = Field(default=None, max_length=2_048)
    thumbnail_url: str | None = Field(default=None, max_length=2_048)

    @field_validator("reference_url", "video_url", "video_file_url", "thumbnail_url")
    @classmethod
    def validate_url(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        if not normalized:
            return None
        parsed = urlparse(normalized)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise ValueError("URL must use http or https")
        return normalized

    @model_validator(mode="after")
    def validate_video_source(self) -> "ExerciseCreate":
        if self.video_platform and not self.video_url:
            raise ValueError("Video URL is required when a video platform is selected")
        if self.video_url and not self.video_platform:
            raise ValueError("Video platform is required when a video URL is set")
        return self


class ExerciseResponse(ExerciseCreate):
    id: str
    trainer_id: str
