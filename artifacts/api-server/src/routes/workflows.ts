import { Router } from "express";
import { db } from "@workspace/db";
import { workflowsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import OpenAI from "openai";

const router = Router();

const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
});

router.get("/", async (req, res) => {
  try {
    const workflows = await db.select().from(workflowsTable).orderBy(workflowsTable.createdAt);
    res.json(workflows.map(w => ({
      ...w,
      createdAt: w.createdAt.toISOString(),
      updatedAt: w.updatedAt.toISOString(),
    })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to list workflows" });
  }
});

router.post("/generate", async (req, res) => {
  try {
    const { prompt } = req.body as { prompt: string };
    if (!prompt) {
      res.status(400).json({ error: "prompt is required" });
      return;
    }

    const systemPrompt = `You are an AI workflow designer. Given a user's description, generate a workflow as JSON with nodes and edges for a visual workflow automation tool.

Node types available: input, ai_agent, api_call, condition, loop, output
Each node: { id: string, type: string, label: string, config: object, position: {x: number, y: number} }
Each edge: { id: string, source: string, target: string, label?: string }

Position nodes in a horizontal flow from left to right. Space nodes ~250px apart horizontally.
Generate sensible config objects for each node type:
- input: { prompt: "User query" }
- ai_agent: { model: "gpt-4", instruction: "What to do", role: "planner|executor|validator" }
- api_call: { url: "https://...", method: "GET|POST", headers: {}, body: "" }
- condition: { expression: "result.length > 0", trueBranch: "yes", falseBranch: "no" }
- loop: { items: "results", variable: "item", maxIterations: 10 }
- output: { format: "text|json|markdown" }

Return ONLY valid JSON with this structure:
{
  "name": "Workflow name",
  "description": "Brief description",
  "nodes": [...],
  "edges": [...]
}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 4096,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      res.status(500).json({ error: "Failed to generate workflow" });
      return;
    }
    const generated = JSON.parse(jsonMatch[0]);
    res.json(generated);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to generate workflow" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { name, description, nodes, edges } = req.body;
    const [workflow] = await db.insert(workflowsTable).values({
      name: name || "Untitled Workflow",
      description: description || null,
      nodes: nodes || [],
      edges: edges || [],
    }).returning();
    res.status(201).json({
      ...workflow,
      createdAt: workflow!.createdAt.toISOString(),
      updatedAt: workflow!.updatedAt.toISOString(),
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to create workflow" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id!);
    const [workflow] = await db.select().from(workflowsTable).where(eq(workflowsTable.id, id));
    if (!workflow) {
      res.status(404).json({ error: "Workflow not found" });
      return;
    }
    res.json({
      ...workflow,
      createdAt: workflow.createdAt.toISOString(),
      updatedAt: workflow.updatedAt.toISOString(),
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to get workflow" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id!);
    const { name, description, nodes, edges } = req.body;
    const [updated] = await db.update(workflowsTable)
      .set({ name, description, nodes, edges, updatedAt: new Date() })
      .where(eq(workflowsTable.id, id))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Workflow not found" });
      return;
    }
    res.json({
      ...updated,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to update workflow" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id!);
    await db.delete(workflowsTable).where(eq(workflowsTable.id, id));
    res.status(204).end();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to delete workflow" });
  }
});

router.get("/:id/explain", async (req, res) => {
  try {
    const id = parseInt(req.params.id!);
    const [workflow] = await db.select().from(workflowsTable).where(eq(workflowsTable.id, id));
    if (!workflow) {
      res.status(404).json({ error: "Workflow not found" });
      return;
    }

    const workflowJson = JSON.stringify({ name: workflow.name, nodes: workflow.nodes, edges: workflow.edges }, null, 2);

    const completion = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 2048,
      messages: [
        {
          role: "system",
          content: "You are an expert at explaining AI workflows. Given a workflow definition, provide a clear, friendly explanation of what it does and list the steps it performs."
        },
        {
          role: "user",
          content: `Explain this workflow:\n\n${workflowJson}\n\nProvide:\n1. A 2-3 sentence overview explanation\n2. A numbered list of steps\n\nReturn JSON: { "explanation": "...", "steps": ["step 1", "step 2", ...] }`
        }
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const result = jsonMatch ? JSON.parse(jsonMatch[0]) : { explanation: "Unable to explain", steps: [] };
    res.json(result);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to explain workflow" });
  }
});

export default router;
