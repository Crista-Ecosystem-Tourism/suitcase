from __future__ import annotations

from contextlib import asynccontextmanager
from typing import Literal
from urllib.parse import urlsplit

from fastapi import BackgroundTasks, Depends, FastAPI, HTTPException, Path, Query, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.status import HTTP_400_BAD_REQUEST, HTTP_401_UNAUTHORIZED, HTTP_404_NOT_FOUND, HTTP_409_CONFLICT

from app.config import get_cors_origins
from app.db import dispose_engine, get_db
from app.schemas import (
    SuitcaseExpenseCreate,
    SuitcaseExpenseOut,
    SuitcaseExpensePatch,
    SuitcaseGoalCreate,
    SuitcaseGoalOut,
    SuitcaseGoalPatch,
    SuitcaseTripCreate,
    SuitcaseTripOut,
    SuitcaseTripPatch,
    SuitcaseWorkspaceOut,
    TripMemberInviteAcceptIn,
    TripMemberInviteAcceptOut,
    TripMemberInviteOut,
    TripMemberOut,
    SettlementCreate,
    SettlementOut,
    TripSplitSummaryOut,
    MiniSiteOwnerOut,
    MiniSiteCompleteRequest,
    MiniSitePublishRequest,
    PublicMiniSiteOut,
    PushDeviceOut,
    PushDeviceUpsert,
)
from app.security import get_current_user
from app.services import (
    create_expense,
    create_goal,
    create_trip_member_invite,
    create_trip,
    delete_expense,
    delete_goal,
    delete_trip,
    accept_trip_member_invite,
    list_trip_members,
    revoke_trip_member_invite,
    create_settlement,
    trip_split_summary,
    update_expense,
    update_goal,
    update_trip,
    workspace,
    StaleWriteError,
    InvalidExpenseSplitError,
    InvalidSettlementError,
    PushDeviceOwnershipError,
    upsert_push_device,
    trip_member_user_ids,
)
from app.mini_sites import PublicMiniSiteQualityError, complete_trip, get_mini_site, publish_mini_site, read_public_mini_site, revoke_mini_site
from app.mini_site_html import render_missing_mini_site_html, render_public_mini_site_html
from app.editorial_html import render_missing_editorial_html, render_public_star_route_html, render_public_wiki_html
from app.editorial_public import EditorialUnavailableError, fetch_published_star_route, fetch_published_wiki
from app.push import send_push_to_users


@asynccontextmanager
async def lifespan(_: FastAPI):
    try:
        yield
    finally:
        await dispose_engine()


