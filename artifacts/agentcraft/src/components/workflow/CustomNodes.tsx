import { Handle, Position } from '@xyflow/react';
import { Bot, Play, Server, ArrowRightFromLine, Repeat, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AppNodeData } from '@/lib/store';

const nodeConfig = {
  input: {
    icon: Play,
    color: 'text-emerald-400',
    bg: 'bg-emerald-400/10',
    border: 'border-emerald-500/50',
    glow: 'shadow-[0_0_20px_rgba(52,211,153,0.15)]',
    hasSource: true,
    hasTarget: false,
  },
  ai_agent: {
    icon: Bot,
    color: 'text-primary',
    bg: 'bg-primary/10',
    border: 'border-primary/50',
    glow: 'shadow-[0_0_20px_rgba(139,92,246,0.2)]',
    hasSource: true,
    hasTarget: true,
  },
  api_call: {
    icon: Server,
    color: 'text-blue-400',
    bg: 'bg-blue-400/10',
    border: 'border-blue-500/50',
    glow: 'shadow-[0_0_20px_rgba(96,165,250,0.15)]',
    hasSource: true,
    hasTarget: true,
  },
  condition: {
    icon: ArrowRightFromLine,
    color: 'text-amber-400',
    bg: 'bg-amber-400/10',
    border: 'border-amber-500/50',
    glow: 'shadow-[0_0_20px_rgba(251,191,36,0.15)]',
    hasSource: true,
    hasTarget: true,
  },
  loop: {
    icon: Repeat,
    color: 'text-pink-400',
    bg: 'bg-pink-400/10',
    border: 'border-pink-500/50',
    glow: 'shadow-[0_0_20px_rgba(244,114,182,0.15)]',
    hasSource: true,
    hasTarget: true,
  },
  output: {
    icon: Sparkles,
    color: 'text-rose-400',
    bg: 'bg-rose-400/10',
    border: 'border-rose-500/50',
    glow: 'shadow-[0_0_20px_rgba(244,63,94,0.15)]',
    hasSource: false,
    hasTarget: true,
  }
};

export function BaseCustomNode({ data, type, selected }: { data: AppNodeData, type: keyof typeof nodeConfig, selected?: boolean }) {
  const config = nodeConfig[type];
  const Icon = config.icon;

  return (
    <div className={cn(
      "relative group rounded-xl bg-card border p-4 min-w-[220px] transition-all duration-300",
      selected ? cn(config.border, config.glow) : "border-border shadow-lg",
      "hover:border-muted-foreground/50"
    )}>
      {config.hasTarget && (
        <Handle 
          type="target" 
          position={Position.Left}
          style={{ width: 12, height: 12, background: 'hsl(240 10% 6%)', border: '2px solid hsl(240 5% 35%)' }}
        />
      )}
      
      <div className="flex items-center gap-3">
        <div className={cn("p-2 rounded-lg", config.bg, config.color)}>
          <Icon size={18} />
        </div>
        <div className="flex flex-col">
          <span className="font-semibold text-sm text-foreground">{data.label}</span>
          <span className="text-xs text-muted-foreground capitalize">{type.replace('_', ' ')}</span>
        </div>
      </div>

      {config.hasSource && (
        <Handle 
          type="source" 
          position={Position.Right}
          style={{ width: 12, height: 12, background: 'hsl(240 10% 6%)', border: '2px solid hsl(240 5% 35%)' }}
        />
      )}
    </div>
  );
}

export const nodeTypes = {
  input: (props: any) => <BaseCustomNode {...props} type="input" />,
  ai_agent: (props: any) => <BaseCustomNode {...props} type="ai_agent" />,
  api_call: (props: any) => <BaseCustomNode {...props} type="api_call" />,
  condition: (props: any) => <BaseCustomNode {...props} type="condition" />,
  loop: (props: any) => <BaseCustomNode {...props} type="loop" />,
  output: (props: any) => <BaseCustomNode {...props} type="output" />,
};
