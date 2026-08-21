from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

import pytest
from sqlalchemy import inspect, text
from sqlalchemy.ext.asyncio import create_async_engine

pytestmark = pytest.mark.asyncio

BACKEND_DIR = Path(__file__).resolve().parents[1]


def run_alembic(database_url: str, *args: str) -> None:
    env = os.environ.copy()
    env["TT_DATABASE_URL"] = database_url
    subprocess.run(
        [sys.executable, "-m", "alembic", "-c", "alembic.ini", *args],
        cwd=BACKEND_DIR,
        env=env,
        check=True,
        capture_output=True,
        text=True,
    )


async def schema_state(database_url: str) -> tuple[set[str], str | None]:
    engine = create_async_engine(database_url)
    try:
        async with engine.connect() as connection:
            tables = await connection.run_sync(
                lambda sync_connection: set(inspect(sync_connection).get_table_names())
            )
            version = None
            if "alembic_version" in tables:
                version = await connection.scalar(text("SELECT version_num FROM alembic_version"))
            return tables, version
    finally:
        await engine.dispose()


async def clean_database(database_url: str) -> None:
    engine = create_async_engine(database_url)
    try:
        async with engine.begin() as connection:
            await connection.execute(text("DROP SCHEMA public CASCADE"))
            await connection.execute(text("CREATE SCHEMA public"))
    finally:
        await engine.dispose()


async def test_alembic_0005_0006_0005_0006_roundtrip() -> None:
    pytest.importorskip("asyncpg")
    database_url = os.getenv("TT_TEST_DATABASE_URL")
    if not database_url:
        pytest.skip("TT_TEST_DATABASE_URL is required for PostgreSQL migration tests")
    if "/toptrainers_test" not in database_url:
        pytest.fail("TT_TEST_DATABASE_URL must point to a dedicated toptrainers_test database")

    await clean_database(database_url)
    try:
        run_alembic(database_url, "upgrade", "20260822_0005")
        tables, version = await schema_state(database_url)
        assert "workout_assignments" not in tables
        assert version == "20260822_0005"

        run_alembic(database_url, "upgrade", "20260822_0006")
        tables, version = await schema_state(database_url)
        assert "workout_assignments" in tables
        assert version == "20260822_0006"

        run_alembic(database_url, "downgrade", "20260822_0005")
        tables, version = await schema_state(database_url)
        assert "workout_assignments" not in tables
        assert version == "20260822_0005"

        run_alembic(database_url, "upgrade", "20260822_0006")
        tables, version = await schema_state(database_url)
        assert "workout_assignments" in tables
        assert version == "20260822_0006"
    finally:
        await clean_database(database_url)
