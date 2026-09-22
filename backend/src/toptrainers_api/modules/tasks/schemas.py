from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator


class MeasurementResultField(BaseModel):
    kind: Literal["measurement"] = "measurement"
    unit: str = Field(min_length=1, max_length=16)
    required: bool = False


class CompletionResultField(BaseModel):
    kind: Literal["completion"] = "completion"
    required: bool = False


class PhotoResultField(BaseModel):
    kind: Literal["photo"] = "photo"
    required: bool = False


class NoteResultField(BaseModel):
    kind: Literal["note"] = "note"
    required: bool = False


TaskResultField = (
    MeasurementResultField | CompletionResultField | PhotoResultField | NoteResultField
)


class TaskTemplateWrite(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    instruction: str = Field(default="", max_length=2_000)
    result_fields: list[TaskResultField] = Field(max_length=4)

    @model_validator(mode="after")
    def require_result_field(self) -> TaskTemplateWrite:
        if not self.result_fields:
            raise ValueError("A task template requires at least one result field")
        kinds = [field.kind for field in self.result_fields]
        if len(kinds) != len(set(kinds)):
            raise ValueError("A task template cannot repeat a result field kind")
        return self


class TaskTemplateResponse(BaseModel):
    id: str
    trainer_id: str
    title: str
    instruction: str
    result_schema: dict[str, object]


class SubmitTaskResultRequest(BaseModel):
    request_id: str = Field(min_length=1, max_length=128)
    measurement_value: float | None = Field(default=None, ge=0, le=100_000)
    completed: bool | None = None
    note: str | None = Field(default=None, max_length=2_000)
    photo_media_ids: list[str] = Field(default_factory=list, max_length=8)

    @model_validator(mode="after")
    def require_a_result_value(self) -> SubmitTaskResultRequest:
        if (
            self.measurement_value is None
            and self.completed is None
            and self.note is None
            and not self.photo_media_ids
        ):
            raise ValueError("A task result requires at least one value")
        if len(self.photo_media_ids) != len(set(self.photo_media_ids)):
            raise ValueError("A photo can only be included once")
        return self


class TaskResultVersionResponse(BaseModel):
    assignment_id: str
    version: int
    request_id: str
    result_payload: dict[str, object]
    created_at: datetime


class TaskAssignmentResponse(BaseModel):
    id: str
    relationship_id: str
    source_task_template_id: str
    scheduled_date: date
    task_snapshot: dict[str, object]
    status: str
