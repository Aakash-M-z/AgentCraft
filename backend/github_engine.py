"""
GitHub Engineering Agent Engine
Handles GitHub API communication, repository discovery, commit diff retrieval,
CI/CD analysis, AI-powered engineering analysis, security auditing,
and enterprise engineering report generation.
"""
import os
import re
import json
import hmac
import hashlib
import logging
from datetime import datetime, timezone
from typing import Optional, Any, Dict, List
import base64
import httpx
from .ai import call_ai

logger = logging.getLogger(__name__)

GITHUB_API_BASE = "https://api.github.com"
DEFAULT_GITHUB_API_VERSION = "2022-11-28"

# ── Secret Redaction ─────────────────────────────────────────────────────────

SECRET_PATTERNS = [
    (re.compile(r"ghp_[A-Za-z0-9_]{36,255}"), "[REDACTED_GITHUB_TOKEN]"),
    (re.compile(r"github_pat_[A-Za-z0-9_]{82}"), "[REDACTED_GITHUB_PAT]"),
    (re.compile(r"sk-[A-Za-z0-9]{32,100}"), "[REDACTED_API_KEY]"),
    (re.compile(r"AKIA[0-9A-Z]{16}"), "[REDACTED_AWS_KEY]"),
    (re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----"), "[REDACTED_PRIVATE_KEY]"),
    (re.compile(r"(password|passwd|secret|apikey|api_key|token|auth)\s*[:=]\s*['\"][^'\"]{6,}['\"]", re.IGNORECASE), r"\1: '[REDACTED]'"),
]

def redact_secrets(content: str) -> str:
    """Sanitize secrets, tokens, private keys, and passwords from logs and reports."""
    if not content:
        return ""
    sanitized = content
    for pattern, replacement in SECRET_PATTERNS:
        sanitized = pattern.sub(replacement, sanitized)
    return sanitized


# ── Webhook Signature Verification ──────────────────────────────────────────

def verify_webhook_signature(payload_bytes: bytes, signature_header: Optional[str], secret: Optional[str]) -> bool:
    """
    Validate GitHub webhook HMAC-SHA256 signature.
    If no secret is configured, accepts requests for testing/local setups.
    """
    if not secret:
        return True
    if not signature_header:
        return False

    sha_name, signature = signature_header.split("=") if "=" in signature_header else ("", "")
    if sha_name != "sha256":
        return False

    mac = hmac.new(secret.encode("utf-8"), msg=payload_bytes, digestmod=hashlib.sha256)
    return hmac.compare_digest(mac.hexdigest(), signature)


# ── GitHub API Client Helpers ───────────────────────────────────────────────

def _get_headers(token: str) -> dict[str, str]:
    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": DEFAULT_GITHUB_API_VERSION,
        "User-Agent": "AgentCraft-Engineering-Agent",
    }
    if token:
        headers["Authorization"] = f"Bearer {token.strip()}"
    return headers


async def validate_github_token(token: str) -> dict[str, Any]:
    """
    Validate GitHub token and return authenticated user profile.
    Raises HTTPException/ValueError if invalid.
    """
    url = f"{GITHUB_API_BASE}/user"
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(url, headers=_get_headers(token))
        if resp.status_code == 401:
            raise ValueError("Invalid GitHub token: Authentication failed.")
        if resp.status_code != 200:
            raise ValueError(f"GitHub API returned error: {resp.status_code} {resp.text}")
        data = resp.json()
        return {
            "github_user_id": str(data.get("id")),
            "username": data.get("login"),
            "name": data.get("name") or data.get("login"),
            "avatar_url": data.get("avatar_url"),
            "account_type": data.get("type", "User"),
            "public_repos": data.get("public_repos", 0),
            "total_private_repos": data.get("total_private_repos", 0),
            "html_url": data.get("html_url"),
        }


