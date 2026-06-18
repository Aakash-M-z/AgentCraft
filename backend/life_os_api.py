"""
Personal Life OS - FastAPI API Router & APScheduler Jobs.
Provides endpoints and automated engines for Assignments, Placements, LeetCode, and AI Chief of Staff.
"""
import logging
import os
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from .database import get_db, AsyncSessionLocal
from .personal_life_os_repository import (
    AssignmentRepository,
    PlacementRepository,
    LeetCodeRepository,
    BriefingRepository
)
from .ai import call_ai

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/life-os", tags=["Personal Life OS"])

# ── Pydantic Request Models ──────────────────────────────────────────────────

class AssignmentCreate(BaseModel):
    title: str
    subject: str
    deadline: datetime
    priority: str = "medium"
    status: str = "pending"
    source: str = "manual"

class AssignmentUpdate(BaseModel):
    title: Optional[str] = None
    subject: Optional[str] = None
    deadline: Optional[datetime] = None
    priority: Optional[str] = None
    status: Optional[str] = None

class PlacementCreate(BaseModel):
    company_name: str
    package: Optional[str] = None
    deadline: datetime
    eligibility: Optional[str] = None
    apply_url: Optional[str] = None
    status: str = "active"

class PlacementUpdate(BaseModel):
    company_name: Optional[str] = None
    package: Optional[str] = None
    deadline: Optional[datetime] = None
    eligibility: Optional[str] = None
    apply_url: Optional[str] = None
    status: Optional[str] = None

class LeetCodeSubmissionCreate(BaseModel):
    title: str
    slug: str
    difficulty: str
    solution: str
    status: str = "solved"

class ChiefOfStaffPrompt(BaseModel):
    prompt: str


# ── REST API Endpoints ────────────────────────────────────────────────────────

