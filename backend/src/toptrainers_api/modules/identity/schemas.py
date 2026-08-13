from enum import StrEnum

from pydantic import BaseModel, EmailStr, Field, field_validator

from toptrainers_api.core.auth import password_is_strong


class UserRole(StrEnum):
    ADMIN = "admin"
    TRAINER = "trainer"
    CLIENT = "client"


class PublicUserRole(StrEnum):
    TRAINER = "trainer"
    CLIENT = "client"


class RegisterAccountRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=12, max_length=256)
    role: PublicUserRole

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        if not password_is_strong(value):
            raise ValueError("Password must contain lowercase, uppercase, and digit characters")
        return value
