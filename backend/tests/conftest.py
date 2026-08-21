from __future__ import annotations

import os
from collections.abc import AsyncIterator

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from toptrainers_api.core.db import Base
from toptrainers_api.modules.clients import models as _client_models  # noqa: F401
from toptrainers_api.modules.identity import models as _identity_models  # noqa: F401


@pytest_asyncio.fixture
async def p0_session_factory() -> AsyncIterator[async_sessionmaker[AsyncSession]]:
    pytest.importorskip("asyncpg")
    database_url = os.getenv("TT_TEST_DATABASE_URL")
    if not database_url:
        pytest.skip("TT_TEST_DATABASE_URL is required for PostgreSQL P0 integration tests")
    if "/toptrainers_test" not in database_url:
        pytest.fail("TT_TEST_DATABASE_URL must point to a dedicated toptrainers_test database")

    engine = create_async_engine(database_url, pool_pre_ping=True)
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.drop_all)
        await connection.run_sync(Base.metadata.create_all)

    factory = async_sessionmaker(engine, expire_on_commit=False)
    try:
        yield factory
    finally:
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.drop_all)
        await engine.dispose()
