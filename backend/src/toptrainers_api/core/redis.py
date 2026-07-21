from __future__ import annotations

from functools import lru_cache

from redis.asyncio import Redis

from toptrainers_api.core.config import settings


@lru_cache(maxsize=1)
def get_redis() -> Redis[str]:
    return Redis.from_url(settings.redis_url, decode_responses=True)


async def redis_is_ready() -> bool:
    try:
        return bool(await get_redis().ping())
    except Exception:
        return False


async def close_redis() -> None:
    if get_redis.cache_info().currsize:
        await get_redis().aclose()
        get_redis.cache_clear()
