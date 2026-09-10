"""
Smoke test for GitHub Engineering Agent models and logic using standard SQLite.
"""
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from backend.database import Base, GitHubAccount, GitHubProject, GitHubAnalysis
from backend.github_engine import redact_secrets, verify_webhook_signature, generate_enterprise_report

def test_backend():
    print("1. Testing secret redaction...")
    test_leak = "API key: ghp_123456789012345678901234567890123456 and AWS AKIA1234567890123456 and sk-1234567890123456789012345678901234"
    sanitized = redact_secrets(test_leak)
    assert "ghp_" not in sanitized, "GitHub token not redacted!"
    assert "AKIA" not in sanitized, "AWS key not redacted!"
    assert "sk-" not in sanitized, "OpenAI key not redacted!"
    print("   Secret redaction verified: OK")

    print("2. Testing webhook signature verification...")
    body = b'{"action":"push"}'
    secret = "test_secret_123"
    import hmac, hashlib
    valid_sig = "sha256=" + hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()
    assert verify_webhook_signature(body, valid_sig, secret) is True
    assert verify_webhook_signature(body, "sha256=wrong", secret) is False
    print("   Webhook HMAC signature verification verified: OK")

    print("3. Testing report generation formatting...")
    repo_meta = {"full_name": "Aakash-M-z/AgentCraft", "default_branch": "main"}
    commit_data = {"sha": "abc1234567890123", "short_sha": "abc1234", "author_name": "Aakash", "message": "feat: autonomous github agent"}
    analysis = {
        "health_score": 94,
        "risk_level": "LOW",
        "build_status": "PASS",
        "test_status": "PASS",
        "security_status": "PASS",
        "what_changed": "Implemented GitHub Engineering Agent",
        "why_changed": "Enable autonomous multi-project monitoring",
        "affected_components": ["backend/github_api.py", "src/pages/github-agent.tsx"],
        "potential_bugs": [],
        "security_findings": [],
        "recommendations": ["Ensure webhook listener is reachable via public HTTPS tunnel"],
    }
    rep = generate_enterprise_report(repo_meta, commit_data, analysis, execution_id=101)
    assert "ENGINEERING ANALYSIS REPORT" in rep
    assert "Aakash-M-z/AgentCraft" in rep
    assert "94 / 100" in rep
    assert "PASS" in rep
    print("   Enterprise Engineering Report generation verified: OK")

    print("4. Testing SQLite table schema generation and CRUD for GitHub models...")
    sync_engine = create_engine("sqlite:///:memory:", echo=False)
    Base.metadata.create_all(sync_engine)
    print("   All database tables created successfully.")

    with Session(sync_engine) as session:
        # Create GitHub account
        acc = GitHubAccount(
            github_user_id="123456",
            username="Aakash-M-z",
            name="Aakash",
            avatar_url="https://github.com/Aakash-M-z.png",
            account_type="User",
            access_token="test_token",
            connected_status="connected",
            monitoring_enabled=True,
        )
        session.add(acc)
        session.commit()
        session.refresh(acc)
        assert acc.id is not None
        print(f"   Created GitHubAccount: @{acc.username} (id={acc.id})")

        # Create GitHub project
        project = GitHubProject(
            github_account_id=acc.id,
            repo_id="987654",
            name="AgentCraft",
            full_name="Aakash-M-z/AgentCraft",
            owner="Aakash-M-z",
            description="Agentic AI Workflow Automation Engine",
            default_branch="main",
            language="TypeScript",
            health_score=94,
            ci_status="PASS",
            security_status="PASS",
            risk_level="LOW",
        )
        session.add(project)
        session.commit()
        session.refresh(project)
        assert project.id is not None
        print(f"   Created GitHubProject: {project.full_name} (id={project.id})")

        # Create GitHub analysis
        analysis_rec = GitHubAnalysis(
            project_id=project.id,
            account_id=acc.id,
            commit_sha="abc1234567890123",
            commit_short_sha="abc1234",
            branch="main",
            author_name="Aakash",
            commit_message="feat: autonomous github agent",
            event_type="push",
            status="completed",
            health_score=94,
            build_status="PASS",
            test_status="PASS",
            security_status="PASS",
            risk_level="LOW",
            what_changed="Added GitHub Agent",
            engineering_report=rep,
        )
        session.add(analysis_rec)
        session.commit()
        session.refresh(analysis_rec)
        assert analysis_rec.id is not None
        print(f"   Created GitHubAnalysis record: (id={analysis_rec.id})")

        # Query back
        res = session.execute(select(GitHubProject).where(GitHubProject.github_account_id == acc.id))
        all_projects = list(res.scalars().all())
        assert len(all_projects) == 1
        assert all_projects[0].name == "AgentCraft"
        print("   Verified relational queries and cascades: OK")

    print("\nALL VERIFICATIONS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    test_backend()
