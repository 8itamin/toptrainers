from fastapi import FastAPI

from toptrainers_api.modules.clients.router import router


def test_clients_router_exposes_p0_foundation_endpoints_and_business_conflicts() -> None:
    app = FastAPI()
    app.include_router(router)
    schema = app.openapi()

    expected = {
        "/clients/invitations": "post",
        "/clients/invitations/{invitation_id}/accept": "post",
        "/clients/invitations/{invitation_id}/reject": "post",
        "/clients/invitations/{invitation_id}/cancel": "post",
        "/clients/relationships/{relationship_id}/terminate": "post",
    }
    for path, method in expected.items():
        operation = schema["paths"][path][method]
        assert "409" in operation["responses"]


def test_create_invitation_returns_201() -> None:
    app = FastAPI()
    app.include_router(router)
    operation = app.openapi()["paths"]["/clients/invitations"]["post"]
    assert "201" in operation["responses"]
