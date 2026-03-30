import { Bot, Play, Server, ArrowRightFromLine, Repeat, Sparkles } from 'lucide-react';
import { WorkflowNodeType } from '@workspace/api-client-react';

const paletteNodes = [
  { type: WorkflowNodeType.input, label: 'Trigger', icon: Play, color: 'text-emerald-400', border: 'border-emerald-500/30' },
  { type: WorkflowNodeType.ai_agent, label: 'AI Agent', icon: Bot, color: 'text-primary', border: 'border-primary/30' },
  { type: WorkflowNodeType.api_call, label: 'API Request', icon: Server, color: 'text-blue-400', border: 'border-blue-500/30' },
  { type: WorkflowNodeType.condition, label: 'Condition', icon: ArrowRightFromLine, color: 'text-amber-400', border: 'border-amber-500/30' },
  { type: WorkflowNodeType.loop, label: 'Loop', icon: Repeat, color: 'text-pink-400', border: 'border-pink-500/30' },
  { type: WorkflowNodeType.output, label: 'Output', icon: Sparkles, color: 'text-rose-400', border: 'border-rose-500/30' },
];

export function NodePalette() {
  const onDragStart = (event: React.DragEvent, nodeType: string, label: string) => {
    event.dataTransfer.setData('application/reactflow', JSON.stringify({ type: nodeType, label }));
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="w-64 bg-card border-r border-border h-full flex flex-col z-10 shadow-xl">
      <div className="p-4 border-b border-border bg-secondary/30">
        <h2 className="font-display font-bold text-lg text-foreground tracking-wide">Palette</h2>
        <p className="text-xs text-muted-foreground mt-1">Drag nodes onto the canvas</p>
      </div>
      <div className="p-4 flex flex-col gap-3 overflow-y-auto">
        {paletteNodes.map((n) => (
          <div
            key={n.type}
            onDragStart={(e) => onDragStart(e, n.type, n.label)}
            draggable
            className={`
              flex items-center gap-3 p-3 rounded-xl border bg-background cursor-grab active:cursor-grabbing
              transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg
              ${n.border} hover:bg-secondary
            `}
          >
            <div className={`p-2 rounded-lg bg-card/50 ${n.color}`}>
              <n.icon size={18} />
            </div>
            <span className="font-medium text-sm text-foreground">{n.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
