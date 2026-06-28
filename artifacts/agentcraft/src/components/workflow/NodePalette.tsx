import { Bot, Play, Server, ArrowRightFromLine, Repeat, Sparkles, Mail, Database, Webhook, FileText, Timer, ChevronDown, ChevronRight, CalendarClock, Code2, BrainCircuit, MessageSquare, Send, Github, CloudSun, Building2, Search, DollarSign, Store, ShieldAlert, FileCheck, ClipboardList } from 'lucide-react';
import { WorkflowNodeType } from '@workspace/api-client-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

type PaletteNode = {
  type: string;
  label: string;
  icon: React.ElementType;
  color: string;
  border: string;
  description: string;
};

const groups: { label: string; nodes: PaletteNode[] }[] = [
  {
    label: 'Triggers',
    nodes: [
      { type: WorkflowNodeType.input, label: 'Manual Trigger', icon: Play, color: 'text-emerald-400', border: 'border-emerald-500/30', description: 'Start with user input' },
      { type: 'schedule_trigger', label: 'Schedule', icon: CalendarClock, color: 'text-emerald-400', border: 'border-emerald-500/30', description: 'Run on a cron schedule' },
      { type: 'webhook', label: 'Webhook', icon: Webhook, color: 'text-orange-400', border: 'border-orange-500/30', description: 'HTTP trigger' },
    ],
  },
  {
    label: 'AI & Logic',
    nodes: [
      { type: WorkflowNodeType.ai_agent, label: 'AI Agent', icon: Bot, color: 'text-violet-400', border: 'border-violet-500/30', description: 'LLM-powered step' },
      { type: 'ai_solver', label: 'AI Solver', icon: BrainCircuit, color: 'text-violet-400', border: 'border-violet-500/30', description: 'Solve LeetCode problems' },
      { type: WorkflowNodeType.condition, label: 'Condition', icon: ArrowRightFromLine, color: 'text-amber-400', border: 'border-amber-500/30', description: 'Branch on condition' },
      { type: WorkflowNodeType.loop, label: 'Loop', icon: Repeat, color: 'text-pink-400', border: 'border-pink-500/30', description: 'Iterate N times' },
      { type: 'delay', label: 'Delay', icon: Timer, color: 'text-yellow-400', border: 'border-yellow-500/30', description: 'Wait N seconds' },
    ],
  },
  {
    label: 'Integrations',
    nodes: [
      { type: 'leetcode_daily', label: 'LeetCode Daily', icon: Code2, color: 'text-amber-400', border: 'border-amber-500/30', description: 'Fetch daily challenge' },
      { type: 'leetcode_submit', label: 'LeetCode Submit', icon: Code2, color: 'text-amber-400', border: 'border-amber-500/30', description: 'Submit solution using cookies' },
      { type: 'leetcode_save', label: 'LeetCode Save', icon: Database, color: 'text-teal-400', border: 'border-teal-500/30', description: 'Save submission status to database' },
      { type: WorkflowNodeType.api_call, label: 'API Request', icon: Server, color: 'text-blue-400', border: 'border-blue-500/30', description: 'HTTP request' },
      { type: WorkflowNodeType.whatsapp_monitor, label: 'WhatsApp Monitor', icon: MessageSquare, color: 'text-emerald-400', border: 'border-emerald-500/30', description: 'Monitor WhatsApp Web group messages' },
      { type: WorkflowNodeType.whatsapp_sender, label: 'Send WhatsApp Message', icon: Send, color: 'text-emerald-400', border: 'border-emerald-500/30', description: 'Send automated or approved WhatsApp message' },
      { type: 'discord_webhook', label: 'Discord', icon: MessageSquare, color: 'text-indigo-400', border: 'border-indigo-500/30', description: 'Send Discord message' },
      { type: 'telegram_bot', label: 'Telegram', icon: Send, color: 'text-sky-400', border: 'border-sky-500/30', description: 'Send Telegram message' },
      { type: 'github', label: 'GitHub', icon: Github, color: 'text-zinc-300', border: 'border-zinc-500/30', description: 'Fetch pull requests, issues, and commits' },
      { type: 'weather', label: 'Weather', icon: CloudSun, color: 'text-sky-400', border: 'border-sky-500/30', description: 'Fetch live weather conditions and temperature' },
      { type: 'email', label: 'Send Email', icon: Mail, color: 'text-sky-400', border: 'border-sky-500/30', description: 'SMTP email' },
      { type: 'database', label: 'Database', icon: Database, color: 'text-teal-400', border: 'border-teal-500/30', description: 'Read/write DB' },
      { type: 'file_processor', label: 'File', icon: FileText, color: 'text-indigo-400', border: 'border-indigo-500/30', description: 'Process files' },
    ],
  },
  {
    label: 'Enterprise Procurement',
    nodes: [
      { type: 'procurement_ai_analyst', label: 'AI Analyst', icon: Building2, color: 'text-blue-400', border: 'border-blue-500/30', description: 'AI extracts structured fields from purchase request' },
      { type: 'procurement_duplicate', label: 'Duplicate Check', icon: Search, color: 'text-orange-400', border: 'border-orange-500/30', description: 'Detect duplicate purchase in history' },
      { type: 'procurement_budget', label: 'Budget Verify', icon: DollarSign, color: 'text-emerald-400', border: 'border-emerald-500/30', description: 'Check department budget & approval tier' },
      { type: 'procurement_vendor', label: 'Vendor AI', icon: Store, color: 'text-violet-400', border: 'border-violet-500/30', description: 'AI vendor scoring & recommendation' },
      { type: 'procurement_risk', label: 'Risk Scorer', icon: ShieldAlert, color: 'text-rose-400', border: 'border-rose-500/30', description: 'Composite AI risk scoring 0-100' },
      { type: 'procurement_po', label: 'Generate PO', icon: FileCheck, color: 'text-amber-400', border: 'border-amber-500/30', description: 'Issue formal Purchase Order document' },
      { type: 'procurement_audit', label: 'Audit Logger', icon: ClipboardList, color: 'text-teal-400', border: 'border-teal-500/30', description: 'Write immutable audit trail entry' },
    ],
  },
  {
    label: 'Output',
    nodes: [
      { type: WorkflowNodeType.output, label: 'Output', icon: Sparkles, color: 'text-rose-400', border: 'border-rose-500/30', description: 'Final result' },
    ],
  },
];

