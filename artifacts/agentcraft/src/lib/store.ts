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

export type NodeExecutionStatus = 'idle' | 'running' | 'success' | 'failed';

export type NodeDebugInfo = {
  input?: string;
  output?: string;
  executionTime?: number;
  error?: string;
  status: NodeExecutionStatus;
};

interface WorkflowState {
  nodes: AppNode[];
  edges: Edge[];
  selectedNodeId: string | null;
  workflowId: number | null;
  workflowName: string;
  workflowDescription: string;

  // Live execution state (used in builder during run)
  nodeExecutionStatus: Record<string, NodeExecutionStatus>;
  nodeDebugInfo: Record<string, NodeDebugInfo>;
  isExecuting: boolean;
  executionProgress: { current: number; total: number } | null;
  finalOutput: string | null;
  executionStatus: 'idle' | 'running' | 'completed' | 'failed' | null;

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
  setNodeExecutionStatus: (nodeId: string, status: NodeExecutionStatus) => void;
  setNodeDebugInfo: (nodeId: string, info: NodeDebugInfo) => void;
  setIsExecuting: (v: boolean) => void;
  setExecutionProgress: (p: { current: number; total: number } | null) => void;
  setFinalOutput: (output: string | null) => void;
  setExecutionStatus: (status: 'idle' | 'running' | 'completed' | 'failed' | null) => void;
  clearExecutionState: () => void;

  // Mappers
  getApiFormat: () => { nodes: WorkflowNode[]; edges: WorkflowEdge[] };
  loadApiFormat: (nodes: WorkflowNode[], edges: WorkflowEdge[]) => void;
}

const initialNodes: AppNode[] = [];

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  nodes: initialNodes,
  edges: [],
  selectedNodeId: null,
  workflowId: null,
  workflowName: 'Untitled Workflow',
  workflowDescription: '',
  nodeExecutionStatus: {},
  nodeDebugInfo: {},
  isExecuting: false,
  executionProgress: null,
  finalOutput: null,
  executionStatus: null,

  onNodesChange: (changes: NodeChange[]) => {
    set({ nodes: applyNodeChanges(changes, get().nodes) as AppNode[] });
  },
  onEdgesChange: (changes: EdgeChange[]) => {
    set({ edges: applyEdgeChanges(changes, get().edges) });
  },
  onConnect: (connection: Connection) => {
    set({ edges: addEdge({ ...connection, animated: true }, get().edges) });
  },
  setNodes: (nodes: AppNode[]) => set({ nodes }),
  setEdges: (edges: Edge[]) => set({ edges }),
  addNode: (node: AppNode) => {
    set({ nodes: [...get().nodes, node] });
  },
  updateNodeData: (id: string, data: Partial<AppNodeData>) => {
    set({
      nodes: get().nodes.map((node) =>
        node.id === id ? { ...node, data: { ...node.data, ...data } } : node
      ),
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
    workflowDescription: '',
    nodeExecutionStatus: {},
    nodeDebugInfo: {},
    isExecuting: false,
    executionProgress: null,
    finalOutput: null,
    executionStatus: null,
  }),
  setNodeExecutionStatus: (nodeId, status) =>
    set((s) => ({ nodeExecutionStatus: { ...s.nodeExecutionStatus, [nodeId]: status } })),
  setNodeDebugInfo: (nodeId, info) =>
    set((s) => ({ nodeDebugInfo: { ...s.nodeDebugInfo, [nodeId]: info } })),
  setIsExecuting: (v) => set({ isExecuting: v }),
  setExecutionProgress: (p) => set({ executionProgress: p }),
  setFinalOutput: (output) => set({ finalOutput: output }),
  setExecutionStatus: (status) => set({ executionStatus: status }),
  clearExecutionState: () => set({
    nodeExecutionStatus: {},
    nodeDebugInfo: {},
    isExecuting: false,
    executionProgress: null,
    finalOutput: null,
    executionStatus: null,
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
      data: { label: n.label, config: n.config || {} }
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
