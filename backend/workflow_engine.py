"""
Executes a workflow (list of ReactFlow-style nodes + edges) sequentially.
Maps frontend node types to actual actions.
"""
import json
import logging
import os
import asyncio
import sys

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

import httpx
from datetime import datetime, timezone
from typing import Any
from .ai import call_ai

logger = logging.getLogger(__name__)

# ── Node type sets ────────────────────────────────────────────────────────────
_AI_TYPES       = {"ai_agent", "ai"}
_API_TYPES      = {"api_call", "api"}
_CONDITION_TYPES = {"condition"}
_LOOP_TYPES     = {"loop"}
_INPUT_TYPES    = {"input", "schedule_trigger"}
_OUTPUT_TYPES   = {"output"}
_EMAIL_TYPES    = {"email"}
_DELAY_TYPES    = {"delay"}
_WEBHOOK_TYPES  = {"webhook"}
_DB_TYPES       = {"database"}
_FILE_TYPES     = {"file_processor"}
_LEETCODE_TYPES = {"leetcode_daily"}
_AI_SOLVER_TYPES= {"ai_solver"}
_DISCORD_TYPES  = {"discord_webhook"}
_TELEGRAM_TYPES = {"telegram_bot"}
_SUBMIT_TYPES   = {"leetcode_submit"}
_WHATSAPP_MONITOR_TYPES = {"whatsapp_monitor"}
_WHATSAPP_SENDER_TYPES  = {"whatsapp_sender", "whatsapp_message_sender"}
_LIFE_OS_EXTRACTOR_TYPES = {"life_os_extractor", "whatsapp_extractor"}
_LEETCODE_SAVE_TYPES = {"leetcode_save"}
_FETCH_LIFE_OS_TYPES = {"fetch_life_os"}
_BRIEFING_GENERATOR_TYPES = {"briefing_generator"}
_GITHUB_TYPES = {"github", "github_activity"}
_WEATHER_TYPES = {"weather", "weather_info"}


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


def _strip_markdown_fences(text: str) -> str:
    """Remove optional markdown code fences from model output."""
    stripped = text.strip()
    if stripped.startswith("```"):
        lines = stripped.splitlines()
        if len(lines) >= 2 and lines[-1].strip() == "```":
            return "\n".join(lines[1:-1]).strip()
    return stripped


def _ensure_plain_text_message(text: str, *, context: str = "message") -> str:
    """Reject JSON-shaped output before sending to WhatsApp."""
    stripped = (text or "").strip()
    if stripped.startswith("{") or stripped.startswith("["):
        raise ValueError(
            f"AI output appears to be JSON instead of final mentor message ({context})."
        )
    return stripped


def _extract_message_text(value: Any) -> str:
    """Extract human-readable message text from AI or upstream node output."""
    if isinstance(value, str):
        return _strip_markdown_fences(value)
    if isinstance(value, dict):
        for key in ("message", "reason", "text", "content", "result"):
            if key in value and value[key]:
                candidate = value[key]
                if isinstance(candidate, str):
                    return _strip_markdown_fences(candidate)
                return _strip_markdown_fences(str(candidate))
    return _strip_markdown_fences(_to_str(value))


def _sanitize_subject(subject: str) -> str:
    """Strip newlines and truncate — SMTP Subject must be a single line."""
    # Take only the first line, strip whitespace, cap at 200 chars
    first_line = subject.splitlines()[0].strip() if subject else ""
    return first_line[:200] or "AgentCraft Workflow Result"


def _get_solver_instruction(language: str, problem_desc: str, starter_code: str) -> str:
    """Compile a highly-optimized competitive programming prompt to prevent LeetCode TLE."""
    instruction = f"""You are an expert competitive programmer and algorithms specialist. Solve the following LeetCode problem in {language}.

STRICT RULES for the "solution" field:
- Write ONLY the Solution class (or equivalent top-level function if needed).
- Do NOT include any import statements (LeetCode already imports them).
- Do NOT include any if __name__ == "__main__" blocks, test code, or examples.
- Do NOT wrap code in Markdown fences (no ```python).
- The code must be 100% syntactically valid {language} that LeetCode can run directly.
- CRITICAL: You MUST write the most optimal solution possible. Avoid brute-force approaches that cause Time Limit Exceeded (TLE) on LeetCode's large hidden test cases. 
  * Aim for O(N), O(N log N), or O(log N) time complexity.
  * For list/array lookups, use sets/hashmaps (O(1)) instead of list scans/checks (O(N)).
  * For queue/deque operations, use `collections.deque` in Python (O(1)) instead of `list.insert(0)` or `list.pop(0)` (O(N)).
  * For Dynamic Programming, ALWAYS use memoization/caching (e.g. `@lru_cache(None)` or standard memoization dict in Python) or bottom-up tabulation to avoid exponential time complexity O(2^N).
  * For searching, use binary search O(log N) instead of linear scan O(N) when data is sorted.
  * For sliding window or two-pointer problems, maintain linear runtime O(N).
  * Avoid any unnecessary array duplication or nested loops where a single pass or hashmap-assisted lookup suffices.
  * CRITICAL: Be extremely careful of infinite loops caused by math traps (such as repeated squaring, multiplication, or division when the value is 0 or 1. e.g. x = x * x remains 1 forever). Always handle these edge cases (like 1s and 0s) explicitly and separately to prevent hanging.
"""
    if starter_code:
        instruction += f"""- YOU MUST KEEP the exact class and method signatures from this starter code template:
```
{starter_code}
```
"""
    else:
        instruction += f"""- If you are writing in Python, the class should be named `Solution` and the standard LeetCode method signature must be used.
"""

    instruction += f"""
Problem:
{problem_desc}

Return ONLY a valid JSON object (no markdown, no extra text) matching this schema:
{{
  "title": "Problem Title",
  "difficulty": "Easy/Medium/Hard",
  "approach": "Concise explanation of your algorithm",
  "time_complexity": "O(...)",
  "space_complexity": "O(...)",
  "solution": "ONLY the Solution class code here"
}}"""
    return instruction


