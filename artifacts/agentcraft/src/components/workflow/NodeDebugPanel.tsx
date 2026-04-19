import { useState } from 'react';
import { ChevronDown, ChevronRight, Clock, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NodeDebugInfo, NodeExecutionStatus } from '@/lib/store';

interface SectionProps {
    title: string;
    children: React.ReactNode;
    defaultOpen?: boolean;
    badge?: string;
    badgeColor?: string;
}

function Section({ title, children, defaultOpen = true, badge, badgeColor = 'bg-secondary text-muted-foreground' }: SectionProps) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="border border-border rounded-lg overflow-hidden">
            <button
                onClick={() => setOpen(!open)}
                className="w-full flex items-center justify-between px-3 py-2 bg-secondary/50 hover:bg-secondary transition-colors text-xs font-semibold text-muted-foreground uppercase tracking-wider"
            >
                <div className="flex items-center gap-2">
                    {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    {title}
                </div>
                {badge && (
                    <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-mono', badgeColor)}>{badge}</span>
                )}
            </button>
            {open && <div className="p-3 bg-background/50">{children}</div>}
        </div>
    );
}

interface NodeDebugPanelProps {
    debugInfo: NodeDebugInfo;
    status: NodeExecutionStatus;
}

export function NodeDebugPanel({ debugInfo, status }: NodeDebugPanelProps) {
    const statusConfig = {
        idle: { icon: Clock, color: 'text-muted-foreground', label: 'Idle' },
        running: { icon: Loader2, color: 'text-blue-400', label: 'Running' },
        success: { icon: CheckCircle2, color: 'text-emerald-400', label: 'Success' },
        failed: { icon: XCircle, color: 'text-rose-400', label: 'Failed' },
    };
    const sc = statusConfig[status];
    const StatusIcon = sc.icon;

    return (
        <div className="space-y-3">
            {/* Status bar */}
            <div className={cn(
                'flex items-center justify-between px-3 py-2 rounded-lg border text-xs font-medium',
                status === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                    status === 'failed' ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' :
                        status === 'running' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' :
                            'bg-secondary border-border text-muted-foreground'
            )}>
                <div className="flex items-center gap-1.5">
                    <StatusIcon size={13} className={cn(status === 'running' && 'animate-spin')} />
                    {sc.label}
                </div>
                {debugInfo.executionTime !== undefined && (
                    <span className="font-mono opacity-70">{debugInfo.executionTime}ms</span>
                )}
            </div>

            {/* Input */}
            {debugInfo.input && (
                <Section title="Input" badge={`${debugInfo.input.length} chars`}>
                    <pre className="text-xs font-mono text-foreground/80 whitespace-pre-wrap break-all leading-relaxed max-h-32 overflow-y-auto">
                        {debugInfo.input}
                    </pre>
                </Section>
            )}

            {/* Output */}
            {debugInfo.output && (
                <Section
                    title="Output"
                    badge={`${debugInfo.output.length} chars`}
                    badgeColor="bg-emerald-500/10 text-emerald-400"
                >
                    <pre className="text-xs font-mono text-foreground/80 whitespace-pre-wrap break-all leading-relaxed max-h-40 overflow-y-auto">
                        {debugInfo.output}
                    </pre>
                </Section>
            )}

            {/* Error */}
            {debugInfo.error && (
                <Section
                    title="Error"
                    defaultOpen={true}
                    badgeColor="bg-rose-500/10 text-rose-400"
                    badge="!"
                >
                    <pre className="text-xs font-mono text-rose-400/90 whitespace-pre-wrap break-all leading-relaxed">
                        {debugInfo.error}
                    </pre>
                </Section>
            )}
        </div>
    );
}
