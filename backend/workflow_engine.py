"""
Executes a workflow (list of ReactFlow-style nodes + edges) sequentially.
Maps frontend node types to actual actions.
"""
import json
import logging
import os
import smtplib
import asyncio
import httpx
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timezone
from typing import Any
from .ai import call_ai

logger = logging.getLogger(__name__)

# ── Node type sets ────────────────────────────────────────────────────────────
_AI_TYPES       = {"ai_agent", "ai"}
_API_TYPES      = {"api_call", "api"}
_CONDITION_TYPES = {"condition"}
_LOOP_TYPES     = {"loop"}
_INPUT_TYPES    = {"input"}
_OUTPUT_TYPES   = {"output"}
_EMAIL_TYPES    = {"email"}
_DELAY_TYPES    = {"delay"}
_WEBHOOK_TYPES  = {"webhook"}
_DB_TYPES       = {"database"}
_FILE_TYPES     = {"file_processor"}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _to_str(value: Any) -> str:
    """Safely convert any value to a string for use as {{input}} injection."""
    if isinstance(value, str):
        return value
    return json.dumps(value, ensure_ascii=False)


def _inject(template: str, value: Any) -> str:
    """Replace {{input}} in template with the string form of value."""
    return template.replace("{{input}}", _to_str(value))


def _parse_json_or_str(value: Any) -> Any:
    """
    If value is a JSON string, parse and return the dict/list.
    Otherwise return as-is.
    """
    if isinstance(value, str):
        stripped = value.strip()
        if stripped.startswith("{") or stripped.startswith("["):
            try:
                return json.loads(stripped)
            except json.JSONDecodeError:
                pass
    return value


def _sanitize_subject(subject: str) -> str:
    """Strip newlines and truncate — SMTP Subject must be a single line."""
    # Take only the first line, strip whitespace, cap at 200 chars
    first_line = subject.splitlines()[0].strip() if subject else ""
    return first_line[:200] or "AgentCraft Workflow Result"


async def _send_email(to: str, subject: str, body: str, fmt: str = "text") -> dict:
    """
    Send email via Gmail SMTP.
    Always returns a structured dict — never raises silently.
    """
    # Debug logging for production troubleshooting
    email_user = os.environ.get("EMAIL_USER", "").strip()
    email_pass = os.environ.get("EMAIL_PASS", "").strip()
    
    # Log environment variable status (without exposing values)
    logger.info("📧 Email credentials check:")
    logger.info(f"   EMAIL_USER present: {bool(email_user)} (length: {len(email_user) if email_user else 0})")
    logger.info(f"   EMAIL_PASS present: {bool(email_pass)} (length: {len(email_pass) if email_pass else 0})")
    
    # Also check os.getenv vs os.environ
    alt_user = os.getenv("EMAIL_USER", "").strip()
    alt_pass = os.getenv("EMAIL_PASS", "").strip()
    logger.info(f"   os.getenv EMAIL_USER: {bool(alt_user)}")
    logger.info(f"   os.getenv EMAIL_PASS: {bool(alt_pass)}")
    
    # List all environment variables that start with EMAIL (for debugging)
    email_vars = {k: "***" for k in os.environ.keys() if k.startswith("EMAIL")}
    logger.info(f"   Available EMAIL_* vars: {list(email_vars.keys())}")

    if not email_user or not email_pass:
        error_msg = "EMAIL_USER and EMAIL_PASS environment variables are not set"
        logger.error(f"❌ {error_msg}")
        logger.error(f"   EMAIL_USER: {'<empty>' if not email_user else '<present>'}")
        logger.error(f"   EMAIL_PASS: {'<empty>' if not email_pass else '<present>'}")
        raise ValueError(error_msg)

    # Subject MUST be a single line — sanitize before building the message
    clean_subject = _sanitize_subject(subject)

    msg = MIMEMultipart("alternative")
    msg["Subject"] = clean_subject
    msg["From"]    = email_user
    msg["To"]      = to

    mime_type = "html" if fmt == "html" else "plain"
    msg.attach(MIMEText(body, mime_type, "utf-8"))

    def _smtp_send():
        with smtplib.SMTP("smtp.gmail.com", 587, timeout=20) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(email_user, email_pass)
            server.sendmail(email_user, to, msg.as_string())

    # Run blocking SMTP in thread pool — never blocks the event loop
    await asyncio.get_event_loop().run_in_executor(None, _smtp_send)

    return {
        "status": "sent",
        "to": to,
        "subject": clean_subject,
        "body": body[:200],  # truncate for output display
    }


