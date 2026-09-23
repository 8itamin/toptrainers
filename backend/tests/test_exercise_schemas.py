import pytest
from pydantic import ValidationError

from toptrainers_api.modules.exercises.schemas import ExerciseCreate, ExercisePatch
from toptrainers_api.modules.workouts.schemas import WorkoutCreate


def test_exercise_accepts_valid_https_video_and_thumbnail_urls() -> None:
    exercise = ExerciseCreate(
        title="Жим лёжа",
        direction="strength",
        muscle_group="Грудь",
        video_platform="youtube",
        video_url="https://youtube.com/watch?v=example",
        thumbnail_url="https://cdn.example.com/bench.jpg",
    )

    assert exercise.video_platform == "youtube"
    assert exercise.thumbnail_url == "https://cdn.example.com/bench.jpg"


@pytest.mark.parametrize("field", ["reference_url", "video_url", "video_file_url", "thumbnail_url"])
def test_exercise_rejects_non_http_urls(field: str) -> None:
    payload = {
        "title": "Жим лёжа",
        "direction": "strength",
        "muscle_group": "Грудь",
        field: "javascript:alert(1)",
    }
    if field == "video_url":
        payload["video_platform"] = "youtube"

    with pytest.raises(ValidationError):
        ExerciseCreate.model_validate(payload)


def test_exercise_requires_platform_together_with_video_url() -> None:
    with pytest.raises(ValidationError):
        ExerciseCreate(
            title="Жим лёжа",
            direction="strength",
            muscle_group="Грудь",
            video_url="https://youtube.com/watch?v=example",
        )


def test_patch_preserves_ordered_primary_group() -> None:
    patch = ExercisePatch(muscle_groups=["Спина", "Руки"])

    assert patch.muscle_groups == ["Спина", "Руки"]


def test_patch_rejects_duplicate_or_unknown_groups() -> None:
    with pytest.raises(ValidationError):
        ExercisePatch(muscle_groups=["Спина", "Спина"])
    with pytest.raises(ValidationError):
        ExercisePatch(muscle_groups=["Шея"])


def test_workout_requires_at_least_one_selected_exercise() -> None:
    with pytest.raises(ValidationError):
        WorkoutCreate(title="Грудь", blocks=[])
