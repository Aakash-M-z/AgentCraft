/**
 * File-backed store — persists workflows to data/db.json so data survives server restarts.
 * Executions are kept in-memory only (they're transient).
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import type { WorkflowNode, WorkflowEdge, NodeResult } from "@workspace/db";

export interface StoredWorkflow {
    id: number;
    name: string;
    description: string | null;
    nodes: WorkflowNode[];
    edges: WorkflowEdge[];
    createdAt: Date;
    updatedAt: Date;
}

export interface StoredExecution {
    id: number;
    workflowId: number;
    status: "pending" | "running" | "completed" | "failed" | "cancelled";
    input: string;
    finalOutput: string | null;
    nodeResults: NodeResult[];
    agentLogs: string[];
    createdAt: Date;
    updatedAt: Date;
}

// ── File path ─────────────────────────────────────────────────────────────────
const DATA_DIR = resolve(process.cwd(), "data");
const DB_FILE = resolve(DATA_DIR, "db.json");

// ── In-memory maps ────────────────────────────────────────────────────────────
export const workflows = new Map<number, StoredWorkflow>();
export const executions = new Map<number, StoredExecution>();

let _wfSeq = 0;
let _exSeq = 0;

export function nextWfId() { return ++_wfSeq; }
export function nextExId() { return ++_exSeq; }

// ── Persistence ───────────────────────────────────────────────────────────────

interface PersistedDB {
    wfSeq: number;
    workflows: Array<StoredWorkflow & { createdAt: string; updatedAt: string }>;
}

export function loadDB() {
    try {
        if (!existsSync(DB_FILE)) return;
        const raw = readFileSync(DB_FILE, "utf-8");
        const data: PersistedDB = JSON.parse(raw);
        _wfSeq = data.wfSeq ?? 0;
        for (const wf of data.workflows ?? []) {
            workflows.set(wf.id, {
                ...wf,
                createdAt: new Date(wf.createdAt),
                updatedAt: new Date(wf.updatedAt),
            });
        }
    } catch (e) {
        console.error("[store] Failed to load db.json:", e);
    }
}

export function saveDB() {
    try {
        if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
        const data: PersistedDB = {
            wfSeq: _wfSeq,
            workflows: [...workflows.values()].map(wf => ({
                ...wf,
                createdAt: wf.createdAt.toISOString() as unknown as string,
                updatedAt: wf.updatedAt.toISOString() as unknown as string,
            })),
        };
        writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf-8");
    } catch (e) {
        console.error("[store] Failed to save db.json:", e);
    }
}
