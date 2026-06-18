"""
Flush all workflows and executions (workflow library reset).

Uses the running API when AGENTCRAFT_API is set (default http://127.0.0.1:8000),
otherwise connects to the database directly.
"""
import os
import sys
import asyncio
import json
import urllib.request

sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

API_BASE = os.environ.get("AGENTCRAFT_API", "http://127.0.0.1:8000")


def flush_via_api() -> bool:
    """Flush through local FastAPI. Returns True on success."""
    req = urllib.request.Request(
        f"{API_BASE}/api/workflows",
        method="DELETE",
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            data = json.loads(resp.read().decode())
            print(
                f"Deleted {data.get('deletedExecutions', 0)} execution(s) "
                f"and {data.get('deletedWorkflows', 0)} workflow(s) via API."
            )
            return True
    except Exception as exc:
        print(f"API flush failed ({exc}). Trying direct database...")
        return False


async def flush_via_db():
    from backend.database import init_db, close_db, AsyncSessionLocal
    from backend.repository import WorkflowRepository, ExecutionRepository
    from backend.scheduler import remove_workflow_schedule

    print("Connecting to database...")
    await init_db()

    async with AsyncSessionLocal() as db:
        workflows = await WorkflowRepository.list_all(db)
        for wf in workflows:
            remove_workflow_schedule(wf.id)
        exec_count = await ExecutionRepository.delete_all(db)
        wf_count = await WorkflowRepository.delete_all(db)
        await db.commit()
        print(f"Deleted {exec_count} execution(s) and {wf_count} workflow(s).")

    await close_db()


async def main():
    if flush_via_api():
        print("Workflow library flushed.")
        return
    await flush_via_db()
    print("Workflow library flushed.")


if __name__ == "__main__":
    asyncio.run(main())
