import { Handle, Position } from '@xyflow/react';
import { Bot, Play, Server, ArrowRightFromLine, Repeat, Sparkles, Mail, CheckCircle2, XCircle, Loader2, Clock, Database, Webhook, FileText, Timer } from 'lucide-react';
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
} as const;

const statusStyles: Record<NodeExecutionStatus, string> = {
  idle: '',
  running: 'ring-2 ring-blue-500 shadow-[0_0_30px_rgba(59,130,246,0.5)]',
  success: 'ring-2 ring-emerald-500 shadow-[0_0_25px_rgba(16,185,129,0.4)]',
  failed: 'ring-2 ring-rose-500 shadow-[0_0_25px_rgba(244,63,94,0.4)]',
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
  data: AppNodeData;
  type: keyof typeof nodeConfig;
  selected?: boolean;
  id: string;
}) {
  const config = nodeConfig[type] ?? nodeConfig.ai_agent;
  const Icon = config.icon;
  const execStatus = useWorkflowStore((s) => s.nodeExecutionStatus[id] ?? 'idle');
  const debugInfo = useWorkflowStore((s) => s.nodeDebugInfo[id]);

  return (
    <motion.div
      initial={{ scale: 0.85, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className={cn(
        'relative group rounded-xl bg-card border p-4 min-w-[220px] transition-all duration-300 cursor-pointer',
        selected ? cn(config.border, config.glow) : 'border-border shadow-lg',
        'hover:border-muted-foreground/40 hover:shadow-xl hover:-translate-y-px',
        statusStyles[execStatus],
      )}
    >
      <StatusBadge status={execStatus} />

      {/* Running pulse ring */}
      {execStatus === 'running' && (
        <div className="absolute inset-0 rounded-xl ring-2 ring-blue-500/30 animate-ping pointer-events-none" />
      )}

      {config.hasTarget && (
        <Handle
          type="target"
          position={Position.Left}
          style={handleStyle}
          className="!hover:border-primary !hover:bg-primary/20 !transition-all"
        />
      )}

      <div className="flex items-center gap-3">
        <div className={cn(
          'p-2 rounded-lg transition-all duration-200',
          config.bg, config.color,
          execStatus === 'running' && 'animate-pulse',
        )}>
          <Icon size={18} />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="font-semibold text-sm text-foreground truncate">{data.label}</span>
          <span className="text-xs text-muted-foreground capitalize">{config.label}</span>
        </div>
      </div>

      {/* Debug info strip — shows after execution */}
      {debugInfo && execStatus !== 'idle' && (
        <div className={cn(
          'mt-3 pt-2 border-t text-xs font-mono truncate',
          execStatus === 'success' ? 'border-emerald-500/20 text-emerald-400/70' :
            execStatus === 'failed' ? 'border-rose-500/20 text-rose-400/70' :
              'border-border text-muted-foreground'
        )}>
          {execStatus === 'failed' && debugInfo.error
            ? `✗ ${debugInfo.error.slice(0, 40)}...`
            : debugInfo.output
              ? `→ ${debugInfo.output.slice(0, 40)}${debugInfo.output.length > 40 ? '…' : ''}`
              : execStatus === 'running' ? 'Processing...' : null
          }
        </div>
      )}

      {config.hasSource && (
        <Handle
          type="source"
          position={Position.Right}
          style={handleStyle}
          className="!hover:border-primary !hover:bg-primary/20 !transition-all"
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
};
