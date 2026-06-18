"""
AgentCraft – FastAPI backend with Neon PostgreSQL
Production-ready workflow automation platform.
"""
# Apply DNS monkeypatch first to ensure Neon database is resolvable
import backend.dns_patch

import sys
import asyncio
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

import logging
import os
from datetime import datetime, timezone
from typing import Any

from dotenv import load_dotenv

# Load .env if present (local dev). On Render, env vars are set via dashboard.
load_dotenv()

from fastapi import FastAPI, HTTPException, Query, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

import asyncio
from .workflow_engine import run_workflow
from .ai import generate_workflow_from_prompt, explain_workflow
from .database import get_db, init_db, close_db, AsyncSessionLocal
from .repository import WorkflowRepository, ExecutionRepository
from .scheduler import scheduler, update_workflow_schedule, remove_workflow_schedule

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# ── Environment Variable Verification ─────────────────────────────────────────
# Log environment variable status on startup (without exposing sensitive values)
def _verify_env_vars():
    """Verify critical environment variables are loaded."""
    required_vars = {
        "DATABASE_URL": bool(os.getenv("DATABASE_URL")),
        "GROQ_API_KEY": bool(os.getenv("GROQ_API_KEY")),
        "EMAIL_USER": bool(os.getenv("EMAIL_USER")),
        "EMAIL_PASS": bool(os.getenv("EMAIL_PASS")),  # Brevo API key
    }
    
    logger.info("🔍 Environment Variables Status:")
    for var_name, is_present in required_vars.items():
        status = "✅ SET" if is_present else "❌ MISSING"
        logger.info(f"   {var_name}: {status}")
    
    # List all EMAIL_* variables (for debugging)
    email_vars = [k for k in os.environ.keys() if k.startswith("EMAIL")]
    logger.info(f"   Available EMAIL_* vars: {email_vars}")
    
    missing = [k for k, v in required_vars.items() if not v]
    if missing:
        logger.warning(f"⚠️  Missing environment variables: {', '.join(missing)}")
        logger.warning("   Email (Brevo API) will not work without EMAIL_USER and EMAIL_PASS")
    
    return required_vars

