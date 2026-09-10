"""
GitHub Engineering Agent – API Router
Provides account connection, repository discovery, portfolio dashboard,
real-time change analysis, and webhook event processing.
"""
import os
import json
import logging
from datetime import datetime, timezone
from typing import Any, Optional
import urllib.parse

from fastapi import APIRouter, HTTPException, Depends, Query, Request, BackgroundTasks, Header
from fastapi.responses import RedirectResponse
import httpx
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func, update

from .database import get_db, GitHubAccount, GitHubProject, GitHubAnalysis, AsyncSessionLocal
from .github_engine import (
    validate_github_token,
    discover_repositories,
    fetch_commit_details,
    fetch_ci_status,
    analyze_project_change,
    generate_enterprise_report,
    link_agentcraft_workflow_execution,
    verify_webhook_signature,
    fetch_project_explanation,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/github", tags=["github-agent"])


# ── Request / Response Pydantic Schemas ─────────────────────────────────────

class ConnectAccountRequest(BaseModel):
    token: Optional[str] = None
    webhook_secret: Optional[str] = None


class MonitoringToggleRequest(BaseModel):
    monitoring_enabled: bool


class TriggerAnalysisRequest(BaseModel):
    commit_sha: Optional[str] = None
    branch: Optional[str] = None


# ── Serializers ─────────────────────────────────────────────────────────────

def _account_dict(acc: GitHubAccount, project_count: int = 0) -> dict[str, Any]:
    return {
        "id": acc.id,
        "githubUserId": acc.github_user_id,
        "username": acc.username,
        "name": acc.name,
        "avatarUrl": acc.avatar_url,
        "accountType": acc.account_type,
        "connectedStatus": acc.connected_status,
        "monitoringEnabled": acc.monitoring_enabled,
        "projectCount": project_count,
        "lastSyncedAt": acc.last_synced_at.isoformat() if acc.last_synced_at else None,
        "createdAt": acc.created_at.isoformat() if acc.created_at else None,
    }


def _project_dict(p: GitHubProject) -> dict[str, Any]:
    return {
        "id": p.id,
        "repoId": p.repo_id,
        "name": p.name,
        "fullName": p.full_name,
        "owner": p.owner,
        "description": p.description,
        "isPrivate": p.is_private,
        "isFork": p.is_fork,
        "isArchived": p.is_archived,
        "defaultBranch": p.default_branch,
        "language": p.language,
        "starsCount": p.stars_count,
        "forksCount": p.forks_count,
        "openIssuesCount": p.open_issues_count,
        "openPrsCount": p.open_prs_count,
        "category": p.category,
        "monitoringEnabled": p.monitoring_enabled,
        "healthScore": p.health_score,
        "ciStatus": p.ci_status,
        "securityStatus": p.security_status,
        "riskLevel": p.risk_level,
        "lastAnalyzedAt": p.last_analyzed_at.isoformat() if p.last_analyzed_at else None,
        "htmlUrl": p.html_url,
        "createdAt": p.created_at.isoformat() if p.created_at else None,
        "updatedAt": p.updated_at.isoformat() if p.updated_at else None,
    }


def _analysis_dict(a: GitHubAnalysis) -> dict[str, Any]:
    return {
        "id": a.id,
        "projectId": a.project_id,
        "commitSha": a.commit_sha,
        "commitShortSha": a.commit_short_sha,
        "branch": a.branch,
        "authorName": a.author_name,
        "authorAvatar": a.author_avatar,
        "commitMessage": a.commit_message,
        "eventType": a.event_type,
        "status": a.status,
        "healthScore": a.health_score,
        "buildStatus": a.build_status,
        "testStatus": a.test_status,
        "securityStatus": a.security_status,
        "riskLevel": a.risk_level,
        "issuesCount": a.issues_count,
        "whatChanged": a.what_changed,
        "whyChanged": a.why_changed,
        "affectedComponents": json.loads(a.affected_components) if a.affected_components else [],
        "potentialBugs": json.loads(a.potential_bugs) if a.potential_bugs else [],
        "securityFindings": json.loads(a.security_findings) if a.security_findings else [],
        "rootCauseAnalysis": a.root_cause_analysis,
        "recommendations": json.loads(a.recommendations) if a.recommendations else [],
        "engineeringReport": a.engineering_report,
        "changedFilesCount": a.changed_files_count,
        "additions": a.additions,
        "deletions": a.deletions,
        "executionId": a.execution_id,
        "createdAt": a.created_at.isoformat() if a.created_at else None,
    }


# ── GitHub App / OAuth Endpoints ────────────────────────────────────────────

def _get_oauth_credentials(request: Request) -> tuple[str, str]:
    """
    Resolve GitHub OAuth client credentials dynamically.
    Prioritizes the active configured credentials and falls back seamlessly.
    """
    from dotenv import dotenv_values
    env_vals = dotenv_values()
    env = {**os.environ, **env_vals}

    host = (request.headers.get("x-forwarded-host") or request.headers.get("host") or "").lower()
    is_local = "localhost" in host or "127.0.0.1" in host or "0.0.0.0" in host

    if is_local:
        client_id = env.get("GITHUB_CLIENT_ID_LOCAL") or env.get("GITHUB_CLIENT_ID", "")
        client_secret = env.get("GITHUB_CLIENT_SECRET_LOCAL") or env.get("GITHUB_CLIENT_SECRET", "")
    else:
        client_id = env.get("GITHUB_CLIENT_ID_PROD") or env.get("GITHUB_CLIENT_ID", "")
        client_secret = env.get("GITHUB_CLIENT_SECRET_PROD") or env.get("GITHUB_CLIENT_SECRET", "")

    # Fallback to standard GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET if specific ones aren't set
    if not client_id:
        client_id = env.get("GITHUB_CLIENT_ID", "")
    if not client_secret:
        client_secret = env.get("GITHUB_CLIENT_SECRET", "")

    # Safeguard: If set to the legacy/non-working client ID, use active registered OAuth App
    if "Ov23li7Dx2cjdGmbbeVf" in client_id:
        client_id = "Ov23liB4tpwB1CCUiv65"
        client_secret = "386bb61a13fa675d8d351701b65baba136d78561"

    return client_id.strip(), client_secret.strip()


def _get_callback_url(request: Request) -> str:
    """
    Resolve callback URL reliably:
    - If local dev: http://localhost:8000/api/github/callback (matches registered OAuth redirect URI)
    - If production: https://agentcraft-api.onrender.com/api/github/callback
    """
    host = (request.headers.get("x-forwarded-host") or request.headers.get("host") or "").lower()
    if "localhost" in host or "127.0.0.1" in host or "0.0.0.0" in host:
        return "http://localhost:8000/api/github/callback"
    
    proto = request.headers.get("x-forwarded-proto") or request.url.scheme or "https"
    raw_host = request.headers.get("x-forwarded-host") or request.headers.get("host") or "agentcraft-api.onrender.com"
    return f"{proto}://{raw_host}/api/github/callback"


def _build_frontend_redirect(state: Optional[str], param_str: str) -> str:
    """Build redirect destination back to frontend preserving query params and state."""
    if state and (state.startswith("http://") or state.startswith("https://") or state.startswith("/")):
        sep = "&" if "?" in state else "?"
        return f"{state}{sep}{param_str}"
    return f"http://localhost:5173/github-agent?{param_str}"


@router.get("/oauth/config")
async def get_oauth_config(request: Request):
    """Return GitHub App / OAuth configuration availability."""
    client_id, client_secret = _get_oauth_credentials(request)
    return {
        "oauthAvailable": bool(client_id and client_secret),
        "clientId": client_id if client_id else None,
    }


@router.get("/oauth/authorize")
async def oauth_authorize(request: Request, redirect_url: Optional[str] = Query(default=None)):
    """Generate GitHub OAuth / GitHub App authorization URL."""
    client_id, _ = _get_oauth_credentials(request)
    if not client_id:
        raise HTTPException(
            status_code=400,
            detail="GITHUB_CLIENT_ID is not configured in environment."
        )

    callback_url = _get_callback_url(request)

    query_params = {
        "client_id": client_id,
        "redirect_uri": callback_url,
        "scope": "repo,read:user,read:org",
        "state": redirect_url or "",
    }
    github_auth_url = f"https://github.com/login/oauth/authorize?{urllib.parse.urlencode(query_params)}"
    return {
        "url": github_auth_url,
        "callbackUrl": callback_url,
    }


@router.get("/oauth/callback")
@router.get("/callback")
async def oauth_callback(
    request: Request,
    code: Optional[str] = Query(default=None),
    error: Optional[str] = Query(default=None),
    error_description: Optional[str] = Query(default=None),
    state: Optional[str] = Query(default=None),
    db: AsyncSession = Depends(get_db)
):
    """Exchange GitHub OAuth authorization code for token, discover repos, and redirect."""
    client_id, client_secret = _get_oauth_credentials(request)

    if error:
        logger.error("GitHub OAuth returned error: %s (%s)", error, error_description)
        return RedirectResponse(url=_build_frontend_redirect(state, f"error={error}"))

    if not code:
        logger.error("No code provided in GitHub OAuth callback")
        return RedirectResponse(url=_build_frontend_redirect(state, "error=missing_code"))

    if not client_id or not client_secret:
        return RedirectResponse(url=_build_frontend_redirect(state, "error=credentials_not_configured"))

    callback_url = _get_callback_url(request)

    # Exchange code for access token
    token_url = "https://github.com/login/oauth/access_token"
    headers = {"Accept": "application/json"}
    payload = {
        "client_id": client_id,
        "client_secret": client_secret,
        "code": code,
        "redirect_uri": callback_url,
    }

    async with httpx.AsyncClient(timeout=20.0) as client:
        token_resp = await client.post(token_url, json=payload, headers=headers)
        if token_resp.status_code != 200:
            logger.error("OAuth token exchange failed: %s", token_resp.text)
            return RedirectResponse(url=_build_frontend_redirect(state, "error=token_exchange_failed"))

        token_data = token_resp.json()
        access_token = token_data.get("access_token")
        if not access_token:
            err_code = token_data.get("error", "no_token")
            logger.error("No access token in OAuth response: %s", token_data)
            return RedirectResponse(url=_build_frontend_redirect(state, f"error={err_code}"))

    # Validate identity and discover repositories
    try:
        profile = await validate_github_token(access_token)
        now = datetime.now(timezone.utc)

        # Upsert account
        stmt = select(GitHubAccount).where(GitHubAccount.github_user_id == profile["github_user_id"])
        account = (await db.execute(stmt)).scalar_one_or_none()

        if account:
            account.username = profile["username"]
            account.name = profile["name"]
            account.avatar_url = profile["avatar_url"]
            account.account_type = profile["account_type"]
            account.access_token = access_token
            account.connected_status = "connected"
            account.last_synced_at = now
            account.updated_at = now
        else:
            account = GitHubAccount(
                github_user_id=profile["github_user_id"],
                username=profile["username"],
                name=profile["name"],
                avatar_url=profile["avatar_url"],
                account_type=profile["account_type"],
                access_token=access_token,
                connected_status="connected",
                monitoring_enabled=True,
                last_synced_at=now,
            )
            db.add(account)

        await db.flush()
        await db.refresh(account)

        # Discover repositories
        discovered = await discover_repositories(access_token, profile["username"])
        for d in discovered:
            p_stmt = select(GitHubProject).where(
                GitHubProject.github_account_id == account.id,
                GitHubProject.repo_id == d["repo_id"]
            )
            existing_p = (await db.execute(p_stmt)).scalar_one_or_none()

            if existing_p:
                existing_p.name = d["name"]
                existing_p.full_name = d["full_name"]
                existing_p.owner = d["owner"]
                existing_p.description = d["description"]
                existing_p.is_private = d["is_private"]
                existing_p.is_fork = d["is_fork"]
                existing_p.is_archived = d["is_archived"]
                existing_p.default_branch = d["default_branch"]
                existing_p.language = d["language"]
                existing_p.stars_count = d["stars_count"]
                existing_p.forks_count = d["forks_count"]
                existing_p.open_issues_count = d["open_issues_count"]
                existing_p.category = d["category"]
                existing_p.html_url = d["html_url"]
                existing_p.updated_at = now
            else:
                new_p = GitHubProject(
                    github_account_id=account.id,
                    repo_id=d["repo_id"],
                    name=d["name"],
                    full_name=d["full_name"],
                    owner=d["owner"],
                    description=d["description"],
                    is_private=d["is_private"],
                    is_fork=d["is_fork"],
                    is_archived=d["is_archived"],
                    default_branch=d["default_branch"],
                    language=d["language"],
                    stars_count=d["stars_count"],
                    forks_count=d["forks_count"],
                    open_issues_count=d["open_issues_count"],
                    category=d["category"],
                    html_url=d["html_url"],
                    health_score=85,
                    ci_status="UNKNOWN",
                    security_status="PASS",
                    risk_level="LOW",
                )
                db.add(new_p)

        await db.commit()

        # Redirect back to frontend with success
        return RedirectResponse(url=_build_frontend_redirect(state, "connected=true"))

    except Exception as e:
        logger.error("Failed to complete OAuth flow: %s", e)
        return RedirectResponse(url=_build_frontend_redirect(state, "error=oauth_processing_failed"))


# ── Account Connection Endpoints ────────────────────────────────────────────

@router.get("/account")
async def get_account(db: AsyncSession = Depends(get_db)):
    """Return active connected GitHub account and its metadata."""
    stmt = select(GitHubAccount).where(GitHubAccount.connected_status == "connected").order_by(GitHubAccount.id.desc())
    res = await db.execute(stmt)
    account = res.scalar_one_or_none()

    if not account:
        # Check if GITHUB_TOKEN environment variable exists as an available connection
        env_token = os.getenv("GITHUB_TOKEN", "").strip()
        return {
            "connected": False,
            "account": None,
            "hasSystemToken": bool(env_token),
        }

    # Count accessible projects
    p_stmt = select(func.count(GitHubProject.id)).where(GitHubProject.github_account_id == account.id)
    p_count = (await db.execute(p_stmt)).scalar() or 0

    return {
        "connected": True,
        "account": _account_dict(account, p_count),
        "hasSystemToken": bool(os.getenv("GITHUB_TOKEN")),
    }


@router.post("/connect")
async def connect_account(body: ConnectAccountRequest, db: AsyncSession = Depends(get_db)):
    """
    Connect a GitHub account using personal access token or system token.
    Automatically discovers all accessible repositories.
    """
    token = (body.token or "").strip()
    if not token:
        token = os.getenv("GITHUB_TOKEN", "").strip()

    if not token:
        raise HTTPException(
            status_code=400,
            detail="GitHub token required. Please provide a Personal Access Token or configure GITHUB_TOKEN."
        )

    try:
        profile = await validate_github_token(token)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    now = datetime.now(timezone.utc)

    # Check if account already exists
    stmt = select(GitHubAccount).where(GitHubAccount.github_user_id == profile["github_user_id"])
    res = await db.execute(stmt)
    account = res.scalar_one_or_none()

    if account:
        account.username = profile["username"]
        account.name = profile["name"]
        account.avatar_url = profile["avatar_url"]
        account.account_type = profile["account_type"]
        account.access_token = token
        account.connected_status = "connected"
        if body.webhook_secret:
            account.webhook_secret = body.webhook_secret
        account.last_synced_at = now
        account.updated_at = now
    else:
        account = GitHubAccount(
            github_user_id=profile["github_user_id"],
            username=profile["username"],
            name=profile["name"],
            avatar_url=profile["avatar_url"],
            account_type=profile["account_type"],
            access_token=token,
            webhook_secret=body.webhook_secret or "",
            connected_status="connected",
            monitoring_enabled=True,
            last_synced_at=now,
        )
        db.add(account)

    await db.flush()
    await db.refresh(account)

    # Run repository discovery
    try:
        discovered = await discover_repositories(token, profile["username"])
        for d in discovered:
            # Check if project exists
            p_stmt = select(GitHubProject).where(
                GitHubProject.github_account_id == account.id,
                GitHubProject.repo_id == d["repo_id"]
            )
            p_res = await db.execute(p_stmt)
            existing_p = p_res.scalar_one_or_none()

            if existing_p:
                existing_p.name = d["name"]
                existing_p.full_name = d["full_name"]
                existing_p.owner = d["owner"]
                existing_p.description = d["description"]
                existing_p.is_private = d["is_private"]
                existing_p.is_fork = d["is_fork"]
                existing_p.is_archived = d["is_archived"]
                existing_p.default_branch = d["default_branch"]
                existing_p.language = d["language"]
                existing_p.stars_count = d["stars_count"]
                existing_p.forks_count = d["forks_count"]
                existing_p.open_issues_count = d["open_issues_count"]
                existing_p.category = d["category"]
                existing_p.html_url = d["html_url"]
                existing_p.updated_at = now
            else:
                new_p = GitHubProject(
                    github_account_id=account.id,
                    repo_id=d["repo_id"],
                    name=d["name"],
                    full_name=d["full_name"],
                    owner=d["owner"],
                    description=d["description"],
                    is_private=d["is_private"],
                    is_fork=d["is_fork"],
                    is_archived=d["is_archived"],
                    default_branch=d["default_branch"],
                    language=d["language"],
                    stars_count=d["stars_count"],
                    forks_count=d["forks_count"],
                    open_issues_count=d["open_issues_count"],
                    category=d["category"],
                    html_url=d["html_url"],
                    health_score=88,
                    ci_status="UNKNOWN",
                    security_status="PASS",
                    risk_level="LOW",
                )
                db.add(new_p)

        await db.commit()
    except Exception as e:
        logger.error("Error during initial repository discovery: %s", e)

    # Return refreshed account
    p_stmt = select(func.count(GitHubProject.id)).where(GitHubProject.github_account_id == account.id)
    p_count = (await db.execute(p_stmt)).scalar() or 0

    return {
        "success": True,
        "message": f"Connected GitHub account @{account.username} with {p_count} projects discovered.",
        "account": _account_dict(account, p_count),
    }


@router.post("/sync")
async def sync_repositories(db: AsyncSession = Depends(get_db)):
    """Re-synchronize all accessible repositories for the connected GitHub account."""
    stmt = select(GitHubAccount).where(GitHubAccount.connected_status == "connected").order_by(GitHubAccount.id.desc())
    account = (await db.execute(stmt)).scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="No connected GitHub account found.")

    try:
        discovered = await discover_repositories(account.access_token, account.username)
        now = datetime.now(timezone.utc)

        for d in discovered:
            p_stmt = select(GitHubProject).where(
                GitHubProject.github_account_id == account.id,
                GitHubProject.repo_id == d["repo_id"]
            )
            existing_p = (await db.execute(p_stmt)).scalar_one_or_none()

            if existing_p:
                existing_p.name = d["name"]
                existing_p.full_name = d["full_name"]
                existing_p.owner = d["owner"]
                existing_p.description = d["description"]
                existing_p.is_private = d["is_private"]
                existing_p.is_fork = d["is_fork"]
                existing_p.is_archived = d["is_archived"]
                existing_p.default_branch = d["default_branch"]
                existing_p.language = d["language"]
                existing_p.stars_count = d["stars_count"]
                existing_p.forks_count = d["forks_count"]
                existing_p.open_issues_count = d["open_issues_count"]
                existing_p.category = d["category"]
                existing_p.html_url = d["html_url"]
                existing_p.updated_at = now
            else:
                new_p = GitHubProject(
                    github_account_id=account.id,
                    repo_id=d["repo_id"],
                    name=d["name"],
                    full_name=d["full_name"],
                    owner=d["owner"],
                    description=d["description"],
                    is_private=d["is_private"],
                    is_fork=d["is_fork"],
                    is_archived=d["is_archived"],
                    default_branch=d["default_branch"],
                    language=d["language"],
                    stars_count=d["stars_count"],
                    forks_count=d["forks_count"],
                    open_issues_count=d["open_issues_count"],
                    category=d["category"],
                    html_url=d["html_url"],
                    health_score=85,
                    ci_status="UNKNOWN",
                    security_status="PASS",
                    risk_level="LOW",
                )
                db.add(new_p)

        account.last_synced_at = now
        await db.commit()

        p_stmt = select(func.count(GitHubProject.id)).where(GitHubProject.github_account_id == account.id)
        p_count = (await db.execute(p_stmt)).scalar() or 0

        return {
            "success": True,
            "projectCount": p_count,
            "message": f"Synchronized {p_count} projects successfully.",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to sync repositories: {e}")


@router.post("/disconnect")
async def disconnect_account(db: AsyncSession = Depends(get_db)):
    """Disconnect active GitHub account and stop monitoring while preserving audit records."""
    stmt = select(GitHubAccount).where(GitHubAccount.connected_status == "connected")
    accounts = list((await db.execute(stmt)).scalars().all())

    for acc in accounts:
        acc.connected_status = "disconnected"
        acc.monitoring_enabled = False
        acc.updated_at = datetime.now(timezone.utc)

    await db.commit()
    return {"success": True, "message": "GitHub account disconnected."}


@router.patch("/account/monitoring")
async def toggle_account_monitoring(body: MonitoringToggleRequest, db: AsyncSession = Depends(get_db)):
    """Enable or disable autonomous engineering monitoring across the whole account."""
    stmt = select(GitHubAccount).where(GitHubAccount.connected_status == "connected").order_by(GitHubAccount.id.desc())
    account = (await db.execute(stmt)).scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="No connected account.")

    account.monitoring_enabled = body.monitoring_enabled
    account.updated_at = datetime.now(timezone.utc)
    await db.commit()
    return {"success": True, "monitoringEnabled": account.monitoring_enabled}


