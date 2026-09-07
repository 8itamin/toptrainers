import pytest
from pydantic import ValidationError

from toptrainers_api.modules.programs.schemas import ProgramCreate, ProgramSlotWrite


def test_program_create_uses_duration_weeks_and_allows_empty_schedule() -> None:
    """Renaming the public duration field back to weeks would break API clients."""
    payload = ProgramCreate(title="Base", description="", duration_weeks=2, slots=[])

    assert payload.duration_weeks == 2
    assert payload.slots == []
    assert "weeks" not in ProgramCreate.model_json_schema()["properties"]


def test_program_create_rejects_duplicate_or_out_of_range_slot_coordinates() -> None:
    """A malformed full replacement must not reach persistence as an ambiguous schedule."""
    duplicate = ProgramSlotWrite(week_number=1, day_number=1, workout_id="w" * 36)

    with pytest.raises(ValidationError):
        ProgramCreate(title="Base", duration_weeks=2, slots=[duplicate, duplicate])
    with pytest.raises(ValidationError):
        ProgramCreate(
            title="Base",
            duration_weeks=1,
            slots=[ProgramSlotWrite(week_number=2, day_number=1, workout_id="w" * 36)],
        )
