"""
Utility script to seed the Neon PostgreSQL database with the
LeetCode Daily Solver workflow and execute it immediately.
"""
import os
import sys
import asyncio

try:
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
except Exception:
    pass

sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

from backend.database import init_db, close_db, AsyncSessionLocal
from backend.repository import WorkflowRepository, ExecutionRepository
from backend.workflow_engine import run_workflow

async def main():
    print("🚀 Initializing database connection...")
    await init_db()

    async with AsyncSessionLocal() as db:
        existing_wfs = await WorkflowRepository.list_all(db)
        existing = next(
            (w for w in existing_wfs if w.name == "LeetCode Daily Solver"),
            None,
        )

        if existing:
            print(f"Workflow 'LeetCode Daily Solver' already exists (ID: {existing.id}). Overwriting...")
            await WorkflowRepository.delete(db, existing.id)
            await db.commit()

        nodes = [
            {
                "id": "n1",
                "type": "leetcode_daily",
                "label": "Fetch LeetCode Daily",
                "position": {"x": 100, "y": 150},
                "config": {
                    "language": "Python"
                }
            },
            {
                "id": "n2",
                "type": "ai_solver",
                "label": "AI Solver (Groq)",
                "position": {"x": 400, "y": 150},
                "config": {
                    "model": "llama-3.3-70b-versatile",
                    "language": "Python",
                    "temperature": 0.2
                }
            },
            {
                "id": "n3",
                "type": "leetcode_submit",
                "label": "Submit to LeetCode",
                "position": {"x": 700, "y": 150},
                "config": {
                    "language": "Python"
                }
            },
            {
                "id": "n4",
                "type": "leetcode_save",
                "label": "Save Solve Result",
                "position": {"x": 1000, "y": 150},
                "config": {}
            }
        ]

        edges = [
            {
                "id": "e1-2",
                "source": "n1",
                "target": "n2",
                "label": "Daily Challenge"
            },
            {
                "id": "e2-3",
                "source": "n2",
                "target": "n3",
                "label": "Code Solution"
            },
            {
                "id": "e3-4",
                "source": "n3",
                "target": "n4",
                "label": "Submission Result"
            }
        ]

        print("Seeding LeetCode Daily Solver workflow...")
        wf = await WorkflowRepository.create(
            db,
            name="LeetCode Daily Solver",
            description="Fetches the daily challenge, solves it with Groq Llama 3.3-70B model with DuckDuckGo web-scraped solution context, submits it, and logs the result.",
            nodes=nodes,
            edges=edges,
            trigger_type="manual"
        )
        await db.commit()
        print(f"✅ Workflow seeded successfully! ID: {wf.id}")

        # Create execution record
        print("Creating execution run record...")
        execution = await ExecutionRepository.create(db, workflow_id=wf.id, input_text="Start Daily Solve")
        await db.commit()
        print(f"✅ Execution record created! ID: {execution.id}")

        print("\n⚡ Running the workflow execution...")
        
        # We capture the incremental logs in a list
        log_sink = []
        
        # Start executing the workflow
        result = await run_workflow(
            user_input="Start Daily Solve",
            nodes=wf.nodes,
            edges=wf.edges,
            _log_sink=log_sink,
            execution_id=execution.id
        )

        # Update execution state in the DB
        status = result.get("status", "failed")
        final_output = result.get("finalOutput", "")
        
        await ExecutionRepository.update_status(
            db,
            execution_id=execution.id,
            status=status,
            final_output=final_output,
            node_results=result.get("nodeResults"),
            agent_logs=log_sink
        )
        await db.commit()
        
        print("\n================== WORKFLOW EXECUTION LOGS ==================")
        for log_entry in log_sink:
            print(log_entry)
        print("=============================================================")
        print(f"\nFinal Workflow Status: {status.upper()}")
        print(f"Final Workflow Output:\n{final_output}")

    await close_db()
    print("\nDatabase connections closed.")

if __name__ == "__main__":
    asyncio.run(main())
