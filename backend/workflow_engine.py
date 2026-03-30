"""
Executes a workflow (list of ReactFlow-style nodes + edges) sequentially.
Maps frontend node types to actual actions.
"""
import logging
import httpx
from datetime import datetime, timezone
from typing import Any
from .ai import call_ai

logger = logging.getLogger(__name__)

# Frontend node types → handler keys
_AI_TYPES = {"ai_agent", "ai"}
_API_TYPES = {"api_call", "api"}
_CONDITION_TYPES = {"condition"}
_LOOP_TYPES = {"loop"}
_INPUT_TYPES = {"input"}
_OUTPUT_TYPES = {"output"}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _inject(template: str, value: str) -> str:
    return template.replace("{{input}}", value)


async def run_workflow(
    user_input: str,
    nodes: list[dict],
    edges: list[dict] | None = None,
) -> dict[str, Any]:
    """
    Execute nodes in order (topological if edges provided, else list order).
    Returns a dict compatible with the frontend ExecutionDetail schema.
    """
    edges = edges or []
    ordered = _topo_sort(nodes, edges) if edges else nodes

    current = user_input
    node_results: list[dict] = []
    agent_logs: list[str] = []
    final_output = ""

    def log(msg: str):
        logger.info(msg)
        agent_logs.append(f"[{_now()}] {msg}")

    log(f"🚀 Starting execution | input: {user_input[:80]}")

    for node in ordered:
        node_id = node.get("id", "?")
        node_type = (node.get("type") or "").lower()
        label = node.get("label") or node_type
        config = node.get("config") or {}

        log(f"⚙️  Node [{node_id}] type={node_type} label={label}")

        result: dict = {
            "nodeId": node_id,
            "nodeType": node_type,
            "label": label,
            "status": "running",
            "startedAt": _now(),
        }

        try:
            # ── input ──────────────────────────────────────────────────────
            if node_type in _INPUT_TYPES:
                output = user_input
                log(f"  📥 Input node → {output[:80]}")

            # ── ai_agent ───────────────────────────────────────────────────
            elif node_type in _AI_TYPES:
                instruction = str(config.get("instruction") or config.get("prompt") or "Process: {{input}}")
                model = config.get("model") or None
                temperature = float(config.get("temperature") or 0.7)
                prompt = _inject(instruction, current)
                log(f"  🤖 AI prompt [{model or 'default'}]: {prompt[:100]}")
                output = await call_ai(prompt, model=model, temperature=temperature)
                log(f"  💬 AI output: {output[:100]}")

            # ── api_call ───────────────────────────────────────────────────
            elif node_type in _API_TYPES:
                url = str(config.get("url") or "")
                method = str(config.get("method") or "GET").upper()
                if not url:
                    output = f"[API] simulated response for: {current[:60]}"
                    log(f"  🌐 API simulated")
                else:
                    async with httpx.AsyncClient(timeout=10) as http:
                        if method == "POST":
                            resp = await http.post(url, json={"input": current})
                        else:
                            resp = await http.get(url, params={"input": current})
                        resp.raise_for_status()
                        output = resp.text
                    log(f"  🌐 API {method} {url} → {output[:60]}")

            # ── condition ──────────────────────────────────────────────────
            elif node_type in _CONDITION_TYPES:
                expr = str(config.get("expression") or config.get("keyword") or "error")
                passed = expr.lower() not in current.lower()
                output = "true" if passed else "false"
                log(f"  🔀 Condition '{expr}' → {'PASS' if passed else 'HALT'}")
                result.update({
                    "status": "success",
                    "output": {"result": output, "passed": passed},
                    "completedAt": _now(),
                })
                node_results.append(result)
                if not passed:
                    agent_logs.append(f"[{_now()}] ❌ Halted by condition")
                    return _build_result(
                        "failed", current, node_results, agent_logs,
                        reason=f"Condition halted: '{expr}' found in output",
                    )
                current = output
                continue

            # ── loop ───────────────────────────────────────────────────────
            elif node_type in _LOOP_TYPES:
                times = int(config.get("maxIterations") or config.get("times") or 3)
                inner = list(config.get("innerNodes") or [])
                log(f"  🔄 Loop x{times}")
                loop_out = current
                for i in range(times):
                    if inner:
                        sub = await run_workflow(loop_out, inner)
                        loop_out = sub["finalOutput"]
                    log(f"  🔄 Loop iter {i+1}: {loop_out[:60]}")
                output = loop_out

            # ── output ─────────────────────────────────────────────────────
            elif node_type in _OUTPUT_TYPES:
                fmt = str(config.get("format") or "text")
                output = current
                final_output = output
                log(f"  📤 Output ({fmt}): {output[:80]}")
                result.update({
                    "status": "success",
                    "output": {"result": output, "format": fmt},
                    "completedAt": _now(),
                    "durationMs": 0,
                })
                node_results.append(result)
                log("🎉 Execution complete")
                return _build_result("completed", final_output, node_results, agent_logs)

            else:
                output = current
                log(f"  ⚠️  Unknown node type '{node_type}' — passing through")

            result.update({
                "status": "success",
                "output": {"result": output},
                "completedAt": _now(),
            })
            current = output

        except Exception as exc:
            logger.error("Node %s failed: %s", node_id, exc)
            log(f"  ❌ Node {node_id} error: {exc}")
            result.update({"status": "failed", "reasoning": str(exc), "completedAt": _now()})
            node_results.append(result)
            return _build_result("failed", str(exc), node_results, agent_logs)

        node_results.append(result)

    # No explicit output node — return last value
    log("✅ Workflow finished (no output node)")
    return _build_result("completed", current, node_results, agent_logs)


def _build_result(
    status: str,
    final_output: str,
    node_results: list,
    agent_logs: list,
    reason: str | None = None,
) -> dict:
    return {
        "status": status,
        "finalOutput": final_output,
        "nodeResults": node_results,
        "agentLogs": agent_logs,
        **({"reason": reason} if reason else {}),
    }


def _topo_sort(nodes: list[dict], edges: list[dict]) -> list[dict]:
    node_map = {n["id"]: n for n in nodes}
    in_degree: dict[str, int] = {n["id"]: 0 for n in nodes}
    adj: dict[str, list[str]] = {n["id"]: [] for n in nodes}

    for e in edges:
        src, tgt = e.get("source", ""), e.get("target", "")
        if src in adj:
            adj[src].append(tgt)
        if tgt in in_degree:
            in_degree[tgt] = in_degree.get(tgt, 0) + 1

    queue = [n for n in nodes if in_degree[n["id"]] == 0]
    result: list[dict] = []
    while queue:
        node = queue.pop(0)
        result.append(node)
        for neighbor in adj.get(node["id"], []):
            in_degree[neighbor] -= 1
            if in_degree[neighbor] == 0 and neighbor in node_map:
                queue.append(node_map[neighbor])

    # Append any nodes not reached
    seen = {n["id"] for n in result}
    result += [n for n in nodes if n["id"] not in seen]
    return result
