import { useWorkflowStore } from "@/lib/store";
import { WorkflowNodeType } from "@workspace/api-client-react";
import { Bot, Server, GitBranch, Repeat, Zap, ArrowDownToLine } from "lucide-react";

const GROQ_MODELS = [
  { value: "llama-3.3-70b-versatile", label: "Llama 3.3 70B Versatile ⚡" },
  { value: "llama-3.1-8b-instant", label: "Llama 3.1 8B Instant 🚀" },
  { value: "meta-llama/llama-4-scout-17b-16e-instruct", label: "Llama 4 Scout 17B 🦙" },
  { value: "qwen/qwen3-32b", label: "Qwen 3 32B 🌟" },
  { value: "moonshotai/kimi-k2-instruct", label: "Kimi K2 🌙" },
  { value: "groq/compound", label: "Groq Compound 🔮" },
  { value: "groq/compound-mini", label: "Groq Compound Mini ⚡" },
  { value: "openai/gpt-oss-120b", label: "GPT OSS 120B 🧠" },
  { value: "openai/gpt-oss-20b", label: "GPT OSS 20B" },
  { value: "allam-2-7b", label: "Allam 2 7B" },
];

const inputClass =
  "w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all";

export function ConfigPanel() {
  const { nodes, selectedNodeId, updateNodeData } = useWorkflowStore();

  if (!selectedNodeId) {
    return (
      <div className="w-80 border-l border-border bg-card/50 backdrop-blur-xl h-full flex flex-col items-center justify-center text-muted-foreground p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-4">
          <div className="w-8 h-8 rounded-full border-2 border-dashed border-muted-foreground/50 animate-spin-slow" />
        </div>
        <p className="font-medium text-foreground">No Node Selected</p>
        <p className="text-sm mt-2">Click any node on the canvas to configure it.</p>
      </div>
    );
  }

  const node = nodes.find(n => n.id === selectedNodeId);
  if (!node) return null;

  const cfg = node.data.config ?? {};

  const set = (key: string, value: any) =>
    updateNodeData(node.id, { config: { ...cfg, [key]: value } });

  const typeIcons: Record<string, React.ReactNode> = {
    input: <Zap size={14} className="text-emerald-400" />,
    ai_agent: <Bot size={14} className="text-primary" />,
    api_call: <Server size={14} className="text-blue-400" />,
    condition: <GitBranch size={14} className="text-amber-400" />,
    loop: <Repeat size={14} className="text-pink-400" />,
    output: <ArrowDownToLine size={14} className="text-rose-400" />,
  };

  return (
    <div className="w-80 border-l border-border bg-card h-full flex flex-col shadow-2xl z-10 overflow-y-auto">
      {/* Header */}
      <div className="p-4 border-b border-border bg-secondary/50 sticky top-0 z-10">
        <h3 className="font-bold text-lg text-foreground">Configuration</h3>
        <span className="inline-flex items-center gap-1.5 mt-1 text-xs px-2 py-0.5 rounded bg-background border border-border text-muted-foreground capitalize">
          {typeIcons[node.type ?? ""] ?? null}
          {node.type?.replace("_", " ")}
        </span>
      </div>

      <div className="p-5 flex flex-col gap-5">
        {/* Label — always shown */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Node Label</label>
          <input
            type="text"
            value={node.data.label}
            onChange={e => updateNodeData(node.id, { label: e.target.value })}
            className={inputClass}
          />
        </div>

        <div className="h-px bg-border" />

        {/* ── AI Agent ─────────────────────────────────────────────────── */}
        {node.type === WorkflowNodeType.ai_agent && (
          <>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Model</label>
              <select
                value={cfg.model ?? "llama-3.3-70b-versatile"}
                onChange={e => set("model", e.target.value)}
                className={inputClass}
              >
                {GROQ_MODELS.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">Powered by Groq</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Role</label>
              <select
                value={cfg.role ?? "executor"}
                onChange={e => set("role", e.target.value)}
                className={inputClass}
              >
                <option value="planner">🧠 Planner</option>
                <option value="executor">⚙️ Executor</option>
                <option value="validator">✅ Validator</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Instruction</label>
              <textarea
                value={cfg.instruction ?? ""}
                onChange={e => set("instruction", e.target.value)}
                rows={5}
                className={`${inputClass} resize-none font-mono text-xs`}
                placeholder={"Summarize the following text:\n{{input}}"}
              />
              <p className="text-xs text-muted-foreground">Use <code className="bg-secondary px-1 rounded">{"{{input}}"}</code> to inject the previous node's output.</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Temperature</label>
              <div className="flex items-center gap-3">
                <input
                  type="range" min="0" max="1" step="0.1"
                  value={cfg.temperature ?? 0.7}
                  onChange={e => set("temperature", parseFloat(e.target.value))}
                  className="flex-1 accent-primary"
                />
                <span className="text-sm font-mono text-foreground w-8 text-right">{cfg.temperature ?? 0.7}</span>
              </div>
            </div>
          </>
        )}

        {/* ── API Call ──────────────────────────────────────────────────── */}
        {node.type === WorkflowNodeType.api_call && (
          <>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Endpoint URL</label>
              <input
                type="text"
                value={cfg.url ?? ""}
                onChange={e => set("url", e.target.value)}
                className={inputClass}
                placeholder="https://api.example.com/data"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Method</label>
              <select value={cfg.method ?? "GET"} onChange={e => set("method", e.target.value)} className={inputClass}>
                <option>GET</option><option>POST</option><option>PUT</option><option>DELETE</option>
              </select>
            </div>
          </>
        )}

        {/* ── Condition ─────────────────────────────────────────────────── */}
        {node.type === WorkflowNodeType.condition && (
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Stop if output contains</label>
            <input
              type="text"
              value={cfg.expression ?? "error"}
              onChange={e => set("expression", e.target.value)}
              className={inputClass}
              placeholder="error"
            />
            <p className="text-xs text-muted-foreground">Execution halts if this keyword is found in the previous output.</p>
          </div>
        )}

        {/* ── Loop ──────────────────────────────────────────────────────── */}
        {node.type === WorkflowNodeType.loop && (
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Max Iterations</label>
            <input
              type="number" min={1} max={20}
              value={cfg.maxIterations ?? 3}
              onChange={e => set("maxIterations", parseInt(e.target.value))}
              className={inputClass}
            />
          </div>
        )}

        {/* ── Input ─────────────────────────────────────────────────────── */}
        {node.type === WorkflowNodeType.input && (
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Input Hint</label>
            <input
              type="text"
              value={cfg.prompt ?? ""}
              onChange={e => set("prompt", e.target.value)}
              className={inputClass}
              placeholder="Describe what input this node expects"
            />
          </div>
        )}

        {/* ── Output ────────────────────────────────────────────────────── */}
        {node.type === WorkflowNodeType.output && (
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Output Format</label>
            <select value={cfg.format ?? "text"} onChange={e => set("format", e.target.value)} className={inputClass}>
              <option value="text">Text</option>
              <option value="markdown">Markdown</option>
              <option value="json">JSON</option>
            </select>
          </div>
        )}
      </div>
    </div>
  );
}
