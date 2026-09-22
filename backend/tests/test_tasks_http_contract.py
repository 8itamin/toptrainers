from __future__ import annotations

from toptrainers_api.app.factory import create_app


def test_task_template_routes_have_typed_openapi_contract() -> None:
    schema = create_app().openapi()
    paths = schema["paths"]

    templates = paths["/api/v1/tasks/templates"]
    assert templates["get"]["operationId"] == "listTaskTemplates"
    assert templates["post"]["operationId"] == "createTaskTemplate"
    assert "201" in templates["post"]["responses"]

    request_schema = templates["post"]["requestBody"]["content"]["application/json"]["schema"]
    assert request_schema["$ref"] == "#/components/schemas/TaskTemplateWrite"

    response_schema = templates["post"]["responses"]["201"]["content"]["application/json"]["schema"]
    assert response_schema["$ref"] == "#/components/schemas/TaskTemplateResponse"


def test_task_template_write_exposes_only_typed_result_fields() -> None:
    schema = create_app().openapi()
    template = schema["components"]["schemas"]["TaskTemplateWrite"]
    fields = template["properties"]["result_fields"]

    assert set(template["properties"]) == {"title", "instruction", "result_fields"}
    assert "anyOf" in fields["items"]


def test_task_result_routes_are_versioned_and_typed() -> None:
    schema = create_app().openapi()
    route = schema["paths"]["/api/v1/tasks/assignments/{assignment_id}/results"]

    assert route["post"]["operationId"] == "submitTaskResult"
    assert route["get"]["operationId"] == "listTaskResultVersions"
    request = route["post"]["requestBody"]["content"]["application/json"]["schema"]
    assert request["$ref"] == "#/components/schemas/SubmitTaskResultRequest"
    assert (
        "/api/v1/tasks/assignments/{assignment_id}/results/media/{media_id}/read-url"
        in schema["paths"]
    )
