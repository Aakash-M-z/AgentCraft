import { Handle, Position } from '@xyflow/react';
import {
  Bot, Play, Server, ArrowRightFromLine, Repeat, Sparkles, Mail,
  CheckCircle2, XCircle, Loader2, Clock, Database, Webhook, FileText,
  Timer, CalendarClock, Code2, BrainCircuit, MessageSquare, Send,
  Github, CloudSun, Building2, Search, DollarSign, Store, ShieldAlert,
  FileCheck, ClipboardList
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AppNodeData, NodeExecutionStatus, useWorkflowStore } from '@/lib/store';
import { motion, AnimatePresence } from 'framer-motion';

// ── Node type metadata ────────────────────────────────────────────────────────

export const nodeConfig = {
  input: { icon: Play, label: 'Trigger', accent: '#34d399', hasSource: true, hasTarget: false },
  ai_agent: { icon: Bot, label: 'AI Agent', accent: '#a78bfa', hasSource: true, hasTarget: true },
  api_call: { icon: Server, label: 'API Call', accent: '#60a5fa', hasSource: true, hasTarget: true },
  condition: { icon: ArrowRightFromLine, label: 'Condition', accent: '#fbbf24', hasSource: true, hasTarget: true },
  loop: { icon: Repeat, label: 'Loop', accent: '#f472b6', hasSource: true, hasTarget: true },
  output: { icon: Sparkles, label: 'Output', accent: '#fb7185', hasSource: false, hasTarget: true },
  email: { icon: Mail, label: 'Email', accent: '#38bdf8', hasSource: true, hasTarget: true },
  database: { icon: Database, label: 'Database', accent: '#2dd4bf', hasSource: true, hasTarget: true },
  webhook: { icon: Webhook, label: 'Webhook', accent: '#fb923c', hasSource: true, hasTarget: false },
  file_processor: { icon: FileText, label: 'File', accent: '#818cf8', hasSource: true, hasTarget: true },
  delay: { icon: Timer, label: 'Delay', accent: '#facc15', hasSource: true, hasTarget: true },
  schedule_trigger: { icon: CalendarClock, label: 'Schedule', accent: '#34d399', hasSource: true, hasTarget: false },
  leetcode_daily: { icon: Code2, label: 'LeetCode', accent: '#fbbf24', hasSource: true, hasTarget: true },
  leetcode_submit: { icon: Code2, label: 'LeetCode Submit', accent: '#fbbf24', hasSource: true, hasTarget: true },
  leetcode_save: { icon: Database, label: 'LeetCode Save', accent: '#2dd4bf', hasSource: true, hasTarget: true },
  ai_solver: { icon: BrainCircuit, label: 'AI Solver', accent: '#a78bfa', hasSource: true, hasTarget: true },
  discord_webhook: { icon: MessageSquare, label: 'Discord', accent: '#818cf8', hasSource: true, hasTarget: true },
  telegram_bot: { icon: Send, label: 'Telegram', accent: '#38bdf8', hasSource: true, hasTarget: true },
  github: { icon: Github, label: 'GitHub', accent: '#9ca3af', hasSource: true, hasTarget: true },
  weather: { icon: CloudSun, label: 'Weather', accent: '#38bdf8', hasSource: true, hasTarget: true },
  procurement_ai_analyst: { icon: Building2, label: 'AI Analyst', accent: '#60a5fa', hasSource: true, hasTarget: true },
  procurement_duplicate: { icon: Search, label: 'Duplicate Check', accent: '#fb923c', hasSource: true, hasTarget: true },
  procurement_budget: { icon: DollarSign, label: 'Budget Verify', accent: '#34d399', hasSource: true, hasTarget: true },
  procurement_vendor: { icon: Store, label: 'Vendor AI', accent: '#a78bfa', hasSource: true, hasTarget: true },
  procurement_risk: { icon: ShieldAlert, label: 'Risk Scorer', accent: '#fb7185', hasSource: true, hasTarget: true },
  procurement_po: { icon: FileCheck, label: 'Generate PO', accent: '#fbbf24', hasSource: true, hasTarget: true },
  procurement_audit: { icon: ClipboardList, label: 'Audit Logger', accent: '#2dd4bf', hasSource: true, hasTarget: true },
  whatsapp_monitor: { icon: MessageSquare, label: 'WhatsApp Monitor', accent: '#34d399', hasSource: true, hasTarget: true },
  whatsapp_sender: { icon: Send, label: 'WhatsApp Send', accent: '#34d399', hasSource: true, hasTarget: true },
} as const;

// ── Status overlay styles ─────────────────────────────────────────────────────

const statusRing: Record<NodeExecutionStatus, string> = {
  idle: '',
  running: 'ring-1 ring-blue-500/60',
  success: 'ring-1 ring-emerald-500/60',
  failed: 'ring-1 ring-rose-500/60',
  waiting_approval: 'ring-1 ring-amber-500/60 animate-pulse',
};

