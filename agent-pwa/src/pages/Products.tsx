import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { db, CachedProduct } from '../lib/db';
import { fmtMoney, fmtNumber } from '../lib/format';

export function Products() {
  const [items, setItems] = useState<CachedProduct[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const cached = await db.products.toArray();
      if (mounted) { setItems(cached); setLoading(cached.length === 0); }
      try {
        const { data } = await api.get<{ items: CachedProduct[] }>('/products', {
          params: { take: 200 },
        });
        if (mounted) {
          setItems(data.items);
          setLoading(false);
          await db.products.clear();
          await db.products.bulkPut(data.items);
        }
      } catch { if (mounted) setLoading(false); }
    })();
    return () => { mounted = false; };
  }, []);

  const visible = q
    ? items.filter((p) =>
        [p.sku, p.barcode, p.name, p.nameAr]
          .filter(Boolean)
          .some((s) => s!.toLowerCase().includes(q.toLowerCase())),
      )
    : items;

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold tracking-tight">المنتجات</h1>

      <div className="relative">
        <span className="absolute top-1/2 -translate-y-1/2 ltr:left-3 rtl:right-3 text-slate-400 text-sm">🔍</span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="SKU / باركود / اسم"
          className="input ltr:pl-10 rtl:pr-10"
        />
      </div>

      {loading && (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card p-3 flex gap-3">
              <div className="skeleton w-10 h-10 rounded-xl" />
              <div className="flex-1 space-y-2">
                <div className="skeleton h-3 w-2/3" />
                <div className="skeleton h-2 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && visible.length === 0 && (
        <div className="card p-8 text-center">
          <div className="text-3xl mb-2">📦</div>
          <div className="text-sm font-medium text-slate-700">
            {q ? 'لا توجد نتائج' : 'لا توجد منتجات'}
          </div>
        </div>
      )}

      <ul className="space-y-2">
        {visible.map((p) => {
          const stock = Number(p.stockQty);
          const lowStock = stock < 10;
          return (
            <li key={p.id} className="card p-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 grid place-items-center text-base shrink-0 ring-1 ring-emerald-200/40">
                  📦
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm">{p.nameAr ?? p.name}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {p.sku}{p.barcode ? ` · ${p.barcode}` : ''}
                  </div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      lowStock ? 'bg-rose-50 text-rose-700 ring-1 ring-rose-200/60'
                        : 'bg-slate-100 text-slate-600'
                    }`}>
                      {fmtNumber(stock, 3)} {p.unitType}
                    </span>
                    <span className="text-[10px] text-slate-400">ضريبة {p.taxPercent}%</span>
                  </div>
                </div>
                <div className="text-end shrink-0">
                  <div className="font-bold text-sm" data-numeric="true">{fmtMoney(p.sellingPrice)}</div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
