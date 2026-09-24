from typing import Literal, Self
from urllib.parse import urlparse

from pydantic import BaseModel, Field, field_validator, model_validator

ExerciseDirection = Literal["speed", "strength", "agility", "cardio"]
VideoPlatform = Literal["rutube", "youtube", "vk"]
MuscleGroup = Literal["Ноги", "Грудь", "Спина", "Плечи", "Руки", "Кор", "Всё тело"]
ExerciseVideoContentType = Literal["video/mp4", "video/webm", "video/quicktime"]
ExerciseThumbnailContentType = Literal["image/jpeg", "image/png", "image/webp"]
ExerciseVideoStreamStatus = Literal["NONE", "PROCESSING", "READY", "FAILED"]


class ExerciseCreate(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    direction: ExerciseDirection
    muscle_group: MuscleGroup
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
    muscle_groups: list[MuscleGroup]
    video_media_id: str | None = None
    thumbnail_media_id: str | None = None
    video_stream_status: ExerciseVideoStreamStatus = "NONE"


class ExerciseVideoConfirmResponse(BaseModel):
    media_id: str
    status: Literal["READY"]
    stream_status: ExerciseVideoStreamStatus


class ExercisePatch(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=160)
    instruction: str | None = Field(default=None, max_length=4_000)
    muscle_groups: list[MuscleGroup] | None = Field(default=None, min_length=1, max_length=7)
    video_media_id: str | None = Field(default=None, min_length=36, max_length=36)
    thumbnail_media_id: str | None = Field(default=None, min_length=36, max_length=36)

    @field_validator("muscle_groups")
    @classmethod
    def reject_duplicate_groups(cls, value: list[MuscleGroup] | None) -> list[MuscleGroup] | None:
        if value is not None and len(value) != len(set(value)):
            raise ValueError("Muscle groups must be unique")
        return value

    @model_validator(mode="after")
    def reject_null_changed_fields(self) -> Self:
        for field_name in ("title", "instruction", "muscle_groups"):
            if field_name in self.model_fields_set and getattr(self, field_name) is None:
                raise ValueError(f"{field_name} cannot be null")
        return self


class ExerciseVideoUploadRequest(BaseModel):
    content_type: ExerciseVideoContentType
    content_length: int = Field(gt=0, le=200 * 1024 * 1024)


class ExerciseThumbnailUploadRequest(BaseModel):
    content_type: ExerciseThumbnailContentType
    content_length: int = Field(gt=0, le=5 * 1024 * 1024)
