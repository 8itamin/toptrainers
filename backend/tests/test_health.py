from fastapi.testclient import TestClient

from toptrainers_api.app.factory import create_app


def test_liveness_does_not_require_external_services() -> None:
    with TestClient(create_app()) as client:
        response = client.get("/api/v1/health/live", headers={"host": "testserver"})

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
