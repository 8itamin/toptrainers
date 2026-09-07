from sqlalchemy.dialects import postgresql
from sqlalchemy.schema import CreateTable

from toptrainers_api.modules.assignments.models import WorkoutAssignment
from toptrainers_api.modules.programs.models import Program, ProgramAssignment, ProgramSlot


def test_program_schedule_persistence_contract() -> None:
    """A broken coordinate or parent idempotency constraint must reject invalid persisted state."""
    slots_ddl = str(CreateTable(ProgramSlot.__table__).compile(dialect=postgresql.dialect()))
    assignments_ddl = str(
        CreateTable(ProgramAssignment.__table__).compile(dialect=postgresql.dialect())
    )

    assert "uq_program_slots_program_week_day" in slots_ddl
    assert "week_number >= 1" in slots_ddl
    assert "day_number >= 1" in slots_ddl
    assert "day_number <= 7" in slots_ddl
    assert "uq_program_assignments_relationship_request_id" in assignments_ddl
    assert "program_snapshot" in assignments_ddl
    assert Program.duration_weeks.property.columns[0].name == "weeks"


def test_direct_assignment_provenance_columns_are_nullable() -> None:
    """Direct assignments need to remain valid without a Program parent or slot."""
    assert WorkoutAssignment.__table__.c.program_assignment_id.nullable is True
    assert WorkoutAssignment.__table__.c.program_slot_id.nullable is True
