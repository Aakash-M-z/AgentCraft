"""
Database layer for AgentCraft using Neon PostgreSQL.
Provides async connection pooling and ORM models.
"""
import os
import logging
from datetime import datetime, timezone
from typing import AsyncGenerator
from urllib.parse import urlparse, parse_qs

from sqlalchemy import Column, String, DateTime, Text, Integer, JSON, Boolean, ForeignKey, create_engine
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
    trigger_type = Column(String(50), nullable=False, default="manual")
    cron = Column(String(100), nullable=True)
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


class Assignment(Base):
    """Personal Assignment tracking model."""
    __tablename__ = "life_os_assignments"

    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String(255), nullable=False)
    subject = Column(String(255), nullable=False)
    deadline = Column(DateTime(timezone=True), nullable=False)
    priority = Column(String(50), nullable=False, default="medium")  # low, medium, high
    status = Column(String(50), nullable=False, default="pending")    # pending, in_progress, completed, overdue
    source = Column(String(50), nullable=False, default="manual")     # whatsapp, manual
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class Placement(Base):
    """Personal Placement opportunity tracking model."""
    __tablename__ = "life_os_placements"

    id = Column(Integer, primary_key=True, autoincrement=True)
    company_name = Column(String(255), nullable=False)
    package = Column(String(100), nullable=True)
    deadline = Column(DateTime(timezone=True), nullable=False)
    eligibility = Column(Text, nullable=True)
    apply_url = Column(String(512), nullable=True)
    status = Column(String(50), nullable=False, default="active")  # active, expired, applied, upcoming
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class LeetCodeSubmission(Base):
    """Personal LeetCode solver tracking model."""
    __tablename__ = "life_os_leetcode_submissions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String(255), nullable=False)
    slug = Column(String(255), nullable=False)
    difficulty = Column(String(50), nullable=False)  # Easy, Medium, Hard
    solution = Column(Text, nullable=False)
    status = Column(String(50), nullable=False, default="solved")  # solved, missed
    date = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))


class DailyBriefing(Base):
    """Daily Briefings archive log."""
    __tablename__ = "life_os_daily_briefings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    content = Column(Text, nullable=False)
    status = Column(String(50), nullable=False, default="sent")  # sent, failed
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))


class ProcurementRequest(Base):
    """Enterprise Procurement request lifecycle tracking."""
    __tablename__ = "procurement_requests"

    id = Column(Integer, primary_key=True, autoincrement=True)
    request_id = Column(String(50), nullable=False, unique=True)  # PO-2024-XXXX
    requester = Column(String(255), nullable=False)
    department = Column(String(100), nullable=False)
    item_name = Column(String(500), nullable=False)
    item_category = Column(String(100), nullable=False)  # Hardware, Software, Services, etc.
    quantity = Column(Integer, nullable=False, default=1)
    amount = Column(Integer, nullable=False)  # in INR
    business_justification = Column(Text, nullable=True)
    priority = Column(String(20), nullable=False, default="medium")  # low, medium, high, critical
    status = Column(String(50), nullable=False, default="pending")  # pending, analyzing, approved, rejected, po_generated
    approval_tier = Column(String(20), nullable=True)  # L1, L2, L3 (based on amount)
    risk_score = Column(Integer, nullable=True)  # 0-100
    risk_level = Column(String(20), nullable=True)  # Low, Medium, High
    recommended_vendor = Column(String(255), nullable=True)
    vendor_score = Column(Integer, nullable=True)  # 0-100
    po_number = Column(String(50), nullable=True)
    duplicate_detected = Column(String(10), nullable=False, default="no")  # yes, no
    budget_available = Column(Integer, nullable=True)  # remaining budget for dept
    ai_analysis = Column(Text, nullable=True)  # AI reasoning
    execution_id = Column(Integer, nullable=True)  # linked workflow execution
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class ProcurementAuditLog(Base):
    """Immutable audit trail for all procurement actions."""
    __tablename__ = "procurement_audit_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    request_id = Column(String(50), nullable=False, index=True)
    action = Column(String(100), nullable=False)  # created, analyzed, approved, rejected, po_issued, notified
    actor = Column(String(100), nullable=False)  # AI Agent, Manager, System
    details = Column(Text, nullable=True)
    old_status = Column(String(50), nullable=True)
    new_status = Column(String(50), nullable=True)
    timestamp = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))


