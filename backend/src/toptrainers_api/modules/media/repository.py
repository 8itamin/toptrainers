from typing import cast

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from toptrainers_api.modules.media.models import MediaObject


async def get_for_owner(
    session: AsyncSession,
    owner_id: str,
    media_id: str,
) -> MediaObject | None:
    return cast(
        MediaObject | None,
        await session.scalar(
            select(MediaObject).where(MediaObject.id == media_id, MediaObject.owner_id == owner_id)
        ),
    )


async def get_ready_for_owner(
    session: AsyncSession,
    owner_id: str,
    media_id: str,
) -> MediaObject | None:
    return cast(
        MediaObject | None,
        await session.scalar(
            select(MediaObject).where(
                MediaObject.id == media_id,
                MediaObject.owner_id == owner_id,
                MediaObject.status == "READY",
            )
        ),
    )


async def get_ready(session: AsyncSession, media_id: str) -> MediaObject | None:
    return cast(
        MediaObject | None,
        await session.scalar(
            select(MediaObject).where(MediaObject.id == media_id, MediaObject.status == "READY")
        ),
    )