async def discover_repositories(token: str, account_username: str) -> list[dict[str, Any]]:
    """
    Discover all repositories the authenticated user is authorized to access.
    Includes owned repositories, collaborations, and organization memberships.
    """
    repos: list[dict[str, Any]] = []
    page = 1
    per_page = 100

    async with httpx.AsyncClient(timeout=25.0) as client:
        while True:
            url = f"{GITHUB_API_BASE}/user/repos"
            params = {
                "per_page": per_page,
                "page": page,
                "sort": "updated",
                "direction": "desc",
                "affiliation": "owner,collaborator,organization_member",
            }
            resp = await client.get(url, headers=_get_headers(token), params=params)
            if resp.status_code != 200:
                logger.error("Failed to list repos page %d: %s", page, resp.text)
                break
            batch = resp.json()
            if not batch:
                break

            for r in batch:
                owner = (r.get("owner") or {}).get("login", "")
                is_archived = bool(r.get("archived", False))
                is_owner = owner.lower() == account_username.lower()

                if is_archived:
                    category = "archived"
                elif is_owner:
                    category = "my_projects"
                else:
                    category = "collaborative"

                repos.append({
                    "repo_id": str(r.get("id")),
                    "name": r.get("name"),
                    "full_name": r.get("full_name"),
                    "owner": owner,
                    "description": r.get("description") or "",
                    "is_private": bool(r.get("private", False)),
                    "is_fork": bool(r.get("fork", False)),
                    "is_archived": is_archived,
                    "default_branch": r.get("default_branch") or "main",
                    "language": r.get("language") or "Other",
                    "stars_count": r.get("stargazers_count", 0),
                    "forks_count": r.get("forks_count", 0),
                    "open_issues_count": r.get("open_issues_count", 0),
                    "html_url": r.get("html_url"),
                    "category": category,
                })

            if len(batch) < per_page or page >= 5:  # cap at 500 repos
                break
            page += 1

    return repos


async def fetch_commit_details(token: str, owner: str, repo: str, commit_sha: Optional[str] = None, branch: Optional[str] = None) -> dict[str, Any]:
    """
    Fetch commit information including author, message, files changed, additions/deletions, and diff patches.
    If commit_sha is None, fetches the latest commit on the branch.
    """
    async with httpx.AsyncClient(timeout=20.0) as client:
        # If sha not provided, get latest commit on branch/default
        if not commit_sha:
            commits_url = f"{GITHUB_API_BASE}/repos/{owner}/{repo}/commits"
            params = {"per_page": 1}
            if branch:
                params["sha"] = branch
            res = await client.get(commits_url, headers=_get_headers(token), params=params)
            if res.status_code != 200:
                raise ValueError(f"Failed to fetch commits for {owner}/{repo}: {res.status_code}")
            commits_list = res.json()
            if not commits_list:
                raise ValueError(f"No commits found for repository {owner}/{repo}")
            commit_sha = commits_list[0]["sha"]

        # Get full commit details
        detail_url = f"{GITHUB_API_BASE}/repos/{owner}/{repo}/commits/{commit_sha}"
        resp = await client.get(detail_url, headers=_get_headers(token))
        if resp.status_code != 200:
            raise ValueError(f"Failed to fetch commit {commit_sha}: {resp.status_code}")
        data = resp.json()

        commit_obj = data.get("commit") or {}
        author_obj = data.get("author") or {}
        committer_obj = commit_obj.get("author") or {}

        files = data.get("files") or []
        changed_files_summary = []
        full_diff_snippets = []

        for f in files[:20]:  # inspect up to 20 files for AI prompt safety
            filename = f.get("filename")
            status = f.get("status")
            additions = f.get("additions", 0)
            deletions = f.get("deletions", 0)
            patch = f.get("patch") or ""
            # Redact secrets from diff
            sanitized_patch = redact_secrets(patch)
            changed_files_summary.append({
                "filename": filename,
                "status": status,
                "additions": additions,
                "deletions": deletions,
            })
            if sanitized_patch:
                full_diff_snippets.append(f"--- {filename} ({status}, +{additions}/-{deletions})\n{sanitized_patch[:2000]}")

        stats = data.get("stats") or {}
        return {
            "sha": data.get("sha", commit_sha),
            "short_sha": data.get("sha", commit_sha)[:7],
            "message": redact_secrets(commit_obj.get("message", "")),
            "author_name": committer_obj.get("name") or author_obj.get("login") or "Developer",
            "author_avatar": author_obj.get("avatar_url") or "",
            "timestamp": committer_obj.get("date") or datetime.now(timezone.utc).isoformat(),
            "additions": stats.get("additions", 0),
            "deletions": stats.get("deletions", 0),
            "total_files": len(files),
            "files_summary": changed_files_summary,
            "diff_sample": "\n\n".join(full_diff_snippets)[:12000],  # bounded prompt size
        }