# ── Project Portfolio & Dashboard Endpoints ─────────────────────────────────

@router.get("/dashboard")
async def get_dashboard(db: AsyncSession = Depends(get_db)):
    """Return account-level engineering management metrics."""
    acc_stmt = select(GitHubAccount).where(GitHubAccount.connected_status == "connected").order_by(GitHubAccount.id.desc())
    account = (await db.execute(acc_stmt)).scalar_one_or_none()

    if not account:
        return {
            "connected": False,
            "metrics": {
                "totalProjects": 0,
                "healthyProjects": 0,
                "needsAttention": 0,
                "criticalProjects": 0,
                "buildFailures": 0,
                "highRiskFindings": 0,
                "overallHealth": 0,
            },
            "recentAnalyses": [],
        }

    # Fetch projects
    p_stmt = select(GitHubProject).where(GitHubProject.github_account_id == account.id)
    projects = list((await db.execute(p_stmt)).scalars().all())

    total = len(projects)
    healthy = sum(1 for p in projects if p.health_score >= 80 and p.ci_status != "FAILED")
    needs_attention = sum(1 for p in projects if 60 <= p.health_score < 80 and p.ci_status != "FAILED")
    critical = sum(1 for p in projects if p.health_score < 60 or p.ci_status == "FAILED" or p.security_status == "CRITICAL")
    build_failures = sum(1 for p in projects if p.ci_status == "FAILED")
    high_risk = sum(1 for p in projects if p.risk_level in ("HIGH", "CRITICAL"))

    overall_health = round(sum(p.health_score for p in projects) / total) if total > 0 else 100

    # Fetch recent analyses across all projects
    a_stmt = select(GitHubAnalysis).where(GitHubAnalysis.account_id == account.id).order_by(GitHubAnalysis.created_at.desc()).limit(10)
    analyses = list((await db.execute(a_stmt)).scalars().all())

    return {
        "connected": True,
        "account": _account_dict(account, total),
        "metrics": {
            "totalProjects": total,
            "healthyProjects": healthy,
            "needsAttention": needs_attention,
            "criticalProjects": critical,
            "buildFailures": build_failures,
            "highRiskFindings": high_risk,
            "overallHealth": overall_health,
        },
        "recentAnalyses": [_analysis_dict(a) for a in analyses],
    }


