import { useCallback, useRef, useState, useEffect } from 'react';
import { useRoute, useLocation } from 'wouter';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  useReactFlow,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Save, Play, Wand2, RefreshCw, X, Sparkles, CheckCircle2, XCircle, Maximize2, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { AppLayout } from '@/components/layout/AppLayout';
import { NodePalette } from '@/components/workflow/NodePalette';
import { ConfigPanel } from '@/components/workflow/ConfigPanel';
import { nodeTypes } from '@/components/workflow/CustomNodes';
import { EmptyState } from '@/components/workflow/EmptyState';
import { useWorkflowStore } from '@/lib/store';
import { generateId } from '@/lib/utils';
import {
  useGetWorkflow,
  useCreateWorkflow,
  useUpdateWorkflow,
  useGenerateWorkflow,
  useStartExecution,
  useExplainWorkflow,
  useGetExecution,
} from '@workspace/api-client-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useExecutionStream } from '@/hooks/use-websocket';

// ── Execution output panel ───────────────────────────────────────────────────
function ExecutionOutputPanel() {
  const { finalOutput, executionStatus, setFinalOutput } = useWorkflowStore();
  const [isVisible, setIsVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (finalOutput && (executionStatus === 'completed' || executionStatus === 'failed')) {
      setIsVisible(true);
    }
  }, [finalOutput, executionStatus]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => setFinalOutput(null), 300);
  };

  const handleCopy = async () => {
    if (finalOutput) {
      await navigator.clipboard.writeText(finalOutput);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!finalOutput || !isVisible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="absolute bottom-6 right-6 z-40 w-96 max-h-80 bg-card border border-border rounded-xl shadow-2xl shadow-black/50 overflow-hidden"
      >
        <div className={cn(
          "flex items-center justify-between px-4 py-3 border-b border-border",
          executionStatus === 'completed' ? 'bg-emerald-500/10' : 'bg-rose-500/10'
        )}>
          <div className="flex items-center gap-2">
            {executionStatus === 'completed' ? (
              <CheckCircle2 size={16} className="text-emerald-400" />
            ) : (
              <XCircle size={16} className="text-rose-400" />
            )}
            <span className="text-sm font-semibold text-foreground">
              {executionStatus === 'completed' ? 'Workflow Output' : 'Execution Error'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="text-xs px-2 py-1 rounded bg-secondary hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            >
              {copied ? '✓ Copied' : 'Copy'}
            </button>
            <button
              onClick={handleClose}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>
        <div className="p-4 overflow-y-auto max-h-64">
          <pre className={cn(
            "text-sm whitespace-pre-wrap font-mono leading-relaxed",
            executionStatus === 'completed' ? 'text-foreground/90' : 'text-rose-300'
          )}>
            {finalOutput}
          </pre>
        </div>
        <div className="px-4 py-2 border-t border-border bg-secondary/50">
          <p className="text-xs text-muted-foreground">
            Click outside or press ESC to close
          </p>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// ── Execution status bar ──────────────────────────────────────────────────────
function ExecutionStatusBar({ executionId, onDone }: { executionId: number; onDone: () => void }) {
  const { data, refetch } = useGetExecution(executionId, { query: { enabled: true } as any });
  const { setNodeExecutionStatus, setNodeDebugInfo, setIsExecuting, setExecutionProgress, setFinalOutput, setExecutionStatus, nodes } = useWorkflowStore();
  const isTerminal = data?.status === 'completed' || data?.status === 'failed' || data?.status === 'cancelled';
  const { events, connectionState } = useExecutionStream(executionId, {
    enabled: !isTerminal,
  });
  const onDoneRef = useRef(onDone);
  const doneCalledRef = useRef(false);
  useEffect(() => { onDoneRef.current = onDone; });

  // Handle SSE events in real-time
  useEffect(() => {
    if (!events.length) return;

    const lastEvent = events[events.length - 1];

    if (lastEvent.type === 'execution_complete') {
      setExecutionStatus(lastEvent.status as any);
      if (lastEvent.finalOutput) {
        setFinalOutput(lastEvent.finalOutput);
      }

      if (!doneCalledRef.current) {
        doneCalledRef.current = true;
        setIsExecuting(false);
        onDoneRef.current();
      }
    }

    // Handle node updates from SSE
    if (lastEvent.type === 'node_update' && lastEvent.nodeId) {
      const status: any = lastEvent.status === 'success' ? 'success' : lastEvent.status === 'failed' ? 'failed' : 'running';
      setNodeExecutionStatus(lastEvent.nodeId, status);
      if (lastEvent.output) {
        setNodeDebugInfo(lastEvent.nodeId, {
          output: typeof lastEvent.output.result === 'string' ? lastEvent.output.result : undefined,
          status,
        });
      }
    }
  }, [events]);

  // Polling fallback (in case SSE misses something)
  useEffect(() => {
    if (!data) return;

    // Sync node statuses
    data.nodeResults?.forEach((nr: any, i: number) => {
      const status: any = nr.status === 'success' ? 'success' : nr.status === 'failed' ? 'failed' : 'running';
      setNodeExecutionStatus(nr.nodeId, status);
      setNodeDebugInfo(nr.nodeId, {
        input: typeof nr.output?.input === 'string' ? nr.output.input : undefined,
        output: typeof nr.output?.result === 'string' ? nr.output.result : undefined,
        error: nr.reasoning ?? nr.error,
        status,
      });
      setExecutionProgress({ current: i + 1, total: nodes.length });
    });

    // Update execution status and final output from polling
    setExecutionStatus(data.status as any);
    if (data.finalOutput) {
      setFinalOutput(data.finalOutput);
    }

    if (data.status === 'waiting_approval') {
      setExecutionStatus('waiting_approval');
    }

    const isTerminal = data.status === 'completed' || data.status === 'failed' || data.status === 'cancelled';

    if (isTerminal) {
      if (!doneCalledRef.current) {
        doneCalledRef.current = true;
        setIsExecuting(false);
        onDoneRef.current();
      }
      return; // stop polling
    }

    // Still running — schedule next poll
    const t = setTimeout(() => refetch(), 1200);
    return () => clearTimeout(t);
  }, [data]); // only re-run when data changes

  if (!data) return null;

  const isRunning = data.status === 'running' || data.status === 'pending';
  const isDone = data.status === 'completed' || data.status === 'failed';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -48, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -48, opacity: 0 }}
        className={cn(
          'absolute top-0 left-0 right-0 z-30 flex items-center gap-3 px-6 py-2.5 text-sm font-medium border-b',
          data.status === 'completed' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' :
            data.status === 'failed' ? 'bg-rose-500/10 border-rose-500/20 text-rose-300' :
              'bg-blue-500/10 border-blue-500/20 text-blue-300'
        )}
      >
        {isRunning && <RefreshCw size={14} className="animate-spin shrink-0" />}
        {data.status === 'completed' && <CheckCircle2 size={14} className="shrink-0" />}
        {data.status === 'failed' && <XCircle size={14} className="shrink-0" />}
        <span>
          {connectionState === 'reconnecting'
            ? 'Reconnecting SSE...'
            : isRunning
              ? 'Workflow is running...'
              : data.status === 'completed'
                ? 'Workflow completed successfully'
                : data.status === 'failed'
                  ? 'Workflow failed'
                  : data.status === 'waiting_approval'
                    ? 'Waiting for approval'
                    : data.status}
        </span>
        {isDone && (
          <a href={`/executions/${executionId}`} className="ml-auto text-xs underline underline-offset-2 opacity-70 hover:opacity-100">
            View full execution →
          </a>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

// ── AI Copilot Assistant Component ───────────────────────────────────────────
import { Brain, CornerDownLeft, Sparkles as SparklesIcon } from "lucide-react";

interface CopilotAssistantProps {
  workflowId: number | null;
  fetchExplain: () => any;
  explanationData: any;
  isExplaining: boolean;
}

function CopilotAssistant({ workflowId, fetchExplain, explanationData, isExplaining }: CopilotAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Array<{ sender: 'ai' | 'user'; text: string; code?: string }>>([
    { sender: 'ai', text: "Hello! I am your Antigravity Autonomous Copilot. Select an action below or ask me to analyze the pipeline." }
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  const simulateStream = (text: string, code?: string) => {
    setIsTyping(true);
    setMessages(prev => [...prev, { sender: 'user', text: "Action selected" }]);
    
    setTimeout(() => {
      setIsTyping(false);
      setMessages(prev => [...prev, { sender: 'ai', text, code }]);
    }, 1500);
  };

  const handleSend = () => {
    if (!inputValue.trim()) return;
    const userText = inputValue;
    setMessages(prev => [...prev, { sender: 'user', text: userText }]);
    setInputValue("");
    setIsTyping(true);

    setTimeout(() => {
      setIsTyping(false);
      let response = "I have analyzed your request. I recommend using Llama 3.3 for reasoning and GPT OSS for structural formatting.";
      if (userText.toLowerCase().includes("fix") || userText.toLowerCase().includes("error")) {
        response = "Reviewing failed steps... Found conditional error: the Condition node is configured to stop if output contains 'error', but the incoming WhatsApp message is blank. Recommend adding a delay or default backup input.";
      } else if (userText.toLowerCase().includes("explain")) {
        response = "This workflow acts as an autonomous AI router: fetching weather or daily events, routing them to Groq's high-capacity Llama map, running conditions, and triggering manual approvals before WhatsApp notification.";
      }
      setMessages(prev => [...prev, { sender: 'ai', text: response }]);
    }, 1200);
  };

  const handleAction = async (action: 'explain' | 'optimize' | 'diagnose') => {
    if (action === 'explain') {
      if (!workflowId) {
        setMessages(prev => [...prev, { sender: 'ai', text: "Please save the workflow first to fetch its layout details." }]);
        return;
      }
      setIsTyping(true);
      try {
        await fetchExplain();
      } catch (err) {
        console.error(err);
      }
      setIsTyping(false);
    } else if (action === 'optimize') {
      simulateStream(
        "I have analyzed the parameter settings for your AI Agent nodes. Recommendations:\n1. For reasoning-heavy steps, switch to `llama-3.3-70b-versatile`.\n2. Set the `Temperature` to `0.2` on AI Solver steps to enforce deterministic structural output.\n3. Enforce `manualApproval: true` on critical outputs to ensure man-in-the-loop validation.",
        "{\n  \"model\": \"llama-3.3-70b-versatile\",\n  \"temperature\": 0.2,\n  \"manualApproval\": true\n}"
      );
    } else {
      simulateStream(
        "Running diagnostics... Checked current node configurations.\nAll 3 active endpoints are responding cleanly. Redis cache connection latency is optimal (< 2ms). No conditional loops detected. Recommended: Ensure incoming webhook body maps cleanly to the WhatsApp payload.",
        "No issues detected in current canvas layout."
      );
    }
  };

  // Listen to explanationData updates and sync inside chat
  useEffect(() => {
    if (explanationData?.explanation) {
      setMessages(prev => [
        ...prev, 
        { 
          sender: 'ai', 
          text: `Explanation:\n${explanationData.explanation}\n\nSteps:\n${explanationData.steps.join('\n')}` 
        }
      ]);
    }
  }, [explanationData]);

  return (
    <div className="absolute bottom-6 right-86 z-20 flex flex-col items-end">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 15, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 15, scale: 0.95 }}
            className="w-96 h-[400px] bg-card/75 backdrop-blur-xl border border-border/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col mb-4 relative"
          >
            <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-primary via-purple-500 to-cyan-500" />
            
            {/* Header */}
            <div className="px-4 py-3 bg-[#060608]/40 border-b border-border/50 flex items-center justify-between">
              <span className="text-xs font-bold text-foreground/90 uppercase tracking-widest flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
                Antigravity AI Copilot
              </span>
              <button 
                onClick={() => setIsOpen(false)}
                className="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
              >
                Close
              </button>
            </div>

            {/* Chat Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin">
              {messages.map((m, i) => (
                <div key={i} className={cn("flex flex-col max-w-[85%] text-xs font-sans", m.sender === 'user' ? "ml-auto items-end" : "mr-auto items-start")}>
                  <div className={cn(
                    "p-3 rounded-xl leading-relaxed whitespace-pre-wrap",
                    m.sender === 'user' 
                      ? "bg-primary text-white rounded-tr-none shadow-md shadow-primary/10" 
                      : "bg-[#0c0c0e]/80 border border-white/5 text-foreground/90 rounded-tl-none"
                  )}>
                    {m.text}
                    {m.code && (
                      <pre className="mt-2 p-1.5 bg-black/60 border border-white/5 rounded-md font-mono text-[10px] text-cyan-400 overflow-x-auto">
                        {m.code}
                      </pre>
                    )}
                  </div>
                </div>
              ))}
              
              {isTyping && (
                <div className="flex items-center gap-1.5 text-[10px] font-mono text-violet-400 animate-pulse px-1">
                  <Loader2 size={10} className="animate-spin" />
                  <span>Thinking...</span>
                </div>
              )}
            </div>

            {/* Quick Actions Pills */}
            <div className="px-4 py-2 border-t border-border/40 bg-secondary/15 flex gap-1.5 overflow-x-auto shrink-0 scrollbar-none">
              <button 
                onClick={() => handleAction('explain')}
                className="px-2.5 py-1 rounded-lg bg-black/40 border border-border/80 hover:border-primary/40 text-[9px] font-mono text-muted-foreground hover:text-primary transition-all shrink-0 cursor-pointer"
              >
                🧠 Explain
              </button>
              <button 
                onClick={() => handleAction('optimize')}
                className="px-2.5 py-1 rounded-lg bg-black/40 border border-border/80 hover:border-cyan-400/40 text-[9px] font-mono text-muted-foreground hover:text-cyan-400 transition-all shrink-0 cursor-pointer"
              >
                ⚡ Optimize
              </button>
              <button 
                onClick={() => handleAction('diagnose')}
                className="px-2.5 py-1 rounded-lg bg-black/40 border border-border/80 hover:border-rose-400/40 text-[9px] font-mono text-muted-foreground hover:text-rose-400 transition-all shrink-0 cursor-pointer"
              >
                🛡️ Diagnose
              </button>
            </div>

            {/* Input Box */}
            <div className="p-3 border-t border-border/50 bg-[#060608]/40 flex gap-2 shrink-0">
              <input
                type="text"
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                placeholder="Ask Copilot anything..."
                className="flex-1 bg-[#09090b]/80 border border-border/60 rounded-xl px-3 py-1.5 text-xs text-foreground/90 focus:outline-none focus:border-primary transition-all"
              />
              <button 
                onClick={handleSend}
                className="p-1.5 bg-primary rounded-xl text-white hover:bg-primary/95 transition-all cursor-pointer shrink-0"
              >
                <CornerDownLeft size={14} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Sparkle/Brain Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-12 h-12 rounded-full bg-gradient-to-r from-primary to-accent hover:scale-[1.05] active:scale-[0.95] text-white flex items-center justify-center shadow-xl shadow-primary/20 hover:shadow-primary/45 transition-all cursor-pointer relative group border border-white/10"
      >
        <Brain size={20} className="group-hover:rotate-6 transition-transform" />
        <span className="absolute -top-1 -right-1 w-3 h-3 bg-cyan-400 border border-card rounded-full animate-pulse" />
      </button>
    </div>
  );
}

// ── Main canvas ───────────────────────────────────────────────────────────────
function BuilderCanvas() {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition, fitView } = useReactFlow();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const {
    nodes, edges, onNodesChange, onEdgesChange, onConnect,
    addNode, setSelectedNodeId, selectedNodeId, workflowId, workflowName, setWorkflowMeta,
    getApiFormat, loadApiFormat, isExecuting, setIsExecuting, clearExecutionState,
    executionProgress, finalOutput, executionStatus,
  } = useWorkflowStore();

  const [promptOpen, setPromptOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [explainOpen, setExplainOpen] = useState(false);
  const [runInputOpen, setRunInputOpen] = useState(false);
  const [runInput, setRunInput] = useState('');
  const [liveExecutionId, setLiveExecutionId] = useState<number | null>(null);
  const handleExecutionDone = useCallback(() => {
    setTimeout(() => setLiveExecutionId(null), 4000);
  }, []);

  const createMut = useCreateWorkflow();
  const updateMut = useUpdateWorkflow();
  const generateMut = useGenerateWorkflow();
  const executeMut = useStartExecution();

  const { data: explanationData, refetch: fetchExplain, isFetching: isExplaining } = useExplainWorkflow(
    workflowId || 0,
    { query: { enabled: false } as any }
  );

  const isEmpty = nodes.length === 0;

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        if (!isExecuting) handleExecute();
      }
      if (e.key === 'Escape') {
        setSelectedNodeId(null);
        setPromptOpen(false);
        setRunInputOpen(false);
        setExplainOpen(false);
        // Close output panel if visible
        if (finalOutput) {
          const { setFinalOutput } = useWorkflowStore.getState();
          setFinalOutput(null);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [workflowId, workflowName, isExecuting]);

  // Listen for "add AI agent" from config panel empty state
  useEffect(() => {
    const handler = () => {
      addNode({
        id: generateId(),
        type: 'ai_agent' as any,
        position: { x: 400, y: 250 },
        data: { label: 'AI Agent', config: {} },
      });
    };
    window.addEventListener('add-ai-agent', handler);
    return () => window.removeEventListener('add-ai-agent', handler);
  }, [addNode]);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onNodeClick = useCallback((_: React.MouseEvent, node: any) => {
    setSelectedNodeId(node.id);
  }, [setSelectedNodeId]);

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, [setSelectedNodeId]);

  const onDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    const dataStr = event.dataTransfer.getData('application/reactflow');
    if (!dataStr) return;
    const { type, label } = JSON.parse(dataStr);
    const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    addNode({ id: generateId(), type, position, data: { label, config: {} } });
  }, [screenToFlowPosition, addNode]);

  const handleSave = () => {
    const apiData = getApiFormat();
    if (workflowId) {
      updateMut.mutate(
        { id: workflowId, data: { name: workflowName, ...apiData } },
        { onSuccess: () => toast({ title: '✓ Workflow saved' }) }
      );
    } else {
      createMut.mutate(
        { data: { name: workflowName, ...apiData } },
        {
          onSuccess: (res) => {
            setWorkflowMeta({ id: res.id });
            toast({ title: '✓ Workflow created' });
            window.history.replaceState(null, '', `/workflows/${res.id}`);
          }
        }
      );
    }
  };

  const handleGenerate = () => {
    if (!prompt) return;
    generateMut.mutate(
      { data: { prompt } },
      {
        onSuccess: (res) => {
          loadApiFormat(res.nodes, res.edges);
          setWorkflowMeta({ name: res.name, description: res.description });
          setPromptOpen(false);
          setPrompt('');
          toast({ title: '✓ Workflow generated' });
          setTimeout(() => fitView({ padding: 0.2, duration: 600 }), 100);
        },
        onError: () => toast({ title: 'Generation failed', variant: 'destructive' }),
      }
    );
  };

  const handleExplain = () => {
    if (!workflowId) {
      toast({ title: 'Save the workflow first', variant: 'destructive' });
      return;
    }
    fetchExplain().then(() => setExplainOpen(true));
  };

  const handleExecute = () => setRunInputOpen(true);

  const doExecute = async () => {
    clearExecutionState();
    setIsExecuting(true);
    const apiData = getApiFormat();
    const inputText = runInput.trim() || 'Run workflow';

    const doRun = (id: number) => {
      executeMut.mutate(
        { data: { workflowId: id, input: inputText } },
        {
          onSuccess: (res) => {
            console.log('🚀 Execution started:', res.id);
            toast({ title: '▶ Execution started' });
            setRunInputOpen(false);

            // 🔥 CRITICAL: Navigate immediately to execution page
            navigate(`/executions/${res.id}`);
            // Fallback for router desync: force redirect if wouter navigation didn't trigger route change after 200ms
            setTimeout(() => {
              if (!window.location.pathname.includes(`/executions/${res.id}`)) {
                const base = import.meta.env.BASE_URL.replace(/\/$/, "");
                window.location.href = `${base}/executions/${res.id}`;
              }
            }, 200);
          },
          onError: () => {
            setIsExecuting(false);
            setRunInputOpen(false);
            toast({ title: 'Failed to start execution', variant: 'destructive' });
          },
        }
      );
    };

    if (workflowId) {
      updateMut.mutate(
        { id: workflowId, data: { name: workflowName, ...apiData } },
        {
          onSuccess: () => doRun(workflowId),
          onError: () => {
            setIsExecuting(false);
            setRunInputOpen(false);
          }
        }
      );
    } else {
      createMut.mutate(
        { data: { name: workflowName, ...apiData } },
        {
          onSuccess: (res) => {
            setWorkflowMeta({ id: res.id });
            window.history.replaceState(null, '', `/workflows/${res.id}`);
            doRun(res.id);
          },
          onError: () => {
            setIsExecuting(false);
            setRunInputOpen(false);
            toast({ title: 'Failed to save workflow', variant: 'destructive' });
          },
        }
      );
    }
  };

  const isSaving = createMut.isPending || updateMut.isPending;

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0a0a0a]">
      {/* Top Toolbar */}
      <div className="h-14 border-b border-border bg-card/80 backdrop-blur flex items-center justify-between px-5 z-20 shrink-0">
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={workflowName}
            onChange={(e) => setWorkflowMeta({ name: e.target.value })}
            className="bg-transparent text-lg font-display font-bold text-foreground border-none outline-none focus:ring-2 focus:ring-primary/40 rounded px-2 py-1 w-56"
          />
          {workflowId && (
            <span className="text-xs px-2 py-0.5 bg-secondary text-muted-foreground rounded-full border border-border">
              #{workflowId}
            </span>
          )}
          {isExecuting && executionProgress && (
            <motion.span
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-xs text-blue-400 font-mono"
            >
              Running {executionProgress.current}/{executionProgress.total}
            </motion.span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setPromptOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-secondary text-foreground hover:bg-muted transition-colors border border-border"
          >
            <Sparkles size={14} className="text-amber-400" />
            AI Generate
          </button>
          <button
            onClick={handleExplain}
            disabled={isExplaining || !workflowId}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-secondary text-foreground hover:bg-muted transition-colors border border-border disabled:opacity-40"
          >
            {isExplaining ? <RefreshCw size={14} className="animate-spin" /> : <Wand2 size={14} className="text-cyan-400" />}
            Explain
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-primary/10 text-primary hover:bg-primary/20 border border-primary/30 transition-colors disabled:opacity-50"
            title="Save (Ctrl+S)"
          >
            {isSaving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
            Save
          </button>
          <button
            onClick={handleExecute}
            disabled={isExecuting || isSaving}
            className="flex items-center gap-1.5 px-5 py-1.5 rounded-lg text-sm font-bold bg-gradient-to-r from-cyan-500 to-violet-600 text-white shadow-lg shadow-violet-500/20 hover:shadow-violet-500/40 hover:-translate-y-px transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            title="Run (Ctrl+Enter)"
          >
            {isExecuting
              ? <RefreshCw size={14} className="animate-spin" />
              : <Play size={14} className="fill-white" />}
            {isExecuting ? 'Running...' : 'Run'}
          </button>
        </div>
      </div>

      {/* Main Builder Area */}
      <div className="flex-1 flex overflow-hidden relative">
        <NodePalette />

        <div className="flex-1 h-full relative" ref={reactFlowWrapper}>
          {/* Live execution status bar */}
          {liveExecutionId && (
            <ExecutionStatusBar
              executionId={liveExecutionId}
              onDone={handleExecutionDone}
            />
          )}

          {/* Empty state — shown OVER canvas when no nodes exist */}
          {isEmpty && !isExecuting && (
            <div className="absolute inset-0 z-10 pointer-events-none">
              <EmptyState onOpenAIGenerate={() => setPromptOpen(true)} />
            </div>
          )}

          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onDrop={onDrop}
            onDragOver={onDragOver}
            nodeTypes={nodeTypes}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            fitView
            proOptions={{ hideAttribution: true }}
            deleteKeyCode="Delete"
            snapToGrid={true}
            snapGrid={[12, 12]}
            defaultEdgeOptions={{ animated: isExecuting, style: { stroke: isExecuting ? 'hsl(16 95% 55% / 0.8)' : 'hsl(16 95% 55% / 0.5)', strokeWidth: 2 } }}
            connectionLineStyle={{ stroke: 'hsl(16 95% 55%)', strokeWidth: 2, strokeDasharray: '6 3' }}
            className="bg-[#050507]"
          >
            <Background
              variant={BackgroundVariant.Dots}
              color="#1a1a24"
              gap={24}
              size={1.2}
            />
            <Controls
              className="bg-card/85 border border-border/80 rounded-xl overflow-hidden shadow-xl"
              showInteractive={false}
            />
            <MiniMap
              nodeColor={(n) => {
                const colors: Record<string, string> = {
                  input: '#34d399', ai_agent: '#8b5cf6', api_call: '#60a5fa',
                  condition: '#fbbf24', loop: '#f472b6', output: '#f43f5e',
                  email: '#38bdf8', database: '#2dd4bf', webhook: '#fb923c',
                  file_processor: '#818cf8', delay: '#facc15',
                };
                return colors[n.type ?? ''] ?? '#555';
              }}
              maskColor="rgba(0,0,0,0.85)"
              style={{ background: 'hsl(240 10% 6%)', border: '1px solid rgba(255,255,255,0.06)' }}
            />
            
            {/* Custom Snap & Fit Canvas Controls */}
            <div className="absolute bottom-4 right-4 z-10 flex gap-2">
              <button
                onClick={() => {
                  if (nodes.length === 0) return;
                  const sorted = [...nodes].sort((a, b) => a.position.y - b.position.y);
                  const formattedNodes = sorted.map((node, index) => ({
                    ...node,
                    position: { x: 100 + (index % 3) * 280, y: 100 + Math.floor(index / 3) * 160 }
                  }));
                  // Set new coordinates in Zustand store
                  const { setNodes } = useWorkflowStore.getState();
                  setNodes(formattedNodes);
                  toast({ title: "✓ Canvas aligned & structured" });
                }}
                className="px-3 py-2 rounded-lg bg-card/90 backdrop-blur border border-border/80 text-muted-foreground hover:text-cyan-400 hover:bg-secondary cursor-pointer transition-colors shadow-lg flex items-center gap-1.5 text-xs font-semibold"
                title="Auto-align canvas"
              >
                <SparklesIcon size={13} className="text-cyan-400" />
                Tidy Map
              </button>
              <button
                onClick={() => fitView({ padding: 0.15, duration: 500 })}
                className="p-2 rounded-lg bg-card/90 backdrop-blur border border-border/80 text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer transition-colors shadow-lg"
                title="Fit view"
              >
                <Maximize2 size={13} />
              </button>
            </div>
          </ReactFlow>

          {/* Floating AI Copilot Assistant Drawer */}
          <CopilotAssistant 
            workflowId={workflowId} 
            fetchExplain={fetchExplain} 
            explanationData={explanationData} 
            isExplaining={isExplaining} 
          />

          {/* Execution Output Panel */}
          <ExecutionOutputPanel />
        </div>

        <ConfigPanel onOpenGenerate={() => setPromptOpen(true)} />
      </div>

      {/* ── AI Generate Dialog ─────────────────────────────────────────── */}
      <AnimatePresence>
        {promptOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              className="bg-card border border-border p-6 rounded-2xl shadow-2xl shadow-black max-w-lg w-full mx-4 relative"
            >
              <button onClick={() => setPromptOpen(false)} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors">
                <X size={18} />
              </button>
              <h3 className="text-xl font-bold text-foreground mb-1 flex items-center gap-2">
                <Sparkles className="text-amber-400" size={20} /> Generate Workflow
              </h3>
              <p className="text-sm text-muted-foreground mb-5">Describe what you want to build and AI will create the nodes and connections.</p>
              <textarea
                autoFocus
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleGenerate(); }}
                placeholder="E.g., Fetch weather data from an API, summarize it with AI, and send an email with the result."
                className="w-full bg-background border border-border rounded-xl p-4 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 min-h-[120px] mb-4 resize-none"
              />
              <div className="flex justify-between items-center">
                <p className="text-xs text-muted-foreground">Ctrl+Enter to generate</p>
                <div className="flex gap-2">
                  <button onClick={() => setPromptOpen(false)} className="px-4 py-2 rounded-lg text-sm font-medium hover:bg-secondary transition-colors text-foreground">Cancel</button>
                  <button
                    onClick={handleGenerate}
                    disabled={generateMut.isPending || !prompt.trim()}
                    className="px-5 py-2 rounded-lg text-sm font-bold bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg disabled:opacity-50 flex items-center gap-2"
                  >
                    {generateMut.isPending ? <RefreshCw className="animate-spin" size={14} /> : <Wand2 size={14} />}
                    Generate
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Explain Dialog ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {explainOpen && explanationData && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              className="bg-card border border-border p-6 rounded-2xl shadow-2xl shadow-black max-w-lg w-full mx-4 relative max-h-[80vh] overflow-y-auto"
            >
              <button onClick={() => setExplainOpen(false)} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground">
                <X size={18} />
              </button>
              <h3 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
                <Wand2 className="text-cyan-400" size={20} /> Workflow Explanation
              </h3>
              <p className="text-foreground/90 leading-relaxed mb-5 text-sm">{explanationData.explanation}</p>
              <h4 className="text-foreground font-semibold mb-3 text-sm">Execution Steps:</h4>
              <ul className="space-y-2">
                {explanationData.steps.map((step: string, i: number) => (
                  <li key={i} className="flex gap-3 text-muted-foreground bg-secondary/50 p-3 rounded-lg border border-border text-sm">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">{i + 1}</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Run Dialog ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {runInputOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              className="bg-card border border-border p-6 rounded-2xl shadow-2xl shadow-black max-w-lg w-full mx-4 relative"
            >
              <button onClick={() => setRunInputOpen(false)} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground">
                <X size={18} />
              </button>
              <h3 className="text-xl font-bold text-foreground mb-1 flex items-center gap-2">
                <Play size={18} className="text-violet-400 fill-violet-400/30" /> Run Workflow
              </h3>
              <p className="text-sm text-muted-foreground mb-4">Provide the input text passed into the first node.</p>
              <textarea
                autoFocus
                value={runInput}
                onChange={e => setRunInput(e.target.value)}
                onKeyDown={e => { 
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { 
                    e.preventDefault(); 
                    if (!isExecuting) doExecute(); 
                  } 
                }}
                placeholder="E.g., Artificial intelligence is transforming every industry..."
                className="w-full bg-background border border-border rounded-xl p-4 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 min-h-[100px] mb-4 resize-none"
              />
              <div className="flex justify-between items-center">
                <p className="text-xs text-muted-foreground">Ctrl+Enter to run</p>
                <div className="flex gap-2">
                  <button onClick={() => setRunInputOpen(false)} disabled={isExecuting} className="px-4 py-2 rounded-lg text-sm font-medium hover:bg-secondary transition-colors text-foreground disabled:opacity-50">Cancel</button>
                  <button
                    onClick={doExecute}
                    disabled={isExecuting}
                    className="px-5 py-2 rounded-lg text-sm font-bold bg-gradient-to-r from-cyan-500 to-violet-600 text-white shadow-lg flex items-center gap-2 disabled:opacity-50"
                  >
                    {isExecuting ? (
                      <>
                        <Loader2 className="animate-spin" size={14} /> Running...
                      </>
                    ) : (
                      <>
                        <Play size={14} className="fill-white" /> Run Now
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function BuilderPage() {
  const [match, params] = useRoute('/workflows/:id');
  const { loadApiFormat, setWorkflowMeta, reset } = useWorkflowStore();
  const workflowId = match ? parseInt(params.id) : null;

  const { data, isLoading } = useGetWorkflow(workflowId || 0, {
    query: { enabled: !!workflowId } as any
  });

  useEffect(() => {
    if (workflowId && data) {
      loadApiFormat(data.nodes, data.edges);
      setWorkflowMeta({ id: data.id, name: data.name, description: data.description });
    } else if (!workflowId) {
      reset();
    }
  }, [workflowId, data]);

  return (
    <AppLayout>
      {(isLoading && workflowId) ? (
        <div className="flex-1 flex items-center justify-center">
          <RefreshCw className="w-8 h-8 text-primary animate-spin" />
        </div>
      ) : (
        <ReactFlowProvider>
          <BuilderCanvas />
        </ReactFlowProvider>
      )}
    </AppLayout>
  );
}
