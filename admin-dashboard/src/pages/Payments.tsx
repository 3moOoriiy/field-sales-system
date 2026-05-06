import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { fmtMoney, fmtDate } from '../lib/format';
import { DataTable } from '../components/DataTable';
import { PageHeader } from '../components/PageHeader';

interface Row {
  id: string; receiptNumber: string; amount: string; method: string; paidAt: string;
  customer: { id: string; storeName: string };
  invoice: { id: string; invoiceNumber: string } | null;
}

export function Payments() {
  const list = useQuery({
    queryKey: ['payments'],
    queryFn: async () => (await api.get<{ items: Row[]; total: number }>('/payments', { params: { take: 200 } })).data,
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="التحصيلات"
        subtitle={list.data ? `${list.data.total} تحصيل` : undefined}
      />
      <DataTable<Row>
        rowKey={(r) => r.id}
        loading={list.isLoading}
        rows={list.data?.items ?? []}
        empty="لا توجد تحصيلات."
        columns={[
          { key: 'receiptNumber', header: 'إيصال' },
          { key: 'invoice', header: 'الفاتورة',
            render: (r) => r.invoice
              ? <Link to={`/invoices/${r.invoice.id}`} className="text-indigo-600">{r.invoice.invoiceNumber}</Link>
              : <span className="text-slate-400">عام</span>,
          },
          { key: 'customer', header: 'العميل', render: (r) => r.customer.storeName },
          { key: 'method', header: 'الطريقة' },
          { key: 'amount', header: 'المبلغ', align: 'end', render: (r) => fmtMoney(r.amount) },
          { key: 'paidAt', header: 'التاريخ', render: (r) => fmtDate(r.paidAt) },
        ]}
      />
    </div>
  );
}
