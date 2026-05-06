import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuid } from 'uuid';
import { api, asMessage } from '../lib/api';
import { db, enqueue } from '../lib/db';
import { getCurrentPosition } from '../lib/gps';

export function CustomerCreate() {
  const navigate = useNavigate();
  const [storeName, setStoreName] = useState('');
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const grabGps = async () => {
    try {
      const p = await getCurrentPosition();
      setLatitude(p.coords.latitude);
      setLongitude(p.coords.longitude);
    } catch (e) {
      setErr(`GPS error: ${(e as Error).message}`);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeName.trim()) {
      setErr('اسم المحل مطلوب');
      return;
    }
    setBusy(true); setErr(null);
    const payload = {
      storeName, contactName, phone, address,
      latitude: latitude ?? undefined,
      longitude: longitude ?? undefined,
    };
    try {
      if (navigator.onLine) {
        const { data } = await api.post('/customers', payload);
        await db.customers.put({
          id: data.id, code: data.code, storeName: data.storeName,
          contactName: data.contactName ?? null, phone: data.phone ?? null,
          address: data.address ?? null, latitude: data.latitude ?? null,
          longitude: data.longitude ?? null, balance: data.balance ?? '0',
        });
      } else {
        // Optimistic local insert + queue
        const tempId = uuid();
        await db.customers.put({
          id: tempId,
          code: 'PENDING',
          storeName, contactName: contactName || null, phone: phone || null,
          address: address || null, latitude, longitude,
          balance: '0', pendingSync: true,
        });
        await enqueue({ kind: 'customer.create', payload, clientUuid: tempId });
      }
      navigate('/customers', { replace: true });
    } catch (e) {
      setErr(asMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <h1 className="text-lg font-bold">عميل جديد</h1>

      <Field label="اسم المحل *" value={storeName} onChange={setStoreName} required />
      <Field label="اسم جهة الاتصال" value={contactName} onChange={setContactName} />
      <Field label="الهاتف" value={phone} onChange={setPhone} />
      <Field label="العنوان" value={address} onChange={setAddress} />

      <div className="bg-white border rounded-xl p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">موقع المحل (GPS)</span>
          <button type="button" onClick={grabGps} className="text-xs text-indigo-600">
            استخدم موقعي
          </button>
        </div>
        {latitude != null && (
          <div className="text-[11px] text-slate-500">
            {latitude.toFixed(5)}, {longitude!.toFixed(5)}
          </div>
        )}
      </div>

      {err && <div className="text-sm text-red-600">{err}</div>}

      <button type="submit" disabled={busy}
        className="w-full bg-indigo-600 disabled:opacity-60 text-white rounded-xl py-3 font-semibold">
        {busy ? '...' : 'حفظ'}
      </button>
    </form>
  );
}

function Field({ label, value, onChange, required }: { label: string; value: string; onChange: (v: string) => void; required?: boolean }) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <input
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className="block w-full border border-slate-300 rounded-xl px-3 py-3 bg-white mt-1"
      />
    </label>
  );
}
