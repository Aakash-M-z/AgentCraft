import { useState, useEffect } from 'react';
import { API_BASE } from '@/lib/api';
import { Loader2, Download, Printer, FileText, X, ArrowLeft } from 'lucide-react';
import { ExecutiveSummary } from './ExecutiveSummary';
import { ReportSection } from './ReportSection';
import { AuditTrail } from './AuditTrail';
import { LoadingSequence } from './LoadingSequence';

export interface ReportData {
    id: string;
    executionId: number;
    workflowId: number;
    workflowName: string;
    workflowType: string;
    templateId: string;
    templateName: string;
    timestamp: string;
    executiveSummary: {
        businessPurpose: string;
        keyFindings: string;
        riskAssessment: string;
        recommendation: string;
        finalDecision: string;
    };
    metrics: Array<{
        key: string;
        value: string | number;
        badge?: 'success' | 'warning' | 'error' | 'info';
        icon?: string;
    }>;
    sections: Record<string, any>;
    charts?: Array<any>;
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
    rawData?: any;
}

interface ReportViewerProps {
    executionId: number;
    onClose?: () => void;
}

function StatusBadge({ value }: { value: string }) {
    const v = value.toLowerCase();
    let cls = 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600';
    if (v.includes('approved') || v.includes('passed') || v.includes('success')) {
        cls = 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800';
    } else if (v.includes('rejected') || v.includes('failed') || v.includes('error')) {
        cls = 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800';
    } else if (v.includes('pending') || v.includes('review') || v.includes('waiting')) {
        cls = 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800';
    }
    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${cls}`}>
            {value}
        </span>
    );
}

export function ReportViewer({ executionId, onClose }: ReportViewerProps) {
    const [loading, setLoading] = useState(true);
    const [reportData, setReportData] = useState<ReportData | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [showLoadingSequence, setShowLoadingSequence] = useState(true);
    const [downloadingPdf, setDownloadingPdf] = useState(false);

    useEffect(() => {
        fetchReport();
    }, [executionId]);

    const fetchReport = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await fetch(`${API_BASE}/api/executions/${executionId}/report`);
            if (!response.ok) throw new Error('Failed to generate report');
            const data = await response.json();
            setReportData(data);
            setTimeout(() => {
                setShowLoadingSequence(false);
                setLoading(false);
            }, 2000);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
            setLoading(false);
            setShowLoadingSequence(false);
        }
    };

    const handleDownloadPDF = async () => {
        try {
            setDownloadingPdf(true);
            const response = await fetch(`${API_BASE}/api/executions/${executionId}/generate-pdf`, { method: 'POST' });
            if (!response.ok) throw new Error('Failed to generate PDF');
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `AgentCraft_Report_${executionId}_${new Date().toISOString().slice(0, 10)}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        } catch (err) {
            alert('Failed to download PDF: ' + (err instanceof Error ? err.message : 'Unknown error'));
        } finally {
            setDownloadingPdf(false);
        }
    };

    const handleExportMarkdown = () => {
        if (!reportData) return;
        let md = `# ${reportData.templateName}\n\n`;
        md += `**Workflow:** ${reportData.workflowName}\n`;
        md += `**Report ID:** ${reportData.id}\n`;
        md += `**Generated:** ${new Date(reportData.timestamp).toLocaleString()}\n\n`;
        md += `## Executive Summary\n\n`;
        md += `${reportData.executiveSummary.businessPurpose}\n\n`;
        md += `**Findings:** ${reportData.executiveSummary.keyFindings}\n\n`;
        md += `**Risk:** ${reportData.executiveSummary.riskAssessment}\n\n`;
        md += `**Recommendation:** ${reportData.executiveSummary.finalDecision}\n\n`;
        const blob = new Blob([md], { type: 'text/markdown' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `AgentCraft_Report_${executionId}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    };

    if (showLoadingSequence && loading) return <LoadingSequence />;

    if (error) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-background">
                <div className="text-center max-w-sm">
                    <p className="text-sm font-semibold text-destructive mb-2">Failed to load report</p>
                    <p className="text-xs text-muted-foreground mb-4">{error}</p>
                    <button onClick={fetchReport} className="px-4 py-2 text-sm bg-primary text-white rounded-md hover:bg-primary/90 transition-colors">
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    if (!reportData) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-background">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
        );
    }

    const reportDate = new Date(reportData.timestamp);

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-[#030303] print:bg-white">
            {/* Action Bar — minimal, professional */}
            <div className="sticky top-0 z-50 bg-white dark:bg-[#0a0a0b] border-b border-slate-200 dark:border-slate-800 print:hidden">
                <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        {onClose && (
                            <button
                                onClick={onClose}
                                className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer"
                            >
                                <ArrowLeft className="w-4 h-4" />
                                Back
                            </button>
                        )}
                        <div className="h-4 w-px bg-slate-200 dark:bg-slate-700" />
                        <div>
                            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{reportData.templateName}</span>
                            <span className="text-xs text-slate-400 ml-3 font-mono">{reportData.id}</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleExportMarkdown}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-md hover:border-slate-300 dark:hover:border-slate-600 transition-all cursor-pointer"
                        >
                            <FileText className="w-3.5 h-3.5" />
                            Export
                        </button>
                        <button
                            onClick={() => window.print()}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-md hover:border-slate-300 dark:hover:border-slate-600 transition-all cursor-pointer"
                        >
                            <Printer className="w-3.5 h-3.5" />
                            Print
                        </button>
                        <button
                            onClick={handleDownloadPDF}
                            disabled={downloadingPdf}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-md hover:bg-slate-700 dark:hover:bg-slate-100 transition-colors disabled:opacity-50 cursor-pointer"
                        >
                            {downloadingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                            Download PDF
                        </button>
                    </div>
                </div>
            </div>

            {/* Document */}
            <div className="max-w-5xl mx-auto px-6 py-10 print:px-0 print:py-0">
                {/* KPI summary strip */}
                {reportData.metrics && reportData.metrics.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-8 print:hidden">
                        {reportData.metrics.slice(0, 8).map((m, i) => (
                            <div key={i} className="bg-white dark:bg-[#0f0f11] border border-slate-200 dark:border-slate-800 rounded-md p-3">
                                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">{m.key}</p>
                                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{String(m.value)}</p>
                            </div>
                        ))}
                    </div>
                )}

                {/* Report Document */}
                <div className="bg-white dark:bg-[#0d0d0f] border border-slate-200 dark:border-slate-800 rounded-lg shadow-sm print:border-0 print:shadow-none print:rounded-none">

                    {/* Document Header */}
                    <div className="px-10 pt-10 pb-8 border-b border-slate-200 dark:border-slate-800 print:border-b-2 print:border-black">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">AgentCraft</p>
                                <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 leading-tight mb-1">
                                    {reportData.templateName}
                                </h1>
                                <p className="text-sm text-slate-500 dark:text-slate-400">{reportData.workflowName}</p>
                            </div>
                            <div className="text-right text-xs text-slate-400 space-y-1">
                                <p className="font-mono">{reportData.id}</p>
                                <p>{reportDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                                <p>{reportDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })}</p>
                            </div>
                        </div>
                    </div>

                    {/* Executive Summary */}
                    <div className="px-10 py-8 border-b border-slate-200 dark:border-slate-800">
                        <ExecutiveSummary summary={reportData.executiveSummary} />
                    </div>

                    {/* Dynamic Sections */}
                    <div className="px-10 py-8 space-y-10">
                        {Object.entries(reportData.sections).map(([key, data]) => {
                            if (key === 'executive_summary' || !data) return null;
                            const title = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                            return (
                                <ReportSection key={key} title={title} data={data} />
                            );
                        })}
                    </div>

                    {/* Audit Trail */}
                    <div className="px-10 py-8 border-t border-slate-200 dark:border-slate-800 print:border-t-2 print:border-black">
                        <AuditTrail audit={reportData.audit} />
                    </div>

                    {/* Document Footer */}
                    <div className="px-10 py-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/30 rounded-b-lg print:bg-gray-50">
                        <div className="flex items-center justify-between text-xs text-slate-400">
                            <span>Generated by AgentCraft &middot; Confidential</span>
                            <span className="font-mono">Execution #{reportData.executionId} &middot; {reportData.audit.digitalFingerprint.slice(0, 16)}...</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