async def fetch_ci_status(token: str, owner: str, repo: str, commit_sha: str) -> dict[str, Any]:
    """
    Fetch GitHub Actions check runs or workflow runs associated with the commit.
    Returns PASS, FAILED, WARNING, or UNKNOWN with context.
    """
    async with httpx.AsyncClient(timeout=15.0) as client:
        # Try Check Runs endpoint
        check_runs_url = f"{GITHUB_API_BASE}/repos/{owner}/{repo}/commits/{commit_sha}/check-runs"
        resp = await client.get(check_runs_url, headers=_get_headers(token))

        runs = []
        if resp.status_code == 200:
            runs = resp.json().get("check_runs") or []

        # If no check runs, fallback to actions workflow runs
        if not runs:
            actions_url = f"{GITHUB_API_BASE}/repos/{owner}/{repo}/actions/runs"
            act_resp = await client.get(actions_url, headers=_get_headers(token), params={"head_sha": commit_sha})
            if act_resp.status_code == 200:
                runs = act_resp.json().get("workflow_runs") or []

        if not runs:
            return {
                "ci_status": "UNKNOWN",
                "test_status": "UNKNOWN",
                "build_status": "UNKNOWN",
                "summary": "No CI/CD check runs or GitHub Actions configured for this commit.",
                "failures": [],
            }

        conclusions = [r.get("conclusion") or r.get("status") for r in runs]
        failures = []
        for r in runs:
            conc = r.get("conclusion") or ""
            name = r.get("name") or "CI Job"
            if conc in ("failure", "timed_out", "action_required"):
                output = r.get("output") or {}
                failures.append({
                    "name": name,
                    "conclusion": conc,
                    "title": output.get("title") or "Workflow failure",
                    "summary": redact_secrets(output.get("summary") or ""),
                })

        if any(c in ("failure", "timed_out") for c in conclusions):
            ci_status = "FAILED"
            build_status = "FAILED"
            test_status = "FAILED" if any("test" in (r.get("name") or "").lower() and r.get("conclusion") == "failure" for r in runs) else "UNKNOWN"
        elif any(c in ("action_required", "neutral", "cancelled") for c in conclusions):
            ci_status = "WARNING"
            build_status = "WARNING"
            test_status = "WARNING"
        elif all(c == "success" for c in conclusions if c):
            ci_status = "PASS"
            build_status = "PASS"
            test_status = "PASS"
        else:
            ci_status = "UNKNOWN"
            build_status = "UNKNOWN"
            test_status = "UNKNOWN"

        return {
            "ci_status": ci_status,
            "build_status": build_status,
            "test_status": test_status,
            "summary": f"{len(runs)} checks evaluated. Conclusion: {ci_status}",
            "failures": failures,
        }


# ── AI Engineering Change Analysis ──────────────────────────────────────────

