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
RESULTS_TABLE = "workout_execution_set_results"


def _test_database_url() -> str:
    database_url = os.getenv("TT_TEST_DATABASE_URL")
    if not database_url:
        pytest.skip("TT_TEST_DATABASE_URL is required for Results migration test")
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


async def _state(database_url: str) -> tuple[set[str], str, list[dict[str, object]]]:
    engine = create_async_engine(database_url)
    try:
        async with engine.connect() as connection:
            tables = await connection.run_sync(
                lambda sync_connection: set(inspect(sync_connection).get_table_names())
            )
            indexes: list[dict[str, object]] = []
            if RESULTS_TABLE in tables:
                indexes = await connection.run_sync(
                    lambda sync_connection: inspect(sync_connection).get_indexes(RESULTS_TABLE)
                )
            revision = await connection.scalar(text("SELECT version_num FROM alembic_version"))
    finally:
        await engine.dispose()
    assert isinstance(revision, str)
    return tables, revision, indexes


def test_results_0009_upgrade_downgrade_upgrade_roundtrip(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    database_url = _test_database_url()
    config = _alembic_config()
    monkeypatch.setattr(settings, "database_url", database_url)

    asyncio.run(_reset_public_schema(database_url))
    try:
        command.upgrade(config, "20260904_0008")
        tables, revision, _ = asyncio.run(_state(database_url))
        assert RESULTS_TABLE not in tables
        assert revision == "20260904_0008"

        command.upgrade(config, "20260904_0009")
        tables, revision, indexes = asyncio.run(_state(database_url))
        assert RESULTS_TABLE in tables
        assert revision == "20260904_0009"
        assert indexes == []

        command.downgrade(config, "20260904_0008")
        tables, revision, _ = asyncio.run(_state(database_url))
        assert RESULTS_TABLE not in tables
        assert revision == "20260904_0008"

        command.upgrade(config, "head")
        tables, revision, indexes = asyncio.run(_state(database_url))
        assert RESULTS_TABLE in tables
        assert revision == "20260904_0009"
        assert indexes == []
    finally:
        asyncio.run(_reset_public_schema(database_url))
