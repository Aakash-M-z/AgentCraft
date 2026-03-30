import { Router } from "express";
import OpenAI from "openai";
import { workflows, executions, nextWfId, saveDB, type StoredWorkflow } from "../lib/store";

const router = Router();

function groq() {
  return new OpenAI({
    baseURL: process.env.GROQ_BASE_URL ?? "https://api.groq.com/openai/v1",
    apiKey: process.env.GROQ_API_KEY ?? "",
  });
}

const MODEL = "llama-3.3-70b-versatile";

function fmt(w: StoredWorkflow) {
  return {
    ...w,
    createdAt: w.createdAt.toISOString(),
    updatedAt: w.updatedAt.toISOString(),
  };
}

// GET /api/workflows
router.get("/", (req, res) => {
  const list = [...workflows.values()].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
  );
  res.json(list.map(fmt));
});

// POST /api/workflows/generate  (must be before /:id)
router.post("/generate", async (req, res) => {
  try {
    const { prompt } = req.body as { prompt: string };
    if (!prompt) { res.status(400).json({ error: "prompt is required" }); return; }

    const systemPrompt = `You are an AI workflow designer. Given a description, return ONLY valid JSON:
{
  "name": "Workflow name",
  "description": "Brief description",
  "nodes": [{ "id": "n1", "type": "input|ai_agent|api_call|condition|loop|output", "label": "...", "config": {}, "position": {"x": 100, "y": 200} }],
  "edges": [{ "id": "e1", "source": "n1", "target": "n2" }]
}
Space nodes 250px apart horizontally. ai_agent config: { instruction, role }.`;

    const completion = await groq().chat.completions.create({
      model: MODEL,
      max_tokens: 2048,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) { res.status(500).json({ error: "AI returned invalid JSON" }); return; }
    res.json(JSON.parse(match[0]));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to generate workflow" });
  }
});

// POST /api/workflows
router.post("/", (req, res) => {
  try {
    const { name, description, nodes, edges } = req.body;
    const now = new Date();
    const id = nextWfId();
    const wf: StoredWorkflow = {
      id,
      name: name || "Untitled Workflow",
      description: description ?? null,
      nodes: nodes ?? [],
      edges: edges ?? [],
      createdAt: now,
      updatedAt: now,
    };
    workflows.set(id, wf);
    saveDB();
    res.status(201).json(fmt(wf));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to create workflow" });
  }
});

// GET /api/workflows/:id
router.get("/:id", (req, res) => {
  const id = parseInt(req.params.id!);
  const wf = workflows.get(id);
  if (!wf) { res.status(404).json({ error: "Workflow not found" }); return; }
  res.json(fmt(wf));
});

// PUT /api/workflows/:id
router.put("/:id", (req, res) => {
  const id = parseInt(req.params.id!);
  const wf = workflows.get(id);
  if (!wf) { res.status(404).json({ error: "Workflow not found" }); return; }
  const { name, description, nodes, edges } = req.body;
  wf.name = name ?? wf.name;
  wf.description = description ?? wf.description;
  wf.nodes = nodes ?? wf.nodes;
  wf.edges = edges ?? wf.edges;
  wf.updatedAt = new Date();
  saveDB();
  res.json(fmt(wf));
});

// DELETE /api/workflows/:id
router.delete("/:id", (req, res) => {
  const id = parseInt(req.params.id!);
  if (!workflows.has(id)) { res.status(404).json({ error: "Workflow not found" }); return; }
  workflows.delete(id);
  saveDB();
  res.status(204).end();
});

// GET /api/workflows/:id/explain
router.get("/:id/explain", async (req, res) => {
  try {
    const id = parseInt(req.params.id!);
    const wf = workflows.get(id);
    if (!wf) { res.status(404).json({ error: "Workflow not found" }); return; }

    const completion = await groq().chat.completions.create({
      model: MODEL,
      max_tokens: 1024,
      messages: [
        {
          role: "system",
          content: "Explain the workflow. Return ONLY JSON: { \"explanation\": \"...\", \"steps\": [\"step 1\", ...] }",
        },
        {
          role: "user",
          content: JSON.stringify({ name: wf.name, nodes: wf.nodes, edges: wf.edges }),
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const match = raw.match(/\{[\s\S]*\}/);
    const result = match ? JSON.parse(match[0]) : { explanation: "Unable to explain", steps: [] };
    res.json(result);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to explain workflow" });
  }
});

export default router;
