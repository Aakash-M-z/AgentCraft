import { Sparkles, Target, TrendingUp, AlertCircle, CheckCircle2, Flag } from 'lucide-react';

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
        <div className="space-y-6 animate-in fade-in slide-in-from-left duration-500">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30">
                    <Sparkles className="w-6 h-6 text-amber-400" />
                </div>
                <h3 className="text-2xl font-bold text-foreground">Executive Summary</h3>
            </div>

            <div className="space-y-5">
                {/* Business Purpose */}
                <div className="p-4 rounded-lg bg-blue-500/5 border border-blue-500/20">
                    <div className="flex items-start gap-3">
                        <div className="p-1.5 rounded-lg bg-blue-500/10 mt-0.5">
                            <Target className="w-4 h-4 text-blue-400" />
                        </div>
                        <div className="flex-1">
                            <h4 className="text-sm font-bold text-blue-400 mb-1.5">Business Purpose</h4>
                            <p className="text-sm text-foreground/90 leading-relaxed">{summary.businessPurpose}</p>
                        </div>
                    </div>
                </div>

                {/* Key Findings */}
                <div className="p-4 rounded-lg bg-purple-500/5 border border-purple-500/20">
                    <div className="flex items-start gap-3">
                        <div className="p-1.5 rounded-lg bg-purple-500/10 mt-0.5">
                            <TrendingUp className="w-4 h-4 text-purple-400" />
                        </div>
                        <div className="flex-1">
                            <h4 className="text-sm font-bold text-purple-400 mb-1.5">Key Findings</h4>
                            <p className="text-sm text-foreground/90 leading-relaxed">{summary.keyFindings}</p>
                        </div>
                    </div>
                </div>

                {/* Risk Assessment */}
                <div className="p-4 rounded-lg bg-amber-500/5 border border-amber-500/20">
                    <div className="flex items-start gap-3">
                        <div className="p-1.5 rounded-lg bg-amber-500/10 mt-0.5">
                            <AlertCircle className="w-4 h-4 text-amber-400" />
                        </div>
                        <div className="flex-1">
                            <h4 className="text-sm font-bold text-amber-400 mb-1.5">Risk Assessment</h4>
                            <p className="text-sm text-foreground/90 leading-relaxed">{summary.riskAssessment}</p>
                        </div>
                    </div>
                </div>

                {/* Recommendation */}
                <div className="p-4 rounded-lg bg-cyan-500/5 border border-cyan-500/20">
                    <div className="flex items-start gap-3">
                        <div className="p-1.5 rounded-lg bg-cyan-500/10 mt-0.5">
                            <Flag className="w-4 h-4 text-cyan-400" />
                        </div>
                        <div className="flex-1">
                            <h4 className="text-sm font-bold text-cyan-400 mb-1.5">Recommendation</h4>
                            <p className="text-sm text-foreground/90 leading-relaxed">{summary.recommendation}</p>
                        </div>
                    </div>
                </div>

                {/* Final Decision */}
                <div className="p-5 rounded-xl bg-emerald-500/10 border-2 border-emerald-500/30 shadow-lg shadow-emerald-500/10">
                    <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-emerald-500/20 mt-0.5">
                            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                        </div>
                        <div className="flex-1">
                            <h4 className="text-base font-bold text-emerald-400 mb-2">Final Decision</h4>
                            <p className="text-base text-foreground font-semibold leading-relaxed">{summary.finalDecision}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
