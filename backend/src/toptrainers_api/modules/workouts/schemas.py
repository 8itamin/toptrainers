from typing import Literal

from pydantic import BaseModel, Field

WorkoutBlockKind = Literal["warmup", "main", "cooldown"]


class WorkoutExerciseCreate(BaseModel):
    exercise_id: str = Field(min_length=36, max_length=36)
    weight_kg: float | None = Field(default=None, ge=0, le=1_000)
    sets: int = Field(ge=1, le=100)
    reps: int = Field(ge=1, le=1_000)


class WorkoutBlockCreate(BaseModel):
    kind: WorkoutBlockKind
    exercises: list[WorkoutExerciseCreate] = Field(min_length=1, max_length=100)


class WorkoutBase(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    description: str = Field(default="", max_length=2_000)


class WorkoutCreate(WorkoutBase):
    blocks: list[WorkoutBlockCreate] = Field(min_length=1, max_length=12)


class WorkoutExerciseResponse(WorkoutExerciseCreate):
    id: str


class WorkoutBlockResponse(BaseModel):
    id: str
    kind: WorkoutBlockKind
    exercises: list[WorkoutExerciseResponse]


class WorkoutResponse(WorkoutBase):
    id: str
    trainer_id: str
    blocks: list[WorkoutBlockResponse]
