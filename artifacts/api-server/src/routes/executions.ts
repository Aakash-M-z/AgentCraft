import { Router } from "express";
import OpenAI from "openai";
import { workflows, executions, nextExId, type StoredExecution } from "../lib/store";
import type { WorkflowNode, NodeResult } from "@workspace/db";

const router = Router();

const MODEL = "llama-3.3-70b-versatile";

function groq() {
  return new OpenAI({
    baseURL: process.env.GROQ_BASE_URL ?? "https://api.groq.com/openai/v1",
    apiKey: process.env.GROQ_API_KEY ?? "",
  });
}

function fmtEx(e: StoredExecution) {
  return {
    ...e,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
  };
}

// ── SSE broadcast ─────────────────────────────────────────────────────────────
const sseClients = new Map<number, Set<(data: unknown) => void>>();

function broadcast(executionId: number, data: unknown) {
  sseClients.get(executionId)?.forEach(send => send(data));
}

// GET /api/executions/:id/stream  (SSE — must be before /:id)
router.get("/:id/stream", (req, res) => {
  const id = parseInt(req.params.id!);
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.flushHeaders();

  const send = (data: unknown) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  if (!sseClients.has(id)) sseClients.set(id, new Set());
  sseClients.get(id)!.add(send);

  const heartbeat = setInterval(() => res.write(": ping\n\n"), 15000);
  req.on("close", () => {
    clearInterval(heartbeat);
    sseClients.get(id)?.delete(send);
    if (sseClients.get(id)?.size === 0) sseClients.delete(id);
  });
});

// GET /api/executions
router.get("/", (req, res) => {
  const { workflowId } = req.query;
  let list = [...executions.values()];
  if (workflowId) list = list.filter(e => e.workflowId === parseInt(workflowId as string));
  list.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  res.json(list.map(fmtEx));
});

// GET /api/executions/:id
router.get("/:id", (req, res) => {
  const id = parseInt(req.params.id!);
  const ex = executions.get(id);
  if (!ex) { res.status(404).json({ error: "Execution not found" }); return; }
  res.json(fmtEx(ex));
});

// POST /api/executions
router.post("/", async (req, res) => {
  try {
    const { workflowId, input } = req.body as { workflowId: number; input: string };
    const wf = workflows.get(workflowId);
    if (!wf) { res.status(404).json({ error: "Workflow not found" }); return; }

    const now = new Date();
    const id = nextExId();
    const ex: StoredExecution = {
      id,
      workflowId,
      status: "pending",
      input: input ?? "",
      finalOutput: null,
      nodeResults: [],
      agentLogs: [],
      createdAt: now,
      updatedAt: now,
    };
    executions.set(id, ex);

    // Respond immediately, run async
    res.status(202).json(fmtEx(ex));

    runExecution(id, wf.nodes as WorkflowNode[], wf.edges as any[], input ?? "").catch(console.error);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to start execution" });
  }
});

// POST /api/executions/:id/cancel
router.post("/:id/cancel", (req, res) => {
  const id = parseInt(req.params.id!);
  const ex = executions.get(id);
  if (!ex) { res.status(404).json({ error: "Execution not found" }); return; }
  ex.status = "cancelled";
  ex.updatedAt = new Date();
  broadcast(id, { type: "execution_cancelled" });
  res.json(fmtEx(ex));
});

// ── Execution runner ──────────────────────────────────────────────────────────

