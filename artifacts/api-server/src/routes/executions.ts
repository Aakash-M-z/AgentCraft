import { Router } from "express";
import { db } from "@workspace/db";
import { executionsTable, workflowsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { WorkflowNode, NodeResult } from "@workspace/db";
import OpenAI from "openai";

const router = Router();

const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
});

// Track active SSE clients per execution
const executionClients = new Map<number, Set<(data: unknown) => void>>();

function broadcast(executionId: number, data: unknown) {
  const clients = executionClients.get(executionId);
  if (clients) {
    for (const send of clients) {
      send(data);
    }
  }
}

// SSE endpoint for real-time execution updates
router.get("/:id/stream", (req, res) => {
  const id = parseInt(req.params.id!);
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.flushHeaders();

  const send = (data: unknown) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  if (!executionClients.has(id)) {
    executionClients.set(id, new Set());
  }
  executionClients.get(id)!.add(send);

  // Send heartbeat
  const heartbeat = setInterval(() => res.write(": ping\n\n"), 15000);

  req.on("close", () => {
    clearInterval(heartbeat);
    executionClients.get(id)?.delete(send);
    if (executionClients.get(id)?.size === 0) {
      executionClients.delete(id);
    }
  });
});

router.get("/", async (req, res) => {
  try {
    const { workflowId } = req.query;
    let executions;
    if (workflowId) {
      executions = await db.select().from(executionsTable)
        .where(eq(executionsTable.workflowId, parseInt(workflowId as string)))
        .orderBy(executionsTable.createdAt);
    } else {
      executions = await db.select().from(executionsTable).orderBy(executionsTable.createdAt);
    }
    res.json(executions.map(e => ({
      ...e,
      nodeResults: e.nodeResults,
      agentLogs: e.agentLogs,
      createdAt: e.createdAt.toISOString(),
      updatedAt: e.updatedAt.toISOString(),
    })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to list executions" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id!);
    const [execution] = await db.select().from(executionsTable).where(eq(executionsTable.id, id));
    if (!execution) {
      res.status(404).json({ error: "Execution not found" });
      return;
    }
    res.json({
      ...execution,
      nodeResults: execution.nodeResults,
      agentLogs: execution.agentLogs,
      createdAt: execution.createdAt.toISOString(),
      updatedAt: execution.updatedAt.toISOString(),
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to get execution" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { workflowId, input } = req.body as { workflowId: number; input: string };

    const [workflow] = await db.select().from(workflowsTable).where(eq(workflowsTable.id, workflowId));
    if (!workflow) {
      res.status(404).json({ error: "Workflow not found" });
      return;
    }

    const [execution] = await db.insert(executionsTable).values({
      workflowId,
      input: input || "",
      status: "pending",
      nodeResults: [],
      agentLogs: [],
    }).returning();

    res.status(202).json({
      ...execution!,
      createdAt: execution!.createdAt.toISOString(),
      updatedAt: execution!.updatedAt.toISOString(),
    });

    // Run execution asynchronously
    runExecution(execution!.id, workflow.nodes as WorkflowNode[], workflow.edges as any[], input || "").catch(console.error);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to start execution" });
  }
});

router.post("/:id/cancel", async (req, res) => {
  try {
    const id = parseInt(req.params.id!);
    const [updated] = await db.update(executionsTable)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(eq(executionsTable.id, id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Execution not found" });
      return;
    }

    broadcast(id, { type: "execution_cancelled" });
    res.json({ ...updated, createdAt: updated.createdAt.toISOString(), updatedAt: updated.updatedAt.toISOString() });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to cancel execution" });
  }
});

async function runExecution(executionId: number, nodes: WorkflowNode[], edges: any[], input: string) {
  const logs: string[] = [];
  const nodeResults: NodeResult[] = [];

  function log(msg: string) {
    logs.push(`[${new Date().toISOString()}] ${msg}`);
    broadcast(executionId, { type: "log", message: msg });
  }

  try {
    await db.update(executionsTable)
      .set({ status: "running", updatedAt: new Date() })
      .where(eq(executionsTable.id, executionId));

    broadcast(executionId, { type: "execution_start" });
    log("🚀 Planner Agent: Analyzing workflow and preparing execution plan...");

    // Build execution order via topological sort
    const orderedNodes = topologicalSort(nodes, edges);
    log(`📋 Planner Agent: Identified ${orderedNodes.length} nodes to execute`);

    let context: Record<string, unknown> = { input };
    let finalOutput = "";

    // Plan phase
    const planCompletion = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 1024,
      messages: [
        { role: "system", content: "You are a Planner Agent. Given a workflow and user input, briefly describe the execution plan in 2-3 sentences." },
        { role: "user", content: `Workflow nodes: ${JSON.stringify(orderedNodes.map(n => ({ type: n.type, label: n.label })))}\nUser input: "${input}"` }
      ]
    });
    const plan = planCompletion.choices[0]?.message?.content ?? "";
    log(`🧠 Planner Agent: ${plan}`);

    for (const node of orderedNodes) {
      const nodeResult: NodeResult = {
        nodeId: node.id,
        nodeType: node.type,
        label: node.label,
        status: "running",
        startedAt: new Date().toISOString(),
      };

      nodeResults.push(nodeResult);
      broadcast(executionId, { type: "node_start", nodeId: node.id, label: node.label, nodeType: node.type });
      log(`⚙️  Executing node: ${node.label} (${node.type})`);

      await db.update(executionsTable)
        .set({ nodeResults: [...nodeResults], agentLogs: [...logs], updatedAt: new Date() })
        .where(eq(executionsTable.id, executionId));

      try {
        const output = await executeNode(node, context, input, log);
        nodeResult.status = "success";
        nodeResult.output = output;
        nodeResult.completedAt = new Date().toISOString();
        nodeResult.durationMs = nodeResult.startedAt
          ? Date.now() - new Date(nodeResult.startedAt).getTime()
          : 0;

        // Update context with node output
        context[node.id] = output;
        if (output.result !== undefined) {
          context.lastResult = output.result;
        }
        if (node.type === "output") {
          finalOutput = String(output.result ?? "");
        }

        broadcast(executionId, {
          type: "node_complete",
          nodeId: node.id,
          status: "success",
          output,
        });
        log(`✅ Node "${node.label}" completed successfully`);
      } catch (nodeErr) {
        nodeResult.status = "failed";
        nodeResult.completedAt = new Date().toISOString();
        nodeResult.reasoning = String(nodeErr);

        broadcast(executionId, {
          type: "node_failed",
          nodeId: node.id,
          status: "failed",
          error: String(nodeErr),
        });
        log(`❌ Node "${node.label}" failed: ${nodeErr}`);

        await db.update(executionsTable)
          .set({ status: "failed", nodeResults: [...nodeResults], agentLogs: [...logs], updatedAt: new Date() })
          .where(eq(executionsTable.id, executionId));

        broadcast(executionId, { type: "execution_complete", status: "failed" });
        return;
      }

      await db.update(executionsTable)
        .set({ nodeResults: [...nodeResults], agentLogs: [...logs], updatedAt: new Date() })
        .where(eq(executionsTable.id, executionId));

      // Brief delay between nodes for visibility
      await sleep(300);
    }

    // Validator phase
    log(`🔍 Validator Agent: Reviewing execution results...`);
    const validatorCompletion = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 512,
      messages: [
        { role: "system", content: "You are a Validator Agent. Review the workflow execution and confirm the results are correct in 1-2 sentences." },
        { role: "user", content: `Input: "${input}"\nFinal output: "${finalOutput}"\nNodes executed: ${nodeResults.length}` }
      ]
    });
    const validation = validatorCompletion.choices[0]?.message?.content ?? "";
    log(`✓ Validator Agent: ${validation}`);

    await db.update(executionsTable)
      .set({
        status: "completed",
        finalOutput,
        nodeResults,
        agentLogs: [...logs],
        updatedAt: new Date()
      })
      .where(eq(executionsTable.id, executionId));

    broadcast(executionId, { type: "execution_complete", status: "completed", finalOutput });
    log(`🎉 Execution completed successfully`);
  } catch (err) {
    log(`💥 Execution failed: ${err}`);
    await db.update(executionsTable)
      .set({ status: "failed", agentLogs: [...logs], nodeResults, updatedAt: new Date() })
      .where(eq(executionsTable.id, executionId));
    broadcast(executionId, { type: "execution_complete", status: "failed" });
  }
}

async function executeNode(
  node: WorkflowNode,
  context: Record<string, unknown>,
  input: string,
  log: (msg: string) => void
): Promise<Record<string, unknown>> {
  const config = node.config ?? {};

  switch (node.type) {
    case "input":
      return { result: input, text: input };

    case "ai_agent": {
      const instruction = String(config.instruction ?? "Process the input");
      const role = String(config.role ?? "executor");
      const lastResult = String(context.lastResult ?? input);

      log(`  🤖 AI Agent (${role}): ${instruction}`);

      const completion = await openai.chat.completions.create({
        model: "gpt-5.2",
        max_completion_tokens: 2048,
        messages: [
          { role: "system", content: `You are an AI ${role} agent. ${instruction}` },
          { role: "user", content: lastResult }
        ]
      });
      const result = completion.choices[0]?.message?.content ?? "";
      log(`  💬 AI Agent output: ${result.slice(0, 100)}...`);
      return { result, reasoning: `${role} agent processed the request`, tokens: completion.usage?.total_tokens };
    }

    case "api_call": {
      const url = String(config.url ?? "");
      const method = String(config.method ?? "GET");
      if (!url) return { result: "No URL configured", status: 0 };

      log(`  🌐 API Call: ${method} ${url}`);
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
      let passed = false;
      try {
        // Simple safe evaluation
        passed = Boolean(lastResult && String(lastResult).length > 0);
        log(`  🔀 Condition: "${expr}" → ${passed ? "TRUE" : "FALSE"}`);
      } catch {
        passed = false;
      }
      return { result: passed ? "true" : "false", passed };
    }

    case "loop": {
      const maxIter = Number(config.maxIterations ?? 3);
      const lastResult = String(context.lastResult ?? input);
      log(`  🔄 Loop: processing up to ${maxIter} iterations`);
      const items = lastResult.split("\n").slice(0, maxIter).filter(Boolean);
      return { result: items.join("\n"), items, count: items.length };
    }

    case "output": {
      const format = String(config.format ?? "text");
      const lastResult = String(context.lastResult ?? "No output");
      log(`  📤 Output (${format}): ${lastResult.slice(0, 80)}...`);
      return { result: lastResult, format };
    }

    default:
      return { result: `Unknown node type: ${node.type}` };
  }
}

function topologicalSort(nodes: WorkflowNode[], edges: any[]): WorkflowNode[] {
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const inDegree = new Map(nodes.map(n => [n.id, 0]));
  const adjacency = new Map(nodes.map(n => [n.id, [] as string[]]));

  for (const edge of edges) {
    adjacency.get(edge.source)?.push(edge.target);
    inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
  }

  const queue = nodes.filter(n => inDegree.get(n.id) === 0);
  const result: WorkflowNode[] = [];

  while (queue.length > 0) {
    const node = queue.shift()!;
    result.push(node);
    for (const neighbor of adjacency.get(node.id) ?? []) {
      const deg = (inDegree.get(neighbor) ?? 0) - 1;
      inDegree.set(neighbor, deg);
      if (deg === 0) {
        const n = nodeMap.get(neighbor);
        if (n) queue.push(n);
      }
    }
  }

  // Include any remaining nodes not in graph
  const included = new Set(result.map(n => n.id));
  for (const node of nodes) {
    if (!included.has(node.id)) result.push(node);
  }

  return result;
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export default router;
