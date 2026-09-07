from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_training_programs_migration_is_additive_after_results() -> None:
    """A revision that misses any parent/child table would make issued Programs unrecoverable."""
    source = (
        ROOT / "migrations/versions/20260906_0010_training_programs_v1.py"
    ).read_text()

    assert 'revision = "20260906_0010"' in source
    assert 'down_revision = "20260904_0009"' in source
    assert '"program_slots"' in source
    assert '"program_assignments"' in source
    assert '"program_assignment_id"' in source
    assert '"program_slot_id"' in source
