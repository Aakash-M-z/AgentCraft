import { useState, useEffect, useRef, useCallback } from 'react';
import { API_BASE } from '@/lib/api';

export type ExecutionStreamEvent = {
  type:
    | 'node_start'
    | 'node_complete'
    | 'node_failed'
    | 'execution_complete'
    | 'log'
    | 'execution_cancelled'
    | 'node_update'
    | 'error';
  nodeId?: string;
  status?: string;
  output?: Record<string, unknown>;
  message?: string;
  reasoning?: string;
  finalOutput?: string;
  executionId?: number;
};

export type SseConnectionState = 'connected' | 'reconnecting' | 'disconnected';

const TERMINAL_STATUSES = new Set(['completed', 'failed', 'cancelled']);
const INITIAL_RECONNECT_MS = 3000;
const MAX_RECONNECT_MS = 30000;

export type UseExecutionStreamOptions = {
  onEvent?: (event: ExecutionStreamEvent) => void;
  enabled?: boolean;
};

export function useExecutionStream(
  executionId: number | null,
  options?: UseExecutionStreamOptions,
) {
  const [events, setEvents] = useState<ExecutionStreamEvent[]>([]);
  const [connectionState, setConnectionState] =
    useState<SseConnectionState>('disconnected');
  const evtSourceRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef(0);
  const stoppedRef = useRef(false);
  const onEventRef = useRef(options?.onEvent);
  onEventRef.current = options?.onEvent;

  const handleEvent = useCallback((data: ExecutionStreamEvent) => {
    setEvents((prev) => [...prev, data]);
    onEventRef.current?.(data);
    if (
      data.type === 'execution_complete' &&
      data.status &&
      TERMINAL_STATUSES.has(data.status)
    ) {
      stoppedRef.current = true;
    }
  }, []);

  const connectExecutionStream = useCallback(() => {
    if (!executionId || stoppedRef.current) return;

    evtSourceRef.current?.close();
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    const sseUrl = `${API_BASE}/api/executions/${executionId}/stream`;
    const es = new EventSource(sseUrl);
    evtSourceRef.current = es;

    es.addEventListener('heartbeat', () => {
      // keepalive — no UI update needed
    });

    es.onopen = () => {
      setConnectionState('connected');
      reconnectAttemptRef.current = 0;
    };

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as ExecutionStreamEvent;
        handleEvent(data);
      } catch (err) {
        console.error('SSE: Failed to parse message', err);
      }
    };

    es.onerror = () => {
      es.close();
      evtSourceRef.current = null;

      if (stoppedRef.current) {
        setConnectionState('disconnected');
        return;
      }

      setConnectionState('reconnecting');
      console.warn('SSE disconnected. Reconnecting...');

      const attempt = reconnectAttemptRef.current;
      reconnectAttemptRef.current += 1;
      const delay = Math.min(
        INITIAL_RECONNECT_MS * Math.pow(1.5, attempt),
        MAX_RECONNECT_MS,
      );
      reconnectTimerRef.current = setTimeout(() => {
        connectExecutionStream();
      }, delay);
    };
  }, [executionId, handleEvent]);

  useEffect(() => {
    if (!executionId || options?.enabled === false) {
      return;
    }

    stoppedRef.current = false;
    reconnectAttemptRef.current = 0;
    connectExecutionStream();

    return () => {
      stoppedRef.current = true;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      evtSourceRef.current?.close();
      evtSourceRef.current = null;
      setConnectionState('disconnected');
    };
  }, [executionId, options?.enabled, connectExecutionStream]);

  return {
    events,
    setEvents,
    connectionState,
    isConnected: connectionState === 'connected',
    connectExecutionStream,
  };
}

/** @deprecated Use useExecutionStream */
export function useExecutionWebSocket(executionId: number | null) {
  const { events, setEvents, isConnected, connectionState } =
    useExecutionStream(executionId);
  return { events, isConnected, connectionState, setEvents };
}
