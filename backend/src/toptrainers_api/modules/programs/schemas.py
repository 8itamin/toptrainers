from pydantic import BaseModel, Field


class ProgramCreate(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    description: str = Field(default="", max_length=2_000)
    weeks: int = Field(default=1, ge=1, le=52)


class ProgramResponse(ProgramCreate):
    id: str
    trainer_id: str
