import { Shield, QrCode, Clock, User, Cpu, CheckCircle } from 'lucide-react';

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
    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom duration-500">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/30">
                    <Shield className="w-6 h-6 text-blue-400" />
                </div>
                <h3 className="text-2xl font-bold text-foreground">Audit Trail</h3>
            </div>

            {/* Audit Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-card border border-border">
                    <div className="flex items-center gap-2 mb-2">
                        <FileText className="w-4 h-4 text-primary" />
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            Execution ID
                        </p>
                    </div>
                    <p className="text-base font-mono text-foreground">{audit.executionId}</p>
                </div>

                <div className="p-4 rounded-lg bg-card border border-border">
                    <div className="flex items-center gap-2 mb-2">
                        <FileText className="w-4 h-4 text-primary" />
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            Workflow ID
                        </p>
                    </div>
                    <p className="text-base font-mono text-foreground">{audit.workflowId}</p>
                </div>

                <div className="p-4 rounded-lg bg-card border border-border">
                    <div className="flex items-center gap-2 mb-2">
                        <Clock className="w-4 h-4 text-primary" />
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            Timestamp
                        </p>
                    </div>
                    <p className="text-sm text-foreground">{new Date(audit.timestamp).toLocaleString()}</p>
                </div>

                <div className="p-4 rounded-lg bg-card border border-border">
                    <div className="flex items-center gap-2 mb-2">
                        <User className="w-4 h-4 text-primary" />
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            Triggered By
                        </p>
                    </div>
                    <p className="text-base text-foreground">{audit.triggeredBy}</p>
                </div>

                <div className="p-4 rounded-lg bg-card border border-border">
                    <div className="flex items-center gap-2 mb-2">
                        <Clock className="w-4 h-4 text-primary" />
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            Duration
                        </p>
                    </div>
                    <p className="text-base font-mono text-foreground">{audit.duration}</p>
                </div>

                <div className="p-4 rounded-lg bg-card border border-border">
                    <div className="flex items-center gap-2 mb-2">
                        <Boxes className="w-4 h-4 text-primary" />
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            Node Count
                        </p>
                    </div>
                    <p className="text-base font-mono text-foreground">{audit.nodeCount}</p>
                </div>

                <div className="p-4 rounded-lg bg-card border border-border">
                    <div className="flex items-center gap-2 mb-2">
                        <Cpu className="w-4 h-4 text-primary" />
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            AI Model
                        </p>
                    </div>
                    <p className="text-sm text-foreground">{audit.aiModel}</p>
                </div>

                <div className="p-4 rounded-lg bg-card border border-border">
                    <div className="flex items-center gap-2 mb-2">
                        <CheckCircle className="w-4 h-4 text-primary" />
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            Validation Status
                        </p>
                    </div>
                    <p className="text-base text-foreground">{audit.validationStatus}</p>
                </div>
            </div>

            {/* Digital Fingerprint */}
            <div className="p-5 rounded-xl bg-gradient-to-br from-blue-500/10 to-purple-500/10 border-2 border-blue-500/30">
                <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 rounded-lg bg-blue-500/20">
                        <QrCode className="w-5 h-5 text-blue-400" />
                    </div>
                    <h4 className="text-base font-bold text-blue-400">Digital Fingerprint</h4>
                </div>
                <p className="text-xl font-mono font-bold text-foreground tracking-wider break-all">
                    {audit.digitalFingerprint}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                    Unique cryptographic hash for report verification and integrity
                </p>
            </div>

            {/* Audit Logs */}
            {audit.auditLog && audit.auditLog.length > 0 && (
                <div className="space-y-3">
                    <h4 className="text-sm font-bold text-foreground uppercase tracking-wide">
                        Recent Audit Logs
                    </h4>
                    <div className="p-4 rounded-lg bg-card border border-border max-h-64 overflow-y-auto">
                        <div className="space-y-1.5 font-mono text-xs">
                            {audit.auditLog.slice(-10).map((log, index) => (
                                <div key={index} className="text-muted-foreground hover:text-foreground transition-colors">
                                    {log}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function FileText({ className }: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <line x1="10" y1="9" x2="8" y2="9" />
        </svg>
    );
}

function Boxes({ className }: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            <path d="M2.97 12.92A2 2 0 0 0 2 14.63v3.24a2 2 0 0 0 .97 1.71l3 1.8a2 2 0 0 0 2.06 0L12 19v-5.5l-5-3-4.03 2.42Z" />
            <path d="m7 16.5-4.74-2.85" />
            <path d="m7 16.5 5-3" />
            <path d="M7 16.5v5.17" />
            <path d="M12 13.5V19l3.97 2.38a2 2 0 0 0 2.06 0l3-1.8a2 2 0 0 0 .97-1.71v-3.24a2 2 0 0 0-.97-1.71L17 10.5l-5 3Z" />
            <path d="m17 16.5-5-3" />
            <path d="m17 16.5 4.74-2.85" />
            <path d="M17 16.5v5.17" />
            <path d="M7.97 4.42A2 2 0 0 0 7 6.13v4.37l5 3 5-3V6.13a2 2 0 0 0-.97-1.71l-3-1.8a2 2 0 0 0-2.06 0l-3 1.8Z" />
            <path d="M12 8 7.26 5.15" />
            <path d="m12 8 4.74-2.85" />
            <path d="M12 13.5V8" />
        </svg>
    );
}
