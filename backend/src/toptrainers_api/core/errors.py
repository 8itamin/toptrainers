from __future__ import annotations

from dataclasses import dataclass

from fastapi import HTTPException
from pydantic import BaseModel


@dataclass(slots=True)
class BusinessRuleError(Exception):
    status_code: int
    code: str
    message: str


class BusinessErrorDetail(BaseModel):
    code: str
    message: str


class BusinessErrorResponse(BaseModel):
    detail: BusinessErrorDetail


def as_http_exception(error: BusinessRuleError) -> HTTPException:
    return HTTPException(
        status_code=error.status_code,
        detail={"code": error.code, "message": error.message},
    )