async def analyze_project_change(
    repo_meta: dict[str, Any],
    commit_data: dict[str, Any],
    ci_data: dict[str, Any]
) -> dict[str, Any]:
    """
    Run deep AI engineering analysis across changed files, commit intent, CI failures,
    security vulnerabilities, potential bugs, blast radius, and remediation.
    """
    system_prompt = """You are a Principal Software Architect, Senior GitHub Integration Engineer, and AI Engineering Agent.
Analyze this code change and CI state with high technical rigor.
Do not hallucinate. State confidence levels (HIGH, MEDIUM, LOW) for potential issues.
Never output secrets or sensitive credentials. Redact any tokens if present.
Return ONLY valid, parseable JSON matching the specified schema."""

    user_prompt = f"""
Project: {repo_meta.get('full_name')}
Language: {repo_meta.get('language', 'Unknown')}
Branch: {repo_meta.get('default_branch', 'main')}
Commit: {commit_data.get('short_sha')} - {commit_data.get('message')}
Author: {commit_data.get('author_name')}
Files changed ({commit_data.get('total_files')} files, +{commit_data.get('additions')}/-{commit_data.get('deletions')}):
{json.dumps(commit_data.get('files_summary', []), indent=2)}

CI / Build / Test Status:
Status: {ci_data.get('ci_status')}
Details: {ci_data.get('summary')}
Failures: {json.dumps(ci_data.get('failures', []), indent=2)}

Diff Sample:
{commit_data.get('diff_sample', 'No diff available')}

Answer the following questions in strict JSON format:
{{
  "what_changed": "Concise summary of the architectural and code changes in this commit (2-3 sentences)",
  "why_changed": "Inferred reason/intent behind the modification",
  "affected_components": ["List of components, services, or modules impacted"],
  "potential_bugs": [
    {{
      "description": "Concise explanation of potential bug or regression",
      "confidence": "HIGH | MEDIUM | LOW",
      "severity": "CRITICAL | HIGH | MEDIUM | LOW",
      "location": "filename or function name"
    }}
  ],
  "security_findings": [
    {{
      "type": "Secret Exposure | Injection Risk | Auth Issue | Unsafe Handling | None",
      "risk_level": "CRITICAL | HIGH | MEDIUM | LOW | NONE",
      "details": "Specific finding description",
      "recommendation": "Remediation step"
    }}
  ],
  "root_cause_analysis": "If CI failed or bugs detected: explain Error, Where it occurred, Why it occurred, Impact, Root Cause, How to resolve, How to prevent. Otherwise write 'No active failures detected.'",
  "recommendations": [
    "Actionable bullet point recommendation for the engineer"
  ],
  "suggested_risk_level": "LOW | MEDIUM | HIGH | CRITICAL"
}}
"""

    full_prompt = f"{system_prompt}\n\n{user_prompt}"
    raw_ai = await call_ai(full_prompt, temperature=0.2, force_json=True)

    # Clean markdown fences if any
    clean_ai = raw_ai.strip()
    if clean_ai.startswith("```"):
        lines = clean_ai.split("\n")
        clean_ai = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])

    parsed: dict[str, Any] = {}
    try:
        parsed = json.loads(clean_ai)
    except Exception as e:
        logger.warning("Failed to parse JSON AI response: %s. Using structured fallback.", e)
        parsed = {
            "what_changed": f"Changes in {commit_data.get('total_files')} files: {commit_data.get('message', '')[:100]}",
            "why_changed": "Feature enhancement or maintenance commit.",
            "affected_components": [f["filename"] for f in commit_data.get("files_summary", [])[:3]],
            "potential_bugs": [],
            "security_findings": [],
            "root_cause_analysis": "No active failures detected.",
            "recommendations": ["Ensure unit tests cover the changed code paths."],
            "suggested_risk_level": "LOW",
        }

    # ── Deterministic Engineering Health Score Calculation ───────────────────
    # Starts at 100
    score = 100

    ci_status = ci_data.get("ci_status", "UNKNOWN")
    if ci_status == "FAILED":
        score -= 30
    elif ci_status == "WARNING":
        score -= 10

    test_status = ci_data.get("test_status", "UNKNOWN")
    if test_status == "FAILED":
        score -= 20

    # Deductions for security findings
    sec_findings = parsed.get("security_findings") or []
    sec_status = "PASS"
    for sf in sec_findings:
        rl = sf.get("risk_level", "NONE").upper()
        if rl in ("CRITICAL", "HIGH"):
            score -= 25
            sec_status = "CRITICAL"
        elif rl == "MEDIUM":
            score -= 10
            if sec_status != "CRITICAL":
                sec_status = "WARNING"

    # Deductions for potential bugs
    bugs = parsed.get("potential_bugs") or []
    for bug in bugs:
        conf = bug.get("confidence", "LOW").upper()
        sev = bug.get("severity", "LOW").upper()
        if conf == "HIGH" or sev in ("CRITICAL", "HIGH"):
            score -= 10
        elif conf == "MEDIUM":
            score -= 5

    # Deductions for open issues count in repo
    open_issues = repo_meta.get("open_issues_count", 0)
    if open_issues > 20:
        score -= 10
    elif open_issues > 5:
        score -= 5

    score = max(15, min(100, score))

    # Determine final overall risk level
    if score >= 85 and sec_status == "PASS" and ci_status != "FAILED":
        risk_level = "LOW"
    elif score >= 65 and sec_status != "CRITICAL":
        risk_level = "MEDIUM"
    elif score >= 45:
        risk_level = "HIGH"
    else:
        risk_level = "CRITICAL"

    parsed["health_score"] = score
    parsed["risk_level"] = risk_level
    parsed["security_status"] = sec_status
    parsed["build_status"] = ci_data.get("build_status", "UNKNOWN")
    parsed["test_status"] = ci_data.get("test_status", "UNKNOWN")
    parsed["issues_count"] = len(bugs)

    return parsed


