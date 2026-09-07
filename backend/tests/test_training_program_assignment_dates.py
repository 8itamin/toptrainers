from datetime import date

from toptrainers_api.modules.programs.models import ProgramSlot
from toptrainers_api.modules.programs.service import scheduled_date_for_slot


def test_program_slot_maps_date_across_week_boundary() -> None:
    """Week/day mapping must not collapse every slot onto the Program start date."""
    slot = ProgramSlot(id="s" * 36, week_number=2, day_number=3, workout_id="w" * 36)

    assert scheduled_date_for_slot(date(2026, 9, 7), slot) == date(2026, 9, 16)
