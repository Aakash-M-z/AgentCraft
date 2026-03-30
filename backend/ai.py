import os
import logging
from pathlib import Path
from dotenv import load_dotenv

# Load .env from repo root before anything else
load_dotenv(Path(__file__).parent.parent / ".env")

from openai import AsyncOpenAI  # noqa: E402

logger = logging.getLogger(__name__)

MODEL = "llama-3.3-70b-versatile"


def _make_client() -> AsyncOpenAI:
    key = os.environ.get("GROQ_API_KEY", "")
    return AsyncOpenAI(
        api_key=key or "no-key",
        base_url="https://api.groq.com/openai/v1",
    )


async def call_ai(prompt: str) -> str:
    """Call Groq. Returns a fallback string instead of raising on failure."""
    logger.info("AI call | prompt: %.120s", prompt)
    try:
        client = _make_client()
        response = await client.chat.completions.create(
            model=MODEL,
            messages=[{"role": "user", "content": prompt}],
        )
        result = response.choices[0].message.content or ""
        logger.info("AI response: %.120s", result)
        return result
    except Exception as exc:
        logger.error("Groq call failed: %s", exc)
        return f"[AI unavailable: {exc}]"


async def generate_workflow_from_prompt(prompt: str) -> dict:
    """Ask Groq to design a workflow JSON from a text description."""
    system = (
        "You are an AI workflow designer. Given a description, return ONLY valid JSON "
        "with keys: name (string), description (string), nodes (array), edges (array). "
        "Node shape: {id, type, label, config, position:{x,y}}. "
        "Edge shape: {id, source, target, label?}. "
        "Node types: input | ai_agent | api_call | condition | loop | output."
    )
    try:
        client = _make_client()
        response = await client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": prompt},
            ],
        )
        raw = response.choices[0].message.content or "{}"
        import json, re
        match = re.search(r"\{[\s\S]*\}", raw)
        return json.loads(match.group(0)) if match else {}
    except Exception as exc:
        logger.error("generate_workflow_from_prompt failed: %s", exc)
        return {}


async def explain_workflow(nodes: list, edges: list, name: str) -> dict:
    """Ask Groq to explain a workflow in plain English."""
    import json
    payload = json.dumps({"name": name, "nodes": nodes, "edges": edges})
    system = (
        "You are an expert at explaining AI workflows. "
        "Return ONLY valid JSON with keys: explanation (string), steps (array of strings)."
    )
    try:
        client = _make_client()
        response = await client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": f"Explain this workflow:\n{payload}"},
            ],
        )
        raw = response.choices[0].message.content or "{}"
        import re
        match = re.search(r"\{[\s\S]*\}", raw)
        return json.loads(match.group(0)) if match else {"explanation": raw, "steps": []}
    except Exception as exc:
        logger.error("explain_workflow failed: %s", exc)
        return {"explanation": f"[AI unavailable: {exc}]", "steps": []}
