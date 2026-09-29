from toptrainers_api.app.factory import create_app
from toptrainers_api.modules.workouts.schemas import WorkoutCreate


def test_workout_editor_accepts_named_blocks_and_rest_seconds() -> None:
    payload = WorkoutCreate.model_validate(
        {
            "title": "Ноги",
            "description": "Силовая тренировка",
            "blocks": [
                {
                    "kind": "main",
                    "title": "Тяжёлый блок",
                    "exercises": [
                        {
                            "exercise_id": "11111111-1111-1111-1111-111111111111",
                            "sets": 4,
                            "reps": 8,
                            "weight_kg": 75.5,
                            "rest_seconds": 90,
                        }
                    ],
                }
            ],
        }
    )

    assert payload.blocks[0].title == "Тяжёлый блок"
    assert payload.blocks[0].exercises[0].rest_seconds == 90


def test_workout_editor_exposes_owned_replace_operation() -> None:
    operation = create_app().openapi()["paths"]["/api/v1/workouts/{workout_id}"]["put"]

    assert operation["requestBody"]["content"]["application/json"]["schema"]["$ref"] == (
        "#/components/schemas/WorkoutCreate"
    )
    assert operation["responses"]["200"]["content"]["application/json"]["schema"]["$ref"] == (
        "#/components/schemas/WorkoutResponse"
    )
