import inspect

from toptrainers_api.modules.programs.service import cancel_program_assignment


def test_program_parent_cancellation_is_a_separate_service_operation() -> None:
    """Parent cancellation must not be implemented by looping through public child endpoints."""
    parameters = inspect.signature(cancel_program_assignment).parameters

    assert list(parameters) == ["session", "account", "program_assignment_id"]
