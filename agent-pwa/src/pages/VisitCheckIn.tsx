import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, asMessage } from '../lib/api';
import { getCurrentPosition } from '../lib/gps';
import { PhotoUpload } from '../components/PhotoUpload';

export function VisitCheckIn() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const taskId = params.get('taskId') ?? undefined;
  const customerId = params.get('customerId') ?? undefined;
  const storeName = params.get('storeName') ?? '';

  const [pos, setPos] = useState<GeolocationPosition | null>(null);
  const [posErr, setPosErr] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [visitId, setVisitId] = useState<string | null>(null);
  const [distance, setDistance] = useState<number | null>(null);

  useEffect(() => {
    getCurrentPosition().then(setPos).catch((e: Error) => setPosErr(e.message));
  }, []);

  const submit = async () => {
    if (!pos) return;
    setBusy(true); setErr(null);
    try {
      const { data } = await api.post('/visits/check-in', {
        taskId, customerId,
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        notes: notes || undefined,
      });
      setVisitId(data.id);
      setDistance(data.distanceMeters ?? null);
    } catch (e) {
      setErr(asMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (visitId) {
    return (
      <div className="space-y-4 text-center">
        <div className="bg-emerald-50 text-emerald-800 rounded-2xl p-6">
          <div className="text-3xl mb-1">✓</div>
          <div className="font-bold">تم تسجيل دخولك في {storeName}</div>
          {distance != null && (
            <div className="text-xs mt-1">المسافة من المحل: {distance} م</div>
          )}
        </div>

        <section className="bg-white border rounded-2xl p-4 space-y-2 text-right">
          <h3 className="text-sm font-bold">صور الزيارة</h3>
          <PhotoUpload parent={{ visitId }} kind="VISIT_PHOTO" />
        </section>

        <button
          onClick={() => navigate(`/visits/check-out?visitId=${visitId}&storeName=${encodeURIComponent(storeName)}`, { replace: true })}
          className="w-full bg-amber-600 text-white rounded-xl py-3 font-semibold"
        >
          الانتقال لتسجيل الخروج
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h1 className="text-lg font-bold">تسجيل دخول الزيارة</h1>
      <div className="bg-white border rounded-2xl p-4 text-sm">{storeName}</div>

      <div className="bg-white border rounded-2xl p-4 text-sm space-y-1">
        {posErr && <div className="text-rose-600 text-xs">GPS error: {posErr}</div>}
        {!pos && !posErr && <div className="text-slate-500 text-xs">جاري قراءة الموقع…</div>}
        {pos && (
          <div className="text-xs text-slate-600">
            موقعي: {pos.coords.latitude.toFixed(5)}, {pos.coords.longitude.toFixed(5)} (±{Math.round(pos.coords.accuracy)} م)
          </div>
        )}
      </div>

      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="ملاحظات الزيارة…"
        rows={3}
        className="w-full border border-slate-300 rounded-xl px-3 py-2 bg-white text-sm"
      />

      {err && <div className="text-sm text-red-600">{err}</div>}

      <button
        disabled={busy || !pos}
        onClick={submit}
        className="w-full bg-indigo-600 disabled:opacity-50 text-white rounded-xl py-3 font-semibold"
      >
        {busy ? '...' : 'تسجيل دخول'}
      </button>
      <p className="text-[11px] text-slate-500 text-center">
        يجب أن تكون ضمن 100م من موقع المحل المسجّل.
      </p>
    </div>
  );
}
