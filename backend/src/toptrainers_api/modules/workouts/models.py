from decimal import Decimal

from sqlalchemy import ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from toptrainers_api.core.db import Base


class Workout(Base):
    __tablename__ = "workouts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    trainer_id: Mapped[str] = mapped_column(String(36), index=True)
    title: Mapped[str] = mapped_column(String(160))
    description: Mapped[str] = mapped_column(Text, default="")
    blocks: Mapped[list["WorkoutBlock"]] = relationship(
        back_populates="workout", cascade="all, delete-orphan", order_by="WorkoutBlock.position"
    )


class WorkoutBlock(Base):
    __tablename__ = "workout_blocks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    workout_id: Mapped[str] = mapped_column(
        ForeignKey("workouts.id", ondelete="CASCADE"),
        index=True,
    )
    kind: Mapped[str] = mapped_column(String(32))
    position: Mapped[int] = mapped_column(Integer)
    workout: Mapped[Workout] = relationship(back_populates="blocks")
    items: Mapped[list["WorkoutExercise"]] = relationship(
        back_populates="block", cascade="all, delete-orphan", order_by="WorkoutExercise.position"
    )


class WorkoutExercise(Base):
    __tablename__ = "workout_exercises"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    workout_block_id: Mapped[str] = mapped_column(
        ForeignKey("workout_blocks.id", ondelete="CASCADE"),
        index=True,
    )
    exercise_id: Mapped[str] = mapped_column(
        ForeignKey("exercises.id", ondelete="RESTRICT"),
        index=True,
    )
    position: Mapped[int] = mapped_column(Integer)
    weight_kg: Mapped[Decimal | None] = mapped_column(Numeric(6, 2), nullable=True)
    sets: Mapped[int] = mapped_column(Integer)
    reps: Mapped[int] = mapped_column(Integer)
    block: Mapped[WorkoutBlock] = relationship(back_populates="items")
