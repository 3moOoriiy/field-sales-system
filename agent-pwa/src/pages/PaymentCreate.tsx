import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, asMessage } from '../lib/api';
import { db, enqueue, CachedCustomer } from '../lib/db';
import { getCurrentPosition } from '../lib/gps';
import { fmtMoney } from '../lib/format';

export function PaymentCreate() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<CachedCustomer[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [amount, setAmount] = useState<number>(0);
  const [method, setMethod] = useState<'CASH' | 'BANK_TRANSFER' | 'CHEQUE' | 'CARD' | 'OTHER'>('CASH');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const cached = await db.customers.toArray();
      setCustomers(cached.filter((c) => !c.pendingSync));
      try {
        const { data } = await api.get<{ items: CachedCustomer[] }>('/customers', { params: { take: 200 } });
        setCustomers(data.items);
      } catch { /* offline */ }
    })();
  }, []);

  const selected = customers.find((c) => c.id === customerId);

  const submit = async () => {
    if (!customerId || amount <= 0) { setErr('اختر عميلاً وأدخل مبلغاً صحيحاً'); return; }
    setBusy(true); setErr(null);
    let pos: GeolocationPosition | null = null;
    try { pos = await getCurrentPosition(); } catch { /* optional */ }
    const payload = {
      customerId, amount, method,
      notes: notes || undefined,
      createLat: pos?.coords.latitude,
      createLng: pos?.coords.longitude,
    };
    try {
      if (navigator.onLine) {
        await api.post('/payments', payload);
      } else {
        await enqueue({ kind: 'payment.create', payload });
      }
      navigate('/', { replace: true });
    } catch (e) {
      setErr(asMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <h1 className="text-lg font-bold">تحصيل دفعة</h1>

      <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}
        className="w-full border border-slate-300 rounded-xl px-3 py-3 bg-white">
        <option value="">اختر العميل…</option>
        {customers.map((c) => (
          <option key={c.id} value={c.id}>{c.storeName} — رصيد {fmtMoney(c.balance)}</option>
        ))}
      </select>

      {selected && Number(selected.balance) > 0 && (
        <div className="text-xs text-rose-700 bg-rose-50 rounded-xl p-3">
          المديونية الحالية: {fmtMoney(selected.balance)}
        </div>
      )}

      <label className="block">
        <span className="text-sm font-medium">المبلغ</span>
        <input type="number" min={0.01} step={0.01} value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
          className="w-full border border-slate-300 rounded-xl px-3 py-3 bg-white mt-1 text-lg" />
      </label>

      <label className="block">
        <span className="text-sm font-medium">طريقة الدفع</span>
        <select value={method} onChange={(e) => setMethod(e.target.value as typeof method)}
          className="w-full border border-slate-300 rounded-xl px-3 py-3 bg-white mt-1">
          <option value="CASH">نقدي</option>
          <option value="BANK_TRANSFER">تحويل بنكي</option>
          <option value="CHEQUE">شيك</option>
          <option value="CARD">بطاقة</option>
          <option value="OTHER">أخرى</option>
        </select>
      </label>

      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="ملاحظات…"
        rows={2} className="w-full border border-slate-300 rounded-xl px-3 py-2 bg-white text-sm" />

      {err && <div className="text-sm text-red-600">{err}</div>}

      <button disabled={busy} onClick={submit}
        className="w-full bg-indigo-600 disabled:opacity-60 text-white rounded-xl py-3 font-semibold">
        {busy ? '...' : 'تأكيد التحصيل'}
      </button>
    </div>
  );
}