function PaletteGroup({ label, nodes }: { label: string; nodes: PaletteNode[] }) {
  const [open, setOpen] = useState(true);

  const onDragStart = (event: React.DragEvent, nodeType: string, nodeLabel: string) => {
    event.dataTransfer.setData('application/reactflow', JSON.stringify({ type: nodeType, label: nodeLabel }));
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
      >
        {label}
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      </button>
      {open && (
        <div className="px-3 pb-2 flex flex-col gap-1.5">
          {nodes.map((n) => (
            <div
              key={n.type}
              onDragStart={(e) => onDragStart(e, n.type, n.label)}
              draggable
              title={n.description}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl border bg-background cursor-grab active:cursor-grabbing',
                'transition-all duration-150 hover:-translate-y-px hover:shadow-lg hover:bg-secondary/80',
                n.border,
              )}
            >
              <div className={cn('p-1.5 rounded-lg bg-card/50', n.color)}>
                <n.icon size={15} />
              </div>
              <div className="min-w-0">
                <p className="font-medium text-sm text-foreground leading-none">{n.label}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{n.description}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function NodePalette() {
  return (
    <div className="w-60 bg-card border-r border-border h-full flex flex-col z-10 shadow-xl">
      <div className="p-4 border-b border-border bg-secondary/30 shrink-0">
        <h2 className="font-display font-bold text-base text-foreground">Nodes</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Drag onto canvas</p>
      </div>
      <div className="flex-1 overflow-y-auto py-2">
        {groups.map((g) => (
          <PaletteGroup key={g.label} label={g.label} nodes={g.nodes} />
        ))}
      </div>
    </div>
  );
}
