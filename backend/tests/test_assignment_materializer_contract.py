import inspect

from toptrainers_api.modules.assignments.service import materialize_assignment


def test_program_materializer_has_explicit_nullable_provenance() -> None:
    """A parent issuance must be able to construct children without owning a commit."""
    parameters = inspect.signature(materialize_assignment).parameters

    assert "program_assignment_id" in parameters
    assert parameters["program_assignment_id"].default is None
    assert "program_slot_id" in parameters
    assert parameters["program_slot_id"].default is None
