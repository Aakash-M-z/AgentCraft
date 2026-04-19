import { AppLayout } from "@/components/layout/AppLayout";
import { useGetExecution, useGetWorkflow, useCancelExecution } from "@workspace/api-client-react";
import { useRoute, useLocation } from "wouter";
import { format } from "date-fns";
import { ReactFlow, Background, ReactFlowProvider } from "@xyflow/react";
import { nodeTypes } from "@/components/workflow/CustomNodes";
import { Loader2, StopCircle, Terminal, Sparkles, CheckCircle2, XCircle, Clock, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";
import { API_BASE } from "@/lib/api";

export default function ExecutionDetailPage() {
  const [, params] = useRoute('/executions/:id');
  const executionId = params ? parseInt(params.id) : null;
  const [, navigate] = useLocation();

  // Fetch initial execution data (for workflow info)
  const { data: execData, refetch } = useGetExecution(
    executionId || 0,
    { query: { enabled: !!executionId, retry: 3, retryDelay: 1000 } }
  );

  const { data: workflowData } = useGetWorkflow(execData?.workflowId || 0, {
    query: { enabled: !!execData?.workflowId }
  });

  const cancelMut = useCancelExecution();

  // Real-time state from SSE (primary source of truth)
  const [status, setStatus] = useState<string>('pending');
  const [logs, setLogs] = useState<string[]>([]);
  const [finalOutput, setFinalOutput] = useState<string | null>(null);
  const [nodeStates, setNodeStates] = useState<Record<string, string>>({});
  const [showOutput, setShowOutput] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // 🔥 PRIMARY: SSE Connection - Source of Truth
  useEffect(() => {
    if (!executionId) return;

    console.log('🔌 SSE: Connecting to execution stream', executionId);
    const sseUrl = `${API_BASE}/api/executions/${executionId}/stream`;
    const eventSource = new EventSource(sseUrl);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      console.log('✅ SSE: Connected');
      setStatus('running');
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('📨 SSE EVENT:', data);

        // Handle log messages
        if (data.type === 'log') {
          setLogs((prev) => [...prev, data.message]);
        }

        // Handle node updates
        if (data.type === 'node_update') {
          console.log('🔄 Node update:', data.nodeId, data.status);
          setNodeStates((prev) => ({
            ...prev,
            [data.nodeId]: data.status,
          }));
        }

        // Handle completion
        if (data.type === 'execution_complete') {
          console.log('🎉 Execution complete!', {
            status: data.status,
            finalOutput: data.finalOutput,
          });

          setStatus(data.status);
          if (data.finalOutput) {
            setFinalOutput(data.finalOutput);
            setTimeout(() => setShowOutput(true), 400);
          }

          // Refresh execution data for final state
          refetch();

          // Close SSE connection
          eventSource.close();
        }

        // Handle errors
        if (data.type === 'error') {
          console.error('❌ SSE Error:', data.message);
          setStatus('failed');
          setFinalOutput(data.message);
          setTimeout(() => setShowOutput(true), 400);
          eventSource.close();
        }
      } catch (err) {
        console.error('❌ Failed to parse SSE message:', err);
      }
    };

    eventSource.onerror = (err) => {
      console.error('❌ SSE Connection error:', err);
      eventSource.close();
    };

    return () => {
      console.log('🔌 SSE: Disconnecting');
      eventSource.close();
    };
  }, [executionId]);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // Loading state (only while fetching initial data)
  if (!execData) {
    return (
      <AppLayout>
        <div className="flex-1 flex items-center justify-center bg-background">
          <Loader2 className="w-10 h-10 text-primary animate-spin" />
        </div>
      </AppLayout>
    );
  }

  if (!execData) {
    return (
      <AppLayout>
        <div className="flex-1 flex items-center justify-center bg-background">
          <Loader2 className="w-10 h-10 text-primary animate-spin" />
        </div>
      </AppLayout>
    );
  }

  const isRunning = status === 'running' || status === 'pending';

  const flowNodes = (workflowData?.nodes ?? []).map(n => {
    const nodeStatus = nodeStates[n.id] || 'pending';
    const statusClass =
      nodeStatus === 'running' ? 'ring-2 ring-blue-500 shadow-[0_0_25px_rgba(59,130,246,0.6)]' :
        nodeStatus === 'success' ? 'ring-2 ring-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.4)]' :
          nodeStatus === 'failed' ? 'ring-2 ring-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.4)]' : '';
    return { id: n.id, type: n.type, position: n.position, data: { label: n.label, config: n.config }, className: statusClass };
  });

  const flowEdges = (workflowData?.edges ?? []).map(e => ({
    id: e.id, source: e.source, target: e.target,
    animated: nodeStates[e.source] === 'running',
    style: { stroke: nodeStates[e.source] === 'success' ? '#10b981' : nodeStates[e.source] === 'running' ? '#3b82f6' : '#444', strokeWidth: 2 }
  }));

  const statusConfig = {
    completed: { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
    failed: { icon: XCircle, color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/20' },
    running: { icon: Loader2, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
    pending: { icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
    cancelled: { icon: XCircle, color: 'text-muted-foreground', bg: 'bg-secondary border-border' },
  };
  const sc = statusConfig[status as keyof typeof statusConfig] ?? statusConfig.pending;
  const StatusIcon = sc.icon;

  return (
    <AppLayout>
      <div className="flex-1 flex flex-col h-full bg-background overflow-hidden">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="h-16 border-b border-border bg-card/80 backdrop-blur flex items-center justify-between px-6 z-10 shrink-0">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/workflows')}
              className="p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
              <ArrowLeft size={18} />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-foreground">Execution #{execData.id}</h1>
                <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border", sc.bg, sc.color)}>
                  <StatusIcon size={12} className={status === 'running' ? 'animate-spin' : ''} />
                  {status}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {format(new Date(execData.createdAt), 'MMM d, yyyy · HH:mm:ss')}
              </p>
            </div>
          </div>
          {isRunning && (
            <button
              onClick={() => cancelMut.mutate({ id: execData.id }, { onSuccess: () => refetch() })}
              disabled={cancelMut.isPending}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-destructive/10 text-destructive hover:bg-destructive/20 border border-destructive/30 transition-colors"
            >
              <StopCircle size={15} /> Cancel
            </button>
          )}
        </div>

        {/* ── Body ───────────────────────────────────────────────────────── */}
        <div className="flex-1 flex overflow-hidden">

          {/* Canvas */}
          <div className="flex-1 relative bg-[#050505] border-r border-border">
            <ReactFlowProvider>
              <ReactFlow nodes={flowNodes} edges={flowEdges} nodeTypes={nodeTypes}
                fitView nodesDraggable={false} nodesConnectable={false}
                elementsSelectable={false} proOptions={{ hideAttribution: true }}>
                <Background color="#1a1a1a" gap={24} size={1.5} />
              </ReactFlow>
            </ReactFlowProvider>
            {/* Legend */}
            <div className="absolute bottom-4 left-4 flex gap-3 px-4 py-2.5 bg-card/90 backdrop-blur border border-border rounded-xl text-xs font-medium text-muted-foreground shadow-lg">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500/30 border border-emerald-500" />Success</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500/30 border border-blue-500 animate-pulse" />Running</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-rose-500/30 border border-rose-500" />Failed</span>
            </div>
          </div>

          {/* Right panel */}
          <div className="w-[480px] flex flex-col bg-[#0d0d0d] border-l border-border">

            {/* Logs */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-card/50">
              <Terminal size={15} className="text-primary" />
              <span className="text-sm font-semibold text-foreground">Execution Logs</span>
              {isRunning && <span className="ml-auto flex gap-1">
                {[0, 1, 2].map(i => (
                  <span key={i} className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce"
                    style={{ animationDelay: `${i * 150}ms` }} />
                ))}
              </span>}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-1.5 font-mono text-xs min-h-0">
              {logs.map((log, i) => {
                const isEmoji = /^[\s\S]*[🚀📋🧠⚙️✅❌🔍✓🎉💥🤖💬🌐🔀🔄📤📥⚠️]/.test(log);
                const isTimestamp = log.startsWith('[20');
                const cleanLog = isTimestamp ? log.replace(/^\[[\d\-T:.Z]+\]\s*/, '') : log;
                return (
                  <div key={i}
                    className="flex gap-2 py-1 border-b border-white/5 animate-in fade-in slide-in-from-bottom-1 duration-200"
                    style={{ animationDelay: '0ms' }}>
                    <span className="text-primary/60 shrink-0 mt-0.5">›</span>
                    <span className={cn(
                      "break-all leading-relaxed",
                      cleanLog.includes('✅') || cleanLog.includes('🎉') ? 'text-emerald-400' :
                        cleanLog.includes('❌') || cleanLog.includes('💥') ? 'text-rose-400' :
                          cleanLog.includes('🤖') || cleanLog.includes('💬') ? 'text-purple-300' :
                            cleanLog.includes('🚀') || cleanLog.includes('📋') ? 'text-blue-300' :
                              'text-gray-400'
                    )}>{cleanLog}</span>
                  </div>
                );
              })}
              {isRunning && (
                <div className="flex gap-2 py-1 text-primary/60 animate-pulse">
                  <span>›</span>
                  <span>Processing<span className="animate-[ellipsis_1.5s_infinite]">...</span></span>
                </div>
              )}
              <div ref={logsEndRef} />
            </div>

            {/* Final Output — slides in when ready */}
            <div className={cn(
              "border-t border-border transition-all duration-500 ease-out overflow-hidden",
              showOutput ? "max-h-[45%] opacity-100" : "max-h-0 opacity-0"
            )}>
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-card/50">
                <Sparkles size={15} className={status === 'failed' ? 'text-rose-400' : 'text-amber-400'} />
                <span className="text-sm font-semibold text-foreground">
                  {status === 'failed' ? 'Error' : 'Final Output'}
                </span>
                {status === 'completed' && (
                  <CheckCircle2 size={14} className="ml-auto text-emerald-400" />
                )}
                {status === 'failed' && (
                  <XCircle size={14} className="ml-auto text-rose-400" />
                )}
              </div>
              <div className={cn(
                "p-4 overflow-y-auto text-sm whitespace-pre-wrap font-mono leading-relaxed",
                status === 'failed' ? 'bg-rose-500/5 text-rose-300' : 'bg-background/50 text-foreground/90'
              )}
                style={{ maxHeight: 'calc(45vh - 48px)' }}>
                {finalOutput
                  ? <span className="animate-in fade-in duration-700">{finalOutput}</span>
                  : <span className="text-muted-foreground italic">No output returned.</span>
                }
              </div>
            </div>

          </div>
        </div>
      </div>
    </AppLayout>
  );
}