async def _send_email(to: str, subject: str, body: str, fmt: str = "text") -> dict:
    """
    Send email via Brevo Transactional Email REST API.
    Uses HTTPS (port 443) — works on all cloud hosts including Render.
    EMAIL_USER = sender address, EMAIL_PASS = Brevo API key (xkeysib-...).
    Always returns a structured dict — never raises silently.
    """
    sender_email = os.environ.get("EMAIL_USER", "").strip()
    api_key      = os.environ.get("EMAIL_PASS", "").strip()

    logger.info("📧 Brevo API email:")
    logger.info(f"   Sender:  {'<set>' if sender_email else '<MISSING>'}")
    logger.info(f"   API key: {'<set>' if api_key else '<MISSING>'}")

    if not sender_email or not api_key:
        missing = [v for v, val in [("EMAIL_USER", sender_email), ("EMAIL_PASS", api_key)] if not val]
        raise ValueError(f"Brevo email: missing env vars: {', '.join(missing)}")

    clean_subject = _sanitize_subject(subject)

    payload: dict = {
        "sender":  {"email": sender_email},
        "to":      [{"email": to}],
        "subject": clean_subject,
    }
    if fmt == "html":
        payload["htmlContent"] = body
    else:
        payload["textContent"] = body

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            "https://api.brevo.com/v3/smtp/email",
            headers={
                "api-key":     api_key,
                "Content-Type": "application/json",
                "Accept":       "application/json",
            },
            json=payload,
        )

    if resp.status_code not in (200, 201):
        error_msg = resp.text
        if "unrecognised IP address" in error_msg.lower():
            # Extract the IP address if possible
            import re
            ip_match = re.search(r"(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}|[0-9a-fA-F:]+)", error_msg)
            ip_str = ip_match.group(1) if ip_match else "your current local IP"
            raise RuntimeError(
                f"Brevo API error: Unrecognized IP address ({ip_str}). "
                "Brevo has blocked the email send request because this IP is not in your authorized list. "
                "Please log in to your Brevo dashboard, go to Settings -> Security -> Authorized IPs, "
                "and add this IP address or disable IP security restrictions."
            )
        raise RuntimeError(
            f"Brevo API error {resp.status_code}: {error_msg[:300]}"
        )

    logger.info(f"   ✅ Brevo accepted → messageId: {resp.json().get('messageId', '?')}")
    return {
        "status":  "sent",
        "to":      to,
        "subject": clean_subject,
        "body":    body[:200],
    }


