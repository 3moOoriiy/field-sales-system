import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, asMessage } from '../lib/api';
import { enqueue } from '../lib/db';
import { getCurrentPosition } from '../lib/gps';

export function VisitCheckOut() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const visitId = params.get('visitId')!;
  const storeName = params.get('storeName') ?? '';

  const [pos, setPos] = useState<GeolocationPosition | null>(null);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    getCurrentPosition().then(setPos).catch(() => { /* allow without */ });
  }, []);

  const submit = async () => {
    if (!pos) { setErr('GPS مطلوب'); return; }
    setBusy(true); setErr(null);
    const body = {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      notes: notes || undefined,
    };
    try {
      if (navigator.onLine) {
        await api.post(`/visits/${visitId}/check-out`, body);
      } else {
        await enqueue({ kind: 'visit.checkout', payload: { visitId, ...body } });
      }
      navigate('/visits', { replace: true });
    } catch (e) {
      setErr(asMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <h1 className="text-lg font-bold">تسجيل خروج</h1>
      <div className="bg-white border rounded-2xl p-4 text-sm">{storeName}</div>

      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="ملخص الزيارة…"
        rows={4}
        className="w-full border border-slate-300 rounded-xl px-3 py-2 bg-white text-sm"
      />

      {err && <div className="text-sm text-red-600">{err}</div>}

      <button
        disabled={busy}
        onClick={submit}
        className="w-full bg-amber-600 disabled:opacity-60 text-white rounded-xl py-3 font-semibold"
      >
        {busy ? '...' : 'تسجيل خروج'}
      </button>
    </div>
  );
}