_env_status = _verify_env_vars()

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(title="AgentCraft – AI Workflow Engine", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

from .life_os_api import router as life_os_router
app.include_router(life_os_router)

# ── Lifecycle Events ──────────────────────────────────────────────────────────

@app.on_event("startup")
async def startup_event():
    """Initialize database, Redis client, and scheduler on startup."""
    logger.info("🚀 Starting AgentCraft...")
    await init_db()
    
    # Initialize Redis connection pool
    try:
        from .redis_client import init_redis
        await init_redis()
    except Exception as e:
        logger.error(f"❌ Failed to initialize Redis on startup: {e}")
    
    # Start the scheduler
    scheduler.start()
    logger.info("⏰ APScheduler started")
    
    # Register existing scheduled workflows
    async with AsyncSessionLocal() as db:
        scheduled_wfs = await WorkflowRepository.list_by_trigger_type(db, "schedule")
        for wf in scheduled_wfs:
            if wf.cron:
                # We extract timezone from the nodes if available, else UTC
                tz = "UTC"
                for node in wf.nodes:
                    if node.get("type") == "schedule_trigger":
                        tz = node.get("config", {}).get("timezone", "UTC")
                        break
                update_workflow_schedule(wf.id, wf.cron, tz)
                
    # Register static background jobs for Personal Life OS
    try:
        from .life_os_api import register_life_os_jobs
        register_life_os_jobs()
    except Exception as e:
        logger.error(f"❌ Failed to register static background jobs for Personal Life OS: {e}")
                
    logger.info("✅ AgentCraft ready!")


@app.on_event("shutdown")
async def shutdown_event():
    """Close database and Redis connections on shutdown."""
    logger.info("👋 Shutting down AgentCraft...")
    await close_db()
    
    # Close Redis connection pool
    try:
        from .redis_client import close_redis
        await close_redis()
    except Exception as e:
        logger.error(f"❌ Failed to close Redis on shutdown: {e}")
        
    logger.info("✅ Cleanup complete")


# In-memory execution tracking replaced by Redis Pub/Sub and central status caching


# ── Pydantic models (mirror frontend schemas) ─────────────────────────────────

def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class NodePosition(BaseModel):
    x: float
    y: float


class WorkflowNode(BaseModel):
    id: str
    type: str
    label: str
    config: dict[str, Any] | None = None
    position: NodePosition


class WorkflowEdge(BaseModel):
    id: str
    source: str
    target: str
    label: str | None = None


class CreateWorkflowBody(BaseModel):
    name: str
    description: str | None = None
    nodes: list[WorkflowNode] = []
    edges: list[WorkflowEdge] = []


class GenerateWorkflowBody(BaseModel):
    prompt: str


class StartExecutionBody(BaseModel):
    workflowId: int
    input: str


# ── Helpers ───────────────────────────────────────────────────────────────────

def _wf_response(wf: Any) -> dict:
    """Return a Workflow-shaped dict from database model."""
    return {
        "id": wf.id,
        "name": wf.name,
        "description": wf.description,
        "nodes": wf.nodes or [],
        "edges": wf.edges or [],
        "triggerType": wf.trigger_type,
        "cron": wf.cron,
        "createdAt": wf.created_at.isoformat() if wf.created_at else _now(),
        "updatedAt": wf.updated_at.isoformat() if wf.updated_at else _now(),
    }


def _ex_response(ex: Any) -> dict:
    """Return an Execution-shaped dict (summary, no nodeResults) from database model."""
    return {
        "id": ex.id,
        "workflowId": ex.workflow_id,
        "status": ex.status,
        "input": ex.input,
        "createdAt": ex.created_at.isoformat() if ex.created_at else _now(),
        "updatedAt": ex.updated_at.isoformat() if ex.updated_at else _now(),
    }


def _ex_detail_response(ex: Any) -> dict:
    """Return an ExecutionDetail-shaped dict from database model."""
    return {
        "id": ex.id,
        "workflowId": ex.workflow_id,
        "status": ex.status,
        "input": ex.input,
        "finalOutput": ex.final_output,
        "nodeResults": ex.node_results or [],
        "agentLogs": ex.agent_logs or [],
        "createdAt": ex.created_at.isoformat() if ex.created_at else _now(),
        "updatedAt": ex.updated_at.isoformat() if ex.updated_at else _now(),
    }


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/")
async def root():
    return {
        "message": "AgentCraft API is live 🚀",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/api/healthz",
        "endpoints": {
            "workflows": "/api/workflows",
            "executions": "/api/executions",
            "generate": "/api/workflows/generate",
        }
    }


@app.get("/api/healthz")
async def health():
    return {"status": "ok"}


# ── Workflows ─────────────────────────────────────────────────────────────────

@app.get("/api/workflows")
async def list_workflows(db: AsyncSession = Depends(get_db)):
    """List all workflows from database."""
    workflows = await WorkflowRepository.list_all(db)
    logger.info("GET /api/workflows → %d items", len(workflows))
    return [_wf_response(w) for w in workflows]


@app.post("/api/workflows", status_code=201)
async def create_workflow(body: CreateWorkflowBody, db: AsyncSession = Depends(get_db)):
    """Create a new workflow in database."""
    try:
        logger.info("POST /api/workflows | name=%s | nodes=%d | edges=%d", 
                   body.name, len(body.nodes), len(body.edges))
        
        # Check for schedule_trigger node
        trigger_type = "manual"
        cron = None
        tz = "UTC"
        for node in body.nodes:
            if node.type == "schedule_trigger":
                trigger_type = "schedule"
                cron = node.config.get("cron", "0 8 * * *") if node.config else "0 8 * * *"
                tz = node.config.get("timezone", "UTC") if node.config else "UTC"
                break
                
        workflow = await WorkflowRepository.create(
            db,
            name=body.name,
            description=body.description,
            nodes=[n.model_dump() for n in body.nodes],
            edges=[e.model_dump() for e in body.edges],
            trigger_type=trigger_type,
            cron=cron,
        )
        
        if trigger_type == "schedule" and cron:
            update_workflow_schedule(workflow.id, cron, tz)
            
        logger.info("✅ POST /api/workflows → created id=%d", workflow.id)
        return _wf_response(workflow)
        
    except Exception as exc:
        logger.error("❌ Failed to create workflow: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to create workflow: {str(exc)}")


@app.post("/api/workflows/generate")
async def generate_workflow(body: GenerateWorkflowBody):
    logger.info("POST /api/workflows/generate | prompt=%.80s", body.prompt)
    try:
        result = await generate_workflow_from_prompt(body.prompt)
        if not result:
            raise ValueError("Empty response from AI")
        # Ensure required fields exist
        return {
            "name": result.get("name", "Generated Workflow"),
            "description": result.get("description", ""),
            "nodes": result.get("nodes", []),
            "edges": result.get("edges", []),
        }
    except Exception as exc:
        logger.error("generate_workflow error: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


@app.get("/api/workflows/{workflow_id}")
async def get_workflow(workflow_id: int, db: AsyncSession = Depends(get_db)):
    """Get workflow by ID from database."""
    workflow = await WorkflowRepository.get_by_id(db, workflow_id)
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return _wf_response(workflow)


@app.put("/api/workflows/{workflow_id}")
async def update_workflow(workflow_id: int, body: CreateWorkflowBody, db: AsyncSession = Depends(get_db)):
    """Update workflow in database."""
    try:
        logger.info("PUT /api/workflows/%d | name=%s | nodes=%d | edges=%d", 
                   workflow_id, body.name, len(body.nodes), len(body.edges))
        
        # Check for schedule_trigger node
        trigger_type = "manual"
        cron = None
        tz = "UTC"
        for node in body.nodes:
            if node.type == "schedule_trigger":
                trigger_type = "schedule"
                cron = node.config.get("cron", "0 8 * * *") if node.config else "0 8 * * *"
                tz = node.config.get("timezone", "UTC") if node.config else "UTC"
                break
                
        workflow = await WorkflowRepository.update(
            db,
            workflow_id=workflow_id,
            name=body.name,
            description=body.description,
            nodes=[n.model_dump() for n in body.nodes],
            edges=[e.model_dump() for e in body.edges],
            trigger_type=trigger_type,
            cron=cron,
        )
        
        if not workflow:
            raise HTTPException(status_code=404, detail="Workflow not found")
            
        if trigger_type == "schedule" and cron:
            update_workflow_schedule(workflow.id, cron, tz)
        else:
            remove_workflow_schedule(workflow.id)
            
        logger.info("✅ PUT /api/workflows/%d updated", workflow_id)
        return _wf_response(workflow)
        
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("❌ Failed to update workflow %d: %s", workflow_id, exc, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to update workflow: {str(exc)}")


@app.delete("/api/workflows", status_code=200)
async def flush_all_workflows(db: AsyncSession = Depends(get_db)):
    """Delete all workflows and executions (reset workflow library)."""
    workflows = await WorkflowRepository.list_all(db)
    for wf in workflows:
        remove_workflow_schedule(wf.id)
    exec_count = await ExecutionRepository.delete_all(db)
    wf_count = await WorkflowRepository.delete_all(db)
    logger.info("DELETE /api/workflows — flushed %d workflows, %d executions", wf_count, exec_count)
    return {"deletedWorkflows": wf_count, "deletedExecutions": exec_count}


@app.delete("/api/workflows/{workflow_id}", status_code=204)
async def delete_workflow(workflow_id: int, db: AsyncSession = Depends(get_db)):
    """Delete workflow from database."""
    deleted = await WorkflowRepository.delete(db, workflow_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Workflow not found")
    remove_workflow_schedule(workflow_id)
    logger.info("DELETE /api/workflows/%d", workflow_id)


@app.get("/api/workflows/{workflow_id}/explain")
async def explain_workflow_route(workflow_id: int, db: AsyncSession = Depends(get_db)):
    """Explain workflow using AI."""
    workflow = await WorkflowRepository.get_by_id(db, workflow_id)
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    logger.info("GET /api/workflows/%d/explain", workflow_id)
    try:
        result = await explain_workflow(workflow.nodes, workflow.edges, workflow.name)
        return {
            "explanation": result.get("explanation", ""),
            "steps": result.get("steps", []),
        }
    except Exception as exc:
        logger.error("explain_workflow error: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


# ── Executions ────────────────────────────────────────────────────────────────

@app.get("/api/executions")
async def list_executions(
    workflowId: int | None = Query(default=None),
    db: AsyncSession = Depends(get_db)
):
    """List executions from database, optionally filtered by workflow."""
    executions = await ExecutionRepository.list_by_workflow(db, workflowId)
    logger.info("GET /api/executions → %d items", len(executions))
    return [_ex_response(e) for e in executions]


@app.post("/api/executions", status_code=202)
async def start_execution(body: StartExecutionBody, db: AsyncSession = Depends(get_db)):
    """Start a new workflow execution."""
    try:
        logger.info("POST /api/executions | workflowId=%d | input=%.80s", 
                   body.workflowId, body.input)
        
        # Get workflow from database
        workflow = await WorkflowRepository.get_by_id(db, body.workflowId)
        if not workflow:
            raise HTTPException(status_code=404, detail="Workflow not found")

        # Create execution record in database
        execution = await ExecutionRepository.create(
            db,
            workflow_id=body.workflowId,
            input_text=body.input,
        )
        
        logger.info("✅ POST /api/executions → created id=%d for workflow %d", 
                   execution.id, body.workflowId)

        # Run asynchronously so we return 202 immediately
        asyncio.create_task(_run_execution(execution.id, workflow, body.input))

        return _ex_response(execution)
        
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("❌ Failed to start execution: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to start execution: {str(exc)}")


@app.get("/api/executions/{execution_id}")
async def get_execution(execution_id: int, db: AsyncSession = Depends(get_db)):
    """Get execution details from database."""
    execution = await ExecutionRepository.get_by_id(db, execution_id)
    if not execution:
        raise HTTPException(status_code=404, detail="Execution not found")
    return _ex_detail_response(execution)


@app.post("/api/executions/{execution_id}/cancel")
async def cancel_execution(execution_id: int, db: AsyncSession = Depends(get_db)):
    """Cancel an execution."""
    execution = await ExecutionRepository.cancel(db, execution_id)
    if not execution:
        raise HTTPException(status_code=404, detail="Execution not found")
    logger.info("POST /api/executions/%d/cancel", execution_id)
    return _ex_response(execution)


class ApproveExecutionBody(BaseModel):
    message: str | None = None


@app.post("/api/executions/{execution_id}/approve")
async def approve_execution(
    execution_id: int,
    body: ApproveExecutionBody = None,
    db: AsyncSession = Depends(get_db)
):
    """Approve a paused execution and resume it by sending the WhatsApp message."""
    execution = await ExecutionRepository.get_by_id(db, execution_id)
    if not execution:
        raise HTTPException(status_code=404, detail="Execution not found")
        
    if execution.status != "waiting_approval":
        raise HTTPException(
            status_code=400, 
            detail=f"Execution is not in waiting_approval state (current: {execution.status})"
        )
        
    # Get workflow
    workflow = await WorkflowRepository.get_by_id(db, execution.workflow_id)
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
        
    # Find the node that is waiting for approval and extract its data
    waiting_node_id = None
    draft_message = ""
    contact_name = ""
    for res in (execution.node_results or []):
        if res.get("status") == "waiting_approval":
            waiting_node_id = res.get("nodeId")
            output = res.get("output", {})
            draft_message = output.get("draft", "")
            contact_name = output.get("contactName", "")
            break
            
    if not waiting_node_id:
        raise HTTPException(status_code=400, detail="No node in waiting_approval status found")
    
    # Use the human-edited message if provided, otherwise use the draft
    final_message = (body.message if body and body.message else draft_message)
    if not final_message:
        raise HTTPException(status_code=400, detail="No message content to send")

    from .workflow_engine import _ensure_plain_text_message
    try:
        final_message = _ensure_plain_text_message(
            final_message, context="approve execution"
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    
    # Update status to running BEFORE launching background task
    from .redis_client import set_execution_state, publish_event
    await ExecutionRepository.update_status(db, execution_id, "running")
    await db.commit()
    
    await set_execution_state(execution_id, "running")
    
    # Launch the resume task in the background
    asyncio.create_task(_resume_execution(
        ex_id=execution_id,
        workflow=workflow,
        approved_message=final_message,
        contact_name=contact_name,
        waiting_node_id=waiting_node_id,
        previous_node_results=list(execution.node_results or []),
        previous_agent_logs=list(execution.agent_logs or []),
    ))
    
    await db.refresh(execution)
    return _ex_response(execution)


@app.post("/api/executions/{execution_id}/reject")
async def reject_execution(
    execution_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Reject and cancel a paused execution."""
    execution = await ExecutionRepository.get_by_id(db, execution_id)
    if not execution:
        raise HTTPException(status_code=404, detail="Execution not found")
        
    if execution.status != "waiting_approval":
        raise HTTPException(
            status_code=400, 
            detail=f"Execution is not in waiting_approval state (current: {execution.status})"
        )
        
    node_results = list(execution.node_results or [])
    waiting_node_id = None
    for res in node_results:
        if res.get("status") == "waiting_approval":
            res["status"] = "failed"
            res["reasoning"] = "Rejected by human operator."
            waiting_node_id = res.get("nodeId")
            break
            
    from .redis_client import set_execution_state, publish_event
    
    agent_logs = list(execution.agent_logs or [])
    agent_logs.append(f"[{datetime.now(timezone.utc).isoformat()}] ❌ Execution rejected by human operator.")
    
    await ExecutionRepository.update_status(
        db,
        execution_id,
        status="cancelled",
        final_output="Execution rejected by human operator.",
        node_results=node_results,
        agent_logs=agent_logs
    )
    await db.commit()
    
    await set_execution_state(execution_id, "cancelled")
    
    # Broadcast updates
    if waiting_node_id:
        await publish_event(f"execution:{execution_id}", {
            "type": "node_update",
            "nodeId": waiting_node_id,
            "status": "failed",
            "output": "Rejected by human operator."
        })
        
    await publish_event(f"execution:{execution_id}", {
        "type": "log",
        "message": "❌ Execution rejected by human operator."
    })
    
    await publish_event(f"execution:{execution_id}", {
        "type": "execution_complete",
        "status": "cancelled",
        "finalOutput": "Execution rejected by human operator.",
        "executionId": execution_id
    })
    
    await db.refresh(execution)
    return _ex_response(execution)


async def _resume_execution(
    ex_id: int,
    workflow: Any,
    approved_message: str,
    contact_name: str,
    waiting_node_id: str,
    previous_node_results: list[dict],
    previous_agent_logs: list[str],
):
    """
    Resume a paused workflow execution after human approval.
    Sends the WhatsApp message and completes the workflow.
    """
    from .redis_client import acquire_lock, release_lock, set_execution_state, publish_event, is_redis_enabled
    from .workflow_engine import resume_workflow_from_approval

    lock_name = f"workflow_lock:{workflow.id}"
    acquired = await acquire_lock(lock_name, timeout=600)
    if not acquired:
        logger.warning(f"⚠️ Resume {ex_id} cancelled: workflow {workflow.id} is locked.")
        async with AsyncSessionLocal() as db:
            await ExecutionRepository.update_status(
                db, ex_id,
                status="failed",
                final_output="Failed to acquire lock: another execution is running.",
                agent_logs=previous_agent_logs + ["💥 Cancelled: could not acquire lock."]
            )
            await db.commit()
        return

    shared_logs = list(previous_agent_logs)

    await set_execution_state(ex_id, "running")

    async with AsyncSessionLocal() as db:
        try:
            result = await resume_workflow_from_approval(
                execution_id=ex_id,
                workflow_nodes=workflow.nodes,
                workflow_edges=workflow.edges,
                approved_message=approved_message,
                contact_name=contact_name,
                waiting_node_id=waiting_node_id,
                previous_node_results=previous_node_results,
                _log_sink=shared_logs,
            )

            status = result.get("status", "completed")
            final_output = result.get("finalOutput") or ""
            node_results = result.get("nodeResults", [])
            agent_logs = result.get("agentLogs", [])

            await ExecutionRepository.update_status(
                db, ex_id,
                status=status,
                final_output=final_output,
                node_results=node_results,
                agent_logs=agent_logs,
            )
            await db.commit()

            await set_execution_state(ex_id, status)

            completion_event = {
                'type': 'execution_complete',
                'status': status,
                'finalOutput': final_output,
                'executionId': ex_id,
            }
            await publish_event(f"execution:{ex_id}", completion_event)

            logger.info("✅ Resume execution %d finished → %s", ex_id, status)

        except Exception as exc:
            logger.error("Resume execution %d crashed: %s", ex_id, exc, exc_info=True)

            error_msg = str(exc)
            entry = f"💥 Crashed during resume: {exc}"
            shared_logs.append(entry)

            if is_redis_enabled():
                try:
                    from .redis_client import append_execution_log
                    await append_execution_log(ex_id, entry)
                except Exception:
                    pass

            await ExecutionRepository.update_status(
                db, ex_id,
                status="failed",
                final_output=error_msg,
                agent_logs=shared_logs,
            )
            await db.commit()

            await set_execution_state(ex_id, "failed")

            failure_event = {
                'type': 'execution_complete',
                'status': 'failed',
                'finalOutput': error_msg,
                'executionId': ex_id,
            }
            await publish_event(f"execution:{ex_id}", failure_event)

        finally:
            await release_lock(lock_name)


# ── SSE stream (Redis Pub/Sub with Polling fallback) ─────────────────────────

from fastapi.responses import StreamingResponse
import json
import time

_SSE_TERMINAL_STATUSES = frozenset({"completed", "failed", "cancelled"})
_SSE_HEARTBEAT_INTERVAL = 15.0


def _sse_should_end_stream(event: dict) -> bool:
    """Only close SSE on terminal execution outcomes, not approval pauses."""
    if event.get("type") != "execution_complete":
        return False
    return event.get("status") in _SSE_TERMINAL_STATUSES


@app.get("/api/executions/{execution_id}/stream")
async def stream_execution(execution_id: int):
    """
    Server-Sent Events stream for live execution updates.
    Reads from Redis Pub/Sub and cached Redis list with local in-memory/DB poll fallback.
    """
    from .redis_client import is_redis_enabled, get_execution_logs, subscribe_channel

    async def _yield_heartbeat(last_heartbeat: float) -> tuple[str, float]:
        now = time.monotonic()
        if now - last_heartbeat >= _SSE_HEARTBEAT_INTERVAL:
            return "event: heartbeat\ndata: ping\n\n", now
        return "", last_heartbeat

    async def _stream_db_poll(last_log_count: int, last_node_count: int):
        last_heartbeat = time.monotonic()
        while True:
            async with AsyncSessionLocal() as db:
                execution = await ExecutionRepository.get_by_id(db, execution_id)
            if not execution:
                yield f"data: {json.dumps({'type': 'error', 'message': 'Execution not found'})}\n\n"
                return

            logs = execution.agent_logs or []
            for log_line in logs[last_log_count:]:
                yield f"data: {json.dumps({'type': 'log', 'message': log_line})}\n\n"
            last_log_count = len(logs)

            node_results = execution.node_results or []
            for nr in node_results[last_node_count:]:
                yield f"data: {json.dumps({'type': 'node_update', 'nodeId': nr.get('nodeId'), 'status': nr.get('status'), 'output': nr.get('output')})}\n\n"
            last_node_count = len(node_results)

            status = execution.status
            if status in _SSE_TERMINAL_STATUSES:
                completion_event = {
                    "type": "execution_complete",
                    "status": status,
                    "finalOutput": execution.final_output or "",
                    "executionId": execution_id,
                }
                yield f"data: {json.dumps(completion_event)}\n\n"
                return

            hb, last_heartbeat = await _yield_heartbeat(last_heartbeat)
            if hb:
                yield hb
            yield ": ping\n\n"
            await asyncio.sleep(1.0)

    async def event_generator():
        cached_logs = []
        if is_redis_enabled():
            cached_logs = await get_execution_logs(execution_id)
        for log_line in cached_logs:
            yield f"data: {json.dumps({'type': 'log', 'message': log_line})}\n\n"

        async with AsyncSessionLocal() as db:
            execution = await ExecutionRepository.get_by_id(db, execution_id)

        if execution and execution.status in _SSE_TERMINAL_STATUSES:
            yield f"data: {json.dumps({
                'type': 'execution_complete',
                'status': execution.status,
                'finalOutput': execution.final_output or '',
                'executionId': execution_id,
            })}\n\n"
            return

        redis_stream_ok = False
        if is_redis_enabled():
            logger.info("SSE: Subscribing to Redis Pub/Sub for execution %d", execution_id)
            try:
                async with subscribe_channel(f"execution:{execution_id}") as pubsub:
                    redis_stream_ok = True
                    last_heartbeat = time.monotonic()
                    while True:
                        message = await pubsub.get_message(
                            ignore_subscribe_messages=True, timeout=1.0
                        )
                        if message:
                            data_str = message.get("data")
                            if data_str:
                                yield f"data: {data_str}\n\n"
                                try:
                                    event = json.loads(data_str)
                                    if _sse_should_end_stream(event):
                                        logger.info(
                                            "SSE: Terminal completion for execution %d",
                                            execution_id,
                                        )
                                        return
                                except json.JSONDecodeError:
                                    pass
                        else:
                            yield ": ping\n\n"

                        hb, last_heartbeat = await _yield_heartbeat(last_heartbeat)
                        if hb:
                            yield hb
            except Exception as e:
                logger.error("Redis SSE stream error for %d: %s", execution_id, e)
                redis_stream_ok = False

        if not redis_stream_ok:
            logger.warning(
                "SSE: Using database polling fallback for execution %d", execution_id
            )
            last_log_count = len(cached_logs)
            last_node_count = 0
            if execution:
                last_node_count = len(execution.node_results or [])
            async for chunk in _stream_db_poll(last_log_count, last_node_count):
                yield chunk

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ── Background execution runner ───────────────────────────────────────────────

async def _run_execution(
    ex_id: int,
    workflow: Any,
    user_input: str,
    node_config_overrides: dict[str, dict] | None = None,
    previous_node_results: list[dict] | None = None,
):
    """
    Execute workflow in background and persist results to database.
    Uses Redis Pub/Sub and caching for real-time SSE streaming.
    """
    from .redis_client import acquire_lock, release_lock, set_execution_state, publish_event, is_redis_enabled
    
    # 1. Distributed lock to prevent duplicate workflow execution
    lock_name = f"workflow_lock:{workflow.id}"
    acquired = await acquire_lock(lock_name, timeout=600)  # Auto-expire in 10 minutes to prevent deadlocks
    if not acquired:
        logger.warning(f"⚠️ Execution {ex_id} cancelled: workflow {workflow.id} is already running.")
        async with AsyncSessionLocal() as db:
            await ExecutionRepository.update_status(
                db,
                ex_id,
                status="failed",
                final_output=f"Failed to acquire lock: workflow {workflow.id} is already running in another execution.",
                agent_logs=[f"💥 Cancelled: another execution is currently running this workflow."]
            )
            await db.commit()
        return

    shared_logs = []
    
    # Centralize execution state in Redis
    await set_execution_state(ex_id, "running")
    
    # Create a new DB session for this execution
    async with AsyncSessionLocal() as db:
        try:
            # Update status to running
            await ExecutionRepository.update_status(db, ex_id, "running")
            await db.commit()
            logger.info("Running execution %d", ex_id)

            # Execute workflow
            result = await run_workflow(
                user_input=user_input,
                nodes=workflow.nodes,
                edges=workflow.edges,
                _log_sink=shared_logs,
                execution_id=ex_id,
                node_config_overrides=node_config_overrides,
                previous_node_results=previous_node_results,
            )

            # Persist results to database
            status = result.get("status", "completed")
            final_output = result.get("finalOutput") or ""
            node_results = result.get("nodeResults", [])
            agent_logs = result.get("agentLogs", [])

            await ExecutionRepository.update_status(
                db,
                ex_id,
                status=status,
                final_output=final_output,
                node_results=node_results,
                agent_logs=agent_logs,
            )
            await db.commit()

            # Centralize execution state in Redis
            await set_execution_state(ex_id, status)

            # Broadcast execution completion via Redis Pub/Sub
            completion_event = {
                'type': 'execution_complete',
                'status': status,
                'finalOutput': final_output,
                'executionId': ex_id,
            }
            await publish_event(f"execution:{ex_id}", completion_event)

            logger.info("✅ Execution %d finished → %s | FINAL OUTPUT: %s",
                        ex_id, status, final_output[:200] if final_output else "(empty)")

        except Exception as exc:
            logger.error("Execution %d crashed: %s", ex_id, exc, exc_info=True)
            
            error_msg = str(exc)
            entry = f"💥 Crashed: {exc}"
            shared_logs.append(entry)
            
            if is_redis_enabled():
                try:
                    from .redis_client import append_execution_log
                    await append_execution_log(ex_id, entry)
                except Exception:
                    pass

            await ExecutionRepository.update_status(
                db,
                ex_id,
                status="failed",
                final_output=error_msg,
                agent_logs=shared_logs,
            )
            await db.commit()

            await set_execution_state(ex_id, "failed")

            # Broadcast failure via Redis Pub/Sub
            failure_event = {
                'type': 'execution_complete',
                'status': 'failed',
                'finalOutput': error_msg,
                'executionId': ex_id,
            }
            await publish_event(f"execution:{ex_id}", failure_event)
            
        finally:
            # Always release lock at the end
            await release_lock(lock_name)

