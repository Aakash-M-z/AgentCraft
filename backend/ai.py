import os
import re
import json
import logging
from dotenv import load_dotenv

load_dotenv()  # no-op on Render; env vars set via dashboard

from openai import AsyncOpenAI

logger = logging.getLogger(__name__)

# Default model — currently active on Groq
DEFAULT_MODEL = "llama-3.3-70b-versatile"

# All supported Groq text models (updated 2026)
SUPPORTED_MODELS = {
    "llama-3.3-70b-versatile",
    "llama-3.1-8b-instant",
    "meta-llama/llama-4-scout-17b-16e-instruct",
    "qwen/qwen3-32b",
    "moonshotai/kimi-k2-instruct",
    "groq/compound",
    "groq/compound-mini",
    "openai/gpt-oss-120b",
    "openai/gpt-oss-20b",
    "allam-2-7b",
}


def _client() -> AsyncOpenAI:
    return AsyncOpenAI(
        api_key=os.environ.get("GROQ_API_KEY") or "no-key",
        base_url=os.environ.get("GROQ_BASE_URL", "https://api.groq.com/openai/v1"),
    )


def _safe_model(model: str | None) -> str:
    """Return model if supported, else fall back to default."""
    if model and model in SUPPORTED_MODELS:
        return model
    if model:
        logger.warning("Model '%s' not in supported list, falling back to %s", model, DEFAULT_MODEL)
    return DEFAULT_MODEL


async def call_ai(prompt: str, model: str | None = None, temperature: float = 0.7) -> str:
    """Call Groq. Returns a fallback string on any error — never raises."""
    m = _safe_model(model)
    logger.info("AI call | model=%s | prompt: %.120s", m, prompt)
    try:
        response = await _client().chat.completions.create(
            model=m,
            temperature=temperature,
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
        "Node types: input | ai_agent | api_call | condition | loop | output. "
        "Space nodes 250px apart horizontally. ai_agent config: {instruction, role, model}."
    )
    try:
        response = await _client().chat.completions.create(
            model=DEFAULT_MODEL,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": prompt},
            ],
        )
        raw = response.choices[0].message.content or "{}"
        match = re.search(r"\{[\s\S]*\}", raw)
        return json.loads(match.group(0)) if match else {}
    except Exception as exc:
        logger.error("generate_workflow_from_prompt failed: %s", exc)
        return {}


async def explain_workflow(nodes: list, edges: list, name: str) -> dict:
    """Ask Groq to explain a workflow in plain English."""
    payload = json.dumps({"name": name, "nodes": nodes, "edges": edges})
    system = (
        "You are an expert at explaining AI workflows. "
        "Return ONLY valid JSON: { \"explanation\": \"...\", \"steps\": [\"step 1\", ...] }"
    )
    try:
        response = await _client().chat.completions.create(
            model=DEFAULT_MODEL,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": f"Explain this workflow:\n{payload}"},
            ],
        )
        raw = response.choices[0].message.content or "{}"
        match = re.search(r"\{[\s\S]*\}", raw)
        return json.loads(match.group(0)) if match else {"explanation": raw, "steps": []}
    except Exception as exc:
        logger.error("explain_workflow failed: %s", exc)
        return {"explanation": f"[AI unavailable: {exc}]", "steps": []}
