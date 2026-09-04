from __future__ import annotations

from toptrainers_api.app.factory import create_app


def _path_parameter(operation: dict[str, object], name: str) -> dict[str, object]:
    parameters = operation["parameters"]
    assert isinstance(parameters, list)
    return next(
        parameter
        for parameter in parameters
        if isinstance(parameter, dict) and parameter.get("name") == name
    )


def test_workout_results_openapi_paths_and_operation_ids_are_authoritative() -> None:
    schema = create_app().openapi()
    paths = schema["paths"]
    collection_path = "/api/v1/assignments/{assignment_id}/execution/results"
    resource_path = (
        "/api/v1/assignments/{assignment_id}/execution/results/"
        "{block_position}/{exercise_position}/{set_index}"
    )

    collection = paths[collection_path]
    resource = paths[resource_path]
    assert collection["get"]["operationId"] == "listWorkoutExecutionResults"
    assert resource["put"]["operationId"] == "putWorkoutExecutionSetResult"
    assert resource["delete"]["operationId"] == "deleteWorkoutExecutionSetResult"

    get_schema = collection["get"]["responses"]["200"]["content"]["application/json"]["schema"]
    assert get_schema["type"] == "array"
    assert get_schema["items"]["$ref"] == "#/components/schemas/WorkoutExecutionSetResultResponse"

    put_schema = resource["put"]["requestBody"]["content"]["application/json"]["schema"]
    assert put_schema["$ref"] == "#/components/schemas/WorkoutExecutionSetResultUpsertRequest"
    put_response = resource["put"]["responses"]["200"]["content"]["application/json"]["schema"]
    assert put_response["$ref"] == "#/components/schemas/WorkoutExecutionSetResultResponse"
    assert "204" in resource["delete"]["responses"]

    for operation in (resource["put"], resource["delete"]):
        for name in ("block_position", "exercise_position", "set_index"):
            parameter = _path_parameter(operation, name)
            assert parameter["schema"]["minimum"] == 0


def test_result_response_and_history_contract_do_not_embed_parallel_identity_or_results() -> None:
    schema = create_app().openapi()
    result_schema = schema["components"]["schemas"]["WorkoutExecutionSetResultResponse"]
    assert set(result_schema["properties"]) == {
        "execution_id",
        "block_position",
        "exercise_position",
        "set_index",
        "actual_reps",
        "actual_weight_kg",
    }
    assert "source_exercise_id" not in result_schema["properties"]

    history_schema = schema["components"]["schemas"]["WorkoutHistoryItem"]
    assert "results" not in history_schema["properties"]
    assert "workout_snapshot" not in history_schema["properties"]
