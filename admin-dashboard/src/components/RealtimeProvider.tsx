import { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { connectSocket } from '../lib/socket';

export interface AgentLocationEvent {
  agentId: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  speed?: number;
  recordedAt: string;
}

interface AlertEvent {
  id: string;
  kind: 'invoice.created' | 'invoice.cancelled' | 'return.created' | 'payment.created' | 'visit.checkin' | 'alert.limit_exceeded';
  payload: unknown;
  at: number;
}

interface RealtimeCtx {
  /** Latest GPS position per agent, keyed by agentId */
  liveLocations: Map<string, AgentLocationEvent>;
  /** Recent alerts (capped at 50) */
  alerts: AlertEvent[];
  /** Subscribe to one named event manually */
  on: (event: string, handler: (data: unknown) => void) => () => void;
}

const Ctx = createContext<RealtimeCtx | null>(null);

const ALERT_EVENTS: AlertEvent['kind'][] = [
  'invoice.created', 'invoice.cancelled', 'return.created',
  'payment.created', 'visit.checkin', 'alert.limit_exceeded',
];

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [liveLocations, setLive] = useState<Map<string, AgentLocationEvent>>(() => new Map());
  const [alerts, setAlerts] = useState<AlertEvent[]>([]);
  const handlersRef = useRef(new Map<string, Set<(data: unknown) => void>>());

  const on = useCallback((event: string, handler: (data: unknown) => void) => {
    let set = handlersRef.current.get(event);
    if (!set) { set = new Set(); handlersRef.current.set(event, set); }
    set.add(handler);
    return () => { set!.delete(handler); };
  }, []);

  useEffect(() => {
    const socket = connectSocket();
    if (!socket) return;

    const onLocation = (data: AgentLocationEvent) => {
      setLive((prev) => {
        const next = new Map(prev);
        next.set(data.agentId, data);
        return next;
      });
      handlersRef.current.get('agent.location')?.forEach((h) => h(data));
    };

    const pushAlert = (kind: AlertEvent['kind']) => (payload: unknown) => {
      const a: AlertEvent = { id: crypto.randomUUID(), kind, payload, at: Date.now() };
      setAlerts((prev) => [a, ...prev].slice(0, 50));
      // Invalidate the matching list query so the relevant page refetches
      switch (kind) {
        case 'invoice.created':
        case 'invoice.cancelled':
          qc.invalidateQueries({ queryKey: ['invoices'] });
          qc.invalidateQueries({ queryKey: ['dashboard'] });
          break;
        case 'return.created':
          qc.invalidateQueries({ queryKey: ['returns'] });
          break;
        case 'payment.created':
          qc.invalidateQueries({ queryKey: ['payments'] });
          break;
        case 'visit.checkin':
          qc.invalidateQueries({ queryKey: ['visits'] });
          break;
      }
      handlersRef.current.get(kind)?.forEach((h) => h(payload));
    };

    socket.on('agent.location', onLocation);
    const detachers = ALERT_EVENTS.map((k) => {
      const fn = pushAlert(k);
      socket.on(k, fn);
      return () => socket.off(k, fn);
    });

    return () => {
      socket.off('agent.location', onLocation);
      detachers.forEach((d) => d());
    };
  }, [qc]);

  return <Ctx.Provider value={{ liveLocations, alerts, on }}>{children}</Ctx.Provider>;
}

export function useRealtime(): RealtimeCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useRealtime must be used inside RealtimeProvider');
  return ctx;
}
