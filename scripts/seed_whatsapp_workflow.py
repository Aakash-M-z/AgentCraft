"""
Utility script to seed the Neon PostgreSQL database with the
production-grade Personal AI Operations Assistant workflow.
"""
import os
import sys
import asyncio

# Ensure backend folder is in Python path so we can import models and database
sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

from backend.database import init_db, close_db, AsyncSessionLocal
from backend.repository import WorkflowRepository
from backend.scheduler import update_workflow_schedule

GENERATOR_PROMPT = """Analyze the WhatsApp messages.

If the name "Aakash" appears in the absentee list:

Generate ONLY a professional WhatsApp message to mentor.

Default reason:
fever and cold

Tone:
- respectful
- concise
- natural
- professional

Return ONLY the final WhatsApp message.

Example:

Good morning mentor,

I am unable to attend today due to fever and cold. I will review the pending updates and complete the missed work once I feel better.

Thank you.

Messages:
{{input}}"""


async def main():
    print("Initializing database connection...")
    await init_db()

    async with AsyncSessionLocal() as db:
        existing_wfs = await WorkflowRepository.list_all(db)
        existing = next(
            (w for w in existing_wfs if w.name == "Personal AI Operations Assistant"),
            None,
        )

        if existing:
            print(
                f"Workflow 'Personal AI Operations Assistant' already exists "
                f"(ID: {existing.id}). Overwriting..."
            )
            await WorkflowRepository.delete(db, existing.id)
            await db.commit()

        nodes = [
            {
                "id": "node-schedule",
                "type": "schedule_trigger",
                "label": "Schedule Trigger",
                "position": {"x": 100, "y": 250},
                "config": {
                    "cron": "0 9 * * 1-6",
                    "timezone": "Asia/Kolkata",
                },
            },
            {
                "id": "node-monitor",
                "type": "whatsapp_monitor",
                "label": "WhatsApp Monitor",
                "position": {"x": 400, "y": 250},
                "config": {
                    "groupName": "Attendance Group",
                    "maxMessages": 30,
                },
            },
            {
                "id": "node-generator",
                "type": "ai_agent",
                "label": "AI Message Generator",
                "position": {"x": 700, "y": 250},
                "config": {
                    "instruction": GENERATOR_PROMPT,
                    "model": "llama-3.3-70b-versatile",
                    "temperature": 0.7,
                    "outputFormat": "plain_text",
                },
            },
            {
                "id": "node-sender",
                "type": "whatsapp_sender",
                "label": "WhatsApp Sender",
                "position": {"x": 1000, "y": 250},
                "config": {
                    "contactName": "Mentor",
                    "messageTemplate": "{{input}}",
                    "manualApproval": True,
                },
            },
        ]

        edges = [
            {
                "id": "edge-1",
                "source": "node-schedule",
                "target": "node-monitor",
                "label": "Trigger",
            },
            {
                "id": "edge-2",
                "source": "node-monitor",
                "target": "node-generator",
                "label": "Extract messages",
            },
            {
                "id": "edge-3",
                "source": "node-generator",
                "target": "node-sender",
                "label": "Send message",
            },
        ]

        print("Seeding Personal AI Operations Assistant workflow...")
        wf = await WorkflowRepository.create(
            db,
            name="Personal AI Operations Assistant",
            description=(
                "Monitors WhatsApp attendance groups, generates a professional mentor "
                "message when Aakash is absent, and gates sending behind human approval."
            ),
            nodes=nodes,
            edges=edges,
            trigger_type="schedule",
            cron="0 9 * * 1-6",
        )

        await db.commit()
        print(f"Workflow seeded successfully! ID: {wf.id}")

        update_workflow_schedule(wf.id, "0 9 * * 1-6", "Asia/Kolkata")
        print("Scheduled daily execution at 9 AM (Mon-Sat)")

    await close_db()
    print("Database connections closed.")


if __name__ == "__main__":
    asyncio.run(main())
