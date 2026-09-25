from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field


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
    completed_at: Optional[str] = None
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


class MiniSitePublishRequest(BaseModel):
    visibility: Literal["public", "link"]
    consent_to_publish: Literal[True]
    game_stamp_ticket: Optional[str] = Field(default=None, max_length=65536)


class MiniSiteCompleteRequest(BaseModel):
    game_stamp_ticket: Optional[str] = Field(default=None, max_length=65536)


class MiniSiteOwnerOut(BaseModel):
    published: bool
    draft_ready: bool = False
    slug: Optional[str] = None
    visibility: Optional[Literal["public", "link"]] = None
    consented_at: Optional[str] = None
    completed_at: Optional[str] = None
    draft_snapshot: Optional[dict] = None
    preview_snapshot: Optional[dict] = None
    published_snapshot: Optional[dict] = None


class PublicMiniSiteOut(BaseModel):
    visibility: Literal["public", "link"]
    snapshot: dict
