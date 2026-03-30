/**
 * Seeds 3 ready-to-run example workflows.
 * Only uses currently active Groq models.
 */
import { workflows, nextWfId, saveDB } from "./store";

// All active Groq text models as of 2026
export const SUPPORTED_MODELS = [
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
];

const DEFAULT_MODEL = "llama-3.3-70b-versatile";

export function seedExamples() {
    if (workflows.size > 0) return;

    const now = new Date();

    // ── 1. Summarize & Translate ──────────────────────────────────────────────
    const id1 = nextWfId();
    workflows.set(id1, {
        id: id1,
        name: "Summarize & Translate",
        description: "Summarizes your text with AI, then translates the summary to Tamil.",
        nodes: [
            { id: "n1", type: "input", label: "User Input", config: { prompt: "Enter text to summarize" }, position: { x: 100, y: 200 } },
            { id: "n2", type: "ai_agent", label: "Summarizer", config: { model: DEFAULT_MODEL, role: "executor", instruction: "Summarize the following text in 2-3 clear sentences:\n\n{{input}}", temperature: 0.5 }, position: { x: 400, y: 200 } },
            { id: "n3", type: "ai_agent", label: "Translator", config: { model: "llama-3.1-8b-instant", role: "executor", instruction: "Translate the following text to Tamil. Return only the Tamil translation:\n\n{{input}}", temperature: 0.3 }, position: { x: 700, y: 200 } },
            { id: "n4", type: "output", label: "Result", config: { format: "text" }, position: { x: 1000, y: 200 } },
        ],
        edges: [
            { id: "e1", source: "n1", target: "n2" },
            { id: "e2", source: "n2", target: "n3" },
            { id: "e3", source: "n3", target: "n4" },
        ],
        createdAt: now,
        updatedAt: now,
    });

    // ── 2. Research & Blog Writer ─────────────────────────────────────────────
    const id2 = nextWfId();
    workflows.set(id2, {
        id: id2,
        name: "Research & Blog Writer",
        description: "Takes a topic, researches key points, then writes a full blog post.",
        nodes: [
            { id: "n1", type: "input", label: "Topic Input", config: { prompt: "Enter a blog topic" }, position: { x: 100, y: 200 } },
            { id: "n2", type: "ai_agent", label: "Researcher", config: { model: "meta-llama/llama-4-scout-17b-16e-instruct", role: "planner", instruction: "List 5 key facts and insights about this topic:\n\n{{input}}", temperature: 0.6 }, position: { x: 400, y: 200 } },
            { id: "n3", type: "ai_agent", label: "Blog Writer", config: { model: DEFAULT_MODEL, role: "executor", instruction: "Using these research points, write an engaging 3-paragraph blog post:\n\n{{input}}", temperature: 0.8 }, position: { x: 700, y: 200 } },
            { id: "n4", type: "ai_agent", label: "Editor", config: { model: "llama-3.1-8b-instant", role: "validator", instruction: "Polish this blog post for clarity, flow, and engagement. Return the final version:\n\n{{input}}", temperature: 0.4 }, position: { x: 1000, y: 200 } },
            { id: "n5", type: "output", label: "Published Post", config: { format: "markdown" }, position: { x: 1300, y: 200 } },
        ],
        edges: [
            { id: "e1", source: "n1", target: "n2" },
            { id: "e2", source: "n2", target: "n3" },
            { id: "e3", source: "n3", target: "n4" },
            { id: "e4", source: "n4", target: "n5" },
        ],
        createdAt: now,
        updatedAt: now,
    });

    // ── 3. Plan → Execute → Validate ─────────────────────────────────────────
    const id3 = nextWfId();
    workflows.set(id3, {
        id: id3,
        name: "Plan → Execute → Validate",
        description: "Full multi-agent pipeline: Planner breaks down the task, Executor completes it, Validator reviews the result.",
        nodes: [
            { id: "n1", type: "input", label: "Task Input", config: { prompt: "Describe a task for the AI agents" }, position: { x: 100, y: 200 } },
            { id: "n2", type: "ai_agent", label: "Planner", config: { model: "meta-llama/llama-4-scout-17b-16e-instruct", role: "planner", instruction: "Break down this task into a clear numbered step-by-step action plan:\n\n{{input}}", temperature: 0.5 }, position: { x: 400, y: 200 } },
            { id: "n3", type: "condition", label: "Has Plan?", config: { expression: "error" }, position: { x: 700, y: 200 } },
            { id: "n4", type: "ai_agent", label: "Executor", config: { model: DEFAULT_MODEL, role: "executor", instruction: "Follow this plan and produce the final result:\n\n{{input}}", temperature: 0.7 }, position: { x: 1000, y: 200 } },
            { id: "n5", type: "ai_agent", label: "Validator", config: { model: "llama-3.1-8b-instant", role: "validator", instruction: "Review this output and confirm it is correct and high quality. Give a brief validation report:\n\n{{input}}", temperature: 0.3 }, position: { x: 1300, y: 200 } },
            { id: "n6", type: "output", label: "Final Result", config: { format: "text" }, position: { x: 1600, y: 200 } },
        ],
        edges: [
            { id: "e1", source: "n1", target: "n2" },
            { id: "e2", source: "n2", target: "n3" },
            { id: "e3", source: "n3", target: "n4" },
            { id: "e4", source: "n4", target: "n5" },
            { id: "e5", source: "n5", target: "n6" },
        ],
        createdAt: now,
        updatedAt: now,
    });

    saveDB();
}
