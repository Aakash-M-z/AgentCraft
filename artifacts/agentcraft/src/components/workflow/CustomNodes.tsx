import { Handle, Position } from '@xyflow/react';
import { Bot, Play, Server, ArrowRightFromLine, Repeat, Sparkles, Mail, CheckCircle2, XCircle, Loader2, Clock, Database, Webhook, FileText, Timer, CalendarClock, Code2, BrainCircuit, MessageSquare, Send, Github, CloudSun } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AppNodeData, NodeExecutionStatus, useWorkflowStore } from '@/lib/store';
import { motion, AnimatePresence } from 'framer-motion';

export const nodeConfig = {
  input: {
    icon: Play,
    label: 'Trigger',
    color: 'text-emerald-400',
    bg: 'bg-emerald-400/10',
    border: 'border-emerald-500/50',
    glow: 'shadow-[0_0_20px_rgba(52,211,153,0.2)]',
    hasSource: true,
    hasTarget: false,
  },
  ai_agent: {
    icon: Bot,
    label: 'AI Agent',
    color: 'text-violet-400',
    bg: 'bg-violet-400/10',
    border: 'border-violet-500/50',
    glow: 'shadow-[0_0_20px_rgba(139,92,246,0.25)]',
    hasSource: true,
    hasTarget: true,
  },
  api_call: {
    icon: Server,
    label: 'API Call',
    color: 'text-blue-400',
    bg: 'bg-blue-400/10',
    border: 'border-blue-500/50',
    glow: 'shadow-[0_0_20px_rgba(96,165,250,0.2)]',
    hasSource: true,
    hasTarget: true,
  },
  condition: {
    icon: ArrowRightFromLine,
    label: 'Condition',
    color: 'text-amber-400',
    bg: 'bg-amber-400/10',
    border: 'border-amber-500/50',
    glow: 'shadow-[0_0_20px_rgba(251,191,36,0.2)]',
    hasSource: true,
    hasTarget: true,
  },
  loop: {
    icon: Repeat,
    label: 'Loop',
    color: 'text-pink-400',
    bg: 'bg-pink-400/10',
    border: 'border-pink-500/50',
    glow: 'shadow-[0_0_20px_rgba(244,114,182,0.2)]',
    hasSource: true,
    hasTarget: true,
  },
  output: {
    icon: Sparkles,
    label: 'Output',
    color: 'text-rose-400',
    bg: 'bg-rose-400/10',
    border: 'border-rose-500/50',
    glow: 'shadow-[0_0_20px_rgba(244,63,94,0.2)]',
    hasSource: false,
    hasTarget: true,
  },
  email: {
    icon: Mail,
    label: 'Email',
    color: 'text-sky-400',
    bg: 'bg-sky-400/10',
    border: 'border-sky-500/50',
    glow: 'shadow-[0_0_20px_rgba(56,189,248,0.2)]',
    hasSource: true,
    hasTarget: true,
  },
  database: {
    icon: Database,
    label: 'Database',
    color: 'text-teal-400',
    bg: 'bg-teal-400/10',
    border: 'border-teal-500/50',
    glow: 'shadow-[0_0_20px_rgba(45,212,191,0.2)]',
    hasSource: true,
    hasTarget: true,
  },
  webhook: {
    icon: Webhook,
    label: 'Webhook',
    color: 'text-orange-400',
    bg: 'bg-orange-400/10',
    border: 'border-orange-500/50',
    glow: 'shadow-[0_0_20px_rgba(251,146,60,0.2)]',
    hasSource: true,
    hasTarget: false,
  },
  file_processor: {
    icon: FileText,
    label: 'File',
    color: 'text-indigo-400',
    bg: 'bg-indigo-400/10',
    border: 'border-indigo-500/50',
    glow: 'shadow-[0_0_20px_rgba(129,140,248,0.2)]',
    hasSource: true,
    hasTarget: true,
  },
  delay: {
    icon: Timer,
    label: 'Delay',
    color: 'text-yellow-400',
    bg: 'bg-yellow-400/10',
    border: 'border-yellow-500/50',
    glow: 'shadow-[0_0_20px_rgba(250,204,21,0.2)]',
    hasSource: true,
    hasTarget: true,
  },
  schedule_trigger: {
    icon: CalendarClock,
    label: 'Schedule',
    color: 'text-emerald-400',
    bg: 'bg-emerald-400/10',
    border: 'border-emerald-500/50',
    glow: 'shadow-[0_0_20px_rgba(52,211,153,0.2)]',
    hasSource: true,
    hasTarget: false,
  },
  leetcode_daily: {
    icon: Code2,
    label: 'LeetCode',
    color: 'text-amber-400',
    bg: 'bg-amber-400/10',
    border: 'border-amber-500/50',
    glow: 'shadow-[0_0_20px_rgba(251,191,36,0.2)]',
    hasSource: true,
    hasTarget: true,
  },
  leetcode_submit: {
    icon: Code2,
    label: 'LeetCode Submit',
    color: 'text-amber-400',
    bg: 'bg-amber-400/10',
    border: 'border-amber-500/50',
    glow: 'shadow-[0_0_20px_rgba(251,191,36,0.2)]',
    hasSource: true,
    hasTarget: true,
  },
  leetcode_save: {
    icon: Database,
    label: 'LeetCode Save',
    color: 'text-teal-400',
    bg: 'bg-teal-400/10',
    border: 'border-teal-500/50',
    glow: 'shadow-[0_0_20px_rgba(20,184,166,0.2)]',
    hasSource: true,
    hasTarget: true,
  },
  ai_solver: {
    icon: BrainCircuit,
    label: 'AI Solver',
    color: 'text-violet-400',
    bg: 'bg-violet-400/10',
    border: 'border-violet-500/50',
    glow: 'shadow-[0_0_20px_rgba(139,92,246,0.25)]',
    hasSource: true,
    hasTarget: true,
  },
  discord_webhook: {
    icon: MessageSquare,
    label: 'Discord',
    color: 'text-indigo-400',
    bg: 'bg-indigo-400/10',
    border: 'border-indigo-500/50',
    glow: 'shadow-[0_0_20px_rgba(99,102,241,0.2)]',
    hasSource: true,
    hasTarget: true,
  },
  telegram_bot: {
    icon: Send,
    label: 'Telegram',
    color: 'text-sky-400',
    bg: 'bg-sky-400/10',
    border: 'border-sky-500/50',
    glow: 'shadow-[0_0_20px_rgba(56,189,248,0.2)]',
    hasSource: true,
    hasTarget: true,
  },
  github: {
    icon: Github,
    label: 'GitHub',
    color: 'text-zinc-300',
    bg: 'bg-zinc-400/10',
    border: 'border-zinc-500/50',
    glow: 'shadow-[0_0_20px_rgba(113,113,122,0.25)]',
    hasSource: true,
    hasTarget: true,
  },
  weather: {
    icon: CloudSun,
    label: 'Weather',
    color: 'text-sky-400',
    bg: 'bg-sky-400/10',
    border: 'border-sky-500/50',
    glow: 'shadow-[0_0_20px_rgba(56,189,248,0.25)]',
    hasSource: true,
    hasTarget: true,
  },
  whatsapp_monitor: {
    icon: MessageSquare,
    label: 'WhatsApp Monitor',
    color: 'text-emerald-400',
    bg: 'bg-emerald-400/10',
    border: 'border-emerald-500/50',
    glow: 'shadow-[0_0_20px_rgba(16,185,129,0.25)]',
    hasSource: true,
    hasTarget: true,
  },
  whatsapp_sender: {
    icon: Send,
    label: 'WhatsApp Sender',
    color: 'text-emerald-400',
    bg: 'bg-emerald-400/10',
    border: 'border-emerald-500/50',
    glow: 'shadow-[0_0_20px_rgba(16,185,129,0.25)]',
    hasSource: true,
    hasTarget: true,
  },
} as const;

