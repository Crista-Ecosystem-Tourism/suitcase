from __future__ import annotations

from contextlib import asynccontextmanager
from urllib.parse import urlsplit

from fastapi import Depends, FastAPI, HTTPException, Path, Request, Response
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
    MiniSiteOwnerOut,
    MiniSiteCompleteRequest,
    MiniSitePublishRequest,
    PublicMiniSiteOut,
)
from app.security import get_current_user
from app.services import (
    create_expense,
    create_goal,
    create_trip,
    delete_expense,
    delete_goal,
    delete_trip,
    update_expense,
    update_goal,
    update_trip,
    workspace,
)
from app.mini_sites import complete_trip, get_mini_site, publish_mini_site, read_public_mini_site, revoke_mini_site
from app.mini_site_html import render_missing_mini_site_html, render_public_mini_site_html


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


@app.post("/suitcase/trips", response_model=SuitcaseTripOut)
async def post_trip(
    payload: SuitcaseTripCreate,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SuitcaseTripOut:
    row = await create_trip(db, user["sub"], payload.model_dump(exclude_unset=True))
    return SuitcaseTripOut(**row)


@app.patch("/suitcase/trips/{trip_id}", response_model=SuitcaseTripOut)
async def patch_trip(
    trip_id: str,
    payload: SuitcaseTripPatch,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SuitcaseTripOut:
    row = await update_trip(db, trip_id, user["sub"], payload.model_dump(exclude_unset=True))
    if not row:
        raise HTTPException(status_code=HTTP_404_NOT_FOUND, detail="Поездка не найдена")
    return SuitcaseTripOut(**row)


@app.delete("/suitcase/trips/{trip_id}")
async def remove_trip(trip_id: str, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> dict[str, bool]:
    ok = await delete_trip(db, trip_id, user["sub"])
    if not ok:
        raise HTTPException(status_code=HTTP_404_NOT_FOUND, detail="Поездка не найдена")
    return {"ok": True}


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


@app.post("/suitcase/trips/{trip_id}/expenses", response_model=SuitcaseExpenseOut)
async def post_expense(
    trip_id: str,
    payload: SuitcaseExpenseCreate,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SuitcaseExpenseOut:
    row = await create_expense(db, user["sub"], trip_id, payload.model_dump(exclude_unset=True))
    if not row:
        raise HTTPException(status_code=HTTP_404_NOT_FOUND, detail="Поездка не найдена")
    return SuitcaseExpenseOut(**row)


@app.patch("/suitcase/expenses/{expense_id}", response_model=SuitcaseExpenseOut)
async def patch_expense(
    expense_id: str,
    payload: SuitcaseExpensePatch,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SuitcaseExpenseOut:
    row = await update_expense(db, expense_id, user["sub"], payload.model_dump(exclude_unset=True))
    if not row:
        raise HTTPException(status_code=HTTP_404_NOT_FOUND, detail="Расход не найден")
    return SuitcaseExpenseOut(**row)


@app.delete("/suitcase/expenses/{expense_id}")
async def remove_expense(expense_id: str, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> dict[str, bool]:
    ok = await delete_expense(db, expense_id, user["sub"])
    if not ok:
        raise HTTPException(status_code=HTTP_404_NOT_FOUND, detail="Расход не найден")
    return {"ok": True}


@app.post("/suitcase/goals", response_model=SuitcaseGoalOut)
async def post_goal(
    payload: SuitcaseGoalCreate,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SuitcaseGoalOut:
    row = await create_goal(db, user["sub"], payload.model_dump(exclude_unset=True))
    return SuitcaseGoalOut(**row)


@app.patch("/suitcase/goals/{goal_id}", response_model=SuitcaseGoalOut)
async def patch_goal(
    goal_id: str,
    payload: SuitcaseGoalPatch,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SuitcaseGoalOut:
    row = await update_goal(db, goal_id, user["sub"], payload.model_dump(exclude_unset=True))
    if not row:
        raise HTTPException(status_code=HTTP_404_NOT_FOUND, detail="Цель не найдена")
    return SuitcaseGoalOut(**row)


@app.delete("/suitcase/goals/{goal_id}")
async def remove_goal(goal_id: str, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> dict[str, bool]:
    ok = await delete_goal(db, goal_id, user["sub"])
    if not ok:
        raise HTTPException(status_code=HTTP_404_NOT_FOUND, detail="Цель не найдена")
    return {"ok": True}
