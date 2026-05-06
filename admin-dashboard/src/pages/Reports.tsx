import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { api } from '../lib/api';
import { fmtMoney } from '../lib/format';
import { DataTable } from '../components/DataTable';

const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#0ea5e9', '#a855f7'];

export function Reports() {
  const [from, setFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30); d.setHours(0, 0, 0, 0);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));

  const range = useMemo(() => ({
    from: new Date(from).toISOString(),
    to: new Date(to + 'T23:59:59').toISOString(),
  }), [from, to]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-lg font-bold">التقارير</h1>
        <div className="flex gap-2 items-center">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
            className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm" />
          <span className="text-xs text-slate-400">→</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
            className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm" />
        </div>
      </div>

      <ExportButtons range={range} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SalesByAgent range={range} />
        <SalesByPaymentType range={range} />
        <Debts />
        <CollectionsTimeline range={range} />
      </div>
    </div>
  );
}

function ExportButtons({ range }: { range: { from: string; to: string } }) {
  const dl = (path: string, name: string) => async () => {
    const res = await api.get(path, { params: range, responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url; a.download = name; a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="flex gap-2 flex-wrap">
      <button onClick={dl('/reports/sales.xlsx', 'sales.xlsx')}
        className="text-xs px-3 py-1.5 rounded-lg bg-emerald-600 text-white">تصدير المبيعات (Excel)</button>
      <button onClick={dl('/reports/debts.xlsx', 'debts.xlsx')}
        className="text-xs px-3 py-1.5 rounded-lg bg-rose-600 text-white">تصدير المديونيات (Excel)</button>
      <button onClick={dl('/reports/collections.xlsx', 'collections.xlsx')}
        className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 text-white">تصدير التحصيلات (Excel)</button>
    </div>
  );
}

interface InvRow {
  totalAmount: string; paymentType: string; status: string;
  createdBy: { id: string; fullName: string; username: string };
  issuedAt: string;
}

function SalesByAgent({ range }: { range: { from: string; to: string } }) {
  const q = useQuery({
    queryKey: ['report', 'sales-by-agent', range],
    queryFn: async () => (await api.get<{ items: InvRow[] }>('/invoices', {
      params: { ...range, take: 1000 },
    })).data.items,
  });
  const data = useMemo(() => {
    const acc = new Map<string, { name: string; sales: number; count: number }>();
    for (const inv of q.data ?? []) {
      if (inv.status === 'CANCELLED') continue;
      const key = inv.createdBy.id;
      const cur = acc.get(key) ?? { name: inv.createdBy.fullName, sales: 0, count: 0 };
      cur.sales += Number(inv.totalAmount);
      cur.count += 1;
      acc.set(key, cur);
    }
    return Array.from(acc.values()).sort((a, b) => b.sales - a.sales).slice(0, 10);
  }, [q.data]);

  return (
    <Card title="المبيعات حسب المندوب">
      <div className="h-72">
        {q.isLoading ? <Loading /> : (
          <ResponsiveContainer>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={60} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v: number) => fmtMoney(v)} />
              <Bar dataKey="sales" fill="#4f46e5" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}

function SalesByPaymentType({ range }: { range: { from: string; to: string } }) {
  const q = useQuery({
    queryKey: ['report', 'sales-by-payment-type', range],
    queryFn: async () => (await api.get<{ items: InvRow[] }>('/invoices', {
      params: { ...range, take: 1000 },
    })).data.items,
  });
  const data = useMemo(() => {
    const acc = new Map<string, number>();
    for (const inv of q.data ?? []) {
      if (inv.status === 'CANCELLED') continue;
      acc.set(inv.paymentType, (acc.get(inv.paymentType) ?? 0) + Number(inv.totalAmount));
    }
    return Array.from(acc.entries()).map(([name, value]) => ({ name, value }));
  }, [q.data]);

  return (
    <Card title="المبيعات حسب طريقة الدفع">
      <div className="h-72">
        {q.isLoading ? <Loading /> : data.length === 0 ? <Empty /> : (
          <ResponsiveContainer>
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v: number) => fmtMoney(v)} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}

interface Debtor { id: string; storeName: string; phone: string | null; balance: string; }

function Debts() {
  const q = useQuery({
    queryKey: ['report', 'debts'],
    queryFn: async () => (await api.get<Debtor[]>('/customers/top-debtors', { params: { limit: 25 } })).data,
  });
  return (
    <Card title="أكثر العملاء مديونيةً" full>
      <DataTable<Debtor>
        rowKey={(d) => d.id}
        loading={q.isLoading}
        rows={q.data ?? []}
        empty="لا توجد مديونيات."
        columns={[
          { key: 'storeName', header: 'العميل' },
          { key: 'phone', header: 'الهاتف', render: (d) => d.phone ?? '-' },
          { key: 'balance', header: 'المديونية', align: 'end',
            render: (d) => <span className="text-rose-600 font-bold">{fmtMoney(d.balance)}</span> },
        ]}
      />
    </Card>
  );
}

function CollectionsTimeline({ range }: { range: { from: string; to: string } }) {
  const q = useQuery({
    queryKey: ['report', 'collections', range],
    queryFn: async () => (await api.get<{ items: { amount: string; paidAt: string }[] }>('/payments', {
      params: { ...range, take: 1000 },
    })).data.items,
  });
  const data = useMemo(() => {
    const acc = new Map<string, number>();
    for (const p of q.data ?? []) {
      const day = p.paidAt.slice(0, 10);
      acc.set(day, (acc.get(day) ?? 0) + Number(p.amount));
    }
    return Array.from(acc.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([day, value]) => ({ day, value }));
  }, [q.data]);

  return (
    <Card title="التحصيلات حسب اليوم">
      <div className="h-72">
        {q.isLoading ? <Loading /> : data.length === 0 ? <Empty /> : (
          <ResponsiveContainer>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="day" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v: number) => fmtMoney(v)} />
              <Bar dataKey="value" fill="#10b981" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}

function Card({ title, children, full }: { title: string; children: React.ReactNode; full?: boolean }) {
  return (
    <section className={`bg-white border rounded-2xl p-4 ${full ? 'lg:col-span-2' : ''}`}>
      <h3 className="font-semibold mb-3">{title}</h3>
      {children}
    </section>
  );
}

function Loading() {
  return <div className="h-full grid place-items-center text-xs text-slate-500">جارٍ التحميل…</div>;
}
function Empty() {
  return <div className="h-full grid place-items-center text-xs text-slate-500">لا توجد بيانات في هذه الفترة.</div>;
}
