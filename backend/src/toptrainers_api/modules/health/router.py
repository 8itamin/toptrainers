from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from toptrainers_api.core.db import database_is_ready
from toptrainers_api.core.redis import redis_is_ready

router = APIRouter(prefix="/health", tags=["health"])


class LiveResponse(BaseModel):
    status: str = "ok"


class ReadyResponse(LiveResponse):
    database: str
    redis: str


@router.get("/live", response_model=LiveResponse, include_in_schema=False)
async def live() -> LiveResponse:
    """Process liveness; intentionally does not touch dependencies."""
    return LiveResponse()


@router.get("/ready", response_model=ReadyResponse, include_in_schema=False)
async def ready() -> ReadyResponse:
    database_ready = await database_is_ready()
    redis_ready = await redis_is_ready()
    if not database_ready or not redis_ready:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"database": database_ready, "redis": redis_ready},
        )
    return ReadyResponse(database="ok", redis="ok")
