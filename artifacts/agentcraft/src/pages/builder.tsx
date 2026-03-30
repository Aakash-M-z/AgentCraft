import { useCallback, useRef, useState, useEffect } from 'react';
import { useRoute } from 'wouter';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  Panel,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Save, Play, Wand2, RefreshCw, X, Sparkles } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { NodePalette } from '@/components/workflow/NodePalette';
import { ConfigPanel } from '@/components/workflow/ConfigPanel';
import { nodeTypes } from '@/components/workflow/CustomNodes';
import { useWorkflowStore } from '@/lib/store';
import { generateId } from '@/lib/utils';
import { 
  useGetWorkflow, 
  useCreateWorkflow, 
  useUpdateWorkflow, 
  useGenerateWorkflow,
  useStartExecution,
  useExplainWorkflow
} from '@workspace/api-client-react';
import { useToast } from '@/hooks/use-toast';

function BuilderCanvas() {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();
  const { toast } = useToast();
  
  const { 
    nodes, edges, onNodesChange, onEdgesChange, onConnect, 
    addNode, setSelectedNodeId, workflowId, workflowName, setWorkflowMeta,
    getApiFormat, loadApiFormat
  } = useWorkflowStore();

  const [promptOpen, setPromptOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [explainOpen, setExplainOpen] = useState(false);

  const createMut = useCreateWorkflow();
  const updateMut = useUpdateWorkflow();
  const generateMut = useGenerateWorkflow();
  const executeMut = useStartExecution();
  
  const { data: explanationData, refetch: fetchExplain, isFetching: isExplaining } = useExplainWorkflow(
    workflowId || 0, 
    { query: { enabled: false } }
  );

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

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const reactFlowBounds = reactFlowWrapper.current?.getBoundingClientRect();
      const dataStr = event.dataTransfer.getData('application/reactflow');
      
      if (!dataStr || !reactFlowBounds) return;
      
      const { type, label } = JSON.parse(dataStr);
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode = {
        id: generateId(),
        type,
        position,
        data: { label, config: {} },
      };

      addNode(newNode);
    },
    [screenToFlowPosition, addNode],
  );

  const handleSave = () => {
    const apiData = getApiFormat();
    if (workflowId) {
      updateMut.mutate(
        { id: workflowId, data: { name: workflowName, ...apiData } },
        {
          onSuccess: () => toast({ title: "Workflow saved!" })
        }
      );
    } else {
      createMut.mutate(
        { data: { name: workflowName, ...apiData } },
        {
          onSuccess: (res) => {
            setWorkflowMeta({ id: res.id });
            toast({ title: "Workflow created!" });
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
          toast({ title: "Workflow generated successfully!" });
        }
      }
    );
  };

  const handleExplain = () => {
    if (!workflowId) {
      toast({ title: "Please save the workflow first", variant: "destructive" });
      return;
    }
    fetchExplain().then(() => setExplainOpen(true));
  };

  const handleExecute = () => {
    if (!workflowId) {
      toast({ title: "Please save the workflow before running", variant: "destructive" });
      return;
    }
    executeMut.mutate(
      { data: { workflowId, input: "{}" } },
      {
        onSuccess: (res) => {
          toast({ title: "Execution started!" });
          window.location.href = `/executions/${res.id}`;
        }
      }
    );
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0a0a0a]">
      {/* Top Toolbar */}
      <div className="h-16 border-b border-border bg-card/80 backdrop-blur flex items-center justify-between px-6 z-20">
        <div className="flex items-center gap-4">
          <input 
            type="text" 
            value={workflowName}
            onChange={(e) => setWorkflowMeta({ name: e.target.value })}
            className="bg-transparent text-xl font-display font-bold text-foreground border-none outline-none focus:ring-2 focus:ring-primary/50 rounded px-2 py-1 w-64"
          />
          {workflowId && <span className="text-xs px-2 py-1 bg-secondary text-muted-foreground rounded-full">ID: {workflowId}</span>}
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setPromptOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-secondary text-foreground hover:bg-muted transition-colors border border-border"
          >
            <Sparkles size={16} className="text-amber-400" />
            AI Generate
          </button>
          <button 
            onClick={handleExplain}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-secondary text-foreground hover:bg-muted transition-colors border border-border"
          >
            <Wand2 size={16} className="text-accent" />
            Explain
          </button>
          <button 
            onClick={handleSave}
            disabled={createMut.isPending || updateMut.isPending}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-primary/10 text-primary hover:bg-primary/20 border border-primary/30 transition-colors"
          >
            {createMut.isPending || updateMut.isPending ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
            Save
          </button>
          <button 
            onClick={handleExecute}
            disabled={executeMut.isPending}
            className="flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-bold bg-gradient-to-r from-accent to-primary text-white shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:-translate-y-0.5 transition-all"
          >
            {executeMut.isPending ? <RefreshCw size={16} className="animate-spin" /> : <Play size={16} className="fill-white" />}
            Run Workflow
          </button>
        </div>
      </div>

      {/* Main Builder Area */}
      <div className="flex-1 flex overflow-hidden relative">
        <NodePalette />
        <div className="flex-1 h-full" ref={reactFlowWrapper}>
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
            className="bg-[#050505]"
          >
            <Background color="#2a2a2a" gap={24} size={2} />
            <Controls className="bg-card border border-border rounded-xl overflow-hidden" showInteractive={false} />
            <MiniMap 
              nodeColor={(n) => {
                switch(n.type) {
                  case 'input': return '#34d399';
                  case 'ai_agent': return '#8b5cf6';
                  case 'api_call': return '#60a5fa';
                  case 'condition': return '#fbbf24';
                  case 'loop': return '#f472b6';
                  case 'output': return '#f43f5e';
                  default: return '#555';
                }
              }}
              maskColor="rgba(0, 0, 0, 0.7)"
              className="!bg-card"
            />
          </ReactFlow>
        </div>
        <ConfigPanel />
      </div>

      {/* AI Generate Dialog */}
      {promptOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
          <div className="bg-card border border-border p-6 rounded-2xl shadow-2xl shadow-black max-w-lg w-full relative">
            <button onClick={() => setPromptOpen(false)} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground">
              <X size={20} />
            </button>
            <h3 className="text-xl font-bold text-foreground mb-2 flex items-center gap-2">
              <Sparkles className="text-amber-400" /> Auto-Generate Workflow
            </h3>
            <p className="text-sm text-muted-foreground mb-6">Describe the workflow you want to build and AI will construct the nodes and connections.</p>
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="E.g., An agent that fetches weather data from an API, uses AI to write a short summary, and outputs it."
              className="w-full bg-background border border-border rounded-xl p-4 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 min-h-[120px] mb-4 resize-none"
            />
            <div className="flex justify-end gap-3">
              <button onClick={() => setPromptOpen(false)} className="px-4 py-2 rounded-lg text-sm font-medium hover:bg-secondary transition-colors text-foreground">Cancel</button>
              <button 
                onClick={handleGenerate}
                disabled={generateMut.isPending || !prompt}
                className="px-6 py-2 rounded-lg text-sm font-bold bg-primary text-white shadow-lg shadow-primary/25 disabled:opacity-50 flex items-center gap-2"
              >
                {generateMut.isPending ? <RefreshCw className="animate-spin" size={16} /> : <Wand2 size={16} />}
                Generate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Explain Dialog */}
      {explainOpen && explanationData && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
          <div className="bg-card border border-border p-6 rounded-2xl shadow-2xl shadow-black max-w-lg w-full relative max-h-[80vh] overflow-y-auto">
            <button onClick={() => setExplainOpen(false)} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground">
              <X size={20} />
            </button>
            <h3 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
              <Wand2 className="text-accent" /> Workflow Explanation
            </h3>
            <div className="prose prose-invert max-w-none text-sm">
              <p className="text-foreground/90 leading-relaxed mb-6">{explanationData.explanation}</p>
              <h4 className="text-foreground font-semibold mb-3">Execution Steps:</h4>
              <ul className="space-y-2">
                {explanationData.steps.map((step, i) => (
                  <li key={i} className="flex gap-3 text-muted-foreground bg-secondary/50 p-3 rounded-lg border border-border">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">{i+1}</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function BuilderPage() {
  const [match, params] = useRoute('/workflows/:id');
  const { loadApiFormat, setWorkflowMeta, reset } = useWorkflowStore();
  const workflowId = match ? parseInt(params.id) : null;

  const { data, isLoading } = useGetWorkflow(workflowId || 0, {
    query: { enabled: !!workflowId }
  });

  useEffect(() => {
    if (workflowId && data) {
      loadApiFormat(data.nodes, data.edges);
      setWorkflowMeta({ id: data.id, name: data.name, description: data.description });
    } else if (!workflowId) {
      reset();
    }
  }, [workflowId, data, loadApiFormat, setWorkflowMeta, reset]);

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
