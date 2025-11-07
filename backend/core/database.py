# core/database.py
import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import MetaData

# Get env var
raw_url = os.getenv("CONNECTION_STRING")
if not raw_url:
    raise RuntimeError("Missing CONNECTION_STRING environment variable")

# Ensure async driver
if raw_url.startswith("postgresql://"):
    raw_url = raw_url.replace("postgresql://", "postgresql+asyncpg://", 1)

# ❗️Do NOT add sslmode=require manually — Supabase pooler handles SSL internally
# Adding it causes the asyncpg TypeError you’re seeing

# Create engine (no connect_args)
engine = create_async_engine(
    raw_url,
    echo=False,
    pool_pre_ping=True,
    future=True,
)

async_session = sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

metadata = MetaData(schema=os.getenv("SCHEMA", "public"))


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(metadata.create_all)