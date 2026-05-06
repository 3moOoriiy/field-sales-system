import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, X, MapPin, Calendar, User, Store } from 'lucide-react';
import { api, asMessage } from '../lib/api';
import { fmtDate } from '../lib/format';
import { DataTable } from '../components/DataTable';
import { PageHeader } from '../components/PageHeader';

interface VisitRow {
  id: string;
  status: string;
  checkInAt: string | null;
  checkOutAt: string | null;
  checkInRadiusMeters: number | null;
  customer: { id: string; storeName: string; address: string | null };
  agent: { id: string; username: string; fullName: string };
}

interface TaskRow {
  id: string;
  scheduledAt: string;
  status: string;
  notes: string | null;
  customer: { id: string; storeName: string; address: string | null };
  agent: { id: string; username: string; fullName: string };
  visit: { id: string; status: string } | null;
}

interface RankingRow {
  agentId: string; username: string; fullName: string;
  completed: number; planned: number; inProgress: number; missed: number; cancelled: number;
}

export function Visits() {
  const [tab, setTab] = useState<'tasks' | 'visits' | 'ranking'>('tasks');
  const [creating, setCreating] = useState(false);

  return (
    <div className="space-y-4">
      <PageHeader
        title="الزيارات"
        subtitle="مهام زيارات العملاء — الأدمن يجدول، المندوب يسجّل دخول/خروج بالـ GPS"
        actions={
          <button onClick={() => setCreating(true)} className="btn-primary">
            <Plus size={16} /> مهمة زيارة جديدة
          </button>
        }
      />

      <div className="inline-flex gap-1 bg-slate-100 rounded-xl p-1">
        <Tab active={tab === 'tasks'}   onClick={() => setTab('tasks')}>المهام المجدولة</Tab>
        <Tab active={tab === 'visits'}  onClick={() => setTab('visits')}>الزيارات الفعلية</Tab>
        <Tab active={tab === 'ranking'} onClick={() => setTab('ranking')}>تصنيف الأداء</Tab>
      </div>

      {tab === 'tasks'   && <TasksList />}
      {tab === 'visits'  && <VisitsList />}
      {tab === 'ranking' && <Ranking />}

      {creating && <CreateTaskDrawer onClose={() => setCreating(false)} />}
    </div>
  );
}

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-1.5 text-sm rounded-lg font-medium transition ${
        active ? 'bg-white shadow-sm text-slate-900' : 'text-slate-600 hover:text-slate-900'
      }`}
    >
      {children}
    </button>
  );
}

function statusBadge(s: string) {
  const c = s === 'COMPLETED' ? 'badge-success'
    : s === 'IN_PROGRESS' ? 'badge-warning'
    : s === 'MISSED' ? 'badge-danger'
    : s === 'CANCELLED' ? 'badge-neutral'
    : 'badge-indigo';
  const label = s === 'COMPLETED' ? 'مكتملة'
    : s === 'IN_PROGRESS' ? 'جارية'
    : s === 'MISSED' ? 'فاتت'
    : s === 'CANCELLED' ? 'ملغاة'
    : s === 'PLANNED' ? 'مجدولة'
    : s;
  return <span className={c}>{label}</span>;
}

function TasksList() {
  const list = useQuery({
    queryKey: ['visit-tasks'],
    queryFn: async () => (await api.get<{ items: TaskRow[]; total: number }>('/visits/tasks', {
      params: { take: 200 },
    })).data,
  });
  return (
    <DataTable<TaskRow>
      rowKey={(t) => t.id}
      loading={list.isLoading}
      rows={list.data?.items ?? []}
      empty="لا توجد مهام زيارة. اضغط «مهمة زيارة جديدة» لتعيين مندوب لزيارة عميل."
      columns={[
        { key: 'agent', header: 'المندوب', render: (t) => t.agent.fullName },
        { key: 'customer', header: 'العميل',
          render: (t) => (
            <div>
              <div className="font-medium">{t.customer.storeName}</div>
              {t.customer.address && (
                <div className="text-[11px] text-slate-500">{t.customer.address}</div>
              )}
            </div>
          ),
        },
        { key: 'scheduledAt', header: 'موعد الزيارة', render: (t) => fmtDate(t.scheduledAt) },
        { key: 'status', header: 'الحالة', render: (t) => statusBadge(t.status) },
        { key: 'notes', header: 'ملاحظات', render: (t) => t.notes ?? '-' },
      ]}
    />
  );
}

function VisitsList() {
  const list = useQuery({
    queryKey: ['visits'],
    queryFn: async () => (await api.get<{ items: VisitRow[]; total: number }>('/visits', {
      params: { take: 200 },
    })).data,
  });
  return (
    <DataTable<VisitRow>
      rowKey={(v) => v.id}
      loading={list.isLoading}
      rows={list.data?.items ?? []}
      empty="لا توجد زيارات فعلية بعد. الزيارة تُنشأ عندما يضغط المندوب «تسجيل دخول»."
      columns={[
        { key: 'agent', header: 'المندوب', render: (v) => v.agent.fullName },
        { key: 'customer', header: 'العميل', render: (v) => v.customer.storeName },
        { key: 'status', header: 'الحالة', render: (v) => statusBadge(v.status) },
        { key: 'checkInAt', header: 'دخول', render: (v) => fmtDate(v.checkInAt) },
        { key: 'checkOutAt', header: 'خروج', render: (v) => fmtDate(v.checkOutAt) },
        { key: 'checkInRadiusMeters', header: 'مسافة',
          render: (v) => v.checkInRadiusMeters != null ? `${v.checkInRadiusMeters} م` : '-' },
      ]}
    />
  );
}

function Ranking() {
  const data = useQuery({
    queryKey: ['visits', 'ranking'],
    queryFn: async () => (await api.get<RankingRow[]>('/visits/ranking')).data,
  });
  return (
    <DataTable<RankingRow>
      rowKey={(r) => r.agentId}
      loading={data.isLoading}
      rows={data.data ?? []}
      empty="لا توجد بيانات أداء بعد."
      columns={[
        { key: 'fullName', header: 'المندوب' },
        { key: 'completed', header: 'مكتمل', align: 'end' },
        { key: 'inProgress', header: 'جارية', align: 'end' },
        { key: 'planned', header: 'مجدولة', align: 'end' },
        { key: 'missed', header: 'فاتت', align: 'end' },
        { key: 'cancelled', header: 'ملغاة', align: 'end' },
      ]}
    />
  );
}

// ------------------------------------------------------------
// Create task drawer
// ------------------------------------------------------------

interface AgentOpt { id: string; fullName: string; username: string; }
interface CustomerOpt { id: string; code: string; storeName: string; address: string | null; latitude: number | null; longitude: number | null; }

function CreateTaskDrawer({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [agentId, setAgentId] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [scheduledAt, setScheduledAt] = useState(() => {
    // Default to "now + 1 hour" rounded to next 5 minutes, formatted for datetime-local
    const d = new Date(Date.now() + 60 * 60 * 1000);
    d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5, 0, 0);
    return d.toISOString().slice(0, 16);
  });
  const [notes, setNotes] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const agents = useQuery({
    queryKey: ['users', 'agents-options'],
    queryFn: async () => (await api.get<{ items: AgentOpt[] }>('/users', {
      params: { role: 'AGENT', take: 200 },
    })).data.items,
  });

  const customers = useQuery({
    queryKey: ['customers', 'options'],
    queryFn: async () => (await api.get<{ items: CustomerOpt[] }>('/customers', {
      params: { take: 500 },
    })).data.items,
  });

  const selectedCustomer = customers.data?.find((c) => c.id === customerId);

  const submit = useMutation({
    mutationFn: async () => {
      await api.post('/visits/tasks', {
        agentId,
        customerId,
        scheduledAt: new Date(scheduledAt).toISOString(),
        notes: notes || undefined,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['visit-tasks'] });
      qc.invalidateQueries({ queryKey: ['visits'] });
      onClose();
    },
    onError: (e) => setErr(asMessage(e)),
  });

  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="flex-1 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="w-full max-w-md bg-white shadow-2xl overflow-y-auto flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <h3 className="font-bold text-base">مهمة زيارة جديدة</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-900 p-1 -m-1 rounded-md hover:bg-slate-100">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 space-y-4 flex-1">
          <Field label="المندوب" icon={<User size={14} />}>
            <select
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              className="input"
              required
            >
              <option value="">اختر المندوب…</option>
              {agents.data?.map((a) => (
                <option key={a.id} value={a.id}>{a.fullName} ({a.username})</option>
              ))}
            </select>
          </Field>

          <Field label="العميل" icon={<Store size={14} />}>
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="input"
              required
            >
              <option value="">اختر العميل…</option>
              {customers.data?.map((c) => (
                <option key={c.id} value={c.id}>{c.storeName} — {c.code}</option>
              ))}
            </select>
          </Field>

          {selectedCustomer && (
            <div className="bg-slate-50 rounded-lg p-3 text-xs space-y-1">
              <div className="flex items-start gap-2 text-slate-600">
                <MapPin size={12} className="mt-0.5 shrink-0" />
                <div>
                  <div className="font-medium">{selectedCustomer.address ?? 'لا يوجد عنوان مسجّل'}</div>
                  {selectedCustomer.latitude && selectedCustomer.longitude ? (
                    <div className="text-[11px] text-slate-400">
                      GPS: {selectedCustomer.latitude.toFixed(5)}, {selectedCustomer.longitude.toFixed(5)}
                    </div>
                  ) : (
                    <div className="text-[11px] text-amber-600">
                      ⚠️ لا يوجد إحداثيات GPS — المندوب لن يستطيع تسجيل الدخول. اطلب من المندوب تحديث موقع العميل أولاً.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <Field label="موعد الزيارة" icon={<Calendar size={14} />}>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="input"
              required
            />
          </Field>

          <Field label="ملاحظات (اختياري)">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="مثلاً: يحتاج عرض المنتج الجديد، يطالب بأسعار محسّنة…"
              className="input"
            />
          </Field>

          {err && (
            <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
              {err}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-200 flex gap-2">
          <button onClick={onClose} className="btn-secondary flex-1">إلغاء</button>
          <button
            onClick={() => submit.mutate()}
            disabled={!agentId || !customerId || !scheduledAt || submit.isPending}
            className="btn-primary flex-1"
          >
            {submit.isPending ? '...' : 'إنشاء المهمة'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-600 mb-1 flex items-center gap-1.5">
        {icon}
        {label}
      </span>
      {children}
    </label>
  );
}
