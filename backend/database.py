"""
Database layer for AgentCraft using Neon PostgreSQL.
Provides async connection pooling and ORM models.
"""
import os
import logging
from datetime import datetime, timezone
from typing import AsyncGenerator
from urllib.parse import urlparse, parse_qs

from sqlalchemy import Column, String, DateTime, Text, Integer, JSON, create_engine
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import declarative_base
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# ── Database URL ──────────────────────────────────────────────────────────────
DATABASE_URL = os.getenv("DATABASE_URL", "")

if not DATABASE_URL:
    raise ValueError("DATABASE_URL environment variable is not set")

# Convert postgresql:// to postgresql+asyncpg:// for async support
# Remove SSL query parameters as asyncpg handles them differently
if DATABASE_URL.startswith("postgresql://"):
    # Split URL and query string
    if "?" in DATABASE_URL:
        base_url, query_string = DATABASE_URL.split("?", 1)
        # Convert to asyncpg URL without query parameters
        ASYNC_DATABASE_URL = base_url.replace("postgresql://", "postgresql+asyncpg://", 1)
    else:
        ASYNC_DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)
else:
    ASYNC_DATABASE_URL = DATABASE_URL

logger.info("Database URL configured: %s", ASYNC_DATABASE_URL.split("@")[0] + "@***")

# ── SQLAlchemy Setup ──────────────────────────────────────────────────────────
Base = declarative_base()

# Create async engine with connection pooling
# For Neon, we need to pass SSL context via connect_args
engine = create_async_engine(
    ASYNC_DATABASE_URL,
    echo=False,  # Set to True for SQL query logging
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,  # Verify connections before using
    pool_recycle=3600,   # Recycle connections after 1 hour
    connect_args={
        "ssl": "require",  # asyncpg SSL parameter
        "server_settings": {
            "application_name": "agentcraft"
        }
    }
)

# Session factory
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


# ── Database Models ───────────────────────────────────────────────────────────

class Workflow(Base):
    """Workflow definition with nodes and edges."""
    __tablename__ = "workflows"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    nodes = Column(JSON, nullable=False, default=list)
    edges = Column(JSON, nullable=False, default=list)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class Execution(Base):
    """Workflow execution record."""
    __tablename__ = "executions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    workflow_id = Column(Integer, nullable=False, index=True)
    status = Column(String(50), nullable=False, default="pending")  # pending, running, completed, failed, cancelled
    input = Column(Text, nullable=False)
    final_output = Column(Text, nullable=True)
    node_results = Column(JSON, nullable=False, default=list)
    agent_logs = Column(JSON, nullable=False, default=list)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


# ── Database Session Dependency ───────────────────────────────────────────────

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Dependency for FastAPI routes to get a database session.
    Automatically handles commit/rollback and cleanup.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


# ── Database Initialization ───────────────────────────────────────────────────

async def init_db():
    """
    Initialize database tables.
    Creates all tables if they don't exist.
    """
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("✅ Database tables initialized successfully")
    except Exception as exc:
        logger.error("❌ Failed to initialize database: %s", exc)
        raise


async def close_db():
    """
    Close database connections.
    Call this on application shutdown.
    """
    await engine.dispose()
    logger.info("Database connections closed")
