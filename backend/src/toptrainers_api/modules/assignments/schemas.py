from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


class CreateWorkoutAssignmentRequest(BaseModel):
    client_id: str = Field(min_length=36, max_length=36)
    workout_id: str = Field(min_length=36, max_length=36)
    scheduled_date: date
    request_id: str = Field(min_length=1, max_length=128)


class RescheduleWorkoutAssignmentRequest(BaseModel):
    scheduled_date: date


class WorkoutSnapshotExerciseV1(BaseModel):
    source_exercise_id: str
    position: int
    title: str
    direction: str
    muscle_group: str
    instruction: str
    reference_url: str | None = None
    video_platform: str | None = None
    video_url: str | None = None
    video_file_url: str | None = None
    thumbnail_url: str | None = None
    weight_kg: float | None = None
    sets: int
    reps: int


class WorkoutSnapshotBlockV1(BaseModel):
    kind: str
    position: int
    exercises: list[WorkoutSnapshotExerciseV1]


class WorkoutSnapshotV1(BaseModel):
    title: str
    description: str
    blocks: list[WorkoutSnapshotBlockV1]


class WorkoutAssignmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    relationship_id: str
    trainer_id: str
    client_id: str
    source_workout_id: str
    request_id: str
    scheduled_date: date
    status: str
    snapshot_schema_version: int
    workout_snapshot: WorkoutSnapshotV1
    created_at: datetime
    updated_at: datetime
