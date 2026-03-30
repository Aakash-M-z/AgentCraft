import { pgTable, serial, text, integer, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const workflowsTable = pgTable("workflows", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  nodes: jsonb("nodes").notNull().$type<WorkflowNode[]>().default([]),
  edges: jsonb("edges").notNull().$type<WorkflowEdge[]>().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export interface WorkflowNode {
  id: string;
  type: "input" | "ai_agent" | "api_call" | "condition" | "loop" | "output";
  label: string;
  config?: Record<string, unknown>;
  position: { x: number; y: number };
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export const insertWorkflowSchema = createInsertSchema(workflowsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertWorkflow = z.infer<typeof insertWorkflowSchema>;
export type Workflow = typeof workflowsTable.$inferSelect;

export const executionsTable = pgTable("executions", {
  id: serial("id").primaryKey(),
  workflowId: integer("workflow_id").notNull(),
  status: text("status")
    .$type<"pending" | "running" | "completed" | "failed" | "cancelled">()
    .notNull()
    .default("pending"),
  input: text("input").notNull().default(""),
  finalOutput: text("final_output"),
  nodeResults: jsonb("node_results").notNull().$type<NodeResult[]>().default([]),
  agentLogs: jsonb("agent_logs").notNull().$type<string[]>().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export interface NodeResult {
  nodeId: string;
  nodeType: string;
  label: string;
  status: "pending" | "running" | "success" | "failed" | "skipped";
  output?: Record<string, unknown>;
  reasoning?: string;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
}

export const insertExecutionSchema = createInsertSchema(executionsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertExecution = z.infer<typeof insertExecutionSchema>;
export type Execution = typeof executionsTable.$inferSelect;