async def run_workflow(
    user_input: str,
    nodes: list[dict],
    edges: list[dict] | None = None,
    _log_sink: list[str] | None = None,  # shared list for incremental SSE logging
) -> dict[str, Any]:
    """
    Execute nodes in topological order.
    Each node receives the previous node's output as `current`.
    Returns a dict compatible with the frontend ExecutionDetail schema.
    """
    edges = edges or []
    ordered = _topo_sort(nodes, edges) if edges else nodes

    # `current` carries the live value between nodes — starts as the user's input
    current: Any = user_input
    node_results: list[dict] = []
    # Use shared sink if provided (for incremental SSE), else local list
    agent_logs: list[str] = _log_sink if _log_sink is not None else []
    final_output: str = ""

    def log(msg: str) -> None:
        entry = f"[{_now()}] {msg}"
        logger.info(msg)
        agent_logs.append(entry)

    log(f"🚀 Starting execution | nodes={len(ordered)} | input: {_to_str(user_input)[:80]}")

    for node in ordered:
        node_id   = node.get("id", "?")
        node_type = (node.get("type") or "").lower()
        label     = node.get("label") or node_type
        config    = node.get("config") or {}

        log(f"⚙️  [{label}] type={node_type}")
        log(f"    ↳ input: {_to_str(current)[:120]}")

        result: dict = {
            "nodeId":    node_id,
            "nodeType":  node_type,
            "label":     label,
            "status":    "running",
            "startedAt": _now(),
            "input":     _to_str(current)[:500],
        }

        try:
            output: Any = None  # will be set by each handler

            # ── input ──────────────────────────────────────────────────────
            if node_type in _INPUT_TYPES:
                output = user_input
                log(f"    ✓ Input → {_to_str(output)[:80]}")

            # ── ai_agent ───────────────────────────────────────────────────
            elif node_type in _AI_TYPES:
                instruction = str(
                    config.get("instruction") or config.get("prompt") or "Process: {{input}}"
                )
                model       = config.get("model") or None
                temperature = float(config.get("temperature") or 0.7)
                prompt      = _inject(instruction, current)
                log(f"    🤖 AI [{model or 'default'}]: {prompt[:120]}")
                raw_output  = await call_ai(prompt, model=model, temperature=temperature)
                # Try to parse as JSON so downstream nodes can use structured data
                output = _parse_json_or_str(raw_output)
                log(f"    💬 AI output: {_to_str(output)[:120]}")

            # ── api_call ───────────────────────────────────────────────────
            elif node_type in _API_TYPES:
                url    = str(config.get("url") or "")
                method = str(config.get("method") or "GET").upper()
                if not url:
                    output = f"[API] simulated response for: {_to_str(current)[:60]}"
                    log(f"    🌐 API simulated (no URL configured)")
                else:
                    async with httpx.AsyncClient(timeout=15) as http:
                        if method == "POST":
                            resp = await http.post(url, json={"input": _to_str(current)})
                        else:
                            resp = await http.get(url, params={"input": _to_str(current)})
                        resp.raise_for_status()
                        output = _parse_json_or_str(resp.text)
                    log(f"    🌐 API {method} {url} → {_to_str(output)[:80]}")

            # ── condition ──────────────────────────────────────────────────
            elif node_type in _CONDITION_TYPES:
                expr   = str(config.get("expression") or config.get("keyword") or "error")
                passed = expr.lower() not in _to_str(current).lower()
                output = current  # pass value through unchanged
                log(f"    🔀 Condition '{expr}' → {'PASS ✓' if passed else 'HALT ✗'}")
                result.update({
                    "status":      "success",
                    "output":      {"result": _to_str(output), "passed": passed},
                    "completedAt": _now(),
                })
                node_results.append(result)
                if not passed:
                    log(f"    ❌ Halted by condition: '{expr}' found in output")
                    return _build_result("failed", _to_str(current), node_results, agent_logs,
                                         reason=f"Condition halted: '{expr}' found in output")
                current = output
                continue

            # ── loop ───────────────────────────────────────────────────────
            elif node_type in _LOOP_TYPES:
                times = int(config.get("maxIterations") or config.get("times") or 3)
                inner = list(config.get("innerNodes") or [])
                log(f"    🔄 Loop ×{times}")
                loop_out: Any = current
                for i in range(times):
                    if inner:
                        sub      = await run_workflow(_to_str(loop_out), inner)
                        loop_out = sub["finalOutput"]
                    log(f"    🔄 iter {i+1}: {_to_str(loop_out)[:60]}")
                output = loop_out

            # ── email ──────────────────────────────────────────────────────
            elif node_type in _EMAIL_TYPES:
                to  = str(config.get("to") or "").strip()
                fmt = str(config.get("format") or "text")

                if not to:
                    raise ValueError("Email node: 'to' address is required — set it in the node config")

                # current may be a dict (from AI node) or a plain string
                parsed = _parse_json_or_str(current)

                # Extract subject: config template > parsed dict key > fallback
                subject_tpl = str(config.get("subject") or "AgentCraft Workflow Result")
                if isinstance(parsed, dict) and "subject" in parsed:
                    subject = str(parsed["subject"])
                else:
                    subject = _inject(subject_tpl, current)

                # Extract body: config template > parsed dict key > full current value
                body_tpl = str(config.get("body") or "{{input}}")
                if isinstance(parsed, dict) and "body" in parsed:
                    body = str(parsed["body"])
                elif isinstance(parsed, dict) and "content" in parsed:
                    body = str(parsed["content"])
                else:
                    body = _inject(body_tpl, current)

                log(f"    📧 Sending to={to} | subject={subject[:60]}")
                email_result = await _send_email(to, subject, body, fmt)
                log(f"    ✅ Email sent → {email_result['to']}")
                # Pass the email result dict downstream (output node will display it)
                output = email_result

            # ── output ─────────────────────────────────────────────────────
            elif node_type in _OUTPUT_TYPES:
                fmt    = str(config.get("format") or "text")
                output = current  # output node simply returns what it receives
                final_output = _to_str(output)
                log(f"    📤 Output ({fmt}): {final_output[:120]}")
                result.update({
                    "status":      "success",
                    "output":      {"result": final_output, "format": fmt},
                    "completedAt": _now(),
                })
                node_results.append(result)
                log("🎉 Workflow complete")
                return _build_result("completed", final_output, node_results, agent_logs)

            # ── delay ──────────────────────────────────────────────────────
            elif node_type in _DELAY_TYPES:
                seconds = min(int(config.get("seconds") or 5), 60)
                log(f"    ⏱️  Waiting {seconds}s...")
                await asyncio.sleep(seconds)
                output = current
                log(f"    ✅ Delay complete")

            # ── webhook ────────────────────────────────────────────────────
            elif node_type in _WEBHOOK_TYPES:
                output = current
                log(f"    🔗 Webhook — passing through")

            # ── database ───────────────────────────────────────────────────
            elif node_type in _DB_TYPES:
                operation = str(config.get("operation") or "read")
                query     = str(config.get("query") or "")
                log(f"    🗄️  DB {operation}: {query[:60]}")
                output = f"[DB {operation}] simulated result for: {_to_str(current)[:60]}"
                log(f"    ✅ {output[:60]}")

            # ── file processor ─────────────────────────────────────────────
            elif node_type in _FILE_TYPES:
                operation = str(config.get("operation") or "read")
                path      = str(config.get("path") or "")
                log(f"    📄 File {operation}: {path}")
                output = f"[File {operation}] simulated result for: {_to_str(current)[:60]}"
                log(f"    ✅ {output[:60]}")

            # ── unknown ────────────────────────────────────────────────────
            else:
                output = current
                log(f"    ⚠️  Unknown type '{node_type}' — passing through")

            # Guard: output must never be None
            if output is None:
                output = current
                log(f"    ⚠️  Node returned None — using previous value")

            log(f"    ✓ output: {_to_str(output)[:120]}")

            result.update({
                "status":      "success",
                "output":      {"result": _to_str(output)},
                "completedAt": _now(),
            })
            current = output

        except Exception as exc:
            error_msg = f"Node [{label}] failed: {exc}"
            logger.error(error_msg, exc_info=True)
            log(f"    ❌ {error_msg}")
            result.update({
                "status":      "failed",
                "reasoning":   error_msg,
                "completedAt": _now(),
            })
            node_results.append(result)
            return _build_result("failed", error_msg, node_results, agent_logs)

        node_results.append(result)

    # Workflow finished without an explicit output node
    final_output = _to_str(current)
    log(f"✅ Workflow finished | final: {final_output[:120]}")
    return _build_result("completed", final_output, node_results, agent_logs)