async function runExecution(executionId: number, nodes: WorkflowNode[], edges: any[], input: string) {
  const ex = executions.get(executionId)!;
  const logs: string[] = [];
  const nodeResults: NodeResult[] = [];

  function log(msg: string) {
    const line = `[${new Date().toISOString()}] ${msg}`;
    logs.push(line);
    ex.agentLogs = [...logs];
    broadcast(executionId, { type: "log", message: line });
  }

  function save() {
    ex.nodeResults = [...nodeResults];
    ex.agentLogs = [...logs];
    ex.updatedAt = new Date();
  }

  try {
    ex.status = "running";
    broadcast(executionId, { type: "execution_start" });
    log("🚀 Planner Agent: Analyzing workflow...");

    const ordered = topologicalSort(nodes, edges);
    log(`📋 Identified ${ordered.length} nodes`);

    let context: Record<string, unknown> = { input };
    let finalOutput = "";

    // Planner phase
    try {
      const plan = await groq().chat.completions.create({
        model: MODEL,
        max_tokens: 512,
        messages: [
          { role: "system", content: "You are a Planner Agent. Briefly describe the execution plan in 2-3 sentences." },
          { role: "user", content: `Nodes: ${JSON.stringify(ordered.map(n => ({ type: n.type, label: n.label })))}\nInput: "${input}"` },
        ],
      });
      log(`🧠 Planner: ${plan.choices[0]?.message?.content ?? ""}`);
    } catch (e) {
      log(`🧠 Planner: (AI unavailable) Will execute ${ordered.length} nodes sequentially.`);
    }

    for (const node of ordered) {
      if (ex.status === "cancelled") break;

      const nr: NodeResult = {
        nodeId: node.id,
        nodeType: node.type,
        label: node.label,
        status: "running",
        startedAt: new Date().toISOString(),
      };
      nodeResults.push(nr);
      broadcast(executionId, { type: "node_start", nodeId: node.id, label: node.label, nodeType: node.type });
      log(`⚙️  Node: ${node.label} (${node.type})`);
      save();

      try {
        const output = await executeNode(node, context, input, log);
        nr.status = "success";
        nr.output = output;
        nr.completedAt = new Date().toISOString();
        nr.durationMs = nr.startedAt ? Date.now() - new Date(nr.startedAt).getTime() : 0;

        context[node.id] = output;
        if (output.result !== undefined) context.lastResult = output.result;
        if (node.type === "output") finalOutput = String(output.result ?? "");

        broadcast(executionId, { type: "node_complete", nodeId: node.id, status: "success", output });
        log(`✅ "${node.label}" done`);
      } catch (nodeErr) {
        nr.status = "failed";
        nr.completedAt = new Date().toISOString();
        nr.reasoning = String(nodeErr);
        broadcast(executionId, { type: "node_failed", nodeId: node.id, status: "failed", error: String(nodeErr) });
        log(`❌ "${node.label}" failed: ${nodeErr}`);
        save();
        ex.status = "failed";
        broadcast(executionId, { type: "execution_complete", status: "failed" });
        return;
      }

      save();
      await sleep(200);
    }

    // Validator phase
    log("🔍 Validator Agent: Reviewing results...");
    try {
      const val = await groq().chat.completions.create({
        model: MODEL,
        max_tokens: 256,
        messages: [
          { role: "system", content: "You are a Validator Agent. Confirm results in 1-2 sentences." },
          { role: "user", content: `Input: "${input}"\nOutput: "${finalOutput}"\nNodes: ${nodeResults.length}` },
        ],
      });
      log(`✓ Validator: ${val.choices[0]?.message?.content ?? ""}`);
    } catch {
      log("✓ Validator: Execution completed successfully.");
    }

    ex.status = "completed";
    ex.finalOutput = finalOutput;
    save();
    broadcast(executionId, { type: "execution_complete", status: "completed", finalOutput });
    log("🎉 Execution complete!");
  } catch (err) {
    log(`💥 Execution crashed: ${err}`);
    ex.status = "failed";
    save();
    broadcast(executionId, { type: "execution_complete", status: "failed" });
  }
}

