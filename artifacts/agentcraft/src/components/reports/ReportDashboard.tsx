import { CheckCircle, XCircle, Clock, AlertTriangle, FileText, Building, Boxes, Package } from 'lucide-react';
import { cn } from '@/lib/utils';

const iconMap: Record<string, any> = {
    CheckCircle,
    XCircle,
    Clock,
    AlertTriangle,
    FileText,
    Building,
    Boxes,
    Package,
};

interface Metric {
    key: string;
    value: string | number;
    badge?: 'success' | 'warning' | 'error' | 'info';
    icon?: string;
}

interface ReportDashboardProps {
    metrics: Metric[];
}

export function ReportDashboard({ metrics }: ReportDashboardProps) {
    const getBadgeStyle = (badge?: string) => {
        switch (badge) {
            case 'success':
                return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
            case 'warning':
                return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30';
            case 'error':
                return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
            case 'info':
            default:
                return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-foreground">Executive Report</h3>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-xs font-semibold text-emerald-400">Report Generated</span>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {metrics.map((metric, index) => {
                    const Icon = metric.icon ? iconMap[metric.icon] : FileText;

                    return (
                        <div
                            key={index}
                            className={cn(
                                "p-5 rounded-xl border transition-all duration-300 hover:scale-105 animate-in fade-in slide-in-from-bottom-2",
                                getBadgeStyle(metric.badge)
                            )}
                            style={{ animationDelay: `${index * 100}ms` }}
                        >
                            <div className="flex items-start justify-between mb-3">
                                <div className="p-2 rounded-lg bg-background/50">
                                    <Icon className="w-5 h-5" />
                                </div>
                            </div>

                            <p className="text-2xl font-bold mb-1">{metric.value}</p>
                            <p className="text-sm opacity-80">{metric.key}</p>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