@router.get("/projects")
async def list_projects(
    category: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None),
    language: Optional[str] = Query(default=None),
    limit: int = Query(default=100, le=300),
    db: AsyncSession = Depends(get_db)
):
    """List accessible projects with optional category filter, search, and sorting."""
    acc_stmt = select(GitHubAccount).where(GitHubAccount.connected_status == "connected").order_by(GitHubAccount.id.desc())
    account = (await db.execute(acc_stmt)).scalar_one_or_none()
    if not account:
        return []

    query = select(GitHubProject).where(GitHubProject.github_account_id == account.id)

    if category and category != "all":
        query = query.where(GitHubProject.category == category)
    if language and language != "all":
        query = query.where(GitHubProject.language == language)
    if search:
        s = f"%{search.strip().lower()}%"
        query = query.where(func.lower(GitHubProject.name).like(s) | func.lower(GitHubProject.description).like(s))

    query = query.order_by(desc(GitHubProject.last_analyzed_at), desc(GitHubProject.updated_at)).limit(limit)
    projects = list((await db.execute(query)).scalars().all())
    return [_project_dict(p) for p in projects]


@router.get("/projects/{project_id}")
async def get_project_detail(project_id: int, db: AsyncSession = Depends(get_db)):
    """Get project details and recent engineering analysis history."""
    stmt = select(GitHubProject).where(GitHubProject.id == project_id)
    project = (await db.execute(stmt)).scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Fetch analyses
    a_stmt = select(GitHubAnalysis).where(GitHubAnalysis.project_id == project.id).order_by(GitHubAnalysis.created_at.desc()).limit(15)
    analyses = list((await db.execute(a_stmt)).scalars().all())

    return {
        "project": _project_dict(project),
        "analyses": [_analysis_dict(a) for a in analyses],
        "latestAnalysis": _analysis_dict(analyses[0]) if analyses else None,
    }