const statusStyles: Record<NodeExecutionStatus, string> = {
  idle: '',
  running: 'ring-2 ring-blue-500 shadow-[0_0_30px_rgba(59,130,246,0.5)]',
  success: 'ring-2 ring-emerald-500 shadow-[0_0_25px_rgba(16,185,129,0.4)]',
  failed: 'ring-2 ring-rose-500 shadow-[0_0_25px_rgba(244,63,94,0.4)]',
  waiting_approval: 'ring-2 ring-amber-500 shadow-[0_0_25px_rgba(245,158,11,0.5)] animate-pulse',
};

const StatusBadge = ({ status }: { status: NodeExecutionStatus }) => {
  if (status === 'idle') return null;
  return (
    <AnimatePresence>
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="absolute -top-2 -right-2 z-10"
      >
        {status === 'running' && (
          <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center shadow-lg shadow-blue-500/50">
            <Loader2 size={11} className="text-white animate-spin" />
          </div>
        )}
        {status === 'success' && (
          <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/50">
            <CheckCircle2 size={11} className="text-white" />
          </div>
        )}
        {status === 'failed' && (
          <div className="w-5 h-5 rounded-full bg-rose-500 flex items-center justify-center shadow-lg shadow-rose-500/50">
            <XCircle size={11} className="text-white" />
          </div>
        )}
        {status === 'waiting_approval' && (
          <div className="w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center shadow-lg shadow-amber-500/50">
            <Clock size={11} className="text-white" />
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};

const handleStyle = {
  width: 14,
  height: 14,
  background: 'hsl(240 10% 6%)',
  border: '2px solid hsl(240 5% 35%)',
  transition: 'all 0.15s ease',
};

export function BaseCustomNode({ data, type, selected, id }: {
  data: AppNodeData & { isDeleting?: boolean };
  type: keyof typeof nodeConfig;
  selected?: boolean;
  id: string;
}) {
  const config = nodeConfig[type] ?? nodeConfig.ai_agent;
  const Icon = config.icon;
  const execStatus = useWorkflowStore((s) => s.nodeExecutionStatus[id] ?? 'idle');
  const debugInfo = useWorkflowStore((s) => s.nodeDebugInfo[id]);

  // Determine state-specific glow styles
  const isAI = type === 'ai_agent' || type === 'ai_solver';
  
  let nodeGlowClass = 'border-border/60 hover:border-muted-foreground/30 shadow-xl';
  if (selected) {
    if (type === 'input' || type === 'schedule_trigger') nodeGlowClass = 'glow-emerald border-emerald-500/50';
    else if (isAI) nodeGlowClass = 'glow-purple border-violet-500/50';
    else if (type === 'api_call' || type === 'telegram_bot' || type === 'discord_webhook' || type === 'weather') nodeGlowClass = 'glow-cyan border-blue-500/50';
    else if (type === 'github') nodeGlowClass = 'border-zinc-500/70 shadow-[0_0_20px_rgba(113,113,122,0.3)] bg-zinc-950/20';
    else if (type === 'condition' || type === 'delay') nodeGlowClass = 'glow-amber border-amber-500/50';
    else if (type === 'output') nodeGlowClass = 'glow-rose border-rose-500/50';
    else nodeGlowClass = 'glow-purple border-primary/50';
  }

  // Format AI Node Specific Data
  const modelValue = data.config?.model || 'llama-3.3-70b-versatile';
  const modelName = modelValue.split('/').pop()?.replace(/-scout|-instant|-versatile|-instruct/g, '').toUpperCase() || 'LLAMA 3.3';
  const provider = modelValue.includes('gpt') || modelValue.includes('openai') ? 'OpenAI Engine' : 'Groq Compute';
  
  // Calculate simulated realistic tokens for premium look
  const isCompleted = execStatus === 'success';
  const promptTokens = Math.max(84, (data.config?.instruction?.length || 0) * 2 + 42);
  const completionTokens = Math.max(148, (debugInfo?.output?.length || 0) * 3 + 64);
  const totalTokens = promptTokens + completionTokens;

  const isDeleting = !!data.isDeleting;

  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={isDeleting ? { scale: 0.3, opacity: 0, rotate: 12, y: 15 } : { scale: 1, opacity: 1, rotate: 0, y: 0 }}
      transition={isDeleting ? { duration: 0.22, ease: "easeInOut" } : { type: 'spring', stiffness: 350, damping: 22 }}
      className={cn(
        'relative group rounded-2xl glass-card p-4 min-w-[260px] border transition-all duration-300 cursor-pointer overflow-hidden shadow-2xl',
        nodeGlowClass,
        statusStyles[execStatus]
      )}
    >
      <StatusBadge status={execStatus} />

      {/* AI Processing Sparkle Ambient Shimmer */}
      {execStatus === 'running' && isAI && (
        <div className="absolute inset-0 bg-gradient-to-r from-violet-500/5 via-cyan-500/5 to-purple-500/5 animate-pulse pointer-events-none" />
      )}

      {/* Active Running Pulse Ring */}
      {execStatus === 'running' && (
        <div className="absolute inset-0 rounded-2xl ring-2 ring-blue-500/20 animate-pulse pointer-events-none" />
      )}

      {config.hasTarget && (
        <Handle
          type="target"
          position={Position.Left}
          style={handleStyle}
          className="!w-3 !h-3 !bg-[#050507] !border-2 !border-zinc-600 hover:!border-primary hover:!bg-primary/20 hover:!scale-110 !transition-all"
        />
      )}

      {/* Node Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={cn(
            'p-2 rounded-xl transition-all duration-300 relative overflow-hidden flex items-center justify-center shrink-0 shadow-lg border border-white/5',
            config.bg, config.color,
            execStatus === 'running' && 'animate-pulse'
          )}>
            <Icon size={16} className={cn(execStatus === 'running' && 'animate-spin-slow')} />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-bold text-sm text-foreground/90 tracking-tight truncate leading-snug">{data.label}</span>
            <span className="text-[10px] text-muted-foreground/80 font-medium tracking-wide uppercase mt-0.5">{config.label}</span>
          </div>
        </div>
      </div>

      {/* Advanced AI Nodes Special Detail Badge (Model Badge & Prompts) */}
      {isAI && (
        <div className="mt-3.5 space-y-2">
          {/* Model Capsule & Provider Info */}
          <div className="flex items-center justify-between gap-2.5">
            <span className="px-2 py-0.5 rounded-md bg-purple-500/10 border border-purple-500/25 text-[8.5px] font-mono font-bold text-purple-300 uppercase tracking-wider">
              🤖 {modelName}
            </span>
            <span className="text-[8px] font-mono text-muted-foreground/80 tracking-normal shrink-0">
              {provider}
            </span>
          </div>

          {/* Prompt Preview */}
          {data.config?.instruction && (
            <div className="p-2 bg-black/60 rounded-xl border border-white/5 text-[10px] font-mono text-muted-foreground/70 leading-normal break-words line-clamp-2">
              <span className="text-violet-400 font-bold">prompt:</span> {data.config.instruction}
            </div>
          )}

          {/* Thinking / Telemetry telemetry indicators */}
          {execStatus === 'running' && (
            <div className="flex items-center gap-1.5 text-[9px] font-mono text-violet-400/90 animate-pulse mt-1">
              <Loader2 size={10} className="animate-spin" />
              <span className="typing-cursor">AI reasoning active...</span>
            </div>
          )}

          {/* Finished execution metrics */}
          {isCompleted && (
            <div className="flex items-center justify-between border-t border-white/5 pt-2 mt-1.5 text-[8.5px] font-mono text-muted-foreground/60">
              <span className="flex items-center gap-1">
                ⚡ {totalTokens} tokens
              </span>
              <span className="flex items-center gap-0.5">
                ⏱️ {debugInfo?.executionTime !== undefined ? `${(debugInfo.executionTime / 1000).toFixed(2)}s` : '1.4s'}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Normal Nodes Executed Detail Badge */}
      {!isAI && debugInfo && execStatus !== 'idle' && (
        <div className={cn(
          'mt-3 pt-2 border-t text-[10px] font-mono truncate',
          execStatus === 'success' ? 'border-emerald-500/20 text-emerald-400/80' :
            execStatus === 'failed' ? 'border-rose-500/20 text-rose-400/80' :
              'border-border/40 text-muted-foreground'
        )}>
          {execStatus === 'failed' && debugInfo.error
            ? `✗ Failed: ${debugInfo.error.slice(0, 30)}`
            : debugInfo.output
              ? `→ out: ${debugInfo.output.slice(0, 30)}${debugInfo.output.length > 30 ? '…' : ''}`
              : execStatus === 'running' ? (
                <span className="flex items-center gap-1.5 text-blue-400/90 animate-pulse">
                  <Loader2 size={10} className="animate-spin shrink-0" />
                  Running task...
                </span>
              ) : null
          }
        </div>
      )}

      {config.hasSource && (
        <Handle
          type="source"
          position={Position.Right}
          style={handleStyle}
          className="!w-3 !h-3 !bg-[#050507] !border-2 !border-zinc-600 hover:!border-primary hover:!bg-primary/20 hover:!scale-110 !transition-all"
        />
      )}
    </motion.div>
  );
}

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
};
