interface AuditTrailProps {
    audit: {
        executionId: number;
        workflowId: number;
        timestamp: string;
        triggeredBy: string;
        duration: string;
        nodeCount: number;
        aiModel: string;
        validationStatus: string;
        digitalFingerprint: string;
        auditLog: string[];
    };
}

export function AuditTrail({ audit }: AuditTrailProps) {
    const auditRows = [
        { label: 'Execution ID', value: String(audit.executionId) },
        { label: 'Workflow ID', value: String(audit.workflowId) },
        { label: 'Timestamp', value: new Date(audit.timestamp).toLocaleString() },
        { label: 'Triggered By', value: audit.triggeredBy },
        { label: 'Duration', value: audit.duration },
        { label: 'Node Count', value: String(audit.nodeCount) },
        { label: 'AI Model', value: audit.aiModel },
        { label: 'Validation Status', value: audit.validationStatus },
    ];

    return (
        <div className="space-y-8">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest pb-2 border-b border-slate-200 dark:border-slate-800">
                Audit Information
            </h3>

            {/* Audit details table */}
            <table className="w-full text-sm border-collapse">
                <tbody>
                    {auditRows.map(({ label, value }) => (
                        <tr key={label} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
                            <td className="py-2.5 pr-6 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide align-top w-44 whitespace-nowrap">
                                {label}
                            </td>
                            <td className="py-2.5 text-slate-800 dark:text-slate-200 font-medium font-mono text-xs">
                                {value}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* Digital fingerprint */}
            <div className="rounded-md border border-slate-200 dark:border-slate-700 p-4 bg-slate-50 dark:bg-slate-900/50">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Digital Signature</p>
                <p className="text-xs font-mono text-slate-700 dark:text-slate-300 break-all leading-relaxed">
                    {audit.digitalFingerprint}
                </p>
                <p className="text-xs text-slate-400 mt-2">
                    Cryptographic integrity hash — tamper-evident report verification.
                </p>
            </div>

            {/* Audit log */}
            {audit.auditLog && audit.auditLog.length > 0 && (
                <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                        Execution Log ({audit.auditLog.length} entries)
                    </p>
                    <div className="rounded-md border border-slate-200 dark:border-slate-700 overflow-hidden">
                        <div className="max-h-56 overflow-y-auto">
                            <table className="w-full text-xs">
                                <tbody>
                                    {audit.auditLog.slice(-15).map((log, i) => (
                                        <tr key={i} className="border-b border-slate-100 dark:border-slate-800 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors">
                                            <td className="px-3 py-2 font-mono text-slate-400 dark:text-slate-500 w-8 text-right select-none">
                                                {audit.auditLog.length - audit.auditLog.slice(-15).length + i + 1}
                                            </td>
                                            <td className="px-3 py-2 font-mono text-slate-700 dark:text-slate-300">
                                                {log}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
