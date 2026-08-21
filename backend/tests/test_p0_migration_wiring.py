from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_p0_migration_is_additive_and_follows_0004() -> None:
    migration = ROOT / "migrations/versions/20260822_0005_p0_trainer_client_foundation.py"
    source = migration.read_text()
    assert 'revision = "20260822_0005"' in source
    assert 'down_revision = "20260813_0004"' in source
    assert '"trainer_client_invitations"' in source
    assert '"trainer_client_relationships"' in source
    assert "uq_trainer_client_invitations_pending_pair" in source
    assert "uq_trainer_client_relationships_active_pair" in source
    assert "status = 'PENDING'" in source
    assert "status = 'ACTIVE'" in source


def test_alembic_env_imports_clients_models() -> None:
    source = (ROOT / "migrations/env.py").read_text()
    assert "from toptrainers_api.modules.clients import models as _client_models" in source


def test_app_router_mounts_clients_router() -> None:
    source = (ROOT / "src/toptrainers_api/app/router.py").read_text()
    expected_import = (
        "from toptrainers_api.modules.clients.router import router as clients_router"
    )
    assert expected_import in source
    assert "api_router.include_router(clients_router)" in source