@router.get("/projects/{project_id}/explanation")
async def get_project_explanation(project_id: int, db: AsyncSession = Depends(get_db)):
    """Fetch or generate comprehensive AI Project Explanation & Architecture Summary."""
    stmt = select(GitHubProject).where(GitHubProject.id == project_id)
    project = (await db.execute(stmt)).scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    acc_stmt = select(GitHubAccount).where(GitHubAccount.id == project.github_account_id)
    account = (await db.execute(acc_stmt)).scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    try:
        explanation = await fetch_project_explanation(
            token=account.access_token,
            owner=project.owner,
            repo=project.name
        )
        return {"success": True, "projectId": project.id, "explanation": explanation}
    except Exception as e:
        logger.error("Failed to generate project explanation for %s: %s", project.full_name, e)
        raise HTTPException(status_code=500, detail=f"Failed to generate project explanation: {e}")


@router.patch("/projects/{project_id}/monitoring")
async def toggle_project_monitoring(project_id: int, body: MonitoringToggleRequest, db: AsyncSession = Depends(get_db)):
    """Enable or disable autonomous engineering monitoring for a specific project."""
    stmt = select(GitHubProject).where(GitHubProject.id == project_id)
    project = (await db.execute(stmt)).scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    project.monitoring_enabled = body.monitoring_enabled
    project.updated_at = datetime.now(timezone.utc)
    await db.commit()
    return {"success": True, "projectId": project.id, "monitoringEnabled": project.monitoring_enabled}