def _build_result(
    status: str,
    final_output: str,
    node_results: list,
    agent_logs: list,
    reason: str | None = None,
) -> dict:
    return {
        "status":      status,
        "finalOutput": final_output,
        "nodeResults": node_results,
        "agentLogs":   agent_logs,
        **({"reason": reason} if reason else {}),
    }


def _topo_sort(nodes: list[dict], edges: list[dict]) -> list[dict]:
    node_map   = {n["id"]: n for n in nodes}
    in_degree  = {n["id"]: 0 for n in nodes}
    adj: dict[str, list[str]] = {n["id"]: [] for n in nodes}

    for e in edges:
        src, tgt = e.get("source", ""), e.get("target", "")
        if src in adj:
            adj[src].append(tgt)
        if tgt in in_degree:
            in_degree[tgt] += 1

    queue  = [n for n in nodes if in_degree[n["id"]] == 0]
    result: list[dict] = []
    while queue:
        node = queue.pop(0)
        result.append(node)
        for neighbor in adj.get(node["id"], []):
            in_degree[neighbor] -= 1
            if in_degree[neighbor] == 0 and neighbor in node_map:
                queue.append(node_map[neighbor])

    # Append any disconnected nodes
    seen = {n["id"] for n in result}
    result += [n for n in nodes if n["id"] not in seen]
    return result
