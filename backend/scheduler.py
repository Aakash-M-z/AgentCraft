"""
APScheduler integration for scheduled workflows.
"""
import os
import logging
import redis
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.jobstores.redis import RedisJobStore
from apscheduler.jobstores.memory import MemoryJobStore
from apscheduler.triggers.cron import CronTrigger
import httpx
from .redis_client import acquire_lock

logger = logging.getLogger(__name__)

REDIS_URL = os.environ.get("REDIS_URL")

jobstores = {}
if REDIS_URL:
    try:
        # Configure synchronous Redis connection pool for APScheduler's sync job store operations
        sync_pool = redis.ConnectionPool.from_url(REDIS_URL)
        jobstores['default'] = RedisJobStore(
            connection_pool=sync_pool,
            jobs_key='apscheduler_jobs',
            run_times_key='apscheduler_run_times'
        )
        logger.info("⏰ APScheduler configured with RedisJobStore")
    except Exception as e:
        logger.error(f"❌ Failed to initialize RedisJobStore for APScheduler: {e}. Falling back to MemoryJobStore.")
        jobstores['default'] = MemoryJobStore()
else:
    logger.warning("⚠️ REDIS_URL not set. APScheduler falling back to MemoryJobStore.")
    jobstores['default'] = MemoryJobStore()

# Global scheduler instance
scheduler = AsyncIOScheduler(jobstores=jobstores)

async def execute_scheduled_workflow(workflow_id: int):
    """Job function that runs when a schedule triggers."""
    # Use a lock name unique to the scheduled trigger run.
    # To prevent two instances from running the exact same cron execution,
    # we acquire a lock on "scheduled_trigger_lock:{workflow_id}" for 30 seconds.
    lock_name = f"scheduled_trigger_lock:{workflow_id}"
    acquired = await acquire_lock(lock_name, timeout=30)
    if not acquired:
        logger.warning(f"⏭️ Scheduled workflow {workflow_id} execution locked/already executed by another instance.")
        return

    logger.info(f"⏰ Triggering scheduled workflow {workflow_id}...")
    try:
        # Use localhost endpoint since this runs in the same container/server
        url = f"http://127.0.0.1:8000/api/executions"
        payload = {"workflowId": workflow_id, "input": "Scheduled daily trigger"}
        
        async with httpx.AsyncClient() as client:
            resp = await client.post(url, json=payload, timeout=5.0)
            resp.raise_for_status()
            logger.info(f"✅ Scheduled execution triggered for workflow {workflow_id}")
    except Exception as exc:
        logger.error(f"❌ Failed to trigger scheduled workflow {workflow_id}: {exc}")

def update_workflow_schedule(workflow_id: int, cron_expr: str, timezone: str = "UTC"):
    """Add or update a workflow schedule."""
    job_id = f"workflow_{workflow_id}"
    
    # Remove existing job if any
    if scheduler.get_job(job_id):
        scheduler.remove_job(job_id)
        
    if not cron_expr:
        return
        
    try:
        trigger = CronTrigger.from_crontab(cron_expr, timezone=timezone)
        scheduler.add_job(
            execute_scheduled_workflow,
            trigger=trigger,
            id=job_id,
            args=[workflow_id],
            replace_existing=True
        )
        logger.info(f"📅 Registered schedule for workflow {workflow_id} with cron '{cron_expr}' ({timezone})")
    except Exception as exc:
        logger.error(f"Failed to register schedule for workflow {workflow_id}: {exc}")

def remove_workflow_schedule(workflow_id: int):
    """Remove a workflow schedule."""
    job_id = f"workflow_{workflow_id}"
    if scheduler.get_job(job_id):
        scheduler.remove_job(job_id)
        logger.info(f"🗑️ Removed schedule for workflow {workflow_id}")
