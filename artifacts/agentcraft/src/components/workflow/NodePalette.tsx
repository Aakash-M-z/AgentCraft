import {
  Bot, Play, Server, ArrowRightFromLine, Repeat, Sparkles, Mail,
  Database, Webhook, FileText, Timer, ChevronDown, ChevronRight,
  CalendarClock, Code2, BrainCircuit, MessageSquare, Send, Github,
  CloudSun, Building2, Search, DollarSign, Store, ShieldAlert,
  FileCheck, ClipboardList
} from 'lucide-react';
import { WorkflowNodeType } from '@workspace/api-client-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

type PaletteNode = {
  type: string;
  label: string;
  icon: React.ElementType;
  description: string;
};

const groups: { label: string; nodes: PaletteNode[] }[] = [
  {
    label: 'Triggers',
    nodes: [
      { type: WorkflowNodeType.input, label: 'Manual Trigger', icon: Play, description: 'Start with user input' },
      { type: 'schedule_trigger', label: 'Schedule', icon: CalendarClock, description: 'Run on a cron schedule' },
      { type: 'webhook', label: 'Webhook', icon: Webhook, description: 'HTTP trigger' },
    ],
  },
  {
    label: 'AI & Logic',
    nodes: [
      { type: WorkflowNodeType.ai_agent, label: 'AI Agent', icon: Bot, description: 'LLM-powered step' },
      { type: 'ai_solver', label: 'AI Solver', icon: BrainCircuit, description: 'Solve LeetCode problems' },
      { type: WorkflowNodeType.condition, label: 'Condition', icon: ArrowRightFromLine, description: 'Branch on condition' },
      { type: WorkflowNodeType.loop, label: 'Loop', icon: Repeat, description: 'Iterate N times' },
      { type: 'delay', label: 'Delay', icon: Timer, description: 'Wait N seconds' },
    ],
  },
  {
    label: 'Integrations',
    nodes: [
      { type: 'leetcode_daily', label: 'LeetCode Daily', icon: Code2, description: 'Fetch daily challenge' },
      { type: 'leetcode_submit', label: 'LeetCode Submit', icon: Code2, description: 'Submit solution' },
      { type: 'leetcode_save', label: 'LeetCode Save', icon: Database, description: 'Save to database' },
      { type: WorkflowNodeType.api_call, label: 'API Request', icon: Server, description: 'HTTP request' },
      { type: WorkflowNodeType.whatsapp_monitor, label: 'WhatsApp Monitor', icon: MessageSquare, description: 'Monitor group messages' },
      { type: WorkflowNodeType.whatsapp_sender, label: 'WhatsApp Send', icon: Send, description: 'Send WhatsApp message' },
      { type: 'discord_webhook', label: 'Discord', icon: MessageSquare, description: 'Send Discord message' },
      { type: 'telegram_bot', label: 'Telegram', icon: Send, description: 'Send Telegram message' },
      { type: 'github', label: 'GitHub', icon: Github, description: 'Fetch PRs, issues, commits' },
      { type: 'weather', label: 'Weather', icon: CloudSun, description: 'Live weather data' },
      { type: 'email', label: 'Send Email', icon: Mail, description: 'SMTP email' },
      { type: 'database', label: 'Database', icon: Database, description: 'Read/write DB' },
      { type: 'file_processor', label: 'File', icon: FileText, description: 'Process files' },
    ],
  },
  {
    label: 'Procurement',
    nodes: [
      { type: 'procurement_ai_analyst', label: 'AI Analyst', icon: Building2, description: 'Extract structured fields' },
      { type: 'procurement_duplicate', label: 'Duplicate Check', icon: Search, description: 'Detect duplicate purchase' },
      { type: 'procurement_budget', label: 'Budget Verify', icon: DollarSign, description: 'Check budget & approval tier' },
      { type: 'procurement_vendor', label: 'Vendor AI', icon: Store, description: 'AI vendor scoring' },
      { type: 'procurement_risk', label: 'Risk Scorer', icon: ShieldAlert, description: 'Composite risk scoring' },
      { type: 'procurement_po', label: 'Generate PO', icon: FileCheck, description: 'Issue Purchase Order' },
      { type: 'procurement_audit', label: 'Audit Logger', icon: ClipboardList, description: 'Write audit trail' },
    ],
  },
  {
    label: 'Output',
    nodes: [
      { type: WorkflowNodeType.output, label: 'Output', icon: Sparkles, description: 'Final result' },
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
    <div className="mb-1">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-1.5 text-[10px] font-semibold text-white/25 uppercase tracking-widest hover:text-white/40 transition-colors duration-150 cursor-pointer"
      >
        {label}
        {open
          ? <ChevronDown size={10} className="shrink-0" />
          : <ChevronRight size={10} className="shrink-0" />
        }
      </button>

      {open && (
        <div className="px-2 pb-1">
          {nodes.map((n) => (
            <div
              key={n.type}
              onDragStart={(e) => onDragStart(e, n.type, n.label)}
              draggable
              title={n.description}
              className={cn(
                'flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-grab active:cursor-grabbing',
                'transition-all duration-100 hover:bg-white/[0.05] group'
              )}
            >
              <n.icon size={13} className="text-white/30 group-hover:text-white/55 transition-colors shrink-0" />
              <div className="min-w-0">
                <p className="text-[12px] font-medium text-white/55 group-hover:text-white/80 transition-colors leading-none truncate">{n.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function NodePalette() {
  const [search, setSearch] = useState('');

  const filteredGroups = search.trim()
    ? groups.map(g => ({
        ...g,
        nodes: g.nodes.filter(n =>
          n.label.toLowerCase().includes(search.toLowerCase()) ||
          n.description.toLowerCase().includes(search.toLowerCase())
        )
      })).filter(g => g.nodes.length > 0)
    : groups;

  return (
    <div className="w-[200px] bg-[#111113] border-r border-white/[0.06] h-full flex flex-col z-10 shrink-0">
      {/* Header */}
      <div className="px-3 pt-4 pb-3 shrink-0">
        <p className="text-[11px] font-semibold text-white/50 mb-2.5">Node Library</p>
        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search nodes..."
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-md px-2.5 py-1.5 text-[11px] text-white/60 placeholder:text-white/20 focus:outline-none focus:border-white/20 focus:bg-white/[0.06] transition-all"
          />
        </div>
      </div>

      {/* Drag hint */}
      <p className="text-[9px] text-white/20 px-3 pb-2 shrink-0">Drag onto canvas to add</p>

      {/* Node groups */}
      <div className="flex-1 overflow-y-auto py-1 scrollbar-none">
        {filteredGroups.map((g) => (
          <PaletteGroup key={g.label} label={g.label} nodes={g.nodes} />
        ))}
      </div>
    </div>
  );
}