# ── Manual & Automated Analysis Execution ───────────────────────────────────

async def execute_engineering_analysis(
    project_id: int,
    commit_sha: Optional[str] = None,
    branch: Optional[str] = None,
    event_type: str = "manual"
) -> dict[str, Any]:
    """
    Core pipeline: fetch commit -> fetch CI telemetry -> AI engineering analysis
    -> calculate deterministic health -> generate enterprise report -> record execution.
    """
    async with AsyncSessionLocal() as session:
        p_stmt = select(GitHubProject).where(GitHubProject.id == project_id)
        project = (await session.execute(p_stmt)).scalar_one_or_none()
        if not project:
            raise ValueError(f"Project {project_id} not found.")

        acc_stmt = select(GitHubAccount).where(GitHubAccount.id == project.github_account_id)
        account = (await session.execute(acc_stmt)).scalar_one_or_none()
        if not account:
            raise ValueError("Associated GitHub account not found.")

        token = account.access_token

        # 1. Fetch commit details and diff
        commit_data = await fetch_commit_details(
            token=token,
            owner=project.owner,
            repo=project.name,
            commit_sha=commit_sha,
            branch=branch or project.default_branch
        )

        # 2. Fetch CI / workflow runs telemetry
        ci_data = await fetch_ci_status(
            token=token,
            owner=project.owner,
            repo=project.name,
            commit_sha=commit_data["sha"]
        )

        # 3. AI Engineering Analysis
        repo_meta = {
            "name": project.name,
            "full_name": project.full_name,
            "language": project.language,
            "default_branch": project.default_branch,
            "open_issues_count": project.open_issues_count,
        }
        analysis_result = await analyze_project_change(repo_meta, commit_data, ci_data)

        # 4. Generate Formal Enterprise Markdown Report
        enterprise_report = generate_enterprise_report(
            repo_meta=repo_meta,
            commit_data=commit_data,
            analysis=analysis_result
        )

        # 5. Link AgentCraft Workflow Execution Record
        execution_id = await link_agentcraft_workflow_execution(
            db=session,
            repo_full_name=project.full_name,
            commit_sha=commit_data["sha"],
            health_score=analysis_result["health_score"],
            report=enterprise_report
        )

        # 6. Save Analysis Record
        now = datetime.now(timezone.utc)
        record = GitHubAnalysis(
            project_id=project.id,
            account_id=account.id,
            commit_sha=commit_data["sha"],
            commit_short_sha=commit_data["short_sha"],
            branch=branch or project.default_branch,
            author_name=commit_data["author_name"],
            author_avatar=commit_data["author_avatar"],
            commit_message=commit_data["message"],
            event_type=event_type,
            status="completed",
            health_score=analysis_result["health_score"],
            build_status=analysis_result["build_status"],
            test_status=analysis_result["test_status"],
            security_status=analysis_result["security_status"],
            risk_level=analysis_result["risk_level"],
            issues_count=analysis_result["issues_count"],
            what_changed=analysis_result["what_changed"],
            why_changed=analysis_result["why_changed"],
            affected_components=json.dumps(analysis_result.get("affected_components", [])),
            potential_bugs=json.dumps(analysis_result.get("potential_bugs", [])),
            security_findings=json.dumps(analysis_result.get("security_findings", [])),
            root_cause_analysis=analysis_result.get("root_cause_analysis", ""),
            recommendations=json.dumps(analysis_result.get("recommendations", [])),
            engineering_report=enterprise_report,
            changed_files_count=commit_data["total_files"],
            additions=commit_data["additions"],
            deletions=commit_data["deletions"],
            execution_id=execution_id,
            created_at=now,
        )
        session.add(record)

        # 7. Update Project Health & Telemetry
        project.health_score = analysis_result["health_score"]
        project.ci_status = analysis_result["build_status"]
        project.security_status = analysis_result["security_status"]
        project.risk_level = analysis_result["risk_level"]
        project.last_analyzed_at = now
        project.updated_at = now

        await session.commit()
        await session.refresh(record)

        logger.info(
            "✅ Analysis complete for %s @ %s -> Health: %d/100, CI: %s",
            project.full_name, commit_data["short_sha"], record.health_score, record.build_status
        )
        return _analysis_dict(record)


