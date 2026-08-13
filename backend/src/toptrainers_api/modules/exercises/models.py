from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column

from toptrainers_api.core.db import Base


class Exercise(Base):
    __tablename__ = "exercises"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    trainer_id: Mapped[str] = mapped_column(String(36), index=True)
    title: Mapped[str] = mapped_column(String(160))
    direction: Mapped[str] = mapped_column(String(32), index=True)
    muscle_group: Mapped[str] = mapped_column(String(64), index=True)
    instruction: Mapped[str] = mapped_column(Text, default="")
    reference_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    video_platform: Mapped[str | None] = mapped_column(String(32), nullable=True)
    video_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    video_file_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    thumbnail_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
