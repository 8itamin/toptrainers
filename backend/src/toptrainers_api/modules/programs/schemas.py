from datetime import date, datetime
from typing import Literal, Self

from pydantic import BaseModel, Field, model_validator


class ProgramScheduleItemWrite(BaseModel):
    week_number: int = Field(ge=1, le=52)
    day_number: int = Field(ge=1, le=7)
    position: int = Field(default=0, ge=0, le=99)
    kind: Literal["WORKOUT", "TASK"] = "WORKOUT"
    workout_id: str | None = Field(default=None, min_length=36, max_length=36)
    task_template_id: str | None = Field(default=None, min_length=36, max_length=36)

    @model_validator(mode="after")
    def require_target_matching_kind(self) -> Self:
        if self.kind == "WORKOUT" and self.workout_id and self.task_template_id is None:
            return self
        if self.kind == "TASK" and self.task_template_id and self.workout_id is None:
            return self
        raise ValueError("A schedule item requires exactly one target matching its kind")


ProgramSlotWrite = ProgramScheduleItemWrite


class ProgramCreate(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    description: str = Field(default="", max_length=2_000)
    duration_weeks: int = Field(default=1, ge=1, le=52)
    slots: list[ProgramScheduleItemWrite] = Field(default_factory=list, max_length=364)

    @model_validator(mode="after")
    def validate_schedule(self) -> "ProgramCreate":
        coordinates = {(slot.week_number, slot.day_number, slot.position) for slot in self.slots}
        if len(coordinates) != len(self.slots):
            raise ValueError(
                "Program schedule cannot contain duplicate week/day/position coordinates"
            )
        if any(slot.week_number > self.duration_weeks for slot in self.slots):
            raise ValueError("Program slot week_number must not exceed duration_weeks")
        return self


class ProgramSlotResponse(ProgramScheduleItemWrite):
    id: str


class ProgramResponse(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    description: str = Field(default="", max_length=2_000)
    duration_weeks: int = Field(default=1, ge=1, le=52)
    slots: list[ProgramSlotResponse]
    id: str
    trainer_id: str


class IssueProgramRequest(BaseModel):
    client_id: str = Field(min_length=36, max_length=36)
    start_date: date
    request_id: str = Field(min_length=1, max_length=128)


class ProgramAssignmentResponse(BaseModel):
    id: str
    program_id: str
    relationship_id: str
    request_id: str
    start_date: date
    status: str
    snapshot_schema_version: int
    program_snapshot: dict[str, object]
    created_at: datetime
    updated_at: datetime