app = FastAPI(title="Suitcase API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, bool]:
    return {"ok": True}


@app.get("/suitcase/workspace", response_model=SuitcaseWorkspaceOut)
async def get_workspace(user=Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> SuitcaseWorkspaceOut:
    data = await workspace(db, user["sub"])
    return SuitcaseWorkspaceOut(
        trips=[SuitcaseTripOut(**t) for t in data["trips"]],
        expenses=[SuitcaseExpenseOut(**e) for e in data["expenses"]],
        goals=[SuitcaseGoalOut(**g) for g in data["goals"]],
    )


@app.put("/suitcase/push-devices", response_model=PushDeviceOut)
async def put_push_device(
    payload: PushDeviceUpsert,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PushDeviceOut:
    try:
        device = await upsert_push_device(db, user["sub"], payload.model_dump())
    except PushDeviceOwnershipError:
        raise HTTPException(status_code=HTTP_409_CONFLICT, detail="Это устройство уже привязано к другому аккаунту")
    return PushDeviceOut(**device)


@app.post("/suitcase/trips", response_model=SuitcaseTripOut)
async def post_trip(
    payload: SuitcaseTripCreate,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SuitcaseTripOut:
    try:
        row = await create_trip(db, user["sub"], payload.model_dump(exclude_unset=True))
    except ValueError:
        raise HTTPException(status_code=HTTP_409_CONFLICT, detail="Идентификатор операции уже занят")
    return SuitcaseTripOut(**row)


@app.patch("/suitcase/trips/{trip_id}", response_model=SuitcaseTripOut)
async def patch_trip(
    trip_id: str,
    payload: SuitcaseTripPatch,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SuitcaseTripOut:
    try:
        row = await update_trip(db, trip_id, user["sub"], payload.model_dump(exclude_unset=True))
    except StaleWriteError:
        raise HTTPException(status_code=HTTP_409_CONFLICT, detail="Данные изменились на другом устройстве")
    if not row:
        raise HTTPException(status_code=HTTP_404_NOT_FOUND, detail="Поездка не найдена")
    return SuitcaseTripOut(**row)


@app.delete("/suitcase/trips/{trip_id}")
async def remove_trip(
    trip_id: str,
    base_updated_at: str | None = Query(default=None, max_length=64),
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, bool]:
    try:
        ok = await delete_trip(db, trip_id, user["sub"], base_updated_at)
    except StaleWriteError:
        raise HTTPException(status_code=HTTP_409_CONFLICT, detail="Данные изменились на другом устройстве")
    if not ok:
        raise HTTPException(status_code=HTTP_404_NOT_FOUND, detail="Поездка не найдена")
    return {"ok": True}


@app.get("/suitcase/trips/{trip_id}/members", response_model=list[TripMemberOut])
async def get_trip_members(
    trip_id: str,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[TripMemberOut]:
    members = await list_trip_members(db, trip_id, user["sub"])
    if members is None:
        raise HTTPException(status_code=HTTP_404_NOT_FOUND, detail="Поездка не найдена")
    return [TripMemberOut(**member) for member in members]


@app.post("/suitcase/trips/{trip_id}/member-invites", response_model=TripMemberInviteOut)
async def post_trip_member_invite(
    trip_id: str,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TripMemberInviteOut:
    invite = await create_trip_member_invite(db, trip_id, user["sub"])
    if invite is None:
        raise HTTPException(status_code=HTTP_404_NOT_FOUND, detail="Поездка не найдена")
    return TripMemberInviteOut(**invite)


@app.delete("/suitcase/trips/{trip_id}/member-invites/{invite_id}")
async def delete_trip_member_invite(
    trip_id: str,
    invite_id: str,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, bool]:
    revoked = await revoke_trip_member_invite(db, trip_id, invite_id, user["sub"])
    if not revoked:
        raise HTTPException(status_code=HTTP_404_NOT_FOUND, detail="Приглашение не найдено")
    return {"ok": True}


@app.post("/suitcase/member-invites/accept", response_model=TripMemberInviteAcceptOut)
async def post_accept_trip_member_invite(
    payload: TripMemberInviteAcceptIn,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TripMemberInviteAcceptOut:
    result = await accept_trip_member_invite(db, user["sub"], payload.invite_code)
    if result is None:
        raise HTTPException(status_code=HTTP_404_NOT_FOUND, detail="Приглашение недоступно")
    return TripMemberInviteAcceptOut(**result)


@app.get("/suitcase/trips/{trip_id}/split-summary", response_model=TripSplitSummaryOut)
async def get_trip_split_summary(
    trip_id: str,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TripSplitSummaryOut:
    summary = await trip_split_summary(db, trip_id, user["sub"])
    if summary is None:
        raise HTTPException(status_code=HTTP_404_NOT_FOUND, detail="Поездка не найдена")
    return TripSplitSummaryOut(**summary)


@app.post("/suitcase/trips/{trip_id}/settlements", response_model=SettlementOut)
async def post_trip_settlement(
    trip_id: str,
    payload: SettlementCreate,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SettlementOut:
    try:
        settlement = await create_settlement(db, trip_id, user["sub"], payload.model_dump())
    except InvalidSettlementError as exc:
        raise HTTPException(status_code=HTTP_400_BAD_REQUEST, detail=str(exc))
    if settlement is None:
        raise HTTPException(status_code=HTTP_404_NOT_FOUND, detail="Поездка не найдена")
    return SettlementOut(**settlement)


@app.get("/suitcase/trips/{trip_id}/mini-site", response_model=MiniSiteOwnerOut)
async def get_trip_mini_site(
    trip_id: str, user=Depends(get_current_user), db: AsyncSession = Depends(get_db),
) -> MiniSiteOwnerOut:
    publication = await get_mini_site(db, trip_id, user["sub"])
    if publication is None:
        raise HTTPException(status_code=HTTP_404_NOT_FOUND, detail="Поездка не найдена")
    return MiniSiteOwnerOut(**publication)


@app.post("/suitcase/trips/{trip_id}/complete", response_model=MiniSiteOwnerOut)
async def post_complete_trip(
    trip_id: str,
    payload: MiniSiteCompleteRequest | None = None,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MiniSiteOwnerOut:
    try:
        state = await complete_trip(
            db, trip_id, user["sub"], payload.game_stamp_ticket if payload else None,
        )
    except ValueError:
        raise HTTPException(status_code=HTTP_400_BAD_REQUEST, detail="Игровые штампы не прошли проверку")
    if state is None:
        raise HTTPException(status_code=HTTP_404_NOT_FOUND, detail="Поездка не найдена")
    return MiniSiteOwnerOut(**state)


@app.post("/suitcase/trips/{trip_id}/mini-site", response_model=MiniSiteOwnerOut)
async def post_trip_mini_site(
    trip_id: str,
    payload: MiniSitePublishRequest,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MiniSiteOwnerOut:
    try:
        publication = await publish_mini_site(
            db, trip_id, user["sub"], payload.visibility, payload.game_stamp_ticket,
        )
    except PublicMiniSiteQualityError as error:
        raise HTTPException(status_code=HTTP_400_BAD_REQUEST, detail=str(error))
    except ValueError:
        raise HTTPException(status_code=HTTP_400_BAD_REQUEST, detail="Игровые штампы не прошли проверку")
    if publication is None:
        raise HTTPException(status_code=HTTP_404_NOT_FOUND, detail="Поездка не найдена")
    return MiniSiteOwnerOut(**publication)


@app.delete("/suitcase/trips/{trip_id}/mini-site")
async def delete_trip_mini_site(
    trip_id: str, user=Depends(get_current_user), db: AsyncSession = Depends(get_db),
) -> dict[str, bool]:
    revoked = await revoke_mini_site(db, trip_id, user["sub"])
    if revoked is None:
        raise HTTPException(status_code=HTTP_404_NOT_FOUND, detail="Поездка не найдена")
    return {"ok": True}


@app.get("/t/{slug}", response_model=PublicMiniSiteOut)
async def get_public_mini_site(
    response: Response,
    slug: str = Path(min_length=32, max_length=64, pattern=r"^[A-Za-z0-9_-]+$"),
    db: AsyncSession = Depends(get_db),
) -> PublicMiniSiteOut:
    publication = await read_public_mini_site(db, slug)
    if publication is None:
        raise HTTPException(status_code=HTTP_404_NOT_FOUND, detail="Страница поездки не найдена")
    response.headers["Cache-Control"] = "private, no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    return PublicMiniSiteOut(**publication)


@app.get("/public-mini-site/{slug}/html", response_class=HTMLResponse)
async def get_public_mini_site_html(
    request: Request,
    slug: str = Path(min_length=32, max_length=64, pattern=r"^[A-Za-z0-9_-]+$"),
    db: AsyncSession = Depends(get_db),
) -> HTMLResponse:
    publication = await read_public_mini_site(db, slug)
    headers = {
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "Content-Security-Policy": "default-src 'none'; img-src https:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    }
    if publication is None:
        return HTMLResponse(render_missing_mini_site_html(), status_code=HTTP_404_NOT_FOUND, headers=headers)

    host = request.headers.get("host", "").lower()
    canonical_url = None
    if publication.get("visibility") == "public":
        for origin in get_cors_origins():
            parsed = urlsplit(origin)
            if (
                parsed.scheme in {"http", "https"}
                and parsed.netloc.lower() == host
                and parsed.path in {"", "/"}
                and not parsed.username
                and not parsed.password
            ):
                canonical_url = f"{parsed.scheme}://{parsed.netloc}/t/{slug}"
                break
    return HTMLResponse(
        render_public_mini_site_html(publication, canonical_url=canonical_url),
        status_code=200,
        headers=headers,
    )


def _editorial_headers() -> dict[str, str]:
    return {
        "Cache-Control": "public, max-age=300",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "Content-Security-Policy": "default-src 'none'; img-src https:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    }


def _editorial_canonical_url(request: Request, path: str) -> str | None:
    host = request.headers.get("host", "").lower()
    for origin in get_cors_origins():
        parsed = urlsplit(origin)
        if (
            parsed.scheme in {"http", "https"}
            and parsed.netloc.lower() == host
            and parsed.path in {"", "/"}
            and not parsed.username
            and not parsed.password
        ):
            return f"{parsed.scheme}://{parsed.netloc}{path}"
    return None


@app.get("/w/{slug}", response_class=HTMLResponse)
async def get_public_wiki_html(
    request: Request,
    slug: str = Path(min_length=2, max_length=80, pattern=r"^[a-z0-9-]+$"),
    language: Literal["ru", "en"] = "ru",
) -> HTMLResponse:
    headers = _editorial_headers()
    try:
        article = await fetch_published_wiki(slug, language)
    except EditorialUnavailableError:
        raise HTTPException(status_code=503, detail="Редакционная страница временно недоступна")
    if article is None:
        return HTMLResponse(render_missing_editorial_html("wiki"), status_code=HTTP_404_NOT_FOUND, headers=headers)
    path = f"/w/{slug}" + ("?language=en" if language == "en" else "")
    return HTMLResponse(render_public_wiki_html(article, _editorial_canonical_url(request, path)), headers=headers)


@app.get("/r/{route_id}", response_class=HTMLResponse)
async def get_public_star_route_html(
    request: Request,
    route_id: str = Path(min_length=1, max_length=64, pattern=r"^[A-Za-z0-9_-]+$"),
) -> HTMLResponse:
    headers = _editorial_headers()
    try:
        route = await fetch_published_star_route(route_id)
    except EditorialUnavailableError:
        raise HTTPException(status_code=503, detail="Редакционная страница временно недоступна")
    if route is None:
        return HTMLResponse(render_missing_editorial_html("route"), status_code=HTTP_404_NOT_FOUND, headers=headers)
    return HTMLResponse(render_public_star_route_html(route, _editorial_canonical_url(request, f"/r/{route_id}")), headers=headers)


@app.post("/suitcase/trips/{trip_id}/expenses", response_model=SuitcaseExpenseOut)
async def post_expense(
    trip_id: str,
    payload: SuitcaseExpenseCreate,
    background_tasks: BackgroundTasks,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SuitcaseExpenseOut:
    try:
        result = await create_expense(db, user["sub"], trip_id, payload.model_dump(exclude_unset=True))
    except InvalidExpenseSplitError as exc:
        raise HTTPException(status_code=HTTP_400_BAD_REQUEST, detail=str(exc))
    except ValueError:
        raise HTTPException(status_code=HTTP_409_CONFLICT, detail="Идентификатор операции уже занят")
    if not result:
        raise HTTPException(status_code=HTTP_404_NOT_FOUND, detail="Поездка не найдена")
    row, created = result
    if created:
        background_tasks.add_task(
            send_push_to_users,
            await trip_member_user_ids(db, trip_id, exclude_user_id=user["sub"]),
            title="Новый расход в поездке",
            body=row["title"],
            data={"type": "expense", "trip_id": trip_id, "expense_id": row["id"]},
        )
    return SuitcaseExpenseOut(**row)


@app.patch("/suitcase/expenses/{expense_id}", response_model=SuitcaseExpenseOut)
async def patch_expense(
    expense_id: str,
    payload: SuitcaseExpensePatch,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SuitcaseExpenseOut:
    try:
        row = await update_expense(db, expense_id, user["sub"], payload.model_dump(exclude_unset=True))
    except StaleWriteError:
        raise HTTPException(status_code=HTTP_409_CONFLICT, detail="Данные изменились на другом устройстве")
    except InvalidExpenseSplitError as exc:
        raise HTTPException(status_code=HTTP_400_BAD_REQUEST, detail=str(exc))
    if not row:
        raise HTTPException(status_code=HTTP_404_NOT_FOUND, detail="Расход не найден")
    return SuitcaseExpenseOut(**row)


@app.delete("/suitcase/expenses/{expense_id}")
async def remove_expense(
    expense_id: str,
    base_updated_at: str | None = Query(default=None, max_length=64),
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, bool]:
    try:
        ok = await delete_expense(db, expense_id, user["sub"], base_updated_at)
    except StaleWriteError:
        raise HTTPException(status_code=HTTP_409_CONFLICT, detail="Данные изменились на другом устройстве")
    if not ok:
        raise HTTPException(status_code=HTTP_404_NOT_FOUND, detail="Расход не найден")
    return {"ok": True}


@app.post("/suitcase/goals", response_model=SuitcaseGoalOut)
async def post_goal(
    payload: SuitcaseGoalCreate,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SuitcaseGoalOut:
    try:
        row = await create_goal(db, user["sub"], payload.model_dump(exclude_unset=True))
    except ValueError:
        raise HTTPException(status_code=HTTP_409_CONFLICT, detail="Идентификатор операции уже занят")
    return SuitcaseGoalOut(**row)


@app.patch("/suitcase/goals/{goal_id}", response_model=SuitcaseGoalOut)
async def patch_goal(
    goal_id: str,
    payload: SuitcaseGoalPatch,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SuitcaseGoalOut:
    try:
        row = await update_goal(db, goal_id, user["sub"], payload.model_dump(exclude_unset=True))
    except StaleWriteError:
        raise HTTPException(status_code=HTTP_409_CONFLICT, detail="Данные изменились на другом устройстве")
    if not row:
        raise HTTPException(status_code=HTTP_404_NOT_FOUND, detail="Цель не найдена")
    return SuitcaseGoalOut(**row)


@app.delete("/suitcase/goals/{goal_id}")
async def remove_goal(
    goal_id: str,
    base_updated_at: str | None = Query(default=None, max_length=64),
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, bool]:
    try:
        ok = await delete_goal(db, goal_id, user["sub"], base_updated_at)
    except StaleWriteError:
        raise HTTPException(status_code=HTTP_409_CONFLICT, detail="Данные изменились на другом устройстве")
    if not ok:
        raise HTTPException(status_code=HTTP_404_NOT_FOUND, detail="Цель не найдена")
    return {"ok": True}
