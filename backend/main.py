"""
AgentCraft – FastAPI backend
Matches the frontend API contract exactly (generated from OpenAPI spec).
"""
import logging
import os
from datetime import datetime, timezone
from typing import Any

from dotenv import load_dotenv

# Load .env if present (local dev). On Render, env vars are set via dashboard.
load_dotenv()

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import asyncio
from .workflow_engine import run_workflow
from .ai import generate_workflow_from_prompt, explain_workflow

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

# ── In-memory stores (no DB required) ────────────────────────────────────────
_workflows: dict[int, dict] = {}
_executions: dict[int, dict] = {}
_wf_counter = 0
_ex_counter = 0


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _next_wf_id() -> int:
    global _wf_counter
    _wf_counter += 1
    return _wf_counter


def _next_ex_id() -> int:
    global _ex_counter
    _ex_counter += 1
    return _ex_counter


# ── Pydantic models (mirror frontend schemas) ─────────────────────────────────

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

def _wf_response(wf: dict) -> dict:
    """Return a Workflow-shaped dict."""
    return {
        "id": wf["id"],
        "name": wf["name"],
        "description": wf.get("description"),
        "nodes": wf.get("nodes", []),
        "edges": wf.get("edges", []),
        "createdAt": wf["createdAt"],
        "updatedAt": wf["updatedAt"],
    }


def _ex_response(ex: dict) -> dict:
    """Return an Execution-shaped dict (summary, no nodeResults)."""
    return {
        "id": ex["id"],
        "workflowId": ex["workflowId"],
        "status": ex["status"],
        "input": ex["input"],
        "createdAt": ex["createdAt"],
        "updatedAt": ex["updatedAt"],
    }


