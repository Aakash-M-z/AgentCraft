"""
AgentCraft – FastAPI backend with Neon PostgreSQL
Production-ready workflow automation platform.
"""
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

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(title="AgentCraft – AI Workflow Engine", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Lifecycle Events ──────────────────────────────────────────────────────────

@app.on_event("startup")
async def startup_event():
    """Initialize database on startup."""
    logger.info("🚀 Starting AgentCraft...")
    await init_db()
    logger.info("✅ AgentCraft ready!")


@app.on_event("shutdown")
async def shutdown_event():
    """Close database connections on shutdown."""
    logger.info("👋 Shutting down AgentCraft...")
    await close_db()
    logger.info("✅ Cleanup complete")


# ── In-memory execution tracking (temporary, for SSE streaming) ───────────────
# Note: Executions are persisted in DB, but we keep a reference here for active SSE streams
_active_executions: dict[int, dict] = {}


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
        
        workflow = await WorkflowRepository.create(
            db,
            name=body.name,
            description=body.description,
            nodes=[n.model_dump() for n in body.nodes],
            edges=[e.model_dump() for e in body.edges],
        )
        
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
        
        workflow = await WorkflowRepository.update(
            db,
            workflow_id=workflow_id,
            name=body.name,
            description=body.description,
            nodes=[n.model_dump() for n in body.nodes],
            edges=[e.model_dump() for e in body.edges],
        )
        
        if not workflow:
            raise HTTPException(status_code=404, detail="Workflow not found")
            
        logger.info("✅ PUT /api/workflows/%d updated", workflow_id)
        return _wf_response(workflow)
        
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("❌ Failed to update workflow %d: %s", workflow_id, exc, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to update workflow: {str(exc)}")


@app.delete("/api/workflows/{workflow_id}", status_code=204)
async def delete_workflow(workflow_id: int, db: AsyncSession = Depends(get_db)):
    """Delete workflow from database."""
    deleted = await WorkflowRepository.delete(db, workflow_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Workflow not found")
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

        # Store in active executions for SSE streaming
        _active_executions[execution.id] = {
            "id": execution.id,
            "workflowId": execution.workflow_id,
            "status": execution.status,
            "agentLogs": [],  # Will be populated during execution
        }

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


# ── SSE stream (basic polling fallback) ───────────────────────────────────────

from fastapi.responses import StreamingResponse
import json


@app.get("/api/executions/{execution_id}/stream")
async def stream_execution(execution_id: int):
    """
    Server-Sent Events stream for live execution updates.
    Reads from database and active execution cache.
    """
    async def event_generator():
        last_log_count = 0
        last_node_count = 0
        
        # Create a new DB session for this stream
        async with AsyncSessionLocal() as db:
            while True:
                # Get execution from database
                execution = await ExecutionRepository.get_by_id(db, execution_id)
                if not execution:
                    yield f"data: {json.dumps({'type': 'error', 'message': 'Execution not found'})}\n\n"
                    break

                # Get live logs from active execution cache
                active_ex = _active_executions.get(execution_id, {})
                logs = active_ex.get("agentLogs", [])
                
                # Stream new logs
                new_logs = logs[last_log_count:]
                for log_line in new_logs:
                    yield f"data: {json.dumps({'type': 'log', 'message': log_line})}\n\n"
                last_log_count = len(logs)

                # Stream node status updates
                node_results = execution.node_results or []
                new_nodes = node_results[last_node_count:]
                for nr in new_nodes:
                    yield f"data: {json.dumps({'type': 'node_update', 'nodeId': nr.get('nodeId'), 'status': nr.get('status'), 'output': nr.get('output')})}\n\n"
                last_node_count = len(node_results)

                status = execution.status
                if status in ("completed", "failed", "cancelled"):
                    # CRITICAL: Always send final output, never None
                    final_output = execution.final_output or ""
                    completion_event = {
                        'type': 'execution_complete',
                        'status': status,
                        'finalOutput': final_output,
                        'executionId': execution_id,
                    }
                    logger.info("SSE: Sending completion event for execution %d | status=%s | output=%.80s", 
                               execution_id, status, final_output)
                    yield f"data: {json.dumps(completion_event)}\n\n"
                    
                    # Clean up active execution cache
                    _active_executions.pop(execution_id, None)
                    break

                yield ": ping\n\n"
                await asyncio.sleep(0.5)

    return StreamingResponse(event_generator(), media_type="text/event-stream")


# ── Background execution runner ───────────────────────────────────────────────

async def _run_execution(ex_id: int, workflow: Any, user_input: str):
    """
    Execute workflow in background and persist results to database.
    Uses active execution cache for real-time SSE streaming.
    """
    # Get active execution for live logging
    active_ex = _active_executions.get(ex_id, {})
    shared_logs: list[str] = active_ex.get("agentLogs", [])
    
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
                _log_sink=shared_logs,  # logs written here appear in SSE immediately
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

            # CRITICAL DEBUG LOG
            logger.info("✅ Execution %d finished → %s | FINAL OUTPUT: %s",
                        ex_id, status, final_output[:200] if final_output else "(empty)")
            print(f"🔍 DEBUG: Execution {ex_id} | Status: {status} | Output length: {len(final_output)}")
            print(f"🔍 DEBUG: Final output preview: {final_output[:200]}")

        except Exception as exc:
            logger.error("Execution %d crashed: %s", ex_id, exc, exc_info=True)
            
            # Persist error to database
            error_msg = str(exc)
            shared_logs.append(f"[{_now()}] 💥 Crashed: {exc}")
            
            await ExecutionRepository.update_status(
                db,
                ex_id,
                status="failed",
                final_output=error_msg,
                agent_logs=shared_logs,
            )
            await db.commit()

