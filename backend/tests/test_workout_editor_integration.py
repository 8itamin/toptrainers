from __future__ import annotations

import pytest
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from toptrainers_api.modules.exercises.models import Exercise
from toptrainers_api.modules.identity.models import Account
from toptrainers_api.modules.workouts import service
from toptrainers_api.modules.workouts.schemas import WorkoutCreate

pytestmark = pytest.mark.asyncio

TRAINER_ID = "11111111-1111-1111-1111-111111111111"
OTHER_TRAINER_ID = "22222222-2222-2222-2222-222222222222"
EXERCISE_ID = "33333333-3333-3333-3333-333333333333"


def payload(title: str, rest_seconds: int) -> WorkoutCreate:
    return WorkoutCreate.model_validate(
        {
            "title": title,
            "description": "План",
            "blocks": [
                {
                    "kind": "main",
                    "title": "Первый блок",
                    "exercises": [
                        {"exercise_id": EXERCISE_ID, "sets": 3, "reps": 8,
                         "weight_kg": 50, "rest_seconds": rest_seconds}
                    ],
                }
            ],
        }
    )


async def test_trainer_can_replace_and_read_back_workout_editor_fields(
    p0_session_factory: async_sessionmaker[AsyncSession],
) -> None:
    async with p0_session_factory() as session:
        session.add_all(
            [
                Account(
                    id=TRAINER_ID, email="trainer@example.test",
                    password_hash="test", role="trainer",
                ),
                Account(
                    id=OTHER_TRAINER_ID, email="other@example.test",
                    password_hash="test", role="trainer",
                ),
                Exercise(
                    id=EXERCISE_ID, trainer_id=TRAINER_ID, title="Присед", direction="strength",
                    muscle_group="Ноги", muscle_groups=["Ноги"], instruction="Техника",
                ),
            ]
        )
        await session.commit()

        owner = {"role": "trainer", "sub": TRAINER_ID}
        created = await service.create_workout(session, owner, payload("Ноги", 60))
        updated = await service.replace_workout(
            session, owner, created.id, payload("Ноги и кор", 120)
        )
        assert updated is not None
        assert updated.title == "Ноги и кор"
        assert updated.blocks[0].title == "Первый блок"
        assert updated.blocks[0].items[0].rest_seconds == 120

        foreign = await service.replace_workout(
            session, {"role": "trainer", "sub": OTHER_TRAINER_ID},
            created.id, payload("Чужая", 30),
        )
        assert foreign is None
        reread = await service.get_owned_workout(session, TRAINER_ID, created.id)
        assert reread is not None and reread.title == "Ноги и кор"

        with pytest.raises(HTTPException) as error:
            await service.create_workout(
                session, {"role": "trainer", "sub": OTHER_TRAINER_ID},
                payload("Чужое упражнение", 30),
            )
        assert error.value.status_code == 422
