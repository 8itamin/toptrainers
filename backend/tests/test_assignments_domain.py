from decimal import Decimal

from sqlalchemy.dialects import postgresql
from sqlalchemy.schema import CreateTable

from toptrainers_api.modules.assignments.models import WorkoutAssignment, WorkoutAssignmentStatus
from toptrainers_api.modules.assignments.schemas import CreateWorkoutAssignmentRequest
from toptrainers_api.modules.exercises.models import Exercise
from toptrainers_api.modules.workouts.models import Workout, WorkoutBlock, WorkoutExercise


def test_assignment_persistence_contract_compiles_for_postgresql() -> None:
    ddl = str(CreateTable(WorkoutAssignment.__table__).compile(dialect=postgresql.dialect()))
    assert "JSONB" in ddl
    assert "snapshot_schema_version = 1" in ddl
    assert "uq_workout_assignments_relationship_request_id" in ddl
    for status in WorkoutAssignmentStatus:
        assert status.value in ddl


def test_create_contract_uses_frontend_authoritative_fields_only() -> None:
    schema = CreateWorkoutAssignmentRequest.model_json_schema()
    assert set(schema["properties"]) == {
        "client_id",
        "workout_id",
        "scheduled_date",
        "request_id",
    }
    assert schema["properties"]["scheduled_date"]["format"] == "date"


def test_snapshot_v1_copies_user_visible_exercise_metadata() -> None:
    from toptrainers_api.modules.assignments.service import build_workout_snapshot_v1

    exercise = Exercise(
        id="e" * 36,
        trainer_id="t" * 36,
        title="Squat",
        direction="strength",
        muscle_group="legs",
        instruction="Neutral back",
        reference_url="https://example.test/ref",
        video_platform="youtube",
        video_url="https://example.test/video",
        video_file_url=None,
        thumbnail_url="https://example.test/thumb",
    )
    item = WorkoutExercise(
        id="i" * 36,
        exercise_id=exercise.id,
        position=0,
        weight_kg=Decimal("50.50"),
        sets=4,
        reps=10,
    )
    block = WorkoutBlock(id="b" * 36, kind="main", position=0)
    block.items = [item]
    workout = Workout(
        id="w" * 36,
        trainer_id="t" * 36,
        title="Leg day",
        description="Heavy session",
    )
    workout.blocks = [block]

    snapshot = build_workout_snapshot_v1(workout, {exercise.id: exercise})
    frozen = snapshot.model_dump(mode="json")
    assert frozen["blocks"][0]["exercises"][0]["title"] == "Squat"
    assert frozen["blocks"][0]["exercises"][0]["weight_kg"] == 50.5

    workout.title = "Changed"
    exercise.title = "Changed"
    item.reps = 99
    assert snapshot.title == "Leg day"
    assert snapshot.blocks[0].exercises[0].title == "Squat"
    assert snapshot.blocks[0].exercises[0].reps == 10