async def run_workflow(
    user_input: str,
    nodes: list[dict],
    edges: list[dict] | None = None,
    _log_sink: list[str] | None = None,  # shared list for incremental SSE logging
    execution_id: int | None = None,
    node_config_overrides: dict[str, dict] | None = None,
    previous_node_results: list[dict] | None = None,
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
    
    # Track successful nodes from previous execution runs (for human-in-the-loop resume)
    successful_nodes = {}
    if previous_node_results:
        for r in previous_node_results:
            if r.get("status") == "success":
                successful_nodes[r["nodeId"]] = r
                node_results.append(r)
                
    # Use shared sink if provided (for incremental SSE), else local list
    agent_logs: list[str] = _log_sink if _log_sink is not None else []
    final_output: str = ""

    def log(msg: str) -> None:
        entry = f"[{_now()}] {msg}"
        logger.info(msg)
        agent_logs.append(entry)
        if execution_id:
            try:
                from .redis_client import publish_event, append_execution_log
                asyncio.create_task(publish_event(f"execution:{execution_id}", {
                    "type": "log",
                    "message": entry
                }))
                asyncio.create_task(append_execution_log(execution_id, entry))
            except Exception as e:
                logger.error(f"Failed to publish/cache log to Redis for {execution_id}: {e}")

    log(f"🚀 Starting execution | nodes={len(ordered)} | input: {_to_str(user_input)[:80]}")

    for node in ordered:
        node_id   = node.get("id", "?")
        node_type = (node.get("type") or "").lower()
        label     = node.get("label") or node_type
        config    = node.get("config") or {}

        # Skip successfully completed nodes from a previous resume
        if node_id in successful_nodes:
            log(f"⏭️  [{label}] already completed successfully. Skipping execution.")
            completed_result = successful_nodes[node_id]
            out_val = completed_result.get("output", {})
            if isinstance(out_val, dict) and "result" in out_val:
                current = _parse_json_or_str(out_val["result"])
            else:
                current = out_val
            continue

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

        if execution_id:
            try:
                from .redis_client import publish_event
                asyncio.create_task(publish_event(f"execution:{execution_id}", {
                    "type": "node_update",
                    "nodeId": node_id,
                    "status": "running",
                    "output": None
                }))
            except Exception as e:
                logger.error(f"Failed to publish node start to Redis: {e}")

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
                output_format = str(config.get("outputFormat") or "").lower()
                prompt      = _inject(instruction, current)
                log(f"    🤖 AI [{model or 'default'}]: {prompt[:120]}")
                raw_output  = await call_ai(prompt, model=model, temperature=temperature)
                if output_format == "plain_text":
                    output = _strip_markdown_fences(raw_output)
                    _ensure_plain_text_message(output, context="ai_agent plain_text")
                else:
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
                operator = config.get("operator", "not_contains")
                current_str = _to_str(current).lower()
                expr_lower = expr.lower()
                
                if operator == "contains":
                    passed = expr_lower in current_str
                elif operator == "equals":
                    passed = expr_lower == current_str
                else: # not_contains
                    passed = expr_lower not in current_str
                    
                output = current  # pass value through unchanged
                log(f"    🔀 Condition (operator={operator}, value='{expr}') → {'PASS ✓' if passed else 'HALT ✗'}")
                result.update({
                    "status":      "success",
                    "output":      {"result": _to_str(output), "passed": passed},
                    "completedAt": _now(),
                })
                node_results.append(result)
                
                if execution_id:
                    try:
                        from .redis_client import publish_event
                        asyncio.create_task(publish_event(f"execution:{execution_id}", {
                            "type": "node_update",
                            "nodeId": node_id,
                            "status": "success",
                            "output": {"result": _to_str(output), "passed": passed}
                        }))
                    except Exception as e:
                        logger.error(f"Failed to publish node success to Redis: {e}")

                if not passed:
                    log(f"    ❌ Halted by condition: condition check failed")
                    return _build_result("failed", _to_str(current), node_results, agent_logs,
                                         reason=f"Condition halted: check failed")
                    
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
                
                if execution_id:
                    try:
                        from .redis_client import publish_event
                        asyncio.create_task(publish_event(f"execution:{execution_id}", {
                            "type": "node_update",
                            "nodeId": node_id,
                            "status": "success",
                            "output": {"result": final_output, "format": fmt}
                        }))
                    except Exception as e:
                        logger.error(f"Failed to publish node success to Redis: {e}")

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

            # ── leetcode_daily ─────────────────────────────────────────────
            elif node_type in _LEETCODE_TYPES:
                log(f"    🌐 Fetching LeetCode daily challenge...")
                # GraphQL query for daily question
                query = """
                query questionOfToday {
                  activeDailyCodingChallengeQuestion {
                    date
                    link
                    question {
                      title
                      titleSlug
                      questionId
                      questionFrontendId
                      difficulty
                      content
                      codeSnippets {
                        lang
                        langSlug
                        code
                      }
                    }
                  }
                }
                """
                async with httpx.AsyncClient(timeout=15) as http:
                    resp = await http.post("https://leetcode.com/graphql", json={"query": query})
                    resp.raise_for_status()
                    data = resp.json()
                    
                    try:
                        challenge = data["data"]["activeDailyCodingChallengeQuestion"]
                        q_data = challenge["question"]
                        output = {
                            "title": q_data["title"],
                            "titleSlug": q_data["titleSlug"],
                            "questionId": q_data.get("questionId") or q_data.get("questionFrontendId") or "",
                            "difficulty": q_data["difficulty"],
                            "content": q_data["content"][:2000] + "..." if len(q_data.get("content", "")) > 2000 else q_data.get("content", ""),
                            "link": f"https://leetcode.com/problems/{q_data['titleSlug']}/",
                            "codeSnippets": q_data.get("codeSnippets") or []
                        }
                        log(f"    ✅ Fetched: {output['title']} ({output['difficulty']})")
                    except KeyError as e:
                        raise ValueError(f"Failed to parse LeetCode API response: {data}")
                        
            # ── ai_solver ──────────────────────────────────────────────────
            elif node_type in _AI_SOLVER_TYPES:
                model       = config.get("model") or "llama-3.3-70b-versatile"
                language    = config.get("language") or "Python"
                temperature = float(config.get("temperature") or 0.2) # Lower temp for coding
                
                # Assume current is the LeetCode output dict
                lc_data = _parse_json_or_str(current)
                problem_desc = str(lc_data)
                starter_code = ""
                if isinstance(lc_data, dict):
                    problem_desc = f"Title: {lc_data.get('title')}\nDifficulty: {lc_data.get('difficulty')}\n{lc_data.get('content')}"
                    snippets = lc_data.get("codeSnippets") or []
                    target_lang = language.lower().replace(" ", "")
                    for snip in snippets:
                        s_lang = snip.get("lang", "").lower()
                        s_slug = snip.get("langSlug", "").lower()
                        if target_lang in s_lang or target_lang in s_slug or s_slug in target_lang:
                            starter_code = snip.get("code", "")
                            break
                
                instruction = _get_solver_instruction(language, problem_desc, starter_code)
                
                log(f"    🤖 AI Solver [{model}] - Language: {language}")
                raw_output  = await call_ai(instruction, model=model, temperature=temperature, force_json=True)
                output = _parse_json_or_str(raw_output)
                if isinstance(output, dict) and "solution" in output:
                    import textwrap
                    output["solution"] = textwrap.dedent(output["solution"]).strip()
                # Carry upstream LeetCode metadata through for leetcode_submit node
                if isinstance(lc_data, dict) and isinstance(output, dict):
                    output.setdefault("titleSlug", lc_data.get("titleSlug", ""))
                    output.setdefault("questionId", lc_data.get("questionId", ""))
                    output.setdefault("language", language)
                log(f"    💬 Solution generated")
                

            # ── discord_webhook ────────────────────────────────────────────
            elif node_type in _DISCORD_TYPES:
                webhook_url = str(config.get("webhookUrl") or "").strip()
                if not webhook_url:
                    raise ValueError("Discord Webhook URL is missing")
                
                parsed = _parse_json_or_str(current)
                # If we received the AI solver output, format a nice embed
                if isinstance(parsed, dict) and "solution" in parsed:
                    content = {
                        "embeds": [{
                            "title": f"🚀 LeetCode Daily: {parsed.get('title', 'Unknown')} ({parsed.get('difficulty', '')})",
                            "color": 5814783,
                            "fields": [
                                {"name": "Approach", "value": str(parsed.get("approach", ""))[:1024]},
                                {"name": "Time Complexity", "value": parsed.get("time_complexity", ""), "inline": True},
                                {"name": "Space Complexity", "value": parsed.get("space_complexity", ""), "inline": True},
                            ],
                            "description": f"```python\n{parsed.get('solution', '')}\n```"
                        }]
                    }
                else:
                    content = {"content": f"AgentCraft Workflow Result:\n```\n{_to_str(current)[:1900]}\n```"}
                    
                log(f"    👾 Sending Discord webhook...")
                async with httpx.AsyncClient(timeout=10) as http:
                    resp = await http.post(webhook_url, json=content)
                    if resp.status_code not in (200, 204):
                        log(f"    ⚠️ Discord webhook returned {resp.status_code}: {resp.text}")
                    else:
                        log(f"    ✅ Sent to Discord")
                output = current
                
            # ── weather ──────────────────────────────────────────────────
            elif node_type in _WEATHER_TYPES:
                api_key = (config.get("apiKey") or os.getenv("WEATHER_API_KEY") or "").strip()
                city = (config.get("city") or "").strip()
                units = (config.get("units") or "celsius").lower().strip()

                if not api_key:
                    raise ValueError("Weather Node: Weather API Key is missing. Add it to config or set WEATHER_API_KEY in .env.")
                if not city:
                    raise ValueError("Weather Node: City parameter is missing.")

                log("🌦 Connecting to Weather API...")
                log(f"📍 Reading weather for city: {city}...")

                url = "http://api.weatherapi.com/v1/current.json"
                params = {
                    "key": api_key,
                    "q": city,
                    "aqi": "no"
                }

                try:
                    async with httpx.AsyncClient(timeout=10) as http:
                        resp = await http.get(url, params=params)
                except httpx.TimeoutException:
                    raise RuntimeError("Weather Node: Weather API connection timed out.")
                except Exception as e:
                    raise RuntimeError(f"Weather Node: Failed to connect to Weather API: {e}")

                if resp.status_code == 400:
                    err_data = resp.json().get("error", {})
                    err_msg = err_data.get("message", "")
                    err_code = err_data.get("code")
                    if err_code == 1006:
                        raise ValueError(f"Weather Node: Invalid city name '{city}'. Location not found.")
                    raise ValueError(f"Weather Node API Error: {err_msg}")
                elif resp.status_code in (401, 403):
                    raise ValueError("Weather Node: Invalid Weather API Key provided.")
                elif resp.status_code != 200:
                    raise RuntimeError(f"Weather Node API returned HTTP {resp.status_code}: {resp.text}")

                data = resp.json()
                current_weather = data.get("current", {})
                condition_data = current_weather.get("condition", {})
                
                # Extract requested unit metrics
                temp = int(round(current_weather.get("temp_c" if units == "celsius" else "temp_f", 0)))
                wind = current_weather.get("wind_kph" if units == "celsius" else "wind_mph", 0)

                output = {
                    "city": data.get("location", {}).get("name", city),
                    "temperature": temp,
                    "condition": condition_data.get("text", "Unknown"),
                    "humidity": current_weather.get("humidity", 0),
                    "wind_speed": int(round(wind))
                }

                log("✅ Weather data collected.")

            # ── github ───────────────────────────────────────────────────
            elif node_type in _GITHUB_TYPES:
                github_token = (config.get("githubToken") or os.getenv("GITHUB_TOKEN") or "").strip()
                username = (config.get("username") or "").strip()
                repository = (config.get("repository") or "").strip()
                
                try:
                    max_events = int(config.get("maxEvents") or 5)
                except ValueError:
                    max_events = 5

                if not username:
                    raise ValueError("GitHub Node: Username parameter is missing.")

                log("🐙 Connecting to GitHub...")

                headers = {
                    "Accept": "application/vnd.github+json",
                    "User-Agent": "AgentCraft-App",
                    "X-GitHub-Api-Version": "2022-11-28"
                }
                if github_token:
                    headers["Authorization"] = f"Bearer {github_token}"

                owner = username
                repo = ""
                if repository:
                    log(f"📂 Reading repository: {repository}...")
                    if "/" in repository:
                        owner, repo = repository.split("/", 1)
                        owner = owner.strip()
                        repo = repo.strip()
                    else:
                        repo = repository.strip()
                else:
                    log("📂 Accessing global user account...")

                log("📊 Collecting activity...")

                async with httpx.AsyncClient(timeout=15) as http:
                    # 1. Fetch Pull Requests
                    pr_query = f"author:{username} type:pr state:open"
                    if repository:
                        pr_query += f" repo:{owner}/{repo}"
                    
                    try:
                        pr_resp = await http.get("https://api.github.com/search/issues", headers=headers, params={"q": pr_query})
                        if pr_resp.status_code != 200:
                            log(f"    ⚠️ GitHub PR search failed: HTTP {pr_resp.status_code}")
                            open_prs_count = 0
                        else:
                            open_prs_count = pr_resp.json().get("total_count", 0)
                    except Exception as e:
                        log(f"    ⚠️ GitHub PR search errored: {e}")
                        open_prs_count = 0

                    # 2. Fetch Assigned Issues
                    issue_query = f"assignee:{username} type:issue state:open"
                    if repository:
                        issue_query += f" repo:{owner}/{repo}"
                    
                    try:
                        issue_resp = await http.get("https://api.github.com/search/issues", headers=headers, params={"q": issue_query})
                        if issue_resp.status_code != 200:
                            log(f"    ⚠️ GitHub Issue search failed: HTTP {issue_resp.status_code}")
                            assigned_issues_count = 0
                        else:
                            assigned_issues_count = issue_resp.json().get("total_count", 0)
                    except Exception as e:
                        log(f"    ⚠️ GitHub Issue search errored: {e}")
                        assigned_issues_count = 0

                    # 3. Fetch Recent Commits
                    commits = []
                    if repository:
                        try:
                            commits_url = f"https://api.github.com/repos/{owner}/{repo}/commits"
                            commits_resp = await http.get(commits_url, headers=headers, params={"author": username, "per_page": max_events})
                            if commits_resp.status_code == 200:
                                for c in commits_resp.json()[:max_events]:
                                    commit_data = c.get("commit", {})
                                    commits.append({
                                        "sha": c.get("sha", "")[:7],
                                        "message": commit_data.get("message", "").split("\n")[0],
                                        "date": commit_data.get("author", {}).get("date", "")
                                    })
                            else:
                                log(f"    ⚠️ GitHub commits fetch failed: HTTP {commits_resp.status_code}")
                        except Exception as e:
                            log(f"    ⚠️ GitHub commits fetch errored: {e}")
                    else:
                        try:
                            events_url = f"https://api.github.com/users/{username}/events"
                            events_resp = await http.get(events_url, headers=headers)
                            if events_resp.status_code == 200:
                                events_list = events_resp.json()
                                for ev in events_list:
                                    if len(commits) >= max_events:
                                        break
                                    if ev.get("type") == "PushEvent":
                                        payload = ev.get("payload", {})
                                        repo_name = ev.get("repo", {}).get("name", "")
                                        for c in payload.get("commits", []):
                                            if len(commits) >= max_events:
                                                break
                                            commits.append({
                                                "sha": c.get("sha", "")[:7],
                                                "message": c.get("message", "").split("\n")[0],
                                                "repository": repo_name
                                            })
                            else:
                                log(f"    ⚠️ GitHub events fetch failed: HTTP {events_resp.status_code}")
                        except Exception as e:
                            log(f"    ⚠️ GitHub events fetch errored: {e}")

                    # 4. Fetch Pending Reviews
                    pending_reviews = 0
                    review_query = f"review-requested:{username} type:pr state:open"
                    if repository:
                        review_query += f" repo:{owner}/{repo}"
                    try:
                        review_resp = await http.get("https://api.github.com/search/issues", headers=headers, params={"q": review_query})
                        if review_resp.status_code == 200:
                            pending_reviews = review_resp.json().get("total_count", 0)
                    except Exception:
                        pass

                output = {
                    "username": username,
                    "repository": repository or "all-repositories",
                    "open_prs": open_prs_count,
                    "assigned_issues": assigned_issues_count,
                    "recent_commits": len(commits),
                    "pending_reviews": pending_reviews,
                    "recent_activity": commits
                }

                log("✅ GitHub activity collected.")

            # ── telegram_bot ───────────────────────────────────────────────
            elif node_type in _TELEGRAM_TYPES:
                bot_token = (config.get("botToken") or os.getenv("TELEGRAM_BOT_TOKEN") or "").strip()
                chat_id = (config.get("chatId") or "").strip()
                message_template = config.get("messageTemplate") or "{{input}}"

                if not bot_token or not chat_id:
                    raise ValueError("Telegram Node: Bot Token or Chat ID is missing.")

                log("📨 Connecting to Telegram...")
                log("✉ Sending message...")

                # Interpolate variable
                text = message_template.replace("{{input}}", _to_str(current))

                url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
                payload = {
                    "chat_id": chat_id,
                    "text": text[:4096],
                    "parse_mode": "Markdown"
                }

                try:
                    async with httpx.AsyncClient(timeout=10) as http:
                        resp = await http.post(url, json=payload)
                except httpx.TimeoutException:
                    raise RuntimeError("Telegram Node: Connection timed out.")
                except Exception as e:
                    raise RuntimeError(f"Telegram Node: Failed to connect to Telegram Bot API: {e}")

                if resp.status_code == 404:
                    raise ValueError("Telegram Node: Invalid Telegram Bot Token (404 Not Found).")
                elif resp.status_code == 400:
                    description = resp.json().get("description", "")
                    if "can't parse entities" in description.lower():
                        # Fallback to plain text send
                        log("    ⚠️ Markdown parsing failed. Retrying without formatting...")
                        payload.pop("parse_mode", None)
                        async with httpx.AsyncClient(timeout=10) as http:
                            resp = await http.post(url, json=payload)
                        if resp.status_code == 200:
                            log("    ✅ Telegram message delivered.")
                            output = {"status": "sent", "chat": chat_id}
                        else:
                            raise RuntimeError(f"Telegram Node: API Error: {resp.json().get('description', '')}")
                    elif "chat not found" in description.lower() or "chat_id is empty" in description.lower():
                        raise ValueError(f"Telegram Node: Chat ID not found or bot is not a member of this chat. Description: {description}")
                    else:
                        raise RuntimeError(f"Telegram Node: API Error: {description}")
                elif resp.status_code != 200:
                    raise RuntimeError(f"Telegram Node: API returned HTTP {resp.status_code} — {resp.text[:300]}")
                else:
                    log("✅ Telegram message delivered.")
                    output = {
                        "status": "sent",
                        "chat": chat_id
                    }

            elif node_type in _SUBMIT_TYPES:
                from dotenv import load_dotenv
                load_dotenv(override=True)
                lc_session   = (config.get("leetcodeSession") or os.getenv("LEETCODE_SESSION") or "").strip()
                csrf_token   = (config.get("csrfToken") or os.getenv("LEETCODE_CSRF_TOKEN") or "").strip()
                if not lc_session or not csrf_token:
                    raise ValueError(
                        "LeetCode cookies not found. Please set LEETCODE_SESSION and LEETCODE_CSRF_TOKEN in your Render environment variables or enter them directly in the node configuration."
                    )

                parsed = _parse_json_or_str(current)
                if not isinstance(parsed, dict):
                    raise ValueError("leetcode_submit expects a dict from upstream node output.")

                title_slug  = parsed.get("titleSlug") or config.get("titleSlug", "")
                question_id = parsed.get("questionId") or config.get("questionId", "")
                code        = parsed.get("solution", "")

                if not code and title_slug:
                    # Autonomous AI Solver fallback
                    log(f"    💡 Solution code not found in upstream data. Invoking Autonomous AI Solver fallback...")
                    model = config.get("model") or "llama-3.3-70b-versatile"
                    config_lang = config.get("language") or "Python"

                    problem_desc = str(parsed)
                    starter_code = ""
                    if isinstance(parsed, dict):
                        problem_desc = f"Title: {parsed.get('title')}\nDifficulty: {parsed.get('difficulty')}\n{parsed.get('content')}"
                        snippets = parsed.get("codeSnippets") or []
                        target_lang = config_lang.lower().replace(" ", "")
                        for snip in snippets:
                            s_lang = snip.get("lang", "").lower()
                            s_slug = snip.get("langSlug", "").lower()
                            if target_lang in s_lang or target_lang in s_slug or s_slug in target_lang:
                                starter_code = snip.get("code", "")
                                break

                    instruction = _get_solver_instruction(config_lang, problem_desc, starter_code)

                    log(f"    🤖 AI Solver [{model}] - Language: {config_lang}")
                    raw_output = await call_ai(instruction, model=model, temperature=0.2, force_json=True)
                    solved_data = _parse_json_or_str(raw_output)
                    if isinstance(solved_data, dict) and "solution" in solved_data:
                        import textwrap
                        code = textwrap.dedent(solved_data["solution"]).strip()
                        parsed.update(solved_data)
                        log(f"    💬 Solution generated autonomously")
                    else:
                        raise ValueError("Autonomous AI Solver failed to generate solution key.")

                language    = (parsed.get("language") or config.get("language") or "python3").lower()

                # Normalise language slug for LeetCode API
                _LANG_MAP = {
                    "python": "python3", "python3": "python3",
                    "c++": "cpp", "cpp": "cpp",
                    "java": "java", "javascript": "javascript",
                    "typescript": "typescript", "go": "golang",
                    "rust": "rust", "c": "c", "kotlin": "kotlin",
                }
                lang_slug = _LANG_MAP.get(language, language)

                if not title_slug or not code:
                    raise ValueError(f"Missing titleSlug ('{title_slug}') or solution code for submission.")

                log(f"    📤 Submitting '{title_slug}' as {lang_slug} to LeetCode account...")

                submit_url = f"https://leetcode.com/problems/{title_slug}/submit/"
                headers = {
                    "Cookie": f"LEETCODE_SESSION={lc_session}; csrftoken={csrf_token}",
                    "X-CSRFToken": csrf_token,
                    "Referer": f"https://leetcode.com/problems/{title_slug}/",
                    "Content-Type": "application/json",
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                    "Origin": "https://leetcode.com",
                }
                payload = {
                    "lang": lang_slug,
                    "question_id": str(question_id),
                    "typed_code": code,
                }

                async with httpx.AsyncClient(timeout=30, follow_redirects=True) as http:
                    sub_resp = await http.post(submit_url, json=payload, headers=headers)
                    if sub_resp.status_code == 403:
                        raise ValueError(
                            "LeetCode authentication failed (HTTP 403). Your session cookie is likely expired. "
                            "Please log in to LeetCode in your browser, copy the latest LEETCODE_SESSION and LEETCODE_CSRF_TOKEN cookies, "
                            "and update them in your environment variables (.env)."
                        )
                    elif sub_resp.status_code not in (200, 201):
                        raise ValueError(
                            f"Submission failed: HTTP {sub_resp.status_code} — {sub_resp.text[:300]}"
                        )
                    sub_data = sub_resp.json()
                    submission_id = sub_data.get("submission_id")
                    log(f"    ✅ Submitted! submission_id={submission_id}")

                    # Poll for result (up to 30s)
                    if submission_id:
                        check_url = f"https://leetcode.com/submissions/detail/{submission_id}/check/"
                        for _ in range(15):
                            await asyncio.sleep(2)
                            chk = await http.get(check_url, headers=headers)
                            chk_data = chk.json()
                            state = chk_data.get("state", "")
                            log(f"    ⏳ Check state: {state}")
                            if state == "SUCCESS":
                                status_msg = chk_data.get("status_msg", "")
                                runtime    = chk_data.get("status_runtime", "N/A")
                                memory     = chk_data.get("status_memory", "N/A")
                                runtime_pct = chk_data.get("runtime_percentile") or chk_data.get("total_correct", "")
                                log(f"    🏆 Result: {status_msg} | Runtime: {runtime} | Memory: {memory}")
                                output = {
                                    **parsed,
                                    "submission_id": submission_id,
                                    "submission_status": status_msg,
                                    "runtime": runtime,
                                    "memory": memory,
                                    "link": f"https://leetcode.com/submissions/detail/{submission_id}/",
                                }
                                break
                        else:
                            log(f"    ⚠️ Result check timed out — check manually at https://leetcode.com/submissions/detail/{submission_id}/")
                            output = {**parsed, "submission_id": submission_id, "submission_status": "pending"}
                    else:
                        output = {**parsed, "submission_status": "submitted", "raw": sub_data}

            # ── whatsapp_monitor ──────────────────────────────────────────
            elif node_type in _WHATSAPP_MONITOR_TYPES:
                group_name = str(config.get("groupName") or "").strip()
                max_messages = int(config.get("maxMessages") or 30)
                if not group_name:
                    raise ValueError("WhatsApp Monitor: 'groupName' is required. Please set it in the node configuration.")
                
                log(f"    📱 WhatsApp Monitor: Scanning group '{group_name}' (max messages={max_messages})...")
                
                from .whatsapp import extract_group_messages
                monitor_result = await extract_group_messages(
                    group_name=group_name,
                    max_messages=max_messages,
                    log_func=log
                )
                output = monitor_result
                log(f"    ✓ Extracted {len(monitor_result.get('messages', []))} messages from '{group_name}'")

            # ── whatsapp_sender ───────────────────────────────────────────
            elif node_type in _WHATSAPP_SENDER_TYPES:
                contact_name = str(config.get("contactName") or "").strip()
                msg_template = str(config.get("messageTemplate") or config.get("message") or "{{input}}")
                manual_approval = config.get("manualApproval", False)
                if isinstance(manual_approval, str):
                    manual_approval = manual_approval.lower() == "true"
                
                if not contact_name:
                    raise ValueError("WhatsApp Sender: 'contactName' is required. Please set it in the node configuration.")

                message_val = _extract_message_text(current)
                message = _inject(msg_template, message_val)
                message = _ensure_plain_text_message(message, context="whatsapp_sender draft")
                
                # Check for human config overrides (approved message and status)
                override = (node_config_overrides or {}).get(node_id, {})
                is_approved = override.get("approved", False)
                if is_approved:
                    # If approved, prioritize manual text area edit
                    if override.get("message") is not None:
                        message = override.get("message")
                    log(f"    🚀 WhatsApp Sender: Human approved message → Sending to '{contact_name}'")
                
                if manual_approval and not is_approved:
                    log(f"    ⏸️  WhatsApp Sender: Pausing for manual approval. Draft message prepared.")
                    log(f"    ↳ Draft message: {message[:120]}...")
                    
                    result.update({
                        "status": "waiting_approval",
                        "output": {
                            "draft": message,
                            "contactName": contact_name,
                            "needsApproval": True
                        },
                        "completedAt": _now(),
                    })
                    node_results.append(result)
                    
                    if execution_id:
                        try:
                            from .redis_client import publish_event
                            asyncio.create_task(publish_event(f"execution:{execution_id}", {
                                "type": "node_update",
                                "nodeId": node_id,
                                "status": "waiting_approval",
                                "output": {
                                    "draft": message,
                                    "contactName": contact_name,
                                    "needsApproval": True
                                }
                            }))
                        except Exception as e:
                            logger.error(f"Failed to publish waiting_approval: {e}")
                            
                    log("⏸️  Workflow execution paused: Awaiting human review.")
                    return _build_result("waiting_approval", message, node_results, agent_logs)
                
                # Send the message
                log(f"    📱 WhatsApp Sender: Sending message to '{contact_name}'...")
                from .whatsapp import send_whatsapp_message, get_screenshot_dir
                
                screenshot_dir = get_screenshot_dir()
                proof_path = os.path.join(screenshot_dir, f"send_proof_{execution_id or 'direct'}.png")
                
                await send_whatsapp_message(
                    contact_name=contact_name,
                    message=message,
                    screenshot_path=proof_path,
                    log_func=log
                )
                
                output = {
                    "sent": True,
                    "recipient": contact_name,
                    "message": message,
                    "proof_screenshot": proof_path
                }

            # ── life_os_extractor ──────────────────────────────────────────
            elif node_type in _LIFE_OS_EXTRACTOR_TYPES:
                from .database import AsyncSessionLocal
                from .personal_life_os_repository import AssignmentRepository, PlacementRepository
                from datetime import timedelta
                
                log(f"    🧠 Life OS Extractor: Analyzing WhatsApp stream...")
                messages_feed = ""
                if isinstance(current, dict):
                    msg_list = current.get("messages", [])
                    messages_feed = "\n".join([f"[{m.get('sender', 'Unknown')}]: {m.get('text', '')}" for m in msg_list])
                else:
                    messages_feed = _to_str(current)
                
                if not messages_feed.strip():
                    log("    ⚠️ Empty WhatsApp messages stream. Skipping extractor.")
                    output = {"extracted_assignments": 0, "extracted_placements": 0}
                else:
                    prompt = f"""You are a staff operations AI. Analyze the following WhatsApp notifications feed and extract assignments, upcoming test/placement deadlines, academic placements, and meetings.
                    
                    Feed:
                    {messages_feed}
                    
                    Extract ONLY actionable and official items. Ignore chit-chat.
                    Return a valid JSON object matching this schema:
                    {{
                      "assignments": [
                        {{
                          "title": "Assignment Topic",
                          "subject": "Subject/Course Name",
                          "days_to_deadline": 2,
                          "priority": "high/medium/low"
                        }}
                      ],
                      "placements": [
                        {{
                          "company_name": "TCS/Infosys",
                          "package": "7 LPA",
                          "days_to_deadline": 5,
                          "eligibility": "B.Tech CSE/ECE",
                          "apply_url": "https://..."
                        }}
                      ]
                    }}
                    """
                    raw_json = await call_ai(prompt, model="llama-3.3-70b-versatile", temperature=0.1, force_json=True)
                    data = _parse_json_or_str(raw_json)
                    
                    asg_count = 0
                    plc_count = 0
                    
                    async with AsyncSessionLocal() as db:
                        # Process Extracted Assignments
                        for asg in data.get("assignments", []):
                            days = int(asg.get("days_to_deadline") or 1)
                            deadline = datetime.now(timezone.utc) + timedelta(days=days)
                            await AssignmentRepository.create(
                                db,
                                title=asg.get("title", "Untitled Task"),
                                subject=asg.get("subject", "General"),
                                deadline=deadline,
                                priority=asg.get("priority", "medium"),
                                source="whatsapp"
                            )
                            asg_count += 1
                        
                        # Process Extracted Placements
                        for plc in data.get("placements", []):
                            days = int(plc.get("days_to_deadline") or 7)
                            deadline = datetime.now(timezone.utc) + timedelta(days=days)
                            saved = await PlacementRepository.create(
                                db,
                                company_name=plc.get("company_name", "Unknown Corp"),
                                package=plc.get("package"),
                                deadline=deadline,
                                eligibility=plc.get("eligibility"),
                                apply_url=plc.get("apply_url")
                            )
                            if saved:
                                plc_count += 1
                        
                        await db.commit()
                    
                    log(f"    ✓ Extracted and stored: {asg_count} assignments, {plc_count} placements.")
                    output = {
                        "extracted_assignments": asg_count,
                        "extracted_placements": plc_count,
                        "raw_data": data
                    }

            # ── leetcode_save ──────────────────────────────────────────────
            elif node_type in _LEETCODE_SAVE_TYPES:
                from .database import AsyncSessionLocal
                from .personal_life_os_repository import LeetCodeRepository
                
                parsed = _parse_json_or_str(current)
                title = parsed.get("title", "LeetCode Challenge") if isinstance(parsed, dict) else "LeetCode Challenge"
                slug = parsed.get("titleSlug", "leetcode-challenge") if isinstance(parsed, dict) else "leetcode-challenge"
                diff = parsed.get("difficulty", "Medium") if isinstance(parsed, dict) else "Medium"
                sol = parsed.get("solution", "") if isinstance(parsed, dict) else _to_str(current)
                
                # Check LeetCode submission status
                status = "missed"
                if isinstance(parsed, dict):
                    sub_status = parsed.get("submission_status", "").upper()
                    if "ACCEPT" in sub_status:
                        status = "solved"
                
                log(f"    🗄️ Saving LeetCode Daily: '{title}' ({diff}) -> status: {status}")
                async with AsyncSessionLocal() as db:
                    await LeetCodeRepository.create(
                        db,
                        title=title,
                        slug=slug,
                        difficulty=diff,
                        solution=sol,
                        status=status
                    )
                    await db.commit()
                
                output = {"saved": True, "title": title, "status": status}

            # ── fetch_life_os ──────────────────────────────────────────────
            elif node_type in _FETCH_LIFE_OS_TYPES:
                from .database import AsyncSessionLocal
                from .personal_life_os_repository import AssignmentRepository, PlacementRepository, LeetCodeRepository
                
                log(f"    💼 Fetching Active Life OS Telemetry...")
                async with AsyncSessionLocal() as db:
                    assignments = await AssignmentRepository.list_active(db)
                    placements = await PlacementRepository.list_active(db)
                    lc_stats = await LeetCodeRepository.get_streak_stats(db)
                
                output = {
                    "assignments": [
                        {
                            "id": a.id,
                            "title": a.title,
                            "subject": a.subject,
                            "deadline": a.deadline.isoformat(),
                            "priority": a.priority,
                            "status": a.status
                        }
                        for a in assignments
                    ],
                    "placements": [
                        {
                            "id": p.id,
                            "company_name": p.company_name,
                            "package": p.package,
                            "deadline": p.deadline.isoformat(),
                            "eligibility": p.eligibility,
                            "apply_url": p.apply_url
                        }
                        for p in placements
                    ],
                    "leetcode": lc_stats
                }
                log(f"    ✓ Loaded {len(assignments)} tasks and {len(placements)} placements.")

            # ── briefing_generator ─────────────────────────────────────────
            elif node_type in _BRIEFING_GENERATOR_TYPES:
                from .database import AsyncSessionLocal
                from .personal_life_os_repository import BriefingRepository
                
                log(f"    🧠 Briefing Generator: Composing AI Daily Briefing digest...")
                context_data = _to_str(current)
                
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
                
                # Save Briefing in database
                async with AsyncSessionLocal() as db:
                    await BriefingRepository.create(db, content=briefing_text, status="sent")
                    await db.commit()
                
                log("    ✓ AI Briefing generated and logged.")
                output = briefing_text

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

            if execution_id:
                try:
                    from .redis_client import publish_event
                    asyncio.create_task(publish_event(f"execution:{execution_id}", {
                        "type": "node_update",
                        "nodeId": node_id,
                        "status": "success",
                        "output": _to_str(output)
                    }))
                except Exception as e:
                    logger.error(f"Failed to publish node success to Redis: {e}")

        except Exception as exc:
            import traceback
            tb = traceback.format_exc()
            error_msg = f"Node [{label}] failed: {exc}\n{tb}"
            logger.error(error_msg, exc_info=True)
            log(f"    ❌ {error_msg}")
            result.update({
                "status":      "failed",
                "reasoning":   error_msg,
                "completedAt": _now(),
            })
            node_results.append(result)

            if execution_id:
                try:
                    from .redis_client import publish_event
                    asyncio.create_task(publish_event(f"execution:{execution_id}", {
                        "type": "node_update",
                        "nodeId": node_id,
                        "status": "failed",
                        "output": error_msg
                    }))
                except Exception as e:
                    logger.error(f"Failed to publish node failure to Redis: {e}")

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


async def resume_workflow_from_approval(
    execution_id: int,
    workflow_nodes: list[dict],
    workflow_edges: list[dict] | None,
    approved_message: str,
    contact_name: str,
    waiting_node_id: str,
    previous_node_results: list[dict],
    _log_sink: list[str] | None = None,
) -> dict[str, Any]:
    """
    Resume a paused workflow from the WhatsApp sender node after human approval.
    This does NOT re-run prior nodes. It only executes the WhatsApp send step
    and any remaining downstream nodes.
    """
    edges = workflow_edges or []
    ordered = _topo_sort(workflow_nodes, edges) if edges else workflow_nodes

    agent_logs: list[str] = _log_sink if _log_sink is not None else []
    node_results: list[dict] = list(previous_node_results or [])

    def log(msg: str) -> None:
        entry = f"[{_now()}] {msg}"
        logger.info(msg)
        agent_logs.append(entry)
        if execution_id:
            try:
                from .redis_client import publish_event, append_execution_log
                asyncio.create_task(publish_event(f"execution:{execution_id}", {
                    "type": "log",
                    "message": entry
                }))
                asyncio.create_task(append_execution_log(execution_id, entry))
            except Exception as e:
                logger.error(f"Failed to publish/cache log to Redis for {execution_id}: {e}")

    log(f"✅ Human approved execution. Resuming from node '{waiting_node_id}'...")

    # Find the index of the waiting node in the topo-sorted order
    waiting_idx = None
    for i, node in enumerate(ordered):
        if node.get("id") == waiting_node_id:
            waiting_idx = i
            break

    if waiting_idx is None:
        log(f"❌ Could not find waiting node '{waiting_node_id}' in workflow.")
        return _build_result("failed", f"Node {waiting_node_id} not found", node_results, agent_logs)

    # Step 1: Execute the WhatsApp send for the approved node
    waiting_node = ordered[waiting_idx]
    node_id = waiting_node.get("id", "?")
    node_type = (waiting_node.get("type") or "").lower()
    label = waiting_node.get("label") or node_type
    config = waiting_node.get("config") or {}

    log(f"📱 WhatsApp Sender: Sending approved message to '{contact_name}'...")
    approved_message = _ensure_plain_text_message(
        approved_message, context="approved WhatsApp message"
    )

    result: dict = {
        "nodeId": node_id,
        "nodeType": node_type,
        "label": label,
        "status": "running",
        "startedAt": _now(),
        "input": approved_message[:500],
    }

    if execution_id:
        try:
            from .redis_client import publish_event
            asyncio.create_task(publish_event(f"execution:{execution_id}", {
                "type": "node_update",
                "nodeId": node_id,
                "status": "running",
                "output": None
            }))
        except Exception as e:
            logger.error(f"Failed to publish node start to Redis: {e}")

    try:
        from .whatsapp import send_whatsapp_message, get_screenshot_dir

        screenshot_dir = get_screenshot_dir()
        proof_path = os.path.join(screenshot_dir, f"send_proof_{execution_id or 'direct'}.png")

        await send_whatsapp_message(
            contact_name=contact_name,
            message=approved_message,
            screenshot_path=proof_path,
            log_func=log
        )

        output = {
            "sent": True,
            "recipient": contact_name,
            "message": approved_message,
            "proof_screenshot": proof_path
        }
        log(f"    ✓ output: {_to_str(output)[:120]}")

        # Remove the old waiting_approval result for this node and add the success one
        node_results = [r for r in node_results if r.get("nodeId") != node_id]
        result.update({
            "status": "success",
            "output": {"result": _to_str(output)},
            "completedAt": _now(),
        })
        node_results.append(result)

        if execution_id:
            try:
                from .redis_client import publish_event
                asyncio.create_task(publish_event(f"execution:{execution_id}", {
                    "type": "node_update",
                    "nodeId": node_id,
                    "status": "success",
                    "output": _to_str(output)
                }))
            except Exception as e:
                logger.error(f"Failed to publish node success to Redis: {e}")

    except Exception as exc:
        import traceback
        tb = traceback.format_exc()
        error_msg = f"Node [{label}] failed: {exc}\n{tb}"
        logger.error(error_msg, exc_info=True)
        log(f"    ❌ {error_msg}")
        result.update({
            "status": "failed",
            "reasoning": error_msg,
            "completedAt": _now(),
        })
        # Remove old waiting result and add failed
        node_results = [r for r in node_results if r.get("nodeId") != node_id]
        node_results.append(result)
        return _build_result("failed", error_msg, node_results, agent_logs)

    # Step 2: Execute any remaining nodes after the sender node
    current: Any = output
    for remaining_node in ordered[waiting_idx + 1:]:
        r_node_id = remaining_node.get("id", "?")
        r_node_type = (remaining_node.get("type") or "").lower()
        r_label = remaining_node.get("label") or r_node_type
        r_config = remaining_node.get("config") or {}

        # Skip already-completed nodes
        already_done = any(r.get("nodeId") == r_node_id and r.get("status") == "success" for r in node_results)
        if already_done:
            continue

        log(f"⚙️  [{r_label}] type={r_node_type}")

        r_result: dict = {
            "nodeId": r_node_id,
            "nodeType": r_node_type,
            "label": r_label,
            "status": "running",
            "startedAt": _now(),
            "input": _to_str(current)[:500],
        }

        try:
            r_output: Any = current
            if r_node_type in _OUTPUT_TYPES:
                final_out = _to_str(current)
                log(f"    📤 Output: {final_out[:120]}")
                r_result.update({
                    "status": "success",
                    "output": {"result": final_out, "format": "text"},
                    "completedAt": _now(),
                })
                node_results.append(r_result)
                log("🎉 Workflow complete")
                return _build_result("completed", final_out, node_results, agent_logs)
            else:
                log(f"    ⚠️  Passing through node type '{r_node_type}'")

            r_result.update({
                "status": "success",
                "output": {"result": _to_str(r_output)[:500]},
                "completedAt": _now(),
            })
            current = r_output
        except Exception as exc:
            import traceback
            tb = traceback.format_exc()
            err_msg = f"Node [{r_label}] failed: {exc}\n{tb}"
            log(f"    ❌ {err_msg}")
            r_result.update({
                "status": "failed",
                "reasoning": err_msg,
                "completedAt": _now(),
            })
            node_results.append(r_result)
            return _build_result("failed", err_msg, node_results, agent_logs)

        node_results.append(r_result)

    # All done
    final_output = _to_str(current)
    log(f"✅ Workflow finished | final: {final_output[:120]}")
    return _build_result("completed", final_output, node_results, agent_logs)


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