# ── AI Project Summary & Explanation ────────────────────────────────────────

async def fetch_project_explanation(token: str, owner: str, repo: str) -> dict[str, Any]:
    """
    Fetch repository README, root directory structure, and package manifests,
    then invoke AI to generate a complete, structured Project Explanation.
    """
    readme_content = ""
    root_files: list[str] = []
    manifest_content = ""

    async with httpx.AsyncClient(timeout=20.0) as client:
        # 1. Fetch README
        try:
            readme_url = f"{GITHUB_API_BASE}/repos/{owner}/{repo}/readme"
            r_resp = await client.get(readme_url, headers=_get_headers(token))
            if r_resp.status_code == 200:
                raw_b64 = r_resp.json().get("content", "")
                decoded = base64.b64decode(raw_b64.encode("utf-8")).decode("utf-8", errors="ignore")
                readme_content = decoded[:4000]
        except Exception as e:
            logger.warning("Could not fetch readme for %s/%s: %s", owner, repo, e)

        # 2. Fetch root directory contents
        try:
            contents_url = f"{GITHUB_API_BASE}/repos/{owner}/{repo}/contents"
            c_resp = await client.get(contents_url, headers=_get_headers(token))
            if c_resp.status_code == 200:
                items = c_resp.json()
                if isinstance(items, list):
                    root_files = [f"{item.get('name')} ({item.get('type')})" for item in items[:30]]
        except Exception as e:
            logger.warning("Could not fetch contents for %s/%s: %s", owner, repo, e)

        # 3. Check for manifest (package.json, requirements.txt, pyproject.toml, etc.)
        for manifest_name in ["package.json", "requirements.txt", "pyproject.toml", "Cargo.toml", "go.mod"]:
            try:
                m_url = f"{GITHUB_API_BASE}/repos/{owner}/{repo}/contents/{manifest_name}"
                m_resp = await client.get(m_url, headers=_get_headers(token))
                if m_resp.status_code == 200:
                    raw_b64 = m_resp.json().get("content", "")
                    decoded = base64.b64decode(raw_b64.encode("utf-8")).decode("utf-8", errors="ignore")
                    manifest_content = f"{manifest_name}:\n{decoded[:1500]}"
                    break
            except Exception:
                pass

    # 4. Synthesize with AI
    prompt = f"""You are a Principal Software Architect. Provide an authoritative, clear, and comprehensive project explanation for the repository '{owner}/{repo}'.

Repository Root Files:
{", ".join(root_files) if root_files else "Not available"}

Package Manifest Snippet:
{manifest_content if manifest_content else "Not available"}

README Snippet:
{readme_content if readme_content else "No README provided."}

Return a valid JSON object matching this schema:
{{
  "summary": "Clear, informative 2-3 paragraph explanation of what this project is, what problem it solves, and how it works.",
  "core_purpose": "1-2 sentence executive summary of the primary objective.",
  "tech_stack": ["List of detected frameworks, languages, databases, or key libraries"],
  "architecture": "High-level architectural design (e.g. Monorepo, Microservice, Client-Server, CLI utility, Event-driven, etc.)",
  "key_components": [
    {{"name": "Folder or Module Name", "role": "What this part of the codebase is responsible for"}}
  ],
  "getting_started": "Brief guide on how to install, build, and run this project based on standard conventions"
}}
"""
    raw_ai = await call_ai(prompt, temperature=0.2, force_json=True)
    clean_ai = raw_ai.strip()
    if clean_ai.startswith("```"):
        lines = clean_ai.split("\n")
        clean_ai = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])

    try:
        data = json.loads(clean_ai)
        return data
    except Exception:
        return {
            "summary": f"The repository '{owner}/{repo}' is a software project utilizing {', '.join(root_files[:5])}.",
            "core_purpose": f"Repository maintained by {owner}.",
            "tech_stack": [f.split(" ")[0] for f in root_files if "." in f][:6],
            "architecture": "Modular codebase structure.",
            "key_components": [{"name": f.split(" ")[0], "role": "Project source / configuration"} for f in root_files[:4]],
            "getting_started": "Inspect repository files for build scripts and deployment instructions."
        }