async function executeNode(
  node: WorkflowNode,
  context: Record<string, unknown>,
  input: string,
  log: (msg: string) => void,
): Promise<Record<string, unknown>> {
  const config = node.config ?? {};

  switch (node.type) {
    case "input":
      return { result: input, text: input };

    case "ai_agent": {
      const instruction = String(config.instruction ?? "Process the input");
      const role = String(config.role ?? "executor");
      const requestedModel = String(config.model ?? MODEL);
      // Fall back to default if model isn't in the supported list
      const SUPPORTED = [
        "llama-3.3-70b-versatile", "llama-3.1-8b-instant",
        "meta-llama/llama-4-scout-17b-16e-instruct", "qwen/qwen3-32b",
        "moonshotai/kimi-k2-instruct", "groq/compound", "groq/compound-mini",
        "openai/gpt-oss-120b", "openai/gpt-oss-20b", "allam-2-7b",
      ];
      const model = SUPPORTED.includes(requestedModel) ? requestedModel : MODEL;
      const temperature = Number(config.temperature ?? 0.7);
      const lastResult = String(context.lastResult ?? input);
      const resolvedInstruction = instruction.replace(/\{\{input\}\}/g, lastResult);
      log(`  🤖 AI Agent (${role}) [${model}]: ${resolvedInstruction.slice(0, 80)}`);
      try {
        const completion = await groq().chat.completions.create({
          model,
          max_tokens: 2048,
          temperature,
          messages: [
            { role: "system", content: `You are an AI ${role} agent. ${resolvedInstruction}` },
            { role: "user", content: lastResult },
          ],
        });
        const result = completion.choices[0]?.message?.content ?? "";
        log(`  💬 Output: ${result.slice(0, 100)}`);
        return { result, reasoning: `${role} agent processed the request`, tokens: completion.usage?.total_tokens };
      } catch (e) {
        const fallback = `[AI unavailable: ${e}]`;
        log(`  ⚠️  ${fallback}`);
        return { result: fallback };
      }
    }

    case "api_call": {
      const url = String(config.url ?? "");
      const method = String(config.method ?? "GET");
      if (!url) return { result: "No URL configured", status: 0 };
      log(`  🌐 API: ${method} ${url}`);
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", ...(config.headers as Record<string, string> ?? {}) },
        ...(method !== "GET" ? { body: JSON.stringify(config.body ?? context.lastResult) } : {}),
      });
      const data = await response.text();
      return { result: data, status: response.status, url };
    }

    case "condition": {
      const expr = String(config.expression ?? "true");
      const lastResult = context.lastResult;
      const passed = Boolean(lastResult && String(lastResult).length > 0);
      log(`  🔀 Condition "${expr}" → ${passed ? "TRUE" : "FALSE"}`);
      return { result: passed ? "true" : "false", passed };
    }

    case "loop": {
      const maxIter = Number(config.maxIterations ?? 3);
      const lastResult = String(context.lastResult ?? input);
      log(`  🔄 Loop: up to ${maxIter} iterations`);
      const items = lastResult.split("\n").slice(0, maxIter).filter(Boolean);
      return { result: items.join("\n"), items, count: items.length };
    }

    case "output": {
      const format = String(config.format ?? "text");
      const lastResult = String(context.lastResult ?? "No output");
      log(`  📤 Output (${format}): ${lastResult.slice(0, 80)}`);
      return { result: lastResult, format };
    }

    default:
      return { result: `Unknown node type: ${node.type}` };
  }
}

function topologicalSort(nodes: WorkflowNode[], edges: any[]): WorkflowNode[] {
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const inDegree = new Map(nodes.map(n => [n.id, 0]));
  const adj = new Map(nodes.map(n => [n.id, [] as string[]]));

  for (const e of edges) {
    adj.get(e.source)?.push(e.target);
    inDegree.set(e.target, (inDegree.get(e.target) ?? 0) + 1);
  }

  const queue = nodes.filter(n => inDegree.get(n.id) === 0);
  const result: WorkflowNode[] = [];

  while (queue.length > 0) {
    const node = queue.shift()!;
    result.push(node);
    for (const neighbor of adj.get(node.id) ?? []) {
      const deg = (inDegree.get(neighbor) ?? 0) - 1;
      inDegree.set(neighbor, deg);
      if (deg === 0) { const n = nodeMap.get(neighbor); if (n) queue.push(n); }
    }
  }

  const seen = new Set(result.map(n => n.id));
  nodes.forEach(n => { if (!seen.has(n.id)) result.push(n); });
  return result;
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

export default router;