@router.get("/summary")
async def get_life_os_summary(db: AsyncSession = Depends(get_db)):
    """Retrieve telemetry metrics summary for the Personal Life OS Command Center."""
    try:
        assignments = await AssignmentRepository.list_all(db)
        placements = await PlacementRepository.list_all(db)
        lc_stats = await LeetCodeRepository.get_streak_stats(db)
        briefings = await BriefingRepository.list_all(db)

        active_assignments = [a for a in assignments if a.status != "completed"]
        completed_assignments = [a for a in assignments if a.status == "completed"]
        overdue_assignments = [a for a in assignments if a.status == "overdue"]

        active_placements = [p for p in placements if p.status == "active"]
        applied_placements = [p for p in placements if p.status == "applied"]

        last_briefing = briefings[0].content if briefings else "No daily briefings generated yet."

        return {
            "assignments": {
                "total": len(assignments),
                "active": len(active_assignments),
                "completed": len(completed_assignments),
                "overdue": len(overdue_assignments)
            },
            "placements": {
                "total": len(placements),
                "active": len(active_placements),
                "applied": len(applied_placements)
            },
            "leetcode": lc_stats,
            "last_briefing": last_briefing
        }
    except Exception as e:
        logger.error(f"Error compiling Life OS summary: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ── Assignments Endpoints ─────────────────────────────────────────────────────

@router.get("/assignments", response_model=List[Dict[str, Any]])
async def list_assignments(db: AsyncSession = Depends(get_db)):
    """List all assignments, automatically updating overdue status."""
    try:
        list_obj = await AssignmentRepository.list_all(db)
        return [
            {
                "id": a.id,
                "title": a.title,
                "subject": a.subject,
                "deadline": a.deadline.isoformat(),
                "priority": a.priority,
                "status": a.status,
                "source": a.source,
                "createdAt": a.created_at.isoformat(),
                "updatedAt": a.updated_at.isoformat()
            } for a in list_obj
        ]
    except Exception as e:
        logger.error(f"Error listing assignments: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/assignments", status_code=201)
async def create_assignment(body: AssignmentCreate, db: AsyncSession = Depends(get_db)):
    """Manually track a new assignment."""
    try:
        asg = await AssignmentRepository.create(
            db,
            title=body.title,
            subject=body.subject,
            deadline=body.deadline,
            priority=body.priority,
            status=body.status,
            source=body.source
        )
        await db.commit()
        return {
            "id": asg.id,
            "title": asg.title,
            "subject": asg.subject,
            "deadline": asg.deadline.isoformat(),
            "priority": asg.priority,
            "status": asg.status
        }
    except Exception as e:
        logger.error(f"Error creating assignment: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/assignments/{assignment_id}")
async def update_assignment(
    assignment_id: int,
    body: AssignmentUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Update details/status of an assignment."""
    try:
        asg = await AssignmentRepository.update(
            db,
            assignment_id=assignment_id,
            title=body.title,
            subject=body.subject,
            deadline=body.deadline,
            priority=body.priority,
            status=body.status
        )
        if not asg:
            raise HTTPException(status_code=404, detail="Assignment not found")
        await db.commit()
        return {
            "id": asg.id,
            "title": asg.title,
            "subject": asg.subject,
            "deadline": asg.deadline.isoformat(),
            "priority": asg.priority,
            "status": asg.status
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating assignment {assignment_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/assignments/{assignment_id}", status_code=204)
async def delete_assignment(assignment_id: int, db: AsyncSession = Depends(get_db)):
    """Delete an assignment."""
    try:
        deleted = await AssignmentRepository.delete(db, assignment_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Assignment not found")
        await db.commit()
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting assignment {assignment_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ── Placements Endpoints ──────────────────────────────────────────────────────

@router.get("/placements", response_model=List[Dict[str, Any]])
async def list_placements(db: AsyncSession = Depends(get_db)):
    """List all career placement opportunities, updating expired ones."""
    try:
        placements = await PlacementRepository.list_all(db)
        return [
            {
                "id": p.id,
                "company_name": p.company_name,
                "package": p.package,
                "deadline": p.deadline.isoformat(),
                "eligibility": p.eligibility,
                "apply_url": p.apply_url,
                "status": p.status,
                "createdAt": p.created_at.isoformat(),
                "updatedAt": p.updated_at.isoformat()
            } for p in placements
        ]
    except Exception as e:
        logger.error(f"Error listing placements: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/placements", status_code=201)
async def create_placement(body: PlacementCreate, db: AsyncSession = Depends(get_db)):
    """Add a new career pipeline opportunity."""
    try:
        plc = await PlacementRepository.create(
            db,
            company_name=body.company_name,
            package=body.package,
            deadline=body.deadline,
            eligibility=body.eligibility,
            apply_url=body.apply_url,
            status=body.status
        )
        if not plc:
            raise HTTPException(status_code=400, detail="Duplicate placement opportunity detected (matching company and deadline within 24h)")
        await db.commit()
        return {
            "id": plc.id,
            "company_name": plc.company_name,
            "package": plc.package,
            "deadline": plc.deadline.isoformat(),
            "status": plc.status
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating placement: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/placements/{placement_id}")
async def update_placement(
    placement_id: int,
    body: PlacementUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Update details/status of a placement opportunity."""
    try:
        plc = await PlacementRepository.update(
            db,
            placement_id=placement_id,
            company_name=body.company_name,
            package=body.package,
            deadline=body.deadline,
            eligibility=body.eligibility,
            apply_url=body.apply_url,
            status=body.status
        )
        if not plc:
            raise HTTPException(status_code=404, detail="Placement not found")
        await db.commit()
        return {
            "id": plc.id,
            "company_name": plc.company_name,
            "package": plc.package,
            "deadline": plc.deadline.isoformat(),
            "status": plc.status
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating placement {placement_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/placements/{placement_id}", status_code=204)
async def delete_placement(placement_id: int, db: AsyncSession = Depends(get_db)):
    """Delete a placement opportunity."""
    try:
        deleted = await PlacementRepository.delete(db, placement_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Placement not found")
        await db.commit()
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting placement {placement_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ── LeetCode Endpoints ────────────────────────────────────────────────────────

@router.get("/leetcode")
async def list_leetcode_submissions(db: AsyncSession = Depends(get_db)):
    """Retrieve streak statistics and past competitive submissions list."""
    try:
        submissions = await LeetCodeRepository.list_all(db)
        stats = await LeetCodeRepository.get_streak_stats(db)
        return {
            "stats": stats,
            "submissions": [
                {
                    "id": s.id,
                    "title": s.title,
                    "slug": s.slug,
                    "difficulty": s.difficulty,
                    "solution": s.solution,
                    "status": s.status,
                    "date": s.date.isoformat(),
                    "createdAt": s.created_at.isoformat()
                } for s in submissions
            ]
        }
    except Exception as e:
        logger.error(f"Error loading LeetCode details: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/leetcode", status_code=201)
async def manual_leetcode_save(body: LeetCodeSubmissionCreate, db: AsyncSession = Depends(get_db)):
    """Manually record a solved/missed LeetCode submission."""
    try:
        sub = await LeetCodeRepository.create(
            db,
            title=body.title,
            slug=body.slug,
            difficulty=body.difficulty,
            solution=body.solution,
            status=body.status
        )
        await db.commit()
        return {
            "id": sub.id,
            "title": sub.title,
            "difficulty": sub.difficulty,
            "status": sub.status,
            "date": sub.date.isoformat()
        }
    except Exception as e:
        logger.error(f"Error saving manual LeetCode submission: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ── Daily Briefing Endpoints ───────────────────────────────────────────────────

@router.get("/briefings", response_model=List[Dict[str, Any]])
async def list_briefings(db: AsyncSession = Depends(get_db)):
    """List generated briefing digests archives logs."""
    try:
        briefings = await BriefingRepository.list_all(db)
        return [
            {
                "id": b.id,
                "content": b.content,
                "status": b.status,
                "createdAt": b.created_at.isoformat()
            } for b in briefings
        ]
    except Exception as e:
        logger.error(f"Error loading daily briefings: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ── AI Chief of Staff Endpoints ───────────────────────────────────────────────

@router.post("/chief-of-staff")
async def conversational_chief_of_staff(body: ChiefOfStaffPrompt, db: AsyncSession = Depends(get_db)):
    """Chat with the conversational AI Chief of Staff loaded with real-time database context."""
    try:
        assignments = await AssignmentRepository.list_active(db)
        placements = await PlacementRepository.list_active(db)
        lc_stats = await LeetCodeRepository.get_streak_stats(db)

        context_summary = f"""Assignments Awaiting Completion:
{chr(10).join([f'- [{a.priority.upper()}] {a.title} ({a.subject}) due {a.deadline.strftime("%Y-%m-%d %H:%M")}' for a in assignments]) if assignments else "None"}

Placements Active/Closing Soon:
{chr(10).join([f'- {p.company_name} ({p.package or "N/A"}) closing {p.deadline.strftime("%Y-%m-%d %H:%M")}' for p in placements]) if placements else "None"}

LeetCode Practice Status:
- Total Solved: {lc_stats.get("totalSolved")}
- Easy: {lc_stats.get("easy")} | Medium: {lc_stats.get("medium")} | Hard: {lc_stats.get("hard")}
- Current Solving Streak: {lc_stats.get("streak")} consecutive days
"""

        prompt = f"""You are Aakash's Executive AI Chief of Staff. Your job is to analyze Aakash's active tasks, placement pipelines, and LeetCode daily progress, and provide strategic advice, prioritized action steps, and helpful assistance.

Here is Aakash's current real-time system state:
{context_summary}

Aakash asks: "{body.prompt}"

Provide a concise, premium, high-impact conversational response in clean Markdown. Highlight urgent priorities, keep Aakash focused, and maintain a highly supportive and professional tone.
"""
        response_text = await call_ai(prompt, model="llama-3.3-70b-versatile", temperature=0.7)
        return {"response": response_text}
    except Exception as e:
        logger.error(f"Error in conversational Chief of Staff: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ── Manual Engines Triggering Endpoints ───────────────────────────────────────

@router.post("/briefings/trigger", status_code=202)
async def trigger_daily_briefing():
    """Manually trigger the 8:00 AM Daily Briefing dispatch engine immediately."""
    import asyncio
    asyncio.create_task(daily_briefing_job())
    return {"message": "Daily briefing engine execution spawned in the background"}


@router.post("/reminders/trigger", status_code=202)
async def trigger_smart_reminders():
    """Manually trigger the Hourly Smart Reminder engine immediately."""
    import asyncio
    asyncio.create_task(smart_reminders_job())
    return {"message": "Hourly smart reminder engine execution spawned in the background"}


# ── APScheduler Static Tasks ─────────────────────────────────────────────────

async def daily_briefing_job():
    """Job function that compiles Aakash's daily morning briefing and dispatches it via WhatsApp."""
    logger.info("⏰ APScheduler trigger: Starting Daily Briefing Job...")
    async with AsyncSessionLocal() as session:
        try:
            # 1. Fetch telemetry
            assignments = await AssignmentRepository.list_active(session)
            placements = await PlacementRepository.list_active(session)
            lc_stats = await LeetCodeRepository.get_streak_stats(session)

            context_data = {
                "assignments": [
                    {
                        "title": a.title,
                        "subject": a.subject,
                        "deadline": a.deadline.isoformat(),
                        "priority": a.priority,
                        "status": a.status
                    } for a in assignments
                ],
                "placements": [
                    {
                        "company_name": p.company_name,
                        "package": p.package,
                        "deadline": p.deadline.isoformat(),
                        "eligibility": p.eligibility,
                        "apply_url": p.apply_url
                    } for p in placements
                ],
                "leetcode": lc_stats
            }

            # 2. AI Briefing Composition
            prompt = f"""You are Aakash's Executive AI Chief of Staff. Compose a premium, highly professional morning briefing based on Aakash's active student/professional dashboard metrics.

Active Personal Data:
{context_data}

STRICT GUIDELINES:
- Greeting: Start exactly with: "Good Morning Aakash"
- Style: Sleek, high-impact, engaging spacing. Make it look like a custom morning digest.
- Sections:
  - Assignments (Highlight any due soon)
  - Placements (TCS, TCS deadline, active opportunities)
  - LeetCode status (Mention if today's solved, streak count)
  - Short prioritized recommendations list (e.g. "Priority: HIGH")
"""
            briefing_text = await call_ai(prompt, model="llama-3.3-70b-versatile", temperature=0.7)

            # 3. WhatsApp dispatch
            from .whatsapp import send_whatsapp_message
            await send_whatsapp_message(contact_name="Aakash", message=briefing_text, log_func=logger.info)

            # 4. Save briefing log
            await BriefingRepository.create(session, content=briefing_text, status="sent")
            await session.commit()
            logger.info("✅ Daily Briefing Job finished successfully and logged.")
        except Exception as e:
            logger.error(f"❌ Failed to run Daily Briefing Job: {e}")
            try:
                await BriefingRepository.create(session, content=f"Failed to generate briefing: {str(e)}", status="failed")
                await session.commit()
            except Exception:
                pass


async def smart_reminders_job():
    """Job function that scans for near deadlines and sends alerts via WhatsApp and Brevo Email."""
    logger.info("⏰ APScheduler trigger: Starting Hourly Smart Reminders Job...")
    async with AsyncSessionLocal() as session:
        try:
            # 1. Fetch active assignments and placements
            assignments = await AssignmentRepository.list_active(session)
            placements = await PlacementRepository.list_active(session)

            now = datetime.now(timezone.utc)
            alerts = []

            # 2. Check for overdue/due assignments
            for a in assignments:
                dl = a.deadline.astimezone(timezone.utc) if a.deadline.tzinfo else a.deadline.replace(tzinfo=timezone.utc)
                time_left = dl - now
                if time_left.total_seconds() > 0 and time_left <= timedelta(hours=24):
                    alerts.append(f"⚠️ *Task Due Soon*: '{a.title}' ({a.subject}) is due in {round(time_left.total_seconds() / 3600, 1)} hours! (Priority: {a.priority.upper()})")
                elif dl < now and a.status != "overdue":
                    a.status = "overdue"
                    alerts.append(f"🚨 *Task Overdue*: '{a.title}' ({a.subject}) has passed its deadline! Please complete it immediately.")

            # 3. Check for placements closing soon
            for p in placements:
                dl = p.deadline.astimezone(timezone.utc) if p.deadline.tzinfo else p.deadline.replace(tzinfo=timezone.utc)
                time_left = dl - now
                if time_left.total_seconds() > 0 and time_left <= timedelta(hours=24):
                    alerts.append(f"💼 *Placement Deadline*: Application for '{p.company_name}' ({p.package or 'N/A'}) closes in {round(time_left.total_seconds() / 3600, 1)} hours! Apply here: {p.apply_url or 'N/A'}")

            # 4. Dispatch Alert Package
            if alerts:
                alert_message = "🔔 *PERSONAL LIFE OS SMART REMINDER* 🔔\n\n" + "\n\n".join(alerts)

                # Send via WhatsApp
                from .whatsapp import send_whatsapp_message
                await send_whatsapp_message(contact_name="Aakash", message=alert_message, log_func=logger.info)

                # Send via Email
                email_user = os.environ.get("EMAIL_USER")
                email_pass = os.environ.get("EMAIL_PASS")
                if email_user and email_pass:
                    from .workflow_engine import _send_email
                    try:
                        await _send_email(
                            to=email_user,
                            subject="[AgentCraft] Personal Life OS Smart Reminder Alert",
                            body=alert_message
                        )
                        logger.info("✅ Sent smart reminder email to %s", email_user)
                    except Exception as e:
                        logger.error(f"❌ Failed to send smart reminder email: {e}")

            await session.commit()
            logger.info("✅ Hourly Smart Reminders Job finished successfully.")
        except Exception as e:
            logger.error(f"❌ Failed to run Hourly Smart Reminders Job: {e}")


def register_life_os_jobs():
    """Register static APScheduler background jobs for Life OS Automation."""
    from .scheduler import scheduler
    from apscheduler.triggers.cron import CronTrigger

    # 1. Register 8:00 AM daily briefing
    if not scheduler.get_job("daily_briefing_job"):
        scheduler.add_job(
            daily_briefing_job,
            trigger=CronTrigger.from_crontab("0 8 * * *", timezone="Asia/Kolkata"),
            id="daily_briefing_job",
            replace_existing=True
        )
        logger.info("⏰ APScheduler: Registered daily briefing job (8:00 AM Asia/Kolkata)")

    # 2. Register hourly reminders
    if not scheduler.get_job("smart_reminders_job"):
        scheduler.add_job(
            smart_reminders_job,
            trigger=CronTrigger.from_crontab("0 * * * *", timezone="Asia/Kolkata"),
            id="smart_reminders_job",
            replace_existing=True
        )
        logger.info("⏰ APScheduler: Registered hourly smart reminders job")