// ── Status badge ──────────────────────────────────────────────────────────────

const StatusBadge = ({ status }: { status: NodeExecutionStatus }) => {
  if (status === 'idle') return null;
  return (
    <AnimatePresence>
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="absolute -top-1.5 -right-1.5 z-10"
      >
        {status === 'running' && (
          <div className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center shadow-lg shadow-blue-500/40">
            <Loader2 size={9} className="text-white animate-spin" />
          </div>
        )}
        {status === 'success' && (
          <div className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
            <CheckCircle2 size={9} className="text-white" />
          </div>
        )}
        {status === 'failed' && (
          <div className="w-4 h-4 rounded-full bg-rose-500 flex items-center justify-center shadow-lg shadow-rose-500/30">
            <XCircle size={9} className="text-white" />
          </div>
        )}
        {status === 'waiting_approval' && (
          <div className="w-4 h-4 rounded-full bg-amber-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
            <Clock size={9} className="text-white" />
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};

// ── Handle style ──────────────────────────────────────────────────────────────

const handleStyle = {
  width: 10,
  height: 10,
  background: '#1a1a1e',
  border: '1.5px solid rgba(255,255,255,0.15)',
  transition: 'all 0.15s ease',
};

// ── Base node component ───────────────────────────────────────────────────────

export function BaseCustomNode({ data, type, selected, id }: {
  data: AppNodeData & { isDeleting?: boolean };
  type: keyof typeof nodeConfig;
  selected?: boolean;
  id: string;
}) {
  const config = nodeConfig[type] ?? nodeConfig.ai_agent;
  const Icon = config.icon;
  const accent = config.accent;
  const execStatus = useWorkflowStore((s) => s.nodeExecutionStatus[id] ?? 'idle');
  const debugInfo = useWorkflowStore((s) => s.nodeDebugInfo[id]);
  const isDeleting = !!data.isDeleting;
  const isAI = type === 'ai_agent' || type === 'ai_solver';
  const isCompleted = execStatus === 'success';

  const modelValue = data.config?.model || 'llama-3.3-70b-versatile';
  const modelName = modelValue.split('/').pop()?.replace(/-scout|-instant|-versatile|-instruct/g, '').replace(/-/g, ' ') || 'Llama 3.3';

  return (
    <motion.div
      initial={{ scale: 0.92, opacity: 0 }}
      animate={
        isDeleting
          ? { scale: 0.2, opacity: 0, y: 10 }
          : { scale: 1, opacity: 1, y: 0 }
      }
      transition={
        isDeleting
          ? { duration: 0.18, ease: 'easeInOut' }
          : { type: 'spring', stiffness: 400, damping: 26 }
      }
      className={cn(
        // Base node card
        'relative group rounded-xl border bg-[#16161a] transition-all duration-200 cursor-pointer',
        'min-w-[200px] max-w-[240px]',
        // Border — default subtle, selected: accent-colored
        selected
          ? 'border-white/20 shadow-[0_0_0_1px_rgba(255,255,255,0.08)]'
          : 'border-white/[0.08] hover:border-white/[0.14]',
        // Execution status ring
        statusRing[execStatus]
      )}
      style={selected ? { boxShadow: `0 0 0 1px ${accent}40, 0 8px 32px rgba(0,0,0,0.4)` } : undefined}
    >
      <StatusBadge status={execStatus} />

      {/* Accent bar on left edge */}
      <div
        className="absolute left-0 top-3 bottom-3 w-0.5 rounded-full opacity-60"
        style={{ backgroundColor: accent }}
      />

      {/* Running shimmer */}
      {execStatus === 'running' && (
        <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.02] to-transparent animate-pulse" />
        </div>
      )}

      {/* Target handle */}
      {config.hasTarget && (
        <Handle
          type="target"
          position={Position.Left}
          style={handleStyle}
          className="!transition-all hover:!border-white/40 hover:!scale-125"
        />
      )}

      {/* Content */}
      <div className="px-3.5 py-3 pl-4">

        {/* Header row */}
        <div className="flex items-start gap-2.5 mb-0.5">
          <div
            className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 mt-0.5"
            style={{ backgroundColor: `${accent}18`, color: accent }}
          >
            <Icon size={13} className={execStatus === 'running' ? 'animate-pulse' : ''} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[12.5px] font-semibold text-white/85 leading-tight truncate">{data.label}</p>
            <p className="text-[10px] text-white/30 leading-none mt-0.5 font-medium uppercase tracking-wide">{config.label}</p>
          </div>
        </div>

        {/* AI node detail */}
        {isAI && (
          <div className="mt-2.5 space-y-1.5">
            {/* Model badge */}
            <div className="flex items-center gap-1.5">
              <span className="text-[9.5px] font-mono text-white/25 bg-white/[0.04] border border-white/[0.06] px-1.5 py-0.5 rounded capitalize">
                {modelName}
              </span>
              {execStatus === 'running' && (
                <span className="text-[9px] font-mono text-blue-400/70 flex items-center gap-1 animate-pulse">
                  <Loader2 size={8} className="animate-spin" />
                  Thinking...
                </span>
              )}
            </div>

            {/* Instruction preview */}
            {data.config?.instruction && (
              <p className="text-[10px] text-white/30 line-clamp-2 leading-relaxed font-mono bg-white/[0.02] rounded px-2 py-1.5">
                {data.config.instruction}
              </p>
            )}

            {/* Completion metrics */}
            {isCompleted && (
              <div className="flex items-center justify-between pt-1.5 border-t border-white/[0.05] text-[9px] font-mono text-white/25">
                <span>
                  {Math.max(84, (data.config?.instruction?.length || 0) * 2 + 42) + Math.max(148, (debugInfo?.output?.length || 0) * 3 + 64)} tokens
                </span>
                <span>
                  {debugInfo?.executionTime !== undefined ? `${(debugInfo.executionTime / 1000).toFixed(2)}s` : '—'}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Non-AI node execution output */}
        {!isAI && debugInfo && execStatus !== 'idle' && (
          <div className={cn(
            'mt-2 text-[10px] font-mono truncate pt-1.5 border-t border-white/[0.05]',
            execStatus === 'success' ? 'text-emerald-400/60' :
              execStatus === 'failed' ? 'text-rose-400/60' :
                'text-white/25'
          )}>
            {execStatus === 'failed' && debugInfo.error
              ? `✗ ${debugInfo.error.slice(0, 36)}`
              : debugInfo.output
                ? `→ ${debugInfo.output.slice(0, 36)}${debugInfo.output.length > 36 ? '…' : ''}`
                : execStatus === 'running'
                  ? (
                    <span className="flex items-center gap-1 text-blue-400/60 animate-pulse">
                      <Loader2 size={9} className="animate-spin" /> Running...
                    </span>
                  )
                  : null}
          </div>
        )}
      </div>

      {/* Source handle */}
      {config.hasSource && (
        <Handle
          type="source"
          position={Position.Right}
          style={handleStyle}
          className="!transition-all hover:!border-white/40 hover:!scale-125"
        />
      )}
    </motion.div>
  );
}

// ── Node type registry ────────────────────────────────────────────────────────

export const nodeTypes = {
  input: (props: any) => <BaseCustomNode {...props} type="input" />,
  ai_agent: (props: any) => <BaseCustomNode {...props} type="ai_agent" />,
  api_call: (props: any) => <BaseCustomNode {...props} type="api_call" />,
  condition: (props: any) => <BaseCustomNode {...props} type="condition" />,
  loop: (props: any) => <BaseCustomNode {...props} type="loop" />,
  output: (props: any) => <BaseCustomNode {...props} type="output" />,
  email: (props: any) => <BaseCustomNode {...props} type="email" />,
  database: (props: any) => <BaseCustomNode {...props} type="database" />,
  webhook: (props: any) => <BaseCustomNode {...props} type="webhook" />,
  file_processor: (props: any) => <BaseCustomNode {...props} type="file_processor" />,
  delay: (props: any) => <BaseCustomNode {...props} type="delay" />,
  schedule_trigger: (props: any) => <BaseCustomNode {...props} type="schedule_trigger" />,
  leetcode_daily: (props: any) => <BaseCustomNode {...props} type="leetcode_daily" />,
  leetcode_submit: (props: any) => <BaseCustomNode {...props} type="leetcode_submit" />,
  leetcode_save: (props: any) => <BaseCustomNode {...props} type="leetcode_save" />,
  ai_solver: (props: any) => <BaseCustomNode {...props} type="ai_solver" />,
  discord_webhook: (props: any) => <BaseCustomNode {...props} type="discord_webhook" />,
  telegram_bot: (props: any) => <BaseCustomNode {...props} type="telegram_bot" />,
  github: (props: any) => <BaseCustomNode {...props} type="github" />,
  weather: (props: any) => <BaseCustomNode {...props} type="weather" />,
  whatsapp_monitor: (props: any) => <BaseCustomNode {...props} type="whatsapp_monitor" />,
  whatsapp_sender: (props: any) => <BaseCustomNode {...props} type="whatsapp_sender" />,
  procurement_ai_analyst: (props: any) => <BaseCustomNode {...props} type="procurement_ai_analyst" />,
  procurement_duplicate: (props: any) => <BaseCustomNode {...props} type="procurement_duplicate" />,
  procurement_budget: (props: any) => <BaseCustomNode {...props} type="procurement_budget" />,
  procurement_vendor: (props: any) => <BaseCustomNode {...props} type="procurement_vendor" />,
  procurement_risk: (props: any) => <BaseCustomNode {...props} type="procurement_risk" />,
  procurement_po: (props: any) => <BaseCustomNode {...props} type="procurement_po" />,
  procurement_audit: (props: any) => <BaseCustomNode {...props} type="procurement_audit" />,
};