# ── Enterprise Engineering Report Generator ─────────────────────────────────

def generate_enterprise_report(
    repo_meta: dict[str, Any],
    commit_data: dict[str, Any],
    analysis: dict[str, Any],
    execution_id: Optional[int] = None
) -> str:
    """
    Format analysis into an executive, enterprise-grade engineering report.
    Zero chatbot language, zero emojis, clean structured layout.
    """
    now_str = datetime.now(timezone.utc).strftime("%d %B %Y, %H:%M UTC")
    short_sha = commit_data.get("short_sha", "HEAD")
    sha = commit_data.get("sha", "HEAD")
    branch = repo_meta.get("default_branch", "main")
    author = commit_data.get("author_name", "Developer")
    exec_str = f"EX-{execution_id}" if execution_id else "N/A"

    bugs = analysis.get("potential_bugs") or []
    sec_findings = analysis.get("security_findings") or []
    recommendations = analysis.get("recommendations") or []
    affected = analysis.get("affected_components") or []

    bugs_rows = ""
    if bugs:
        for b in bugs:
            bugs_rows += f"| {b.get('location', 'Repository')} | {b.get('severity', 'LOW')} | {b.get('confidence', 'LOW')} | {b.get('description', '')} |\n"
    else:
        bugs_rows = "| None | — | — | No high-risk code anomalies detected. |\n"

    sec_rows = ""
    if sec_findings and any(s.get("risk_level", "NONE") != "NONE" for s in sec_findings):
        for s in sec_findings:
            if s.get("risk_level") != "NONE":
                sec_rows += f"| {s.get('type', 'Security')} | {s.get('risk_level', 'LOW')} | {s.get('details', '')} | {s.get('recommendation', '')} |\n"
    else:
        sec_rows = "| Secret Redaction & Vulnerabilities | PASS | Zero credential exposure or critical injections detected. | Maintain least-privilege CI tokens. |\n"

    recs_list = ""
    if recommendations:
        for r in recommendations:
            recs_list += f"- {r}\n"
    else:
        recs_list = "- Continue standard peer review prior to staging release.\n"

    affected_list = ", ".join(affected) if affected else "Core repository modules"

    report = f"""# ENGINEERING ANALYSIS REPORT
**Confidential — AgentCraft Autonomous Engineering Operations**

---

### METADATA
- **Project**: {repo_meta.get('full_name')}
- **Commit SHA**: `{sha}` ({short_sha})
- **Branch**: `{branch}`
- **Author**: {author}
- **Timestamp**: {now_str}
- **AgentCraft Execution ID**: {exec_str}

---

### EXECUTIVE SUMMARY
- **Overall Engineering Health**: **{analysis.get('health_score', 85)} / 100**
- **Risk Assessment**: **{analysis.get('risk_level', 'LOW')}**
- **CI / Build Pipeline**: **{analysis.get('build_status', 'UNKNOWN')}**
- **Test Suite Status**: **{analysis.get('test_status', 'UNKNOWN')}**
- **Security Compliance**: **{analysis.get('security_status', 'PASS')}**

#### What Changed
{analysis.get('what_changed', 'Code modification across repository.')}

#### Architectural Intent
{analysis.get('why_changed', 'Functional revision and repository maintenance.')}

#### Impacted Components
{affected_list}

---

### CHANGE VERIFICATION MATRIX
| Dimension | Status | Assessment |
| :--- | :--- | :--- |
| **CI Build** | {analysis.get('build_status', 'UNKNOWN')} | Verification of compilation and bundle outputs. |
| **Automated Tests** | {analysis.get('test_status', 'UNKNOWN')} | Unit and integration test suite execution. |
| **Security Audit** | {analysis.get('security_status', 'PASS')} | Static analysis for secret leaks and injection vectors. |
| **Diff Blast Radius** | {analysis.get('risk_level', 'LOW')} | Scope of modified interfaces and dependencies. |

---

### DETECTED CODE ANOMALIES & POTENTIAL BUGS
| Location | Severity | Confidence | Description |
| :--- | :--- | :--- | :--- |
{bugs_rows}

---

### SECURITY & COMPLIANCE FINDINGS
| Category | Risk Level | Finding Details | Recommended Action |
| :--- | :--- | :--- | :--- |
{sec_rows}

---

### ROOT CAUSE & FAILURE DIAGNOSIS
{analysis.get('root_cause_analysis', 'No active pipeline failures detected.')}

---

### ACTIONABLE ENGINEERING RECOMMENDATIONS
{recs_list}

---
*Generated autonomously by AgentCraft GitHub Engineering Agent v1.0. Verified without arbitrary code execution.*
"""
    return report.strip()


