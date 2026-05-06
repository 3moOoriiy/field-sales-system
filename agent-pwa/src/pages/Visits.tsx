import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { db } from '../lib/db';
import { fmtDate } from '../lib/format';

interface VisitTask {
  id: string;
  scheduledAt: string;
  status: string;
  notes: string | null;
  customer: {
    id: string; storeName: string; address: string | null;
    latitude: number | null; longitude: number | null;
  };
  visit?: { id: string; status: string; checkInAt: string | null } | null;
}

export function Visits() {
  const [tasks, setTasks] = useState<VisitTask[]>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      // hydrate from cache
      const cached = await db.visitTasks.toArray();
      if (mounted && cached.length) {
        // only used for offline preview; full task data needs server
      }
      try {
        const { data } = await api.get<{ items: VisitTask[] }>('/visits/tasks', {
          params: { take: 50 },
        });
        if (mounted) {
          setTasks(data.items);
          await db.visitTasks.clear();
          await db.visitTasks.bulkPut(data.items.map((t) => ({
            id: t.id, customerId: t.customer.id, customerName: t.customer.storeName,
            scheduledAt: t.scheduledAt, status: t.status,
          })));
        }
      } catch { /* offline */ }
    })();
    return () => { mounted = false; };
  }, []);

  return (
    <div className="space-y-3">
      <h1 className="text-lg font-bold">زيارات اليوم</h1>
      {tasks.length === 0 && (
        <div className="text-xs text-slate-500 bg-white border rounded-xl p-4 text-center">
          لا توجد مهام زيارة.
        </div>
      )}
      <ul className="space-y-2">
        {tasks.map((t) => (
          <li key={t.id} className="bg-white border rounded-xl p-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-sm">{t.customer.storeName}</div>
                <div className="text-[11px] text-slate-500">
                  {fmtDate(t.scheduledAt)} · {t.customer.address ?? '-'}
                </div>
              </div>
              <span className={`text-[10px] px-2 py-1 rounded ${
                t.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700'
                : t.status === 'IN_PROGRESS' ? 'bg-amber-100 text-amber-700'
                : 'bg-slate-100 text-slate-700'
              }`}>
                {t.status}
              </span>
            </div>
            {t.status === 'PLANNED' && (
              <Link
                to={`/visits/check-in?taskId=${t.id}&customerId=${t.customer.id}&storeName=${encodeURIComponent(t.customer.storeName)}`}
                className="mt-2 block text-center bg-indigo-600 text-white text-sm rounded-lg py-2"
              >
                تسجيل دخول الزيارة
              </Link>
            )}
            {t.visit && t.status === 'IN_PROGRESS' && (
              <Link
                to={`/visits/check-out?visitId=${t.visit.id}&storeName=${encodeURIComponent(t.customer.storeName)}`}
                className="mt-2 block text-center bg-amber-600 text-white text-sm rounded-lg py-2"
              >
                تسجيل خروج
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