def _ex_detail_response(ex: dict) -> dict:
    """Return an ExecutionDetail-shaped dict."""
    return {
        "id": ex["id"],
        "workflowId": ex["workflowId"],
        "status": ex["status"],
        "input": ex["input"],
        "finalOutput": ex.get("finalOutput"),
        "nodeResults": ex.get("nodeResults", []),
        "agentLogs": ex.get("agentLogs", []),
        "createdAt": ex["createdAt"],
        "updatedAt": ex["updatedAt"],
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
async def list_workflows():
    logger.info("GET /api/workflows → %d items", len(_workflows))
    return [_wf_response(w) for w in sorted(_workflows.values(), key=lambda x: x["createdAt"])]


@app.post("/api/workflows", status_code=201)
async def create_workflow(body: CreateWorkflowBody):
    wf_id = _next_wf_id()
    now = _now()
    wf = {
        "id": wf_id,
        "name": body.name,
        "description": body.description,
        "nodes": [n.model_dump() for n in body.nodes],
        "edges": [e.model_dump() for e in body.edges],
        "createdAt": now,
        "updatedAt": now,
    }
    _workflows[wf_id] = wf
    logger.info("POST /api/workflows → created id=%d", wf_id)
    return _wf_response(wf)


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
async def get_workflow(workflow_id: int):
    wf = _workflows.get(workflow_id)
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return _wf_response(wf)


@app.put("/api/workflows/{workflow_id}")
async def update_workflow(workflow_id: int, body: CreateWorkflowBody):
    wf = _workflows.get(workflow_id)
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")
    wf.update({
        "name": body.name,
        "description": body.description,
        "nodes": [n.model_dump() for n in body.nodes],
        "edges": [e.model_dump() for e in body.edges],
        "updatedAt": _now(),
    })
    logger.info("PUT /api/workflows/%d updated", workflow_id)
    return _wf_response(wf)


@app.delete("/api/workflows/{workflow_id}", status_code=204)
async def delete_workflow(workflow_id: int):
    if workflow_id not in _workflows:
        raise HTTPException(status_code=404, detail="Workflow not found")
    del _workflows[workflow_id]
    logger.info("DELETE /api/workflows/%d", workflow_id)


@app.get("/api/workflows/{workflow_id}/explain")
async def explain_workflow_route(workflow_id: int):
    wf = _workflows.get(workflow_id)
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")
    logger.info("GET /api/workflows/%d/explain", workflow_id)
    try:
        result = await explain_workflow(wf["nodes"], wf["edges"], wf["name"])
        return {
            "explanation": result.get("explanation", ""),
            "steps": result.get("steps", []),
        }
    except Exception as exc:
        logger.error("explain_workflow error: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


# ── Executions ────────────────────────────────────────────────────────────────

@app.get("/api/executions")
async def list_executions(workflowId: int | None = Query(default=None)):
    items = list(_executions.values())
    if workflowId is not None:
        items = [e for e in items if e["workflowId"] == workflowId]
    items.sort(key=lambda x: x["createdAt"])
    logger.info("GET /api/executions → %d items", len(items))
    return [_ex_response(e) for e in items]


@app.post("/api/executions", status_code=202)
async def start_execution(body: StartExecutionBody):
    wf = _workflows.get(body.workflowId)
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")

    ex_id = _next_ex_id()
    now = _now()
    ex = {
        "id": ex_id,
        "workflowId": body.workflowId,
        "status": "pending",
        "input": body.input,
        "finalOutput": None,
        "nodeResults": [],
        "agentLogs": [],
        "createdAt": now,
        "updatedAt": now,
    }
    _executions[ex_id] = ex
    logger.info("POST /api/executions → created id=%d for workflow %d", ex_id, body.workflowId)

    # Run asynchronously so we return 202 immediately
    asyncio.create_task(_run_execution(ex_id, wf, body.input))

    return _ex_response(ex)


@app.get("/api/executions/{execution_id}")
async def get_execution(execution_id: int):
    ex = _executions.get(execution_id)
    if not ex:
        raise HTTPException(status_code=404, detail="Execution not found")
    return _ex_detail_response(ex)


@app.post("/api/executions/{execution_id}/cancel")
async def cancel_execution(execution_id: int):
    ex = _executions.get(execution_id)
    if not ex:
        raise HTTPException(status_code=404, detail="Execution not found")
    ex["status"] = "cancelled"
    ex["updatedAt"] = _now()
    logger.info("POST /api/executions/%d/cancel", execution_id)
    return _ex_response(ex)


# ── SSE stream (basic polling fallback) ───────────────────────────────────────

from fastapi.responses import StreamingResponse
import json


@app.get("/api/executions/{execution_id}/stream")
async def stream_execution(execution_id: int):
    """
    Server-Sent Events stream for live execution updates.
    Polls the in-memory store and pushes updates until done.
    """
    async def event_generator():
        last_log_count = 0
        while True:
            ex = _executions.get(execution_id)
            if not ex:
                yield f"data: {json.dumps({'type': 'error', 'message': 'Execution not found'})}\n\n"
                break

            logs = ex.get("agentLogs", [])
            new_logs = logs[last_log_count:]
            for log_line in new_logs:
                yield f"data: {json.dumps({'type': 'log', 'message': log_line})}\n\n"
            last_log_count = len(logs)

            status = ex["status"]
            if status in ("completed", "failed", "cancelled"):
                yield f"data: {json.dumps({'type': 'execution_complete', 'status': status, 'finalOutput': ex.get('finalOutput', '')})}\n\n"
                break

            yield ": ping\n\n"
            await asyncio.sleep(0.5)

    return StreamingResponse(event_generator(), media_type="text/event-stream")


# ── Background execution runner ───────────────────────────────────────────────

async def _run_execution(ex_id: int, wf: dict, user_input: str):
    ex = _executions[ex_id]
    try:
        ex["status"] = "running"
        ex["updatedAt"] = _now()
        logger.info("Running execution %d", ex_id)

        result = await run_workflow(
            user_input=user_input,
            nodes=wf.get("nodes", []),
            edges=wf.get("edges", []),
        )

        ex["status"] = result.get("status", "completed")
        ex["finalOutput"] = result.get("finalOutput", "")
        ex["nodeResults"] = result.get("nodeResults", [])
        ex["agentLogs"] = result.get("agentLogs", [])
        ex["updatedAt"] = _now()
        logger.info("Execution %d finished → %s", ex_id, ex["status"])

    except Exception as exc:
        logger.error("Execution %d crashed: %s", ex_id, exc)
        ex["status"] = "failed"
        ex["agentLogs"].append(f"[{_now()}] 💥 Crashed: {exc}")
        ex["updatedAt"] = _now()
