from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
import os

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./adpilot.db")

# Convert postgres:// / postgresql:// to async driver
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+asyncpg://", 1)
elif DATABASE_URL.startswith("postgresql://") and "+asyncpg" not in DATABASE_URL:
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)

is_postgres = DATABASE_URL.startswith("postgresql+asyncpg://")

engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    # Supabase's pooler silently drops idle backend connections; without pre_ping
    # SQLAlchemy hands out the dead connection anyway and the request hangs forever
    # instead of failing fast. pool_recycle proactively replaces connections before
    # they're old enough to have been reaped server-side.
    pool_pre_ping=True,
    pool_recycle=280,
    connect_args={"ssl": "require", "timeout": 10, "command_timeout": 10} if is_postgres else {},
)
AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session


async def init_db():
    async with engine.begin() as conn:
        from models import Base as ModelsBase  # noqa: F401
        await conn.run_sync(ModelsBase.metadata.create_all)
