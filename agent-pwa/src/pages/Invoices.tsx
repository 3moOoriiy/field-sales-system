import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { db, CachedInvoice } from '../lib/db';
import { fmtMoney, fmtDate } from '../lib/format';

export function Invoices() {
  const [items, setItems] = useState<CachedInvoice[]>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const cached = await db.invoices.orderBy('issuedAt').reverse().toArray();
      if (mounted) setItems(cached);

      try {
        const { data } = await api.get<{ items: Array<{
          id: string; invoiceNumber: string; customerId: string; totalAmount: string;
          status: string; issuedAt: string; customer: { storeName: string };
        }> }>('/invoices', { params: { take: 100 } });
        const mapped: CachedInvoice[] = data.items.map((i) => ({
          id: i.id, invoiceNumber: i.invoiceNumber,
          customerId: i.customerId, customerName: i.customer.storeName,
          totalAmount: i.totalAmount, status: i.status, issuedAt: i.issuedAt,
        }));
        if (mounted) {
          setItems([...cached.filter((c) => c.pendingSync), ...mapped]);
          // Persist server records (keep pending-sync rows)
          await db.invoices.bulkPut(mapped);
        }
      } catch { /* offline */ }
    })();
    return () => { mounted = false; };
  }, []);

  return (
    <div className="space-y-3">
      <Link to="/invoices/new" className="block bg-indigo-600 text-white text-center py-3 rounded-xl font-semibold">
        + فاتورة جديدة
      </Link>
      <ul className="space-y-2">
        {items.map((inv) => (
          <li key={inv.id}>
            <Link to={`/invoices/${inv.id}`} className="block bg-white border rounded-xl p-3">
              <div className="flex items-center justify-between">
                <div className="font-semibold text-sm flex items-center gap-2">
                  {inv.customerName}
                  {inv.pendingSync && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded">مزامنة</span>
                  )}
                </div>
                <div className="text-sm font-bold">{fmtMoney(inv.totalAmount)}</div>
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                {inv.invoiceNumber} · {fmtDate(inv.issuedAt)} · {inv.status}
              </div>
            </Link>
          </li>
        ))}
        {items.length === 0 && (
          <li className="text-xs text-slate-500 text-center py-8">لا توجد فواتير.</li>
        )}
      </ul>
    </div>
  );
}
