from sqlalchemy import Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from toptrainers_api.core.db import Base


class Program(Base):
    __tablename__ = "programs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    trainer_id: Mapped[str] = mapped_column(String(36), index=True)
    title: Mapped[str] = mapped_column(String(160))
    description: Mapped[str] = mapped_column(Text, default="")
    weeks: Mapped[int] = mapped_column(Integer, default=1)
