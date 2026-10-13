from dataclasses import dataclass
from typing import cast

from sqlalchemy import case, exists, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from toptrainers_api.modules.clients.models import (
    ClientJoinInvitation,
    TrainerClientCard,
    TrainerClientRelationship,
)


async def get_card(
    session: AsyncSession, card_id: str, lock: bool = False
) -> TrainerClientCard | None:
    query = select(TrainerClientCard).where(TrainerClientCard.id == card_id)
    if lock:
        query = query.with_for_update().execution_options(populate_existing=True)
    return cast(TrainerClientCard | None, await session.scalar(query))


async def get_join(
    session: AsyncSession, token_hash: str, lock: bool = False
) -> ClientJoinInvitation | None:
    query = select(ClientJoinInvitation).where(ClientJoinInvitation.token_hash == token_hash)
    if lock:
        query = query.with_for_update().execution_options(populate_existing=True)
    return cast(ClientJoinInvitation | None, await session.scalar(query))


async def relationships(
    session: AsyncSession, trainer_id: str, client_id: str
) -> list[TrainerClientRelationship]:
    return list(
        await session.scalars(
            select(TrainerClientRelationship)
            .where(
                TrainerClientRelationship.trainer_id == trainer_id,
                TrainerClientRelationship.client_id == client_id,
            )
            .order_by(
                TrainerClientRelationship.created_at.desc(), TrainerClientRelationship.id.desc()
            )
        )
    )


@dataclass(frozen=True)
class CardProjection:
    card: TrainerClientCard
    relationship_id: str | None
    group: str


async def find_card_for_account(
    session: AsyncSession, trainer_id: str, account_id: str, email: str
) -> TrainerClientCard | None:
    query = select(TrainerClientCard).where(
        TrainerClientCard.trainer_id == trainer_id,
        or_(
            TrainerClientCard.client_account_id == account_id,
            TrainerClientCard.contact_email == email,
        ),
    )
    return cast(
        TrainerClientCard | None,
        await session.scalar(query.with_for_update().execution_options(populate_existing=True)),
    )


async def list_card_projections(
    session: AsyncSession, trainer_id: str, group: str, query: str, cursor: str | None, limit: int
) -> tuple[list[CardProjection], dict[str, int]]:
    card, relation = TrainerClientCard, TrainerClientRelationship
    pair = (relation.trainer_id == card.trainer_id, relation.client_id == card.client_account_id)
    active_id = select(relation.id).where(*pair, relation.status == "ACTIVE").scalar_subquery()
    state = case(
        (active_id.is_not(None), "active"),
        (exists(select(relation.id).where(*pair)), "past"),
        else_="pending",
    ).label("group")
    base = select(card, active_id.label("relationship_id"), state).where(
        card.trainer_id == trainer_id
    )
    count_base = select(state).where(card.trainer_id == trainer_id).subquery()
    count_rows = await session.execute(
        select(count_base.c.group, func.count()).group_by(count_base.c.group)
    )
    counts = {str(row[0]): int(row[1]) for row in count_rows.all()}
    if group != "all":
        base = base.where(state == group)
    needle = query.strip().lower()
    if needle:
        base = base.where(
            or_(
                func.lower(card.display_name).contains(needle, autoescape=True),
                func.lower(card.contact_email).contains(needle, autoescape=True),
            )
        )
    if cursor:
        base = base.where(card.id > cursor)
    rows = (await session.execute(base.order_by(card.id).limit(limit + 1))).all()
    return [CardProjection(row[0], row[1], str(row[2])) for row in rows], counts
