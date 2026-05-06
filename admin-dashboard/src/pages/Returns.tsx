import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { fmtMoney, fmtDate } from '../lib/format';
import { DataTable } from '../components/DataTable';
import { PageHeader } from '../components/PageHeader';

interface Row {
  id: string; returnNumber: string; totalAmount: string; createdAt: string;
  customer: { id: string; storeName: string };
  invoice: { id: string; invoiceNumber: string };
}

export function Returns() {
  const list = useQuery({
    queryKey: ['returns'],
    queryFn: async () => (await api.get<{ items: Row[]; total: number }>('/returns', { params: { take: 200 } })).data,
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="المرتجعات"
        subtitle={list.data ? `${list.data.total} مرتجع` : undefined}
      />
      <DataTable<Row>
        rowKey={(r) => r.id}
        loading={list.isLoading}
        rows={list.data?.items ?? []}
        empty="لا توجد مرتجعات."
        columns={[
          { key: 'returnNumber', header: 'الرقم' },
          { key: 'invoice', header: 'الفاتورة',
            render: (r) => <Link to={`/invoices/${r.invoice.id}`} className="text-indigo-600">{r.invoice.invoiceNumber}</Link> },
          { key: 'customer', header: 'العميل', render: (r) => r.customer.storeName },
          { key: 'totalAmount', header: 'الإجمالي', align: 'end', render: (r) => fmtMoney(r.totalAmount) },
          { key: 'createdAt', header: 'التاريخ', render: (r) => fmtDate(r.createdAt) },
        ]}
      />
    </div>
  );
}
