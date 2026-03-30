import { useWorkflowStore } from "@/lib/store";
import { WorkflowNodeType } from "@workspace/api-client-react";

export function ConfigPanel() {
  const { nodes, selectedNodeId, updateNodeData } = useWorkflowStore();
  
  if (!selectedNodeId) {
    return (
      <div className="w-80 border-l border-border bg-card/50 backdrop-blur-xl h-full flex flex-col items-center justify-center text-muted-foreground p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-4">
          <div className="w-8 h-8 rounded-full border-2 border-dashed border-muted-foreground/50 animate-spin-slow" />
        </div>
        <p className="font-medium text-foreground">No Node Selected</p>
        <p className="text-sm mt-2">Select a node on the canvas to configure its properties.</p>
      </div>
    );
  }

  const node = nodes.find(n => n.id === selectedNodeId);
  if (!node) return null;

  const handleChange = (key: string, value: any) => {
    updateNodeData(node.id, {
      config: { ...node.data.config, [key]: value }
    });
  };

  return (
    <div className="w-80 border-l border-border bg-card h-full flex flex-col shadow-2xl z-10 overflow-y-auto">
      <div className="p-4 border-b border-border bg-secondary/50">
        <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
          Configuration
        </h3>
        <p className="text-xs text-muted-foreground capitalize mt-1 border border-border inline-block px-2 py-0.5 rounded bg-background">
          Type: {node.type?.replace('_', ' ')}
        </p>
      </div>

      <div className="p-6 flex flex-col gap-6">
        <div className="space-y-2">
          <label className="text-sm font-semibold text-foreground">Node Label</label>
          <input 
            type="text" 
            value={node.data.label} 
            onChange={(e) => updateNodeData(node.id, { label: e.target.value })}
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all"
          />
        </div>

        <div className="h-[1px] bg-border w-full" />

        {/* Dynamic Config Fields based on Type */}
        {node.type === WorkflowNodeType.ai_agent && (
          <>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">System Prompt</label>
              <textarea 
                value={node.data.config.systemPrompt || ''} 
                onChange={(e) => handleChange('systemPrompt', e.target.value)}
                rows={4}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all resize-none"
                placeholder="You are a helpful assistant..."
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Model</label>
              <select 
                value={node.data.config.model || 'gpt-4o'} 
                onChange={(e) => handleChange('model', e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all"
              >
                <option value="gpt-4o">GPT-4o</option>
                <option value="gpt-5.2">GPT-5.2</option>
                <option value="claude-3-sonnet">Claude 3 Sonnet</option>
              </select>
            </div>
          </>
        )}

        {node.type === WorkflowNodeType.api_call && (
          <>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Endpoint URL</label>
              <input 
                type="text" 
                value={node.data.config.url || ''} 
                onChange={(e) => handleChange('url', e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all"
                placeholder="https://api.example.com/data"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Method</label>
              <select 
                value={node.data.config.method || 'GET'} 
                onChange={(e) => handleChange('method', e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all"
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="DELETE">DELETE</option>
              </select>
            </div>
          </>
        )}

        {node.type === WorkflowNodeType.condition && (
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground">Condition Expression (JS)</label>
            <textarea 
              value={node.data.config.expression || ''} 
              onChange={(e) => handleChange('expression', e.target.value)}
              rows={3}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono text-xs focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all resize-none"
              placeholder="input.score > 0.8"
            />
          </div>
        )}

        {(node.type === WorkflowNodeType.input || node.type === WorkflowNodeType.output) && (
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground">JSON Schema</label>
            <textarea 
              value={node.data.config.schema || '{}'} 
              onChange={(e) => handleChange('schema', e.target.value)}
              rows={6}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono text-xs focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all resize-none"
              placeholder="{}"
            />
          </div>
        )}
      </div>
    </div>
  );
}
