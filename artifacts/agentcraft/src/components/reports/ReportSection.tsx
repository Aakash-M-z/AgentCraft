interface ReportSectionProps {
    title: string;
    data: any;
}

export function ReportSection({ title, data }: ReportSectionProps) {
    const renderContent = () => {
        if (!data || (Array.isArray(data) && data.length === 0) || (typeof data === 'object' && Object.keys(data).length === 0)) {
            return <p className="text-sm text-slate-500 italic">No data available.</p>;
        }

        if (typeof data === 'object' && !Array.isArray(data)) {
            return (
                <table className="w-full text-sm border-collapse">
                    <tbody>
                        {Object.entries(data).map(([key, value]) => (
                            <tr key={key} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
                                <td className="py-2.5 pr-6 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide align-top whitespace-nowrap w-48">
                                    {key.replace(/_/g, ' ')}
                                </td>
                                <td className="py-2.5 text-slate-800 dark:text-slate-200 font-medium break-words">
                                    {String(value)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            );
        }

        if (Array.isArray(data)) {
            return (
                <ul className="space-y-1.5">
                    {data.map((item, index) => (
                        <li key={index} className="flex items-start gap-3 text-sm text-slate-800 dark:text-slate-200">
                            <span className="text-slate-400 mt-0.5 shrink-0 font-mono text-xs">{String(index + 1).padStart(2, '0')}.</span>
                            <span className="flex-1">{String(item)}</span>
                        </li>
                    ))}
                </ul>
            );
        }

        return (
            <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
                {String(data)}
            </p>
        );
    };

    return (
        <div className="space-y-3">
            <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-widest pb-2 border-b border-slate-200 dark:border-slate-800">
                {title}
            </h4>
            <div>{renderContent()}</div>
        </div>
    );
}
