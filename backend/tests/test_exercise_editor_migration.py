from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_existing_exercises_backfill_to_their_single_legacy_group() -> None:
    source = (
        ROOT / "migrations/versions/20260923_0013_exercise_editor_private_video.py"
    ).read_text()

    assert 'revision = "20260923_0013"' in source
    assert 'down_revision = "20260922_0012"' in source
    assert '"muscle_groups"' in source
    assert "UPDATE exercises SET muscle_groups = jsonb_build_array(muscle_group)" in source
    assert '"video_media_id"' in source
    assert '"purpose"' in source
