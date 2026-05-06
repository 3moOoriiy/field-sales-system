import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { db, CachedCustomer } from '../lib/db';
import { fmtMoney } from '../lib/format';

export function Customers() {
  const [items, setItems] = useState<CachedCustomer[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const cached = await db.customers.toArray();
      if (mounted) { setItems(cached); setLoading(cached.length === 0); }

      try {
        const { data } = await api.get<{ items: CachedCustomer[] }>('/customers', {
          params: { take: 200 },
        });
        if (mounted) {
          setItems(data.items);
          setLoading(false);
          const serverIds = new Set(data.items.map((c) => c.id));
          const localPending = cached.filter((c) => c.pendingSync && !serverIds.has(c.id));
          await db.customers.clear();
          await db.customers.bulkPut([...data.items, ...localPending]);
        }
      } catch {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const visible = q
    ? items.filter((c) =>
        [c.code, c.storeName, c.phone, c.contactName]
          .filter(Boolean)
          .some((s) => s!.toLowerCase().includes(q.toLowerCase())),
      )
    : items;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold tracking-tight">العملاء</h1>
        <Link to="/customers/new" className="btn-primary">
          <span>+</span>
          <span>جديد</span>
        </Link>
      </div>

      <div className="relative">
        <span className="absolute top-1/2 -translate-y-1/2 ltr:left-3 rtl:right-3 text-slate-400 text-sm">🔍</span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="بحث بالاسم أو الهاتف…"
          className="input ltr:pl-10 rtl:pr-10"
        />
      </div>

      {loading && (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="card p-3">
              <div className="flex gap-3">
                <div className="skeleton w-10 h-10 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-3 w-2/3" />
                  <div className="skeleton h-2 w-1/3" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && visible.length === 0 && (
        <div className="card p-8 text-center">
          <div className="text-3xl mb-2">🏪</div>
          <div className="text-sm font-medium text-slate-700">
            {q ? 'لا توجد نتائج' : 'لم تضف عملاء بعد'}
          </div>
          {!q && (
            <Link to="/customers/new" className="btn-primary mt-3 inline-flex">
              + إضافة عميل
            </Link>
          )}
        </div>
      )}

      <ul className="space-y-2">
        {visible.map((c) => {
          const positiveBalance = Number(c.balance) > 0;
          const initial = c.storeName.charAt(0);
          return (
            <li key={c.id} className="card p-3 active:scale-[0.99] transition-transform">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-brand-100 to-brand-50 text-brand-700 grid place-items-center font-bold text-base shrink-0 ring-1 ring-brand-200/40">
                  {initial}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate flex items-center gap-1.5">
                    {c.storeName}
                    {c.pendingSync && (
                      <span className="text-[9px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded font-medium">قيد المزامنة</span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 truncate">
                    {c.code} · {c.phone ?? 'لا يوجد هاتف'}
                  </div>
                </div>
                <div className="text-end shrink-0">
                  <div className={`text-sm font-bold ${positiveBalance ? 'text-rose-600' : 'text-slate-700'}`} data-numeric="true">
                    {fmtMoney(c.balance)}
                  </div>
                  <div className="text-[10px] text-slate-400">{positiveBalance ? 'مديونية' : 'الرصيد'}</div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
