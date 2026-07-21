from enum import StrEnum

from pydantic import BaseModel, EmailStr, Field


class UserRole(StrEnum):
    ADMIN = "admin"
    TRAINER = "trainer"
    CLIENT = "client"


class RegisterAccountRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=12, max_length=256)
    role: UserRole
