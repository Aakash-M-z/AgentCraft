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


def get_clients():
    """Return a list of (AsyncOpenAI_client, provider_name) fallback options."""
    clients = []
    
    if os.environ.get("GROQ_API_KEY"):
        clients.append((
            AsyncOpenAI(
                api_key=os.environ.get("GROQ_API_KEY"),
                base_url=os.environ.get("GROQ_BASE_URL", "https://api.groq.com/openai/v1"),
            ),
            "groq"
        ))
        
    if os.environ.get("OPENROUTER_API_KEY"):
        clients.append((
            AsyncOpenAI(
                api_key=os.environ.get("OPENROUTER_API_KEY"),
                base_url="https://openrouter.ai/api/v1",
            ),
            "openrouter"
        ))
        
    if os.environ.get("CEREBRAS_API_KEY"):
        clients.append((
            AsyncOpenAI(
                api_key=os.environ.get("CEREBRAS_API_KEY"),
                base_url="https://api.cerebras.ai/v1",
            ),
            "cerebras"
        ))
        
    if os.environ.get("TOGETHER_API_KEY"):
        clients.append((
            AsyncOpenAI(
                api_key=os.environ.get("TOGETHER_API_KEY"),
                base_url="https://api.together.xyz/v1",
            ),
            "together"
        ))
        
    if os.environ.get("GEMINI_API_KEY"):
        clients.append((
            AsyncOpenAI(
                api_key=os.environ.get("GEMINI_API_KEY"),
                base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
            ),
            "gemini"
        ))
        
    if not clients:
        # Dummy fallback to avoid crashing instantly
        clients.append((
            AsyncOpenAI(api_key="no-key", base_url="https://api.groq.com/openai/v1"),
            "groq"
        ))
        
    return clients


def _safe_model(model: str | None) -> str:
    """Return model if supported, else fall back to default."""
    if model and model in SUPPORTED_MODELS:
        return model
    if model:
        logger.warning("Model '%s' not in supported list, falling back to %s", model, DEFAULT_MODEL)
    return DEFAULT_MODEL


async def call_ai(prompt: str, model: str | None = None, temperature: float = 0.7, force_json: bool = False) -> str:
    """Call AI via OpenAI-compatible endpoints with fallbacks. Returns a fallback string on any error."""
    m = _safe_model(model)
    logger.info("AI call | model=%s | prompt: %.120s", m, prompt)
    
    clients = get_clients()
    kwargs = {
        "model": m,
        "temperature": temperature,
        "messages": [{"role": "user", "content": prompt}]
    }
    if force_json:
        kwargs["response_format"] = {"type": "json_object"}
        
    last_err = None
    for client, provider in clients:
        try:
            logger.info("Trying provider: %s", provider)
            # Gemini models might be different
            if provider == "gemini":
                kwargs["model"] = "gemini-2.5-flash"
                
            response = await client.chat.completions.create(**kwargs)
            result = response.choices[0].message.content or ""
            logger.info("AI response (%s): %.120s", provider, result)
            return result
        except Exception as exc:
            logger.warning("Provider %s failed: %s", provider, exc)
            last_err = exc
            
    logger.error("All AI providers failed. Last error: %s", last_err)
    return f"[AI unavailable: {last_err}]"


async def generate_workflow_from_prompt(prompt: str) -> dict:
    """Ask AI to design a workflow JSON from a text description."""
    system = (
        "You are an AI workflow designer. Given a description, return ONLY valid JSON "
        "with keys: name (string), description (string), nodes (array), edges (array). "
        "Node shape: {id, type, label, config, position:{x,y}}. "
        "Edge shape: {id, source, target, label?}. "
        "Node types: input | ai_agent | api_call | condition | loop | output. "
        "Space nodes 250px apart horizontally. ai_agent config: {instruction, role, model}."
    )
    
    clients = get_clients()
    kwargs = {
        "model": DEFAULT_MODEL,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": prompt},
        ],
        "response_format": {"type": "json_object"}
    }
    
    for client, provider in clients:
        try:
            if provider == "gemini":
                kwargs["model"] = "gemini-2.5-flash"
            response = await client.chat.completions.create(**kwargs)
            raw = response.choices[0].message.content or "{}"
            match = re.search(r"\{[\s\S]*\}", raw)
            return json.loads(match.group(0)) if match else {}
        except Exception as exc:
            logger.warning("generate_workflow_from_prompt (%s) failed: %s", provider, exc)
            
    logger.error("All AI providers failed for workflow generation.")
    return {}


async def explain_workflow(nodes: list, edges: list, name: str) -> dict:
    """Ask AI to explain a workflow in plain English."""
    payload = json.dumps({"name": name, "nodes": nodes, "edges": edges})
    system = (
        "You are an expert at explaining AI workflows. "
        "Return ONLY valid JSON: { \"explanation\": \"...\", \"steps\": [\"step 1\", ...] }"
    )
    
    clients = get_clients()
    kwargs = {
        "model": DEFAULT_MODEL,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": f"Explain this workflow:\n{payload}"},
        ],
        "response_format": {"type": "json_object"}
    }
    
    last_exc = None
    for client, provider in clients:
        try:
            if provider == "gemini":
                kwargs["model"] = "gemini-2.5-flash"
            response = await client.chat.completions.create(**kwargs)
            raw = response.choices[0].message.content or "{}"
            match = re.search(r"\{[\s\S]*\}", raw)
            return json.loads(match.group(0)) if match else {"explanation": raw, "steps": []}
        except Exception as exc:
            logger.warning("explain_workflow (%s) failed: %s", provider, exc)
            last_exc = exc
            
    return {"explanation": f"[AI unavailable: {last_exc}]", "steps": []}
