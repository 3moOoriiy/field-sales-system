import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { api } from '../lib/api';
import { fmtDate, timeAgo } from '../lib/format';
import { useRealtime } from '../components/RealtimeProvider';

// Default Leaflet marker icons reference image assets via the bundler. Override
// to a simple coloured pin so we don't have to bundle the default icons.
const onlineIcon = L.divIcon({
  className: '',
  html: '<div style="width:14px;height:14px;border-radius:50%;background:#10b981;box-shadow:0 0 0 2px white,0 0 0 4px rgba(16,185,129,.3)"></div>',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});
const offlineIcon = L.divIcon({
  className: '',
  html: '<div style="width:14px;height:14px;border-radius:50%;background:#94a3b8;box-shadow:0 0 0 2px white"></div>',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

interface AgentLive {
  id: string;
  username: string;
  fullName: string;
  isOnline: boolean;
  lastLocation: {
    latitude: number; longitude: number;
    accuracy: number | null; speed: number | null;
    recordedAt: string;
  } | null;
}

interface HistoryPoint {
  id: string; latitude: number; longitude: number; recordedAt: string;
}

export function LiveMap() {
  const { liveLocations } = useRealtime();
  const live = useQuery({
    queryKey: ['tracking', 'live'],
    queryFn: async () => (await api.get<AgentLive[]>('/tracking/agents-live')).data,
    refetchInterval: 30_000,
  });
  const [selected, setSelected] = useState<string | null>(null);
  const [historyDate, setHistoryDate] = useState<string>(() => new Date().toISOString().slice(0, 10));

  // Merge realtime updates onto the snapshot
  const agents = useMemo(() => {
    const map = new Map<string, AgentLive>();
    for (const a of live.data ?? []) map.set(a.id, a);
    for (const [id, ev] of liveLocations) {
      const cur = map.get(id);
      if (cur) {
        map.set(id, {
          ...cur,
          isOnline: true,
          lastLocation: {
            latitude: ev.latitude, longitude: ev.longitude,
            accuracy: ev.accuracy ?? null, speed: ev.speed ?? null,
            recordedAt: ev.recordedAt,
          },
        });
      }
    }
    return Array.from(map.values());
  }, [live.data, liveLocations]);

  const history = useQuery({
    enabled: !!selected,
    queryKey: ['tracking', 'history', selected, historyDate],
    queryFn: async () => {
      const from = new Date(historyDate); from.setHours(0, 0, 0, 0);
      const to = new Date(historyDate); to.setHours(23, 59, 59, 999);
      const { data } = await api.get<HistoryPoint[]>('/tracking/agent-history', {
        params: { agentId: selected!, from: from.toISOString(), to: to.toISOString() },
      });
      return data;
    },
  });

  // Compute reasonable initial bounds
  const center: [number, number] = (() => {
    const withLoc = agents.find((a) => a.lastLocation);
    if (withLoc?.lastLocation) return [withLoc.lastLocation.latitude, withLoc.lastLocation.longitude];
    return [24.7136, 46.6753]; // Riyadh fallback
  })();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[18rem_1fr] gap-4 h-[calc(100vh-9rem)]">
      <aside className="bg-white border rounded-2xl p-3 overflow-y-auto">
        <h3 className="font-semibold mb-2 text-sm">المندوبون ({agents.length})</h3>
        <ul className="space-y-1">
          {agents.map((a) => (
            <li key={a.id}>
              <button
                onClick={() => setSelected(a.id)}
                className={`w-full text-start px-2 py-2 rounded-lg flex items-center justify-between ${
                  selected === a.id ? 'bg-indigo-50' : 'hover:bg-slate-50'
                }`}
              >
                <div>
                  <div className="text-sm font-semibold">{a.fullName}</div>
                  <div className="text-[11px] text-slate-500">
                    {a.lastLocation ? timeAgo(a.lastLocation.recordedAt) : 'لا يوجد موقع'}
                  </div>
                </div>
                <span className={`w-2 h-2 rounded-full ${a.isOnline ? 'bg-emerald-500' : 'bg-slate-300'}`} />
              </button>
            </li>
          ))}
          {agents.length === 0 && (
            <li className="text-xs text-slate-500 text-center py-4">لا يوجد مندوبون.</li>
          )}
        </ul>

        {selected && (
          <div className="mt-4 border-t pt-3">
            <h4 className="text-xs font-bold mb-2">سجل الحركة</h4>
            <input
              type="date"
              value={historyDate}
              onChange={(e) => setHistoryDate(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-xs"
            />
            {history.isLoading && <div className="text-[11px] text-slate-500 mt-2">جارٍ التحميل…</div>}
            {history.data && (
              <div className="text-[11px] text-slate-500 mt-2">
                {history.data.length} نقطة
              </div>
            )}
          </div>
        )}
      </aside>

      <div className="bg-white border rounded-2xl overflow-hidden">
        <MapContainer center={center} zoom={11} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FitToAgents agents={agents} />

          {agents.map((a) => a.lastLocation && (
            <Marker
              key={a.id}
              position={[a.lastLocation.latitude, a.lastLocation.longitude]}
              icon={a.isOnline ? onlineIcon : offlineIcon}
              eventHandlers={{ click: () => setSelected(a.id) }}
            >
              <Popup>
                <div className="text-xs">
                  <div className="font-bold">{a.fullName}</div>
                  <div>{a.username}</div>
                  <div className="text-slate-500">{fmtDate(a.lastLocation.recordedAt)}</div>
                  {a.lastLocation.accuracy != null && (
                    <div className="text-slate-500">±{Math.round(a.lastLocation.accuracy)}م</div>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}

          {history.data && history.data.length > 1 && (
            <Polyline
              positions={history.data.map((p) => [p.latitude, p.longitude])}
              pathOptions={{ color: '#4f46e5', weight: 3 }}
            />
          )}
        </MapContainer>
      </div>
    </div>
  );
}

function FitToAgents({ agents }: { agents: AgentLive[] }) {
  const map = useMap();
  useEffect(() => {
    const points = agents
      .map((a) => a.lastLocation)
      .filter((l): l is NonNullable<typeof l> => !!l)
      .map((l): [number, number] => [l.latitude, l.longitude]);
    if (points.length >= 2) {
      map.fitBounds(points, { padding: [40, 40] });
    } else if (points.length === 1) {
      map.setView(points[0], 14);
    }
  }, [agents, map]);
  return null;
}
