import { useState, useEffect, useRef } from 'react';
import { API_BASE } from '@/lib/api';

export type WSEvent = {
  type: 'node_start' | 'node_complete' | 'node_failed' | 'execution_complete' | 'log' | 'execution_cancelled';
  nodeId?: string;
  status?: string;
  output?: Record<string, any>;
  message?: string;
  reasoning?: string;
  finalOutput?: string;
};

export function useExecutionWebSocket(executionId: number | null) {
  const [events, setEvents] = useState<WSEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const evtSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!executionId) return;

    // Use API_BASE so SSE works in both dev (proxy) and production (Render URL)
    const sseUrl = `${API_BASE}/api/executions/${executionId}/stream`;

    const es = new EventSource(sseUrl);
    evtSourceRef.current = es;

    es.onopen = () => setIsConnected(true);

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as WSEvent;
        setEvents((prev) => [...prev, data]);
      } catch (err) {
        console.error('Failed to parse SSE message', err);
      }
    };

    es.onerror = () => setIsConnected(false);

    return () => {
      es.close();
      setIsConnected(false);
    };
  }, [executionId]);

  return { events, isConnected, setEvents };
}
