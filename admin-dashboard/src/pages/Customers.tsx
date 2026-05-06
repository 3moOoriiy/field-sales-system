import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, Search } from 'lucide-react';
import { api } from '../lib/api';
import { fmtMoney, fmtDate } from '../lib/format';
import { DataTable } from '../components/DataTable';
import { PageHeader } from '../components/PageHeader';

interface Customer {
  id: string; code: string; storeName: string; contactName: string | null;
  phone: string | null; address: string | null; balance: string; createdAt: string;
}

export function Customers() {
  const [q, setQ] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ['customers', q],
    queryFn: async () => {
      const { data } = await api.get<{ items: Customer[]; total: number }>('/customers', {
        params: { q: q || undefined, take: 200 },
      });
      return data;
    },
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="العملاء"
        subtitle={list.data ? `${list.data.total} عميل في قاعدة البيانات` : undefined}
        actions={
          <div className="relative">
            <Search size={14} className="absolute top-1/2 -translate-y-1/2 ltr:left-3 rtl:right-3 text-slate-400" />
            <input
              value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="بحث…"
              className="input ltr:pl-9 rtl:pr-9 w-64"
            />
          </div>
        }
      />

      <DataTable<Customer>
        rowKey={(c) => c.id}
        loading={list.isLoading}
        rows={list.data?.items ?? []}
        empty="لا يوجد عملاء."
        onRowClick={(c) => setSelectedId(c.id)}
        columns={[
          { key: 'code', header: 'الكود' },
          { key: 'storeName', header: 'اسم المحل' },
          { key: 'phone', header: 'الهاتف', render: (c) => c.phone ?? '-' },
          { key: 'address', header: 'العنوان', render: (c) => c.address ?? '-' },
          {
            key: 'balance', header: 'الرصيد', align: 'end',
            render: (c) => (
              <span className={Number(c.balance) > 0 ? 'text-rose-600 font-bold' : ''}>
                {fmtMoney(c.balance)}
              </span>
            ),
          },
          { key: 'createdAt', header: 'تاريخ الإضافة', render: (c) => fmtDate(c.createdAt) },
        ]}
      />

      {selectedId && (
        <CustomerStatement id={selectedId} onClose={() => setSelectedId(null)} />
      )}
    </div>
  );
}

interface Statement {
  customer: Customer;
  currentBalance: string;
  invoices: Array<{ id: string; invoiceNumber: string; issuedAt: string; status: string; totalAmount: string; paidAmount: string }>;
  payments: Array<{ id: string; receiptNumber: string; amount: string; method: string; paidAt: string }>;
  returns: Array<{ id: string; returnNumber: string; createdAt: string; totalAmount: string }>;
  balanceHistory: Array<{ id: string; delta: string; balanceAfter: string; reason: string; createdAt: string }>;
}

function CustomerStatement({ id, onClose }: { id: string; onClose: () => void }) {
  const q = useQuery({
    queryKey: ['customers', id, 'statement'],
    queryFn: async () => (await api.get<Statement>(`/customers/${id}/statement`)).data,
  });
  const s = q.data;

  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <div className="w-full max-w-2xl bg-white shadow-xl overflow-y-auto">
        <div className="flex justify-between p-3 border-b">
          <h3 className="font-bold">كشف حساب العميل</h3>
          <button onClick={onClose} className="text-slate-500"><X size={20} /></button>
        </div>
        <div className="p-4 space-y-4">
          {q.isLoading && <div className="text-sm text-slate-500">جارٍ التحميل…</div>}
          {s && (
            <>
              <div>
                <div className="font-bold">{s.customer.storeName}</div>
                <div className="text-xs text-slate-500">{s.customer.code} · {s.customer.phone ?? '-'}</div>
                <div className={`mt-2 text-lg font-bold ${Number(s.currentBalance) > 0 ? 'text-rose-600' : 'text-slate-700'}`}>
                  الرصيد: {fmtMoney(s.currentBalance)}
                </div>
              </div>

              <Section title={`الفواتير (${s.invoices.length})`}>
                <ul className="text-xs divide-y">
                  {s.invoices.map((i) => (
                    <li key={i.id} className="py-1.5 flex justify-between">
                      <span>{i.invoiceNumber} · {fmtDate(i.issuedAt)} · {i.status}</span>
                      <span className="font-semibold">{fmtMoney(i.totalAmount)}</span>
                    </li>
                  ))}
                  {s.invoices.length === 0 && <li className="text-slate-500">لا يوجد.</li>}
                </ul>
              </Section>

              <Section title={`التحصيلات (${s.payments.length})`}>
                <ul className="text-xs divide-y">
                  {s.payments.map((p) => (
                    <li key={p.id} className="py-1.5 flex justify-between">
                      <span>{p.receiptNumber} · {fmtDate(p.paidAt)} · {p.method}</span>
                      <span className="font-semibold text-emerald-700">{fmtMoney(p.amount)}</span>
                    </li>
                  ))}
                  {s.payments.length === 0 && <li className="text-slate-500">لا يوجد.</li>}
                </ul>
              </Section>

              <Section title={`المرتجعات (${s.returns.length})`}>
                <ul className="text-xs divide-y">
                  {s.returns.map((r) => (
                    <li key={r.id} className="py-1.5 flex justify-between">
                      <span>{r.returnNumber} · {fmtDate(r.createdAt)}</span>
                      <span className="font-semibold text-rose-700">{fmtMoney(r.totalAmount)}</span>
                    </li>
                  ))}
                  {s.returns.length === 0 && <li className="text-slate-500">لا يوجد.</li>}
                </ul>
              </Section>

              <Section title="حركات الرصيد">
                <ul className="text-xs divide-y">
                  {s.balanceHistory.slice(0, 50).map((h) => (
                    <li key={h.id} className="py-1.5 flex justify-between">
                      <span>{fmtDate(h.createdAt)} · {h.reason}</span>
                      <span className={`font-semibold ${Number(h.delta) > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                        {fmtMoney(h.delta)} → {fmtMoney(h.balanceAfter)}
                      </span>
                    </li>
                  ))}
                </ul>
              </Section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border border-slate-200 rounded-xl p-3">
      <h4 className="text-sm font-bold mb-2">{title}</h4>
      {children}
    </section>
  );
}
