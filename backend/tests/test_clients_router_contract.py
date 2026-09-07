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
        "/clients/relationships/active": "get",
        "/clients/relationships/{relationship_id}/terminate": "post",
    }
    for path, method in expected.items():
        operation = schema["paths"][path][method]
        if method == "post":
            assert "409" in operation["responses"]


def test_active_relationships_contract_is_trainer_read_only() -> None:
    app = FastAPI()
    app.include_router(router)
    operation = app.openapi()["paths"]["/clients/relationships/active"]["get"]

    assert operation["responses"]["200"]["content"]["application/json"]["schema"] == {
        "items": {"$ref": "#/components/schemas/RelationshipResponse"},
        "type": "array",
        "title": "Response List Active Trainer Relationships Clients Relationships Active Get",
    }


def test_create_invitation_returns_201() -> None:
    app = FastAPI()
    app.include_router(router)
    operation = app.openapi()["paths"]["/clients/invitations"]["post"]
    assert "201" in operation["responses"]
