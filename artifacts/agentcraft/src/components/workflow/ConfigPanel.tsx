import { useWorkflowStore } from "@/lib/store";
import { WorkflowNodeType } from "@workspace/api-client-react";
import { Bot, Server, GitBranch, Repeat, Zap, ArrowDownToLine, Mail, Database, Webhook, FileText, Timer, Plus, Wand2, Lightbulb, Bug, CalendarClock, Code2, BrainCircuit, MessageSquare, Send, Trash2, Github, CloudSun } from "lucide-react";
import { NodeDebugPanel } from "./NodeDebugPanel";
import { cn } from "@/lib/utils";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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

const TIPS = [
  "Drag nodes from the palette onto the canvas to build your workflow.",
  "Connect nodes by dragging from the right handle to the left handle of the next node.",
  "Use {{input}} in AI Agent instructions to inject the previous node's output.",
  "Click 'AI Generate' to describe a workflow in plain English and let AI build it.",
  "Save your workflow before running it to preserve your changes.",
  "Use the Condition node to stop execution if an error keyword is detected.",
];

function EmptyPanel({ onOpenGenerate }: { onOpenGenerate?: () => void }) {
  const tip = TIPS[Math.floor(Math.random() * TIPS.length)];
  return (
    <div className="flex flex-col h-full p-5 gap-4">
      {/* Quick actions */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Quick Actions</p>
        <div className="flex flex-col gap-2">
          <button
            onClick={onOpenGenerate}
            className="flex items-center gap-3 p-3 rounded-xl border border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 hover:border-amber-500/40 transition-all text-sm font-medium text-amber-300 group"
          >
            <Wand2 size={16} className="group-hover:rotate-12 transition-transform" />
            Generate Workflow with AI
          </button>
          <button
            className="flex items-center gap-3 p-3 rounded-xl border border-border bg-secondary/30 hover:bg-secondary transition-all text-sm font-medium text-foreground group"
            onClick={() => {
              const event = new CustomEvent('add-ai-agent');
              window.dispatchEvent(event);
            }}
          >
            <Plus size={16} className="text-violet-400" />
            Add AI Agent Node
          </button>
        </div>
      </div>

      <div className="h-px bg-border" />

      {/* Tip */}
      <div className="p-3 rounded-xl bg-secondary/40 border border-border">
        <div className="flex items-start gap-2">
          <Lightbulb size={14} className="text-amber-400 mt-0.5 shrink-0" />
          <p className="text-xs text-muted-foreground leading-relaxed">{tip}</p>
        </div>
      </div>

      <div className="mt-auto text-center">
        <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center mx-auto mb-3">
          <div className="w-6 h-6 rounded-full border-2 border-dashed border-muted-foreground/30 animate-spin" style={{ animationDuration: '3s' }} />
        </div>
        <p className="text-sm font-medium text-foreground">No node selected</p>
        <p className="text-xs text-muted-foreground mt-1">Click any node to configure it</p>
      </div>
    </div>
  );
}

interface ConfigPanelProps {
  onOpenGenerate?: () => void;
}

export function ConfigPanel({ onOpenGenerate }: ConfigPanelProps) {
  const { nodes, selectedNodeId, updateNodeData, deleteNode, nodeExecutionStatus, nodeDebugInfo } = useWorkflowStore();
  const [activeTab, setActiveTab] = useState<'config' | 'debug'>('config');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  if (!selectedNodeId) {
    return (
      <div className="w-80 border-l border-border/80 bg-card/65 backdrop-blur-xl h-full flex flex-col z-10 shadow-2xl overflow-y-auto">
        <div className="p-4 border-b border-border/50 bg-secondary/25 sticky top-0 z-10">
          <h3 className="font-bold text-base text-foreground/90 tracking-tight flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            Inspector
          </h3>
        </div>
        <EmptyPanel onOpenGenerate={onOpenGenerate} />
      </div>
    );
  }

  const node = nodes.find(n => n.id === selectedNodeId);
  if (!node) return null;

  const cfg = node.data.config ?? {};
  const set = (key: string, value: any) =>
    updateNodeData(node.id, { config: { ...cfg, [key]: value } });

  const execStatus = nodeExecutionStatus[node.id] ?? 'idle';
  const debugInfo = nodeDebugInfo[node.id];
  const hasDebugInfo = !!debugInfo;

  const typeIcons: Record<string, React.ReactNode> = {
    input: <Zap size={13} className="text-emerald-400" />,
    ai_agent: <Bot size={13} className="text-violet-400" />,
    api_call: <Server size={13} className="text-blue-400" />,
    condition: <GitBranch size={13} className="text-amber-400" />,
    loop: <Repeat size={13} className="text-pink-400" />,
    output: <ArrowDownToLine size={13} className="text-rose-400" />,
    email: <Mail size={13} className="text-sky-400" />,
    database: <Database size={13} className="text-teal-400" />,
    webhook: <Webhook size={13} className="text-orange-400" />,
    file_processor: <FileText size={13} className="text-indigo-400" />,
    delay: <Timer size={13} className="text-yellow-400" />,
    schedule_trigger: <CalendarClock size={13} className="text-emerald-400" />,
    leetcode_daily: <Code2 size={13} className="text-amber-400" />,
    leetcode_submit: <Code2 size={13} className="text-amber-400" />,
    leetcode_save: <Database size={13} className="text-amber-400" />,
    ai_solver: <BrainCircuit size={13} className="text-violet-400" />,
    discord_webhook: <MessageSquare size={13} className="text-indigo-400" />,
    telegram_bot: <Send size={13} className="text-sky-400" />,
    github: <Github size={13} className="text-zinc-300" />,
    weather: <CloudSun size={13} className="text-sky-400" />,
    whatsapp_monitor: <MessageSquare size={13} className="text-emerald-400" />,
    whatsapp_sender: <Send size={13} className="text-emerald-400" />,
  };

  return (
    <div className="w-80 border-l border-border/80 bg-card/65 backdrop-blur-xl h-full flex flex-col shadow-2xl z-10 overflow-y-auto relative">
      {/* Header */}
      <div className="p-4 border-b border-border/50 bg-secondary/25 sticky top-0 z-10">
        <h3 className="font-bold text-base text-foreground/90 tracking-tight flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          Inspector
        </h3>
        <span className="inline-flex items-center gap-1.5 mt-2 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md bg-[#000000]/40 border border-border/60 text-muted-foreground capitalize">
          {typeIcons[node.type ?? ""] ?? null}
          {node.type?.replace(/_/g, " ")}
        </span>
      </div>

      {/* Tabs — only show Debug if we have data */}
      {hasDebugInfo && (
        <div className="flex border-b border-border sticky top-[73px] z-10 bg-card">
          {(['config', 'debug'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-colors capitalize',
                activeTab === tab
                  ? 'text-primary border-b-2 border-primary bg-primary/5'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {tab === 'debug' ? <Bug size={12} /> : null}
              {tab}
            </button>
          ))}
        </div>
      )}

      {/* Debug tab */}
      {activeTab === 'debug' && hasDebugInfo && (
        <div className="p-4">
          <NodeDebugPanel debugInfo={debugInfo} status={execStatus} />
        </div>
      )}

      {/* Config tab */}
      {activeTab === 'config' && (
        <div className="p-5 flex flex-col gap-5">
          {/* Label */}
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

          {/* AI Agent */}
          {node.type === WorkflowNodeType.ai_agent && (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Model</label>
                <select value={cfg.model ?? "llama-3.3-70b-versatile"} onChange={e => set("model", e.target.value)} className={inputClass}>
                  {GROQ_MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
                <p className="text-xs text-muted-foreground">Powered by Groq</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Role</label>
                <select value={cfg.role ?? "executor"} onChange={e => set("role", e.target.value)} className={inputClass}>
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
                <p className="text-xs text-muted-foreground">Use <code className="bg-secondary px-1 rounded">{"{{input}}"}</code> to inject previous output.</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Temperature</label>
                <div className="flex items-center gap-3">
                  <input type="range" min="0" max="1" step="0.1"
                    value={cfg.temperature ?? 0.7}
                    onChange={e => set("temperature", parseFloat(e.target.value))}
                    className="flex-1 accent-primary"
                  />
                  <span className="text-sm font-mono text-foreground w-8 text-right">{cfg.temperature ?? 0.7}</span>
                </div>
              </div>
            </>
          )}

          {/* API Call */}
          {node.type === WorkflowNodeType.api_call && (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Endpoint URL</label>
                <input type="text" value={cfg.url ?? ""} onChange={e => set("url", e.target.value)} className={inputClass} placeholder="https://api.example.com/data" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Method</label>
                <select value={cfg.method ?? "GET"} onChange={e => set("method", e.target.value)} className={inputClass}>
                  <option>GET</option><option>POST</option><option>PUT</option><option>DELETE</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Headers (JSON)</label>
                <textarea value={cfg.headers ?? ""} onChange={e => set("headers", e.target.value)} rows={3} className={`${inputClass} resize-none font-mono text-xs`} placeholder={'{"Authorization": "Bearer token"}'} />
              </div>
            </>
          )}

          {/* Condition */}
          {node.type === WorkflowNodeType.condition && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Stop if output contains</label>
              <input type="text" value={cfg.expression ?? "error"} onChange={e => set("expression", e.target.value)} className={inputClass} placeholder="error" />
              <p className="text-xs text-muted-foreground">Execution halts if this keyword is found in the previous output.</p>
            </div>
          )}

          {/* Loop */}
          {node.type === WorkflowNodeType.loop && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Max Iterations</label>
              <input type="number" min={1} max={20} value={cfg.maxIterations ?? 3} onChange={e => set("maxIterations", parseInt(e.target.value))} className={inputClass} />
            </div>
          )}

          {/* Input */}
          {node.type === WorkflowNodeType.input && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Input Hint</label>
              <input type="text" value={cfg.prompt ?? ""} onChange={e => set("prompt", e.target.value)} className={inputClass} placeholder="Describe what input this node expects" />
            </div>
          )}

          {/* Output */}
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

          {/* Email */}
          {node.type === "email" && (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">To</label>
                <input type="email" value={cfg.to ?? ""} onChange={e => set("to", e.target.value)} className={inputClass} placeholder="recipient@example.com" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Subject</label>
                <input type="text" value={cfg.subject ?? ""} onChange={e => set("subject", e.target.value)} className={inputClass} placeholder="Workflow result: {{input}}" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Body</label>
                <textarea value={cfg.body ?? ""} onChange={e => set("body", e.target.value)} rows={6} className={`${inputClass} resize-none font-mono text-xs`} placeholder={"Hello,\n\nHere is your result:\n\n{{input}}"} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Format</label>
                <select value={cfg.format ?? "text"} onChange={e => set("format", e.target.value)} className={inputClass}>
                  <option value="text">Plain Text</option>
                  <option value="html">HTML</option>
                </select>
              </div>
            </>
          )}

          {/* Delay */}
          {node.type === "delay" && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Delay (seconds)</label>
              <input type="number" min={1} max={300} value={cfg.seconds ?? 5} onChange={e => set("seconds", parseInt(e.target.value))} className={inputClass} />
            </div>
          )}

          {/* Webhook */}
          {node.type === "webhook" && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Webhook Path</label>
              <input type="text" value={cfg.path ?? "/webhook"} onChange={e => set("path", e.target.value)} className={inputClass} placeholder="/webhook/my-trigger" />
              <p className="text-xs text-muted-foreground">Incoming POST requests to this path will trigger the workflow.</p>
            </div>
          )}

          {/* Database */}
          {node.type === "database" && (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Operation</label>
                <select value={cfg.operation ?? "read"} onChange={e => set("operation", e.target.value)} className={inputClass}>
                  <option value="read">Read</option>
                  <option value="write">Write</option>
                  <option value="query">Query</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Query / Key</label>
                <textarea value={cfg.query ?? ""} onChange={e => set("query", e.target.value)} rows={3} className={`${inputClass} resize-none font-mono text-xs`} placeholder="SELECT * FROM table WHERE id = {{input}}" />
              </div>
            </>
          )}

          {/* File Processor */}
          {node.type === "file_processor" && (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Operation</label>
                <select value={cfg.operation ?? "read"} onChange={e => set("operation", e.target.value)} className={inputClass}>
                  <option value="read">Read File</option>
                  <option value="write">Write File</option>
                  <option value="parse">Parse CSV/JSON</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">File Path</label>
                <input type="text" value={cfg.path ?? ""} onChange={e => set("path", e.target.value)} className={inputClass} placeholder="/data/output.txt" />
              </div>
            </>
          )}

          {/* Schedule Trigger */}
          {node.type === "schedule_trigger" && (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cron Expression</label>
                <input type="text" value={cfg.cron ?? "0 8 * * *"} onChange={e => set("cron", e.target.value)} className={inputClass} placeholder="0 8 * * *" />
                <p className="text-xs text-muted-foreground">Standard cron format. Default: 0 8 * * * (8:00 AM daily)</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Timezone</label>
                <input type="text" value={cfg.timezone ?? "UTC"} onChange={e => set("timezone", e.target.value)} className={inputClass} placeholder="UTC" />
              </div>
            </>
          )}

          {/* LeetCode Daily */}
          {node.type === "leetcode_daily" && (
            <div className="p-3 bg-secondary/30 rounded-lg border border-border">
              <p className="text-xs text-muted-foreground">Fetches the daily LeetCode coding challenge automatically.</p>
            </div>
          )}

          {/* LeetCode Submit */}
          {node.type === "leetcode_submit" && (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">LeetCode Session Cookie</label>
                <input
                  type="password"
                  value={cfg.leetcodeSession ?? ""}
                  onChange={e => set("leetcodeSession", e.target.value)}
                  className={inputClass}
                  placeholder="Optional if set in Render environment"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">CSRF Token Cookie</label>
                <input
                  type="password"
                  value={cfg.csrfToken ?? ""}
                  onChange={e => set("csrfToken", e.target.value)}
                  className={inputClass}
                  placeholder="Optional if set in Render environment"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Language Override</label>
                <select
                  value={cfg.language ?? "python3"}
                  onChange={e => set("language", e.target.value)}
                  className={inputClass}
                >
                  <option value="python3">Python</option>
                  <option value="java">Java</option>
                  <option value="cpp">C++</option>
                  <option value="javascript">JavaScript</option>
                  <option value="typescript">TypeScript</option>
                </select>
              </div>
              <div className="p-3 bg-secondary/30 rounded-lg border border-border">
                <p className="text-xs text-muted-foreground">Submits the solution generated by AI Solver directly to LeetCode using cookies.</p>
              </div>
            </>
          )}

          {/* LeetCode Save */}
          {node.type === "leetcode_save" && (
            <div className="p-3 bg-secondary/30 rounded-lg border border-border">
              <p className="text-xs text-muted-foreground">Saves the daily submission status to your database, updating your streak metrics in the Life OS Dashboard.</p>
            </div>
          )}

          {/* AI Solver */}
          {node.type === "ai_solver" && (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Model</label>
                <select value={cfg.model ?? "llama-3.3-70b-versatile"} onChange={e => set("model", e.target.value)} className={inputClass}>
                  {GROQ_MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Language</label>
                <select value={cfg.language ?? "Python"} onChange={e => set("language", e.target.value)} className={inputClass}>
                  <option value="Python">Python</option>
                  <option value="Java">Java</option>
                  <option value="C++">C++</option>
                  <option value="JavaScript">JavaScript</option>
                  <option value="TypeScript">TypeScript</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Temperature</label>
                <div className="flex items-center gap-3">
                  <input type="range" min="0" max="1" step="0.1"
                    value={cfg.temperature ?? 0.2}
                    onChange={e => set("temperature", parseFloat(e.target.value))}
                    className="flex-1 accent-primary"
                  />
                  <span className="text-sm font-mono text-foreground w-8 text-right">{cfg.temperature ?? 0.2}</span>
                </div>
              </div>
            </>
          )}

          {/* Discord Webhook */}
          {node.type === "discord_webhook" && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Webhook URL</label>
              <input type="text" value={cfg.webhookUrl ?? ""} onChange={e => set("webhookUrl", e.target.value)} className={inputClass} placeholder="https://discord.com/api/webhooks/..." />
            </div>
          )}

          {/* Telegram Bot */}
          {node.type === "telegram_bot" && (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Bot Token</label>
                <input type="password" value={cfg.botToken ?? ""} onChange={e => set("botToken", e.target.value)} className={inputClass} placeholder="Optional if set in environment" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Chat ID</label>
                <input type="text" value={cfg.chatId ?? ""} onChange={e => set("chatId", e.target.value)} className={inputClass} placeholder="-1001234567890" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Message Template</label>
                <textarea
                  value={cfg.messageTemplate ?? "{{input}}"}
                  onChange={e => set("messageTemplate", e.target.value)}
                  className={cn(inputClass, "min-h-[100px] font-mono text-xs")}
                  placeholder="Write message template. Support variables: {{input}}"
                />
              </div>
            </>
          )}

          {/* GitHub Node */}
          {node.type === "github" && (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">GitHub Access Token</label>
                <input
                  type="password"
                  value={cfg.githubToken ?? ""}
                  onChange={e => set("githubToken", e.target.value)}
                  className={inputClass}
                  placeholder="Optional if set in environment"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">GitHub Username</label>
                <input
                  type="text"
                  value={cfg.username ?? ""}
                  onChange={e => set("username", e.target.value)}
                  className={inputClass}
                  placeholder="e.g. Aakash-M-z"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Repository (Optional)</label>
                <input
                  type="text"
                  value={cfg.repository ?? ""}
                  onChange={e => set("repository", e.target.value)}
                  className={inputClass}
                  placeholder="e.g. owner/repo or repo"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Max Events</label>
                <input
                  type="number"
                  value={cfg.maxEvents ?? 5}
                  onChange={e => set("maxEvents", parseInt(e.target.value) || 5)}
                  className={inputClass}
                  min={1}
                  max={20}
                />
              </div>
            </>
          )}

          {/* Weather Node */}
          {node.type === "weather" && (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Weather API Key</label>
                <input
                  type="password"
                  value={cfg.apiKey ?? ""}
                  onChange={e => set("apiKey", e.target.value)}
                  className={inputClass}
                  placeholder="Optional if set in environment"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">City</label>
                <input
                  type="text"
                  value={cfg.city ?? ""}
                  onChange={e => set("city", e.target.value)}
                  className={inputClass}
                  placeholder="e.g. Chennai"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Units</label>
                <select
                  value={cfg.units ?? "celsius"}
                  onChange={e => set("units", e.target.value)}
                  className={inputClass}
                >
                  <option value="celsius">Celsius (°C)</option>
                  <option value="fahrenheit">Fahrenheit (°F)</option>
                </select>
              </div>
            </>
          )}

          {/* WhatsApp Monitor */}
          {node.type === WorkflowNodeType.whatsapp_monitor && (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Group Name</label>
                <input
                  type="text"
                  value={cfg.groupName ?? ""}
                  onChange={e => set("groupName", e.target.value)}
                  className={inputClass}
                  placeholder="e.g. Attendance Group"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Max Messages</label>
                <input
                  type="number"
                  min={5}
                  max={100}
                  value={cfg.maxMessages ?? 30}
                  onChange={e => set("maxMessages", parseInt(e.target.value))}
                  className={inputClass}
                />
              </div>
            </>
          )}

          {/* WhatsApp Sender */}
          {node.type === WorkflowNodeType.whatsapp_sender && (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Contact / Mentor Name</label>
                <input
                  type="text"
                  value={cfg.contactName ?? ""}
                  onChange={e => set("contactName", e.target.value)}
                  className={inputClass}
                  placeholder="e.g. Mentor Aakash"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Message Template</label>
                <textarea
                  value={cfg.messageTemplate ?? ""}
                  onChange={e => set("messageTemplate", e.target.value)}
                  rows={4}
                  className={`${inputClass} resize-none font-mono text-xs`}
                  placeholder="Hello, I will be absent because {{input}}"
                />
                <p className="text-xs text-muted-foreground">Use <code className="bg-secondary px-1 rounded">{"{{input}}"}</code> to inject the generated reason.</p>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-secondary/20">
                <div className="space-y-0.5">
                  <label className="text-xs font-semibold text-foreground uppercase tracking-wider">Manual Approval</label>
                  <p className="text-[10px] text-muted-foreground">Require confirmation before sending</p>
                </div>
                <input
                  type="checkbox"
                  checked={cfg.manualApproval ?? false}
                  onChange={e => set("manualApproval", e.target.checked)}
                  className="w-4 h-4 rounded border-border text-emerald-500 focus:ring-emerald-500 focus:ring-opacity-25"
                />
              </div>
            </>
          )}

          {/* Delete Node Section */}
          <div className="pt-2 border-t border-border mt-2">
            <button
              onClick={() => setDeleteConfirmOpen(true)}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold text-rose-400 bg-rose-500/5 hover:bg-rose-500/10 border border-rose-500/25 hover:border-rose-500/40 transition-colors cursor-pointer"
            >
              <Trash2 size={13} />
              Delete Node
            </button>
          </div>

          <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
            <AlertDialogContent className="bg-card border border-border max-w-sm rounded-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-200">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-foreground font-display font-bold text-lg flex items-center gap-2">
                  <Trash2 className="text-rose-500" size={18} />
                  Delete Node
                </AlertDialogTitle>
                <AlertDialogDescription className="text-muted-foreground text-xs leading-relaxed mt-2">
                  Are you sure you want to delete this node? This will also remove any connected input and output edges from the canvas.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="flex sm:flex-row gap-2 mt-4">
                <AlertDialogCancel className="bg-secondary/85 hover:bg-muted border border-border text-foreground hover:text-foreground text-xs font-medium py-1.5 px-3 rounded-xl cursor-pointer">
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    deleteNode(node.id);
                    setDeleteConfirmOpen(false);
                  }}
                  className="bg-rose-600 hover:bg-rose-700 text-white border border-rose-700 hover:border-rose-800 text-xs font-bold py-1.5 px-3 rounded-xl cursor-pointer shadow-lg shadow-rose-950/20"
                >
                  Yes, Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </div>
  );
}