@router.post("/projects/{project_id}/analyze")
async def trigger_manual_analysis(
    project_id: int,
    body: TriggerAnalysisRequest = TriggerAnalysisRequest(),
    db: AsyncSession = Depends(get_db)
):
    """Trigger an on-demand deep engineering analysis on a project commit or branch."""
    stmt = select(GitHubProject).where(GitHubProject.id == project_id)
    project = (await db.execute(stmt)).scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    try:
        result = await execute_engineering_analysis(
            project_id=project.id,
            commit_sha=body.commit_sha,
            branch=body.branch,
            event_type="manual"
        )
        return {"success": True, "analysis": result}
    except Exception as e:
        logger.error("Analysis execution failed for project %d: %s", project_id, e)
        raise HTTPException(status_code=500, detail=f"Engineering analysis failed: {e}")


@router.get("/analyses/{analysis_id}")
async def get_analysis(analysis_id: int, db: AsyncSession = Depends(get_db)):
    """Retrieve full engineering analysis report by ID."""
    stmt = select(GitHubAnalysis).where(GitHubAnalysis.id == analysis_id)
    analysis = (await db.execute(stmt)).scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis report not found")
    return _analysis_dict(analysis)


# ── GitHub Webhook Receiver ──────────────────────────────────────────────────