class ProcurementVendor(Base):
    """Vendor master data for AI-driven recommendations."""
    __tablename__ = "procurement_vendors"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    category = Column(String(100), nullable=False)  # Hardware, Software, Cloud, Networking, Office
    rating = Column(Integer, nullable=False, default=80)  # 0-100
    avg_delivery_days = Column(Integer, nullable=False, default=7)
    price_competitiveness = Column(Integer, nullable=False, default=80)  # 0-100 (higher=better price)
    compliance_score = Column(Integer, nullable=False, default=90)  # 0-100
    active = Column(String(5), nullable=False, default="true")
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))


class GitHubAccount(Base):
    """Connected GitHub Account identity and synchronization metadata."""
    __tablename__ = "github_accounts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    github_user_id = Column(String(100), nullable=False, unique=True)
    username = Column(String(255), nullable=False, index=True)
    name = Column(String(255), nullable=True)
    avatar_url = Column(String(500), nullable=True)
    account_type = Column(String(50), nullable=False, default="User")  # User or Organization
    access_token = Column(String(500), nullable=False)
    webhook_secret = Column(String(100), nullable=True)
    connected_status = Column(String(50), nullable=False, default="connected")  # connected, disconnected
    monitoring_enabled = Column(Boolean, nullable=False, default=True)
    notification_preferences = Column(Text, nullable=True)  # JSON config
    last_synced_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class GitHubProject(Base):
    """Accessible GitHub repositories discovered under the connected account."""
    __tablename__ = "github_projects"

    id = Column(Integer, primary_key=True, autoincrement=True)
    github_account_id = Column(Integer, ForeignKey("github_accounts.id", ondelete="CASCADE"), nullable=False, index=True)
    repo_id = Column(String(100), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False, index=True)
    owner = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    is_private = Column(Boolean, nullable=False, default=False)
    is_fork = Column(Boolean, nullable=False, default=False)
    is_archived = Column(Boolean, nullable=False, default=False)
    default_branch = Column(String(100), nullable=False, default="main")
    language = Column(String(100), nullable=True)
    stars_count = Column(Integer, nullable=False, default=0)
    forks_count = Column(Integer, nullable=False, default=0)
    open_issues_count = Column(Integer, nullable=False, default=0)
    open_prs_count = Column(Integer, nullable=False, default=0)
    category = Column(String(50), nullable=False, default="my_projects")  # my_projects, collaborative, archived
    monitoring_enabled = Column(Boolean, nullable=False, default=True)
    health_score = Column(Integer, nullable=False, default=85)  # 0-100
    ci_status = Column(String(20), nullable=False, default="UNKNOWN")  # PASS, WARNING, FAILED, UNKNOWN
    security_status = Column(String(20), nullable=False, default="PASS")  # PASS, WARNING, CRITICAL
    risk_level = Column(String(20), nullable=False, default="LOW")  # LOW, MEDIUM, HIGH, CRITICAL
    last_analyzed_at = Column(DateTime(timezone=True), nullable=True)
    html_url = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class GitHubAnalysis(Base):
    """Historical and real-time engineering analysis of changes/commits."""
    __tablename__ = "github_analyses"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("github_projects.id", ondelete="CASCADE"), nullable=False, index=True)
    account_id = Column(Integer, nullable=False, index=True)
    commit_sha = Column(String(100), nullable=False, index=True)
    commit_short_sha = Column(String(20), nullable=True)
    branch = Column(String(100), nullable=False, default="main")
    author_name = Column(String(255), nullable=True)
    author_avatar = Column(String(500), nullable=True)
    commit_message = Column(Text, nullable=True)
    event_type = Column(String(50), nullable=False, default="push")  # push, pull_request, manual, workflow_run
    status = Column(String(50), nullable=False, default="completed")  # pending, analyzing, completed, failed
    health_score = Column(Integer, nullable=False, default=85)
    build_status = Column(String(20), nullable=False, default="UNKNOWN")
    test_status = Column(String(20), nullable=False, default="UNKNOWN")
    security_status = Column(String(20), nullable=False, default="PASS")
    risk_level = Column(String(20), nullable=False, default="LOW")
    issues_count = Column(Integer, nullable=False, default=0)
    what_changed = Column(Text, nullable=True)
    why_changed = Column(Text, nullable=True)
    affected_components = Column(Text, nullable=True)  # JSON list
    potential_bugs = Column(Text, nullable=True)  # JSON list
    security_findings = Column(Text, nullable=True)  # JSON list
    root_cause_analysis = Column(Text, nullable=True)
    recommendations = Column(Text, nullable=True)  # JSON list
    engineering_report = Column(Text, nullable=True)  # Full enterprise markdown report
    changed_files_count = Column(Integer, nullable=False, default=0)
    additions = Column(Integer, nullable=False, default=0)
    deletions = Column(Integer, nullable=False, default=0)
    execution_id = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))


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
