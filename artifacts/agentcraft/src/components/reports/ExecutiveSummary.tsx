interface ExecutiveSummaryProps {
    summary: {
        businessPurpose: string;
        keyFindings: string;
        riskAssessment: string;
        recommendation: string;
        finalDecision: string;
    };
}

export function ExecutiveSummary({ summary }: ExecutiveSummaryProps) {
    return (
        <div className="space-y-8">
            <div>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-6 pb-2 border-b border-slate-200 dark:border-slate-800">
                    Executive Summary
                </h3>

                <div className="space-y-5 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                    <div>
                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wide mb-1.5">
                            Business Purpose
                        </p>
                        <p className="text-slate-800 dark:text-slate-200">{summary.businessPurpose}</p>
                    </div>

                    <div>
                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wide mb-1.5">
                            Key Findings
                        </p>
                        <p className="text-slate-800 dark:text-slate-200">{summary.keyFindings}</p>
                    </div>

                    <div>
                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wide mb-1.5">
                            Risk Assessment
                        </p>
                        <p className="text-slate-800 dark:text-slate-200">{summary.riskAssessment}</p>
                    </div>

                    <div>
                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wide mb-1.5">
                            Recommendation
                        </p>
                        <p className="text-slate-800 dark:text-slate-200">{summary.recommendation}</p>
                    </div>
                </div>
            </div>

            {/* Final Decision Block — clear, document-style callout */}
            <div className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 p-5">
                <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wide mb-2">
                            Final Recommendation
                        </p>
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100 leading-relaxed">
                            {summary.finalDecision}
                        </p>
                    </div>
                    <span className="shrink-0 inline-flex items-center px-2.5 py-1 rounded text-xs font-semibold border bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600">
                        AI-Validated
                    </span>
                </div>
            </div>
        </div>
    );
}