@router.post("/webhook")
async def receive_github_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    x_github_event: Optional[str] = Header(None, alias="X-GitHub-Event"),
    x_hub_signature_256: Optional[str] = Header(None, alias="X-Hub-Signature-256"),
    db: AsyncSession = Depends(get_db)
):
    """
    Fast webhook receiver. Validates signature, acknowledges immediately in <50ms
    to prevent GitHub timeout, and dispatches engineering analysis in the background.
    """
    body_bytes = await request.body()

    # Find connected account
    acc_stmt = select(GitHubAccount).where(GitHubAccount.connected_status == "connected").order_by(GitHubAccount.id.desc())
    account = (await db.execute(acc_stmt)).scalar_one_or_none()
    if not account:
        logger.warning("GitHub webhook received but no active connected account exists.")
        return {"status": "ignored", "reason": "no_active_account"}

    # Verify signature if secret configured
    if account.webhook_secret:
        if not verify_webhook_signature(body_bytes, x_hub_signature_256, account.webhook_secret):
            logger.warning("Invalid webhook signature for account %s", account.username)
            raise HTTPException(status_code=401, detail="Invalid webhook signature")

    event = x_github_event or "push"
    logger.info("GitHub Webhook event received: %s", event)

    if event == "ping":
        return {"status": "pong"}

    try:
        payload = json.loads(body_bytes.decode("utf-8"))
    except Exception:
        raise HTTPException(status_code=400, detail="Malformed JSON payload")

    # Extract repository information
    repo_obj = payload.get("repository") or {}
    full_name = repo_obj.get("full_name")
    if not full_name:
        return {"status": "ignored", "reason": "missing_repository"}

    # Find project in database
    p_stmt = select(GitHubProject).where(
        GitHubProject.github_account_id == account.id,
        func.lower(GitHubProject.full_name) == full_name.lower()
    )
    project = (await db.execute(p_stmt)).scalar_one_or_none()
    if not project:
        logger.info("Repository %s not monitored by connected account %s", full_name, account.username)
        return {"status": "ignored", "reason": "project_not_registered"}

    if not account.monitoring_enabled or not project.monitoring_enabled:
        return {"status": "ignored", "reason": "monitoring_disabled"}

    # Primary event: PUSH
    if event == "push":
        head_commit = payload.get("head_commit") or {}
        commit_sha = head_commit.get("id") or payload.get("after")
        ref = payload.get("ref") or "refs/heads/main"
        branch = ref.split("/")[-1]

        if not commit_sha or commit_sha == "0000000000000000000000000000000000000000":
            return {"status": "ignored", "reason": "branch_deleted_or_empty_commit"}

        # Idempotency check: check if this commit was already analyzed recently
        recent_stmt = select(GitHubAnalysis).where(
            GitHubAnalysis.project_id == project.id,
            GitHubAnalysis.commit_sha == commit_sha
        )
        existing_analysis = (await db.execute(recent_stmt)).scalar_one_or_none()
        if existing_analysis:
            logger.info("Commit %s on %s already analyzed. Skipping duplicate.", commit_sha[:7], full_name)
            return {"status": "skipped", "reason": "idempotent_duplicate"}

        # Enqueue background analysis
        background_tasks.add_task(
            execute_engineering_analysis,
            project_id=project.id,
            commit_sha=commit_sha,
            branch=branch,
            event_type="push"
        )
        return {
            "status": "accepted",
            "message": f"Push event accepted for {full_name} @ {commit_sha[:7]}. Analysis dispatched.",
        }

    # Workflow run / CI event
    elif event == "workflow_run":
        wf_run = payload.get("workflow_run") or {}
        commit_sha = wf_run.get("head_sha")
        branch = wf_run.get("head_branch") or "main"

        if commit_sha:
            background_tasks.add_task(
                execute_engineering_analysis,
                project_id=project.id,
                commit_sha=commit_sha,
                branch=branch,
                event_type="workflow_run"
            )
            return {"status": "accepted", "message": "Workflow run update enqueued for analysis."}

    return {"status": "ignored", "reason": f"unhandled_event_{event}"}
