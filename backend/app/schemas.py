from __future__ import annotations

import re
from typing import Optional

from pydantic import BaseModel, Field, field_validator

EMAIL_RE = re.compile(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$")


class RegisterIn(BaseModel):
    email: str
    password: str = Field(..., min_length=6)
    name: str = Field(..., min_length=1)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        if not EMAIL_RE.match(value):
            raise ValueError("Некорректный адрес электронной почты")
        return value.lower()


class LoginIn(BaseModel):
    email: str
    password: str

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        if not EMAIL_RE.match(value):
            raise ValueError("Некорректный адрес электронной почты")
        return value.lower()


class UserOut(BaseModel):
    id: str
    email: str
    name: Optional[str] = None


class AuthOut(BaseModel):
    access_token: str
    user: UserOut


class SuitcaseTripCreate(BaseModel):
    country: str
    city: str
    start_date: str
    end_date: str
    image: Optional[str] = None
    mood: Optional[str] = None
    route_json: Optional[str] = None
    impressions: Optional[str] = None
    photos: Optional[list] = None
    is_archived: bool = False


class SuitcaseTripPatch(BaseModel):
    country: Optional[str] = None
    city: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    image: Optional[str] = None
    mood: Optional[str] = None
    route_json: Optional[str] = None
    impressions: Optional[str] = None
    photos: Optional[list] = None
    is_archived: Optional[bool] = None


class SuitcaseTripOut(SuitcaseTripCreate):
    id: str
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class SuitcaseExpenseCreate(BaseModel):
    amount: float
    category: str
    title: str
    date: str
    currency: Optional[str] = None


class SuitcaseExpensePatch(BaseModel):
    amount: Optional[float] = None
    category: Optional[str] = None
    title: Optional[str] = None
    date: Optional[str] = None
    currency: Optional[str] = None


class SuitcaseExpenseOut(SuitcaseExpenseCreate):
    id: str
    trip_id: str
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class SuitcaseGoalCreate(BaseModel):
    title: str
    current: int = 0
    total: int = 1
    color: str = "#007AFF"


class SuitcaseGoalPatch(BaseModel):
    title: Optional[str] = None
    current: Optional[int] = None
    total: Optional[int] = None
    color: Optional[str] = None


class SuitcaseGoalOut(SuitcaseGoalCreate):
    id: str
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class SuitcaseWorkspaceOut(BaseModel):
    trips: list[SuitcaseTripOut]
    expenses: list[SuitcaseExpenseOut]
    goals: list[SuitcaseGoalOut]
