import { create } from 'zustand';
import {
  Connection,
  Edge,
  EdgeChange,
  Node,
  NodeChange,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
} from '@xyflow/react';
import type { WorkflowNodeType, WorkflowNode, WorkflowEdge } from '@workspace/api-client-react';

export type AppNodeData = {
  label: string;
  config: Record<string, any>;
};

export type AppNode = Node<AppNodeData, WorkflowNodeType>;

interface WorkflowState {
  nodes: AppNode[];
  edges: Edge[];
  selectedNodeId: string | null;
  workflowId: number | null;
  workflowName: string;
  workflowDescription: string;
  
  // Actions
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  setNodes: (nodes: AppNode[]) => void;
  setEdges: (edges: Edge[]) => void;
  addNode: (node: AppNode) => void;
  updateNodeData: (id: string, data: Partial<AppNodeData>) => void;
  setSelectedNodeId: (id: string | null) => void;
  setWorkflowMeta: (meta: { id?: number | null; name?: string; description?: string }) => void;
  reset: () => void;
  
  // Mappers
  getApiFormat: () => { nodes: WorkflowNode[]; edges: WorkflowEdge[] };
  loadApiFormat: (nodes: WorkflowNode[], edges: WorkflowEdge[]) => void;
}

const initialNodes: AppNode[] = [
  {
    id: 'trigger-1',
    type: 'input',
    position: { x: 250, y: 200 },
    data: { label: 'Manual Trigger', config: { inputSchema: '{}' } },
  },
];

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  nodes: initialNodes,
  edges: [],
  selectedNodeId: null,
  workflowId: null,
  workflowName: 'Untitled Workflow',
  workflowDescription: '',

  onNodesChange: (changes: NodeChange[]) => {
    set({
      nodes: applyNodeChanges(changes, get().nodes) as AppNode[],
    });
  },
  
  onEdgesChange: (changes: EdgeChange[]) => {
    set({
      edges: applyEdgeChanges(changes, get().edges),
    });
  },
  
  onConnect: (connection: Connection) => {
    set({
      edges: addEdge({ ...connection, animated: true }, get().edges),
    });
  },
  
  setNodes: (nodes: AppNode[]) => set({ nodes }),
  setEdges: (edges: Edge[]) => set({ edges }),
  
  addNode: (node: AppNode) => {
    set({ nodes: [...get().nodes, node] });
  },
  
  updateNodeData: (id: string, data: Partial<AppNodeData>) => {
    set({
      nodes: get().nodes.map((node) => {
        if (node.id === id) {
          return { ...node, data: { ...node.data, ...data } };
        }
        return node;
      }),
    });
  },
  
  setSelectedNodeId: (id: string | null) => set({ selectedNodeId: id }),
  
  setWorkflowMeta: (meta) => set((state) => ({ ...state, ...meta })),
  
  reset: () => set({ 
    nodes: initialNodes, 
    edges: [], 
    selectedNodeId: null, 
    workflowId: null, 
    workflowName: 'Untitled Workflow', 
    workflowDescription: '' 
  }),

  getApiFormat: () => {
    const { nodes, edges } = get();
    return {
      nodes: nodes.map(n => ({
        id: n.id,
        type: n.type as WorkflowNodeType,
        label: n.data.label,
        config: n.data.config,
        position: n.position
      })),
      edges: edges.map(e => ({
        id: e.id,
        source: e.source,
        target: e.target,
        label: e.label?.toString()
      }))
    };
  },

  loadApiFormat: (apiNodes, apiEdges) => {
    const nodes: AppNode[] = apiNodes.map(n => ({
      id: n.id,
      type: n.type,
      position: n.position,
      data: {
        label: n.label,
        config: n.config || {}
      }
    }));
    
    const edges: Edge[] = apiEdges.map(e => ({
      id: e.id,
      source: e.source,
      target: e.target,
      label: e.label,
      animated: true,
    }));
    
    set({ nodes, edges, selectedNodeId: null });
  }
}));
