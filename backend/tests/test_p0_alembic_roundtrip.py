from __future__ import annotations

import asyncio
import os
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import inspect, text
from sqlalchemy.ext.asyncio import create_async_engine

from toptrainers_api.core.config import settings

BACKEND_ROOT = Path(__file__).resolve().parents[1]
RELATIONSHIP_TABLES = {
    "trainer_client_invitations",
    "trainer_client_relationships",
}
ASSIGNMENT_TABLE = "workout_assignments"
V2_INVITATION_COLUMNS = {
    "resolved_at",
    "resolved_by_account_id",
    "resolution_reason",
}


def _test_database_url() -> str:
    database_url = os.getenv("TT_TEST_DATABASE_URL")
    if not database_url:
        pytest.skip("TT_TEST_DATABASE_URL is required for Alembic roundtrip test")
    if "/toptrainers_test" not in database_url:
        pytest.fail("TT_TEST_DATABASE_URL must point to a dedicated toptrainers_test database")
    return database_url


def _alembic_config() -> Config:
    config = Config(str(BACKEND_ROOT / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND_ROOT / "migrations"))
    config.set_main_option("prepend_sys_path", str(BACKEND_ROOT / "src"))
    return config


async def _reset_public_schema(database_url: str) -> None:
    engine = create_async_engine(database_url)
    try:
        async with engine.begin() as connection:
            await connection.execute(text("DROP SCHEMA IF EXISTS public CASCADE"))
            await connection.execute(text("CREATE SCHEMA public"))
    finally:
        await engine.dispose()


async def _database_state(database_url: str) -> tuple[set[str], str, set[str]]:
    engine = create_async_engine(database_url)
    try:
        async with engine.connect() as connection:
            tables = await connection.run_sync(
                lambda sync_connection: set(inspect(sync_connection).get_table_names())
            )
            invitation_columns: set[str] = set()
            if "trainer_client_invitations" in tables:
                invitation_columns = await connection.run_sync(
                    lambda sync_connection: {
                        column["name"]
                        for column in inspect(sync_connection).get_columns(
                            "trainer_client_invitations"
                        )
                    }
                )
            revision = await connection.scalar(text("SELECT version_num FROM alembic_version"))
    finally:
        await engine.dispose()
    assert isinstance(revision, str)
    return tables, revision, invitation_columns


def test_p0_alembic_upgrade_downgrade_upgrade_roundtrip(monkeypatch: pytest.MonkeyPatch) -> None:
    database_url = _test_database_url()
    config = _alembic_config()
    monkeypatch.setattr(settings, "database_url", database_url)

    asyncio.run(_reset_public_schema(database_url))
    try:
        command.upgrade(config, "20260822_0005")
        tables, revision, invitation_columns = asyncio.run(_database_state(database_url))
        assert tables >= RELATIONSHIP_TABLES
        assert ASSIGNMENT_TABLE not in tables
        assert invitation_columns >= V2_INVITATION_COLUMNS
        assert revision == "20260822_0005"

        command.upgrade(config, "20260822_0006")
        tables, revision, invitation_columns = asyncio.run(_database_state(database_url))
        assert tables >= RELATIONSHIP_TABLES | {ASSIGNMENT_TABLE}
        assert invitation_columns >= V2_INVITATION_COLUMNS
        assert revision == "20260822_0006"

        command.downgrade(config, "20260822_0005")
        tables, revision, invitation_columns = asyncio.run(_database_state(database_url))
        assert tables >= RELATIONSHIP_TABLES
        assert ASSIGNMENT_TABLE not in tables
        assert invitation_columns >= V2_INVITATION_COLUMNS
        assert revision == "20260822_0005"

        command.upgrade(config, "head")
        tables, revision, invitation_columns = asyncio.run(_database_state(database_url))
        assert tables >= RELATIONSHIP_TABLES | {ASSIGNMENT_TABLE}
        assert invitation_columns >= V2_INVITATION_COLUMNS
        assert revision == "20260822_0006"

        command.downgrade(config, "20260813_0004")
        tables, revision, invitation_columns = asyncio.run(_database_state(database_url))
        assert RELATIONSHIP_TABLES.isdisjoint(tables)
        assert ASSIGNMENT_TABLE not in tables
        assert invitation_columns == set()
        assert "accounts" in tables
        assert revision == "20260813_0004"

        command.upgrade(config, "head")
        tables, revision, invitation_columns = asyncio.run(_database_state(database_url))
        assert tables >= RELATIONSHIP_TABLES | {ASSIGNMENT_TABLE}
        assert invitation_columns >= V2_INVITATION_COLUMNS
        assert revision == "20260822_0006"
    finally:
        asyncio.run(_reset_public_schema(database_url))
