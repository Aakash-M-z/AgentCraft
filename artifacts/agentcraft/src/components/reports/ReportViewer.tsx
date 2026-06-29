import { useState, useEffect } from 'react';
import { API_BASE } from '@/lib/api';
import { Loader2, Download, Printer, Mail, Archive, FileJson, FileText, Copy } from 'lucide-react';
import { ReportDashboard } from './ReportDashboard';
import { ExecutiveSummary } from './ExecutiveSummary';
import { ReportSection } from './ReportSection';
import { AuditTrail } from './AuditTrail';
import { LoadingSequence } from './LoadingSequence';
import { cn } from '@/lib/utils';

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
            if (!response.ok) {
                throw new Error('Failed to generate report');
            }

            const data = await response.json();
            setReportData(data);

            // Show loading sequence for 2 seconds
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
            const response = await fetch(`${API_BASE}/api/executions/${executionId}/generate-pdf`, {
                method: 'POST',
            });

            if (!response.ok) {
                throw new Error('Failed to generate PDF');
            }

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

    const handlePrint = () => {
        window.print();
    };

    const handleCopyJSON = () => {
        if (reportData?.rawData) {
            navigator.clipboard.writeText(JSON.stringify(reportData.rawData, null, 2));
            alert('JSON copied to clipboard!');
        }
    };

    const handleExportMarkdown = () => {
        if (!reportData) return;

        let markdown = `# ${reportData.templateName}\n\n`;
        markdown += `**Workflow:** ${reportData.workflowName}\n`;
        markdown += `**Report ID:** ${reportData.id}\n`;
        markdown += `**Generated:** ${new Date(reportData.timestamp).toLocaleString()}\n\n`;

        markdown += `## Executive Summary\n\n`;
        markdown += `**Business Purpose:** ${reportData.executiveSummary.businessPurpose}\n\n`;
        markdown += `**Key Findings:** ${reportData.executiveSummary.keyFindings}\n\n`;
        markdown += `**Risk Assessment:** ${reportData.executiveSummary.riskAssessment}\n\n`;
        markdown += `**Recommendation:** ${reportData.executiveSummary.recommendation}\n\n`;
        markdown += `**Final Decision:** ${reportData.executiveSummary.finalDecision}\n\n`;

        markdown += `## Metrics\n\n`;
        reportData.metrics.forEach(m => {
            markdown += `- **${m.key}:** ${m.value}\n`;
        });

        const blob = new Blob([markdown], { type: 'text/markdown' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `AgentCraft_Report_${executionId}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    };

    if (showLoadingSequence && loading) {
        return <LoadingSequence />;
    }

    if (error) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-background">
                <div className="text-center">
                    <p className="text-destructive text-lg font-semibold">Failed to load report</p>
                    <p className="text-muted-foreground mt-2">{error}</p>
                    <button
                        onClick={fetchReport}
                        className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    if (!reportData) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-background">
                <Loader2 className="w-10 h-10 text-primary animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#030303] print:bg-white">
            {/* Action Bar */}
            <div className="sticky top-0 z-50 bg-card/95 backdrop-blur border-b border-border print:hidden">
                <div className="container mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-xl font-bold text-foreground">{reportData.templateName}</h1>
                            <p className="text-sm text-muted-foreground mt-1">
                                Report ID: {reportData.id} • Generated: {new Date(reportData.timestamp).toLocaleString()}
                            </p>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleDownloadPDF}
                                disabled={downloadingPdf}
                                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                            >
                                {downloadingPdf ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Download className="w-4 h-4" />
                                )}
                                Download PDF
                            </button>

                            <button
                                onClick={handlePrint}
                                className="flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors"
                            >
                                <Printer className="w-4 h-4" />
                                Print
                            </button>

                            <button
                                onClick={handleExportMarkdown}
                                className="flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors"
                            >
                                <FileText className="w-4 h-4" />
                                Markdown
                            </button>

                            <button
                                onClick={handleCopyJSON}
                                className="flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors"
                            >
                                <FileJson className="w-4 h-4" />
                                JSON
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Report Content */}
            <div className="container mx-auto px-6 py-8 print:px-0 print:py-0">
                {/* Dashboard Preview */}
                <div className="mb-8 print:hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <ReportDashboard metrics={reportData.metrics} />
                </div>

                {/* Report Document */}
                <div className="bg-card border border-border rounded-xl shadow-lg print:border-0 print:shadow-none print:rounded-none animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200">
                    {/* Header */}
                    <div className="p-8 border-b border-border print:border-b-2 print:border-black">
                        <div className="flex items-start justify-between">
                            <div>
                                <h2 className="text-3xl font-bold text-foreground print:text-black">
                                    {reportData.templateName}
                                </h2>
                                <p className="text-lg text-muted-foreground mt-2 print:text-gray-700">
                                    {reportData.workflowName}
                                </p>
                            </div>
                            <div className="text-right text-sm text-muted-foreground print:text-gray-700">
                                <p className="font-mono">{reportData.id}</p>
                                <p>{new Date(reportData.timestamp).toLocaleDateString()}</p>
                            </div>
                        </div>
                    </div>

                    {/* Executive Summary */}
                    <div className="p-8 border-b border-border print:border-b print:border-gray-300">
                        <ExecutiveSummary summary={reportData.executiveSummary} />
                    </div>

                    {/* Sections */}
                    <div className="p-8 space-y-8">
                        {Object.entries(reportData.sections).map(([key, data]) => {
                            if (key === 'executive_summary' || !data) return null;
                            return (
                                <ReportSection
                                    key={key}
                                    title={key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                    data={data}
                                />
                            );
                        })}
                    </div>

                    {/* Audit Trail */}
                    <div className="p-8 border-t border-border print:border-t-2 print:border-black print:page-break-before">
                        <AuditTrail audit={reportData.audit} />
                    </div>

                    {/* Footer */}
                    <div className="p-6 bg-muted/30 border-t border-border print:bg-gray-50 print:border-t">
                        <p className="text-center text-xs text-muted-foreground print:text-gray-600">
                            Generated by AgentCraft AI • Digital Fingerprint: {reportData.audit.digitalFingerprint} • Confidential
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
