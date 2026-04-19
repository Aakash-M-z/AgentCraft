import { create } from 'zustand';

export type ExecutionStatus = 'idle' | 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

interface ExecutionState {
    // Current execution state
    executionId: number | null;
    status: ExecutionStatus;
    logs: string[];
    finalOutput: string | null;
    nodeStates: Record<string, string>;

    // Actions
    startExecution: (executionId: number) => void;
    addLog: (log: string) => void;
    setStatus: (status: ExecutionStatus) => void;
    setFinalOutput: (output: string) => void;
    updateNodeState: (nodeId: string, status: string) => void;
    reset: () => void;
}

const initialState = {
    executionId: null,
    status: 'idle' as ExecutionStatus,
    logs: [],
    finalOutput: null,
    nodeStates: {},
};

export const useExecutionStore = create<ExecutionState>((set) => ({
    ...initialState,

    startExecution: (executionId: number) => set({
        executionId,
        status: 'pending',
        logs: [],
        finalOutput: null,
        nodeStates: {},
    }),

    addLog: (log: string) => set((state) => ({
        logs: [...state.logs, log],
    })),

    setStatus: (status: ExecutionStatus) => set({ status }),

    setFinalOutput: (output: string) => set({ finalOutput: output }),

    updateNodeState: (nodeId: string, status: string) => set((state) => ({
        nodeStates: { ...state.nodeStates, [nodeId]: status },
    })),

    reset: () => set(initialState),
}));
