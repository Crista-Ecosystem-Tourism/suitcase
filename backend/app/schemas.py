from __future__ import annotations

from decimal import Decimal
from typing import Literal, Optional

from pydantic import BaseModel, Field


class ClientRequestBody(BaseModel):
    client_request_id: Optional[str] = Field(default=None, min_length=16, max_length=64, pattern=r"^[A-Za-z0-9_-]+$")


class SuitcaseTripCreate(ClientRequestBody):
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
    base_updated_at: Optional[str] = Field(default=None, max_length=64)
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


class SuitcaseTripOut(BaseModel):
    id: str
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
    completed_at: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    membership_role: Optional[Literal["owner", "member"]] = None


class TripMemberInviteAcceptIn(BaseModel):
    invite_code: str = Field(min_length=32, max_length=128, pattern=r"^[A-Za-z0-9_-]+$")


class TripMemberInviteOut(BaseModel):
    id: str
    invite_code: str
    expires_at: str


class TripMemberInviteAcceptOut(BaseModel):
    trip_id: str
    created: bool


class TripMemberOut(BaseModel):
    user_id: str
    role: Literal["owner", "member"]
    joined_at: str


class ExpenseShareAmountIn(BaseModel):
    user_id: str = Field(min_length=1, max_length=255)
    amount: Decimal = Field(gt=0, max_digits=18, decimal_places=4)


class SuitcaseExpenseCreate(ClientRequestBody):
    amount: Decimal = Field(gt=0, max_digits=18, decimal_places=4)
    category: str
    title: str
    date: str
    currency: Optional[str] = None
    paid_by_user_id: Optional[str] = Field(default=None, min_length=1, max_length=255)
    split_member_ids: Optional[list[str]] = Field(default=None, min_length=1, max_length=50)
    shares: Optional[list[ExpenseShareAmountIn]] = Field(default=None, min_length=1, max_length=50)


class SuitcaseExpensePatch(BaseModel):
    base_updated_at: Optional[str] = Field(default=None, max_length=64)
    amount: Optional[Decimal] = Field(default=None, gt=0, max_digits=18, decimal_places=4)
    category: Optional[str] = None
    title: Optional[str] = None
    date: Optional[str] = None
    currency: Optional[str] = None


class ExpenseShareOut(BaseModel):
    user_id: str
    amount: str


class SettlementCreate(BaseModel):
    to_user_id: str = Field(min_length=1, max_length=255)
    amount: Decimal = Field(gt=0, max_digits=18, decimal_places=4)
    currency: str = Field(min_length=1, max_length=8)


class SettlementOut(BaseModel):
    id: str
    from_user_id: str
    to_user_id: str
    amount: str
    currency: str
    settled_at: str


class TripBalanceOut(BaseModel):
    user_id: str
    amount: str


class SettlementSuggestionOut(BaseModel):
    from_user_id: str
    to_user_id: str
    amount: str


class CurrencySplitSummaryOut(BaseModel):
    currency: str
    balances: list[TripBalanceOut]
    suggested_settlements: list[SettlementSuggestionOut]


class TripSplitSummaryOut(BaseModel):
    currencies: list[CurrencySplitSummaryOut]


class SuitcaseExpenseOut(BaseModel):
    id: str
    trip_id: str
    amount: float
    category: str
    title: str
    date: str
    currency: Optional[str] = None
    paid_by_user_id: Optional[str] = None
    created_by_user_id: Optional[str] = None
    shares: list[ExpenseShareOut] = Field(default_factory=list)
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
class SuitcaseGoalCreate(ClientRequestBody):
    title: str
    current: int = 0
    total: int = 1
    color: str = "#007AFF"


class SuitcaseGoalPatch(BaseModel):
    base_updated_at: Optional[str] = Field(default=None, max_length=64)
    title: Optional[str] = None
    current: Optional[int] = None
    total: Optional[int] = None
    color: Optional[str] = None


class SuitcaseGoalOut(BaseModel):
    id: str
    title: str
    current: int = 0
    total: int = 1
    color: str = "#007AFF"
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
