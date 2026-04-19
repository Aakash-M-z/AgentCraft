import { useState, useEffect, useRef } from 'react';
import { API_BASE } from '@/lib/api';

export type WSEvent = {
  type: 'node_start' | 'node_complete' | 'node_failed' | 'execution_complete' | 'log' | 'execution_cancelled' | 'node_update' | 'error';
  nodeId?: string;
  status?: string;
  output?: Record<string, any>;
  message?: string;
  reasoning?: string;
  finalOutput?: string;
  executionId?: number;
};

export function useExecutionWebSocket(executionId: number | null) {
  const [events, setEvents] = useState<WSEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const evtSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!executionId) return;

    // Use API_BASE so SSE works in both dev (proxy) and production (Render URL)
    const sseUrl = `${API_BASE}/api/executions/${executionId}/stream`;
    console.log('🔌 SSE: Connecting to', sseUrl);

    const es = new EventSource(sseUrl);
    evtSourceRef.current = es;

    es.onopen = () => {
      console.log('✅ SSE: Connected');
      setIsConnected(true);
    };

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as WSEvent;
        console.log('📨 SSE EVENT:', data);

        // CRITICAL: Log completion events
        if (data.type === 'execution_complete') {
          console.log('🎉 SSE: Execution complete!', {
            status: data.status,
            finalOutput: data.finalOutput,
            outputLength: data.finalOutput?.length || 0
          });
        }

        setEvents((prev) => [...prev, data]);
      } catch (err) {
        console.error('❌ SSE: Failed to parse message', err, event.data);
      }
    };

    es.onerror = (err) => {
      console.error('❌ SSE: Connection error', err);
      setIsConnected(false);
    };

    return () => {
      console.log('🔌 SSE: Disconnecting');
      es.close();
      setIsConnected(false);
    };
  }, [executionId]);

  return { events, isConnected, setEvents };
}
