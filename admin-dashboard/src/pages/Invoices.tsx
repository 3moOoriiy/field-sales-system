import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { fmtMoney, fmtDate } from '../lib/format';
import { DataTable } from '../components/DataTable';
import { PageHeader } from '../components/PageHeader';
import { FilterBar } from '../components/FilterBar';

interface Row {
  id: string; invoiceNumber: string; status: string; paymentType: string;
  totalAmount: string; issuedAt: string;
  customer: { id: string; storeName: string };
  createdBy: { id: string; username: string; fullName: string };
}

export function Invoices() {
  const [from, setFrom] = useState('');
  const [to, setTo]     = useState('');
  const [status, setStatus] = useState('');

  const list = useQuery({
    queryKey: ['invoices', { from, to, status }],
    queryFn: async () => {
      const { data } = await api.get<{ items: Row[]; total: number }>('/invoices', {
        params: {
          from: from ? new Date(from).toISOString() : undefined,
          to: to ? new Date(to).toISOString() : undefined,
          status: status || undefined,
          take: 200,
        },
      });
      return data;
    },
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="الفواتير"
        subtitle={list.data ? `${list.data.total} فاتورة` : undefined}
      />
      <FilterBar>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input w-auto" />
        <span className="text-xs text-slate-400">→</span>
        <input type="date" value={to}   onChange={(e) => setTo(e.target.value)}   className="input w-auto" />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="input w-auto">
          <option value="">كل الحالات</option>
          <option value="ISSUED">مُصدرة</option>
          <option value="PAID">مدفوعة</option>
          <option value="PARTIALLY_PAID">مدفوعة جزئياً</option>
          <option value="CANCELLED">ملغاة</option>
        </select>
      </FilterBar>

      <DataTable<Row>
        rowKey={(r) => r.id}
        loading={list.isLoading}
        rows={list.data?.items ?? []}
        empty="لا توجد فواتير."
        columns={[
          { key: 'invoiceNumber', header: 'الرقم', render: (r) => (
            <Link to={`/invoices/${r.id}`} className="text-indigo-600 font-semibold">{r.invoiceNumber}</Link>
          ) },
          { key: 'customer', header: 'العميل', render: (r) => r.customer.storeName },
          { key: 'createdBy', header: 'المندوب', render: (r) => r.createdBy.fullName },
          { key: 'paymentType', header: 'الدفع' },
          { key: 'status', header: 'الحالة',
            render: (r) => {
              const c = r.status === 'PAID' ? 'bg-emerald-100 text-emerald-700'
                : r.status === 'CANCELLED' ? 'bg-rose-100 text-rose-700'
                : r.status === 'PARTIALLY_PAID' ? 'bg-amber-100 text-amber-700'
                : 'bg-slate-100 text-slate-700';
              return <span className={`text-[11px] px-2 py-0.5 rounded ${c}`}>{r.status}</span>;
            },
          },
          { key: 'totalAmount', header: 'الإجمالي', align: 'end', render: (r) => fmtMoney(r.totalAmount) },
          { key: 'issuedAt', header: 'التاريخ', render: (r) => fmtDate(r.issuedAt) },
        ]}
      />
    </div>
  );
}
