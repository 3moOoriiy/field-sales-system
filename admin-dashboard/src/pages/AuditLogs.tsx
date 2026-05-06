import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { fmtDate } from '../lib/format';
import { DataTable } from '../components/DataTable';

interface Row {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  ip: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  user: { id: string; username: string; fullName: string } | null;
}

const ACTIONS = [
  '', 'LOGIN', 'LOGOUT', 'LOGIN_FAILED',
  'INVOICE_CREATED', 'INVOICE_UPDATED', 'INVOICE_CANCELLED',
  'INVOICE_DISCOUNT_OVERRIDE', 'LIMIT_EXCEEDED_ATTEMPT',
  'RETURN_CREATED', 'PAYMENT_CREATED',
  'CUSTOMER_CREATED', 'CUSTOMER_UPDATED',
  'PRODUCT_CREATED', 'PRODUCT_UPDATED',
  'USER_CREATED', 'USER_UPDATED', 'USER_DISABLED',
  'PASSWORD_RESET', 'PERMISSIONS_CHANGED', 'SETTINGS_UPDATED',
];

export function AuditLogs() {
  const [action, setAction] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const list = useQuery({
    queryKey: ['audit-logs', { action, from, to }],
    queryFn: async () => (await api.get<{ items: Row[]; total: number }>('/audit-logs', {
      params: {
        action: action || undefined,
        from: from ? new Date(from).toISOString() : undefined,
        to: to ? new Date(to + 'T23:59:59').toISOString() : undefined,
        take: 200,
      },
    })).data,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-lg font-bold">سجل التدقيق</h1>
        <div className="flex gap-2 items-center flex-wrap">
          <select value={action} onChange={(e) => setAction(e.target.value)}
            className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm bg-white">
            {ACTIONS.map((a) => <option key={a} value={a}>{a || 'كل الأحداث'}</option>)}
          </select>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
            className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm" />
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
            className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm" />
        </div>
      </div>

      <DataTable<Row>
        rowKey={(r) => r.id}
        loading={list.isLoading}
        rows={list.data?.items ?? []}
        empty="لا توجد سجلات."
        columns={[
          { key: 'createdAt', header: 'الوقت', render: (r) => fmtDate(r.createdAt), width: '160px' },
          { key: 'user', header: 'المستخدم', render: (r) => r.user?.fullName ?? r.user?.username ?? '—' },
          { key: 'action', header: 'الحدث',
            render: (r) => {
              const isAlert = r.action === 'LIMIT_EXCEEDED_ATTEMPT' || r.action === 'LOGIN_FAILED';
              return (
                <span className={`text-[11px] font-mono ${isAlert ? 'text-rose-600' : ''}`}>
                  {r.action}
                </span>
              );
            },
          },
          { key: 'entity', header: 'الكيان',
            render: (r) => r.entityType ? `${r.entityType}#${r.entityId?.slice(0, 8) ?? ''}` : '-' },
          { key: 'ip', header: 'IP', render: (r) => r.ip ?? '-' },
          { key: 'metadata', header: 'تفاصيل',
            render: (r) => r.metadata
              ? <code className="text-[10px]">{JSON.stringify(r.metadata).slice(0, 80)}</code>
              : '-' },
        ]}
      />
    </div>
  );
}
