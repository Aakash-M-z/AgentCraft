import { AppLayout } from "@/components/layout/AppLayout";
import { useGetExecution, useGetWorkflow, useCancelExecution, getGetExecutionQueryKey, getGetWorkflowQueryKey } from "@workspace/api-client-react";
import { useRoute } from "wouter";
import { format } from "date-fns";
import { ReactFlow, Background, ReactFlowProvider } from "@xyflow/react";
import { nodeTypes } from "@/components/workflow/CustomNodes";
import { useExecutionWebSocket } from "@/hooks/use-websocket";
import { Activity, Bot, Loader2, StopCircle, Terminal, CheckCircle2, XCircle, Clock, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

export default function ExecutionDetailPage() {
  const [, params] = useRoute('/executions/:id');
  const executionId = params ? parseInt(params.id) : null;

  const { data: execData, refetch } = useGetExecution(executionId || 0, {
    query: { queryKey: getGetExecutionQueryKey(executionId || 0), enabled: !!executionId }
  });
  
  const { data: workflowData } = useGetWorkflow(execData?.workflowId || 0, {
    query: { queryKey: getGetWorkflowQueryKey(execData?.workflowId || 0), enabled: !!execData?.workflowId }
  });

  const cancelMut = useCancelExecution();
  
  // Real-time events
  const { events } = useExecutionWebSocket(executionId);

  // Combine initial state with live events for local state view
  const [liveNodes, setLiveNodes] = useState<Record<string, string>>({}); // id -> status
  const [liveLogs, setLiveLogs] = useState<string[]>([]);
  
  useEffect(() => {
    if (execData) {
      const initialNodeState: Record<string, string> = {};
      execData.nodeResults.forEach(nr => {
        initialNodeState[nr.nodeId] = nr.status;
      });
      setLiveNodes(initialNodeState);
      setLiveLogs(execData.agentLogs || []);
    }
  }, [execData]);

  useEffect(() => {
    if (events.length > 0) {
      const newLogs: string[] = [];
      const newNodeState = { ...liveNodes };
      
      events.forEach(e => {
        if (e.nodeId && e.status) {
          newNodeState[e.nodeId] = e.status;
        }
        if (e.message) newLogs.push(e.message);
        if (e.reasoning) newLogs.push(`[Reasoning] ${e.reasoning}`);
      });
      
      if (Object.keys(newNodeState).length > 0) setLiveNodes(prev => ({...prev, ...newNodeState}));
      if (newLogs.length > 0) setLiveLogs(prev => [...prev, ...newLogs]);
    }
  }, [events]);

  if (!execData || !workflowData) {
    return (
      <AppLayout>
        <div className="flex-1 flex items-center justify-center bg-background">
          <Loader2 className="w-10 h-10 text-primary animate-spin" />
        </div>
      </AppLayout>
    );
  }

  // Map workflow data to ReactFlow nodes, injecting real-time state
  const flowNodes = workflowData.nodes.map(n => {
    const status = liveNodes[n.id] || 'pending';
    let statusClass = '';
    if (status === 'running') statusClass = 'ring-2 ring-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.5)]';
    if (status === 'success') statusClass = 'ring-2 ring-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.3)]';
    if (status === 'failed') statusClass = 'ring-2 ring-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.3)]';
    
    return {
      id: n.id,
      type: n.type,
      position: n.position,
      data: { label: n.label, config: n.config },
      className: statusClass
    };
  });

  const flowEdges = workflowData.edges.map(e => ({
    id: e.id,
    source: e.source,
    target: e.target,
    animated: liveNodes[e.source] === 'running',
    style: { stroke: liveNodes[e.source] === 'success' ? '#10b981' : '#555' }
  }));

  const isRunning = execData.status === 'running' || execData.status === 'pending';

  return (
    <AppLayout>
      <div className="flex-1 flex flex-col h-full bg-background overflow-hidden">
        {/* Header */}
        <div className="h-20 border-b border-border bg-card flex items-center justify-between px-8 z-10 shrink-0">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground font-display">Execution #{execData.id}</h1>
              <span className={cn(
                "px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider border",
                execData.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                execData.status === 'failed' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                execData.status === 'running' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                'bg-amber-500/10 text-amber-400 border-amber-500/20'
              )}>
                {execData.status}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Started on {format(new Date(execData.createdAt), 'MMM d, yyyy HH:mm:ss')}
            </p>
          </div>
          
          <div className="flex gap-3">
            {isRunning && (
              <button 
                onClick={() => cancelMut.mutate({ id: execData.id }, { onSuccess: () => refetch() })}
                disabled={cancelMut.isPending}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-destructive/10 text-destructive hover:bg-destructive/20 border border-destructive/30 transition-colors"
              >
                <StopCircle size={16} /> Cancel Run
              </button>
            )}
          </div>
        </div>

        {/* Content Split Pane */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* Left: Canvas Viewer */}
          <div className="flex-1 relative border-r border-border bg-[#050505]">
            <ReactFlowProvider>
              <ReactFlow
                nodes={flowNodes}
                edges={flowEdges}
                nodeTypes={nodeTypes}
                fitView
                nodesDraggable={false}
                nodesConnectable={false}
                elementsSelectable={false}
                proOptions={{ hideAttribution: true }}
              >
                <Background color="#222" gap={20} size={2} />
              </ReactFlow>
            </ReactFlowProvider>
            
            <div className="absolute bottom-4 left-4 flex gap-4 p-4 bg-card/80 backdrop-blur border border-border rounded-xl shadow-lg">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><span className="w-3 h-3 rounded-full bg-emerald-500/20 border border-emerald-500" /> Success</div>
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><span className="w-3 h-3 rounded-full bg-blue-500/20 border border-blue-500" /> Running</div>
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><span className="w-3 h-3 rounded-full bg-rose-500/20 border border-rose-500" /> Failed</div>
            </div>
          </div>

          {/* Right: Logs & Outputs */}
          <div className="w-[500px] bg-card flex flex-col h-full shadow-[-10px_0_30px_rgba(0,0,0,0.5)] z-10">
            <div className="p-4 border-b border-border bg-secondary/50 flex items-center gap-2 text-foreground font-semibold">
              <Terminal size={18} className="text-primary" /> Execution Logs
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 font-mono text-xs space-y-3 bg-[#0a0a0a]">
              {liveLogs.map((log, i) => (
                <div key={i} className="text-muted-foreground pb-2 border-b border-border/50 break-words">
                  <span className="text-accent mr-2">{'>'}</span>
                  {log.startsWith('[Reasoning]') ? (
                    <span className="text-purple-300/80 italic">{log}</span>
                  ) : (
                    <span className="text-gray-300">{log}</span>
                  )}
                </div>
              ))}
              {isRunning && (
                <div className="flex items-center gap-2 text-primary animate-pulse py-2">
                  <span className="text-accent">{'>'}</span> Waiting for output<span className="animate-[bounce_1s_infinite]">.</span><span className="animate-[bounce_1s_infinite_100ms]">.</span><span className="animate-[bounce_1s_infinite_200ms]">.</span>
                </div>
              )}
            </div>

            {/* Final Output Panel */}
            {(execData.finalOutput || !isRunning) && (
              <div className="h-1/3 border-t border-border flex flex-col">
                <div className="p-3 border-b border-border bg-secondary/50 flex items-center gap-2 text-foreground font-semibold text-sm">
                  <Sparkles size={16} className="text-amber-400" /> Final Output
                </div>
                <div className="flex-1 p-4 overflow-y-auto bg-background text-sm text-foreground/90 whitespace-pre-wrap font-mono">
                  {execData.finalOutput || "No output returned."}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