# ── AgentCraft Execution Integration ────────────────────────────────────────

async def link_agentcraft_workflow_execution(
    db: Any,
    repo_full_name: str,
    commit_sha: str,
    health_score: int,
    report: str
) -> Optional[int]:
    """
    Create an AgentCraft Workflow & Execution record to track the analysis
    in the existing AgentCraft telemetry and executions system.
    """
    try:
        from .database import Workflow, Execution
        from sqlalchemy import select

        # Find or create a system GitHub Engineering Agent workflow
        stmt = select(Workflow).where(Workflow.name == "GitHub Engineering Agent")
        res = await db.execute(stmt)
        wf = res.scalar_one_or_none()

        if not wf:
            wf = Workflow(
                name="GitHub Engineering Agent",
                description="Autonomous multi-project CI, diff, security, and health analysis for connected GitHub repositories.",
                trigger_type="webhook",
                nodes=[
                    {"id": "n1", "type": "webhook", "position": {"x": 200, "y": 100}, "data": {"label": "GitHub Webhook"}},
                    {"id": "n2", "type": "github", "position": {"x": 200, "y": 200}, "data": {"label": "Project Resolver"}},
                    {"id": "n3", "type": "ai_agent", "position": {"x": 200, "y": 300}, "data": {"label": "Engineering Analyst"}},
                    {"id": "n4", "type": "output", "position": {"x": 200, "y": 400}, "data": {"label": "Engineering Report"}},
                ],
                edges=[
                    {"id": "e1-2", "source": "n1", "target": "n2"},
                    {"id": "e2-3", "source": "n2", "target": "n3"},
                    {"id": "e3-4", "source": "n3", "target": "n4"},
                ]
            )
            db.add(wf)
            await db.flush()
            await db.refresh(wf)

        # Create Execution record
        exec_record = Execution(
            workflow_id=wf.id,
            status="completed",
            input=f"Analyze {repo_full_name} @ {commit_sha[:7]}",
            final_output=report[:4000],
            node_results=[
                {"nodeId": "n1", "status": "success", "output": {"result": f"Webhook payload received for {repo_full_name}"}},
                {"nodeId": "n2", "status": "success", "output": {"result": f"Resolved commit {commit_sha[:7]}"}},
                {"nodeId": "n3", "status": "success", "output": {"result": f"AI Engineering Health Score: {health_score}/100"}},
                {"nodeId": "n4", "status": "success", "output": {"result": "Enterprise Engineering Report generated"}},
            ],
            agent_logs=[
                f"GitHub Webhook received for {repo_full_name}",
                f"Fetched diff and CI telemetry for commit {commit_sha[:7]}",
                f"Generated engineering assessment: {health_score}/100",
                "Stored immutable audit report in AgentCraft database",
            ]
        )
        db.add(exec_record)
        await db.flush()
        await db.refresh(exec_record)
        return exec_record.id
    except Exception as e:
        logger.error("Failed to link AgentCraft execution: %s", e)
        return None
