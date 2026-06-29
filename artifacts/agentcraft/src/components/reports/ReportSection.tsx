import { FileText } from 'lucide-react';

interface ReportSectionProps {
    title: string;
    data: any;
}

export function ReportSection({ title, data }: ReportSectionProps) {
    const renderContent = () => {
        // Handle empty or null data
        if (!data || (Array.isArray(data) && data.length === 0) || (typeof data === 'object' && Object.keys(data).length === 0)) {
            return <p className="text-sm text-muted-foreground italic">No data available</p>;
        }

        // Handle object (key-value pairs)
        if (typeof data === 'object' && !Array.isArray(data)) {
            return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.entries(data).map(([key, value]) => (
                        <div key={key} className="p-3 rounded-lg bg-muted/30 border border-border">
                            <p className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wide">
                                {key.replace(/_/g, ' ')}
                            </p>
                            <p className="text-sm text-foreground font-medium">
                                {String(value)}
                            </p>
                        </div>
                    ))}
                </div>
            );
        }

        // Handle array (list items)
        if (Array.isArray(data)) {
            return (
                <ul className="space-y-2">
                    {data.map((item, index) => (
                        <li key={index} className="flex items-start gap-2 text-sm text-foreground">
                            <span className="text-primary mt-1.5">•</span>
                            <span className="flex-1">{String(item)}</span>
                        </li>
                    ))}
                </ul>
            );
        }

        // Handle plain text
        return (
            <div className="prose prose-sm max-w-none">
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                    {String(data)}
                </p>
            </div>
        );
    };

    return (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex items-center gap-3">
                <div className="p-1.5 rounded-lg bg-primary/10 border border-primary/30">
                    <FileText className="w-4 h-4 text-primary" />
                </div>
                <h4 className="text-lg font-bold text-foreground">{title}</h4>
            </div>

            <div className="pl-9">
                {renderContent()}
            </div>
        </div>
    );
}
