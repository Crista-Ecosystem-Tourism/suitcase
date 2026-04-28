from __future__ import annotations

from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import get_database_url

engine = create_async_engine(get_database_url(), pool_pre_ping=True, future=True)
SessionFactory = async_sessionmaker(engine, expire_on_commit=False)


async def get_db() -> AsyncIterator[AsyncSession]:
    async with SessionFactory() as session:
        yield session


async def dispose_engine() -> None:
    await engine.dispose()
