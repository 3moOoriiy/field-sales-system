import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, X } from 'lucide-react';
import { api, asMessage } from '../lib/api';
import { fmtDate } from '../lib/format';
import { DataTable } from '../components/DataTable';
import { ALL_PERMISSIONS, PERMISSION_GROUPS } from '../lib/permissions';
import { PageHeader } from '../components/PageHeader';

interface UserRow {
  id: string;
  username: string;
  fullName: string;
  phone: string | null;
  isActive: boolean;
  branchId: string | null;
  lastLoginAt: string | null;
  role: { name: string };
}

interface UserDetail extends UserRow {
  agentLimits?: {
    maxDiscountPercent: string | null;
    maxDiscountAmount: string | null;
    maxInvoiceTotal: string | null;
    preventBelowCost: boolean;
    allowEditAfterPrint: boolean;
    allowReturns: boolean;
  } | null;
}

export function Agents() {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ['users', 'agents'],
    queryFn: async () => (
      await api.get<{ items: UserRow[] }>('/users', { params: { role: 'AGENT', take: 200 } })
    ).data.items,
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="المندوبون"
        subtitle={list.data ? `${list.data.length} مندوب نشط` : undefined}
        actions={
          <button onClick={() => setCreating(true)} className="btn-primary">
            <Plus size={16} /> مندوب جديد
          </button>
        }
      />

      <DataTable<UserRow>
        rowKey={(u) => u.id}
        loading={list.isLoading}
        rows={list.data ?? []}
        empty="لا يوجد مندوبون."
        onRowClick={(u) => setSelectedId(u.id)}
        columns={[
          { key: 'username', header: 'اسم المستخدم' },
          { key: 'fullName', header: 'الاسم' },
          { key: 'phone',    header: 'الهاتف', render: (u) => u.phone ?? '-' },
          { key: 'lastLoginAt', header: 'آخر دخول', render: (u) => fmtDate(u.lastLoginAt) },
          { key: 'isActive', header: 'الحالة',
            render: (u) => (
              <span className={`text-[11px] px-2 py-0.5 rounded ${u.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                {u.isActive ? 'مفعّل' : 'معطّل'}
              </span>
            ),
          },
        ]}
      />

      {creating && (
        <CreateAgent
          onClose={() => setCreating(false)}
          onCreated={() => { qc.invalidateQueries({ queryKey: ['users', 'agents'] }); setCreating(false); }}
        />
      )}
      {selectedId && (
        <AgentDrawer userId={selectedId} onClose={() => setSelectedId(null)} />
      )}
    </div>
  );
}

function CreateAgent({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [username, setU] = useState('');
  const [fullName, setF] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setP] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(null);
    try {
      await api.post('/users', { username, fullName, phone: phone || undefined, password, role: 'AGENT' });
      onCreated();
    } catch (e) { setErr(asMessage(e)); }
    finally { setBusy(false); }
  };

  return (
    <DrawerOverlay onClose={onClose}>
      <form onSubmit={submit} className="p-4 space-y-3">
        <h3 className="text-lg font-bold mb-2">مندوب جديد</h3>
        <Field label="اسم المستخدم" value={username} onChange={setU} required />
        <Field label="الاسم الكامل" value={fullName} onChange={setF} required />
        <Field label="الهاتف" value={phone} onChange={setPhone} />
        <Field label="كلمة المرور" value={password} onChange={setP} type="password" required />
        {err && <div className="text-sm text-red-600">{err}</div>}
        <button type="submit" disabled={busy} className="w-full bg-indigo-600 disabled:opacity-60 text-white rounded-lg py-2.5 text-sm font-semibold">
          {busy ? '...' : 'إنشاء'}
        </button>
      </form>
    </DrawerOverlay>
  );
}

function AgentDrawer({ userId, onClose }: { userId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const detail = useQuery({
    queryKey: ['users', userId],
    queryFn: async () => (await api.get<UserDetail>(`/users/${userId}`)).data,
  });
  const u = detail.data;

  const [grant, setGrant] = useState<Set<string>>(new Set());

  const togglePerm = (code: string) => {
    setGrant((cur) => {
      const next = new Set(cur);
      if (next.has(code)) next.delete(code); else next.add(code);
      return next;
    });
  };

  const savePerms = useMutation({
    mutationFn: async () => {
      await api.post(`/users/${userId}/permissions`, {
        grant: Array.from(grant),
        deny: [],
      });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); },
  });

  const [limits, setLimits] = useState({
    maxDiscountPercent: '', maxDiscountAmount: '', maxInvoiceTotal: '',
    preventBelowCost: true, allowEditAfterPrint: false, allowReturns: true,
  });

  // Hydrate the form when the user detail arrives
  useEffect(() => {
    if (!u?.agentLimits) return;
    setLimits({
      maxDiscountPercent: u.agentLimits.maxDiscountPercent ?? '',
      maxDiscountAmount: u.agentLimits.maxDiscountAmount ?? '',
      maxInvoiceTotal: u.agentLimits.maxInvoiceTotal ?? '',
      preventBelowCost: u.agentLimits.preventBelowCost,
      allowEditAfterPrint: u.agentLimits.allowEditAfterPrint,
      allowReturns: u.agentLimits.allowReturns,
    });
  }, [u]);

  const saveLimits = useMutation({
    mutationFn: async () => {
      await api.post(`/users/${userId}/agent-limits`, {
        maxDiscountPercent: limits.maxDiscountPercent ? Number(limits.maxDiscountPercent) : undefined,
        maxDiscountAmount: limits.maxDiscountAmount ? Number(limits.maxDiscountAmount) : undefined,
        maxInvoiceTotal: limits.maxInvoiceTotal ? Number(limits.maxInvoiceTotal) : undefined,
        preventBelowCost: limits.preventBelowCost,
        allowEditAfterPrint: limits.allowEditAfterPrint,
        allowReturns: limits.allowReturns,
      });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users', userId] }); },
  });

  const resetPwd = useMutation({
    mutationFn: async (newPassword: string) => {
      await api.post(`/users/${userId}/reset-password`, { newPassword });
    },
  });

  const disable = useMutation({
    mutationFn: async () => { await api.delete(`/users/${userId}`); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); onClose(); },
  });

  return (
    <DrawerOverlay onClose={onClose}>
      <div className="p-4 space-y-4">
        <div>
          <h3 className="text-lg font-bold">{u?.fullName ?? '...'}</h3>
          <div className="text-xs text-slate-500">{u?.username} · {u?.role.name}</div>
        </div>

        <Section title="حدود الفاتورة">
          <div className="grid grid-cols-2 gap-2">
            <Field label="حد الخصم %" type="number" value={limits.maxDiscountPercent}
              onChange={(v) => setLimits((s) => ({ ...s, maxDiscountPercent: v }))} />
            <Field label="حد قيمة الخصم" type="number" value={limits.maxDiscountAmount}
              onChange={(v) => setLimits((s) => ({ ...s, maxDiscountAmount: v }))} />
            <Field label="حد إجمالي الفاتورة" type="number" value={limits.maxInvoiceTotal}
              onChange={(v) => setLimits((s) => ({ ...s, maxInvoiceTotal: v }))} />
          </div>
          <Toggle label="منع البيع تحت التكلفة" checked={limits.preventBelowCost}
            onChange={(v) => setLimits((s) => ({ ...s, preventBelowCost: v }))} />
          <Toggle label="السماح بالتعديل بعد الطباعة" checked={limits.allowEditAfterPrint}
            onChange={(v) => setLimits((s) => ({ ...s, allowEditAfterPrint: v }))} />
          <Toggle label="السماح بالمرتجعات" checked={limits.allowReturns}
            onChange={(v) => setLimits((s) => ({ ...s, allowReturns: v }))} />
          <button onClick={() => saveLimits.mutate()} disabled={saveLimits.isPending}
            className="w-full bg-indigo-600 disabled:opacity-60 text-white rounded-lg py-2 text-sm">
            حفظ الحدود
          </button>
          {saveLimits.isError && <div className="text-xs text-red-600">{asMessage(saveLimits.error)}</div>}
          {saveLimits.isSuccess && <div className="text-xs text-emerald-600">✓ محفوظ</div>}
        </Section>

        <Section title="الصلاحيات الإضافية (تتراكم فوق الدور)">
          {PERMISSION_GROUPS.map((g) => (
            <div key={g} className="mb-3">
              <div className="text-xs font-bold text-slate-500 mb-1">{g}</div>
              <div className="space-y-1">
                {ALL_PERMISSIONS.filter((p) => p.group === g).map((p) => (
                  <label key={p.code} className="flex items-start gap-2 text-xs">
                    <input type="checkbox" checked={grant.has(p.code)} onChange={() => togglePerm(p.code)} className="mt-0.5" />
                    <span>
                      <code className="text-[10px] text-slate-400">{p.code}</code>
                      <span className="block">{p.descriptionAr}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ))}
          <button onClick={() => savePerms.mutate()} disabled={savePerms.isPending}
            className="w-full bg-indigo-600 disabled:opacity-60 text-white rounded-lg py-2 text-sm">
            حفظ الصلاحيات الإضافية
          </button>
          {savePerms.isSuccess && <div className="text-xs text-emerald-600">✓ محفوظ</div>}
        </Section>

        <Section title="إجراءات الحساب">
          <ResetPwdInline onSubmit={(p) => resetPwd.mutate(p)} pending={resetPwd.isPending} />
          {resetPwd.isSuccess && <div className="text-xs text-emerald-600">✓ تم تغيير كلمة المرور</div>}
          <button onClick={() => { if (confirm('تعطيل هذا المندوب؟')) disable.mutate(); }}
            className="w-full bg-rose-600 text-white rounded-lg py-2 text-sm mt-2">
            تعطيل الحساب
          </button>
        </Section>
      </div>
    </DrawerOverlay>
  );
}

function ResetPwdInline({ onSubmit, pending }: { onSubmit: (pwd: string) => void; pending: boolean }) {
  const [v, setV] = useState('');
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium">إعادة تعيين كلمة المرور</div>
      <div className="flex gap-2">
        <input type="password" value={v} onChange={(e) => setV(e.target.value)} placeholder="كلمة جديدة"
          className="flex-1 border border-slate-300 rounded-lg px-2 py-2 text-sm" />
        <button disabled={!v || pending} onClick={() => onSubmit(v)}
          className="px-3 py-2 bg-slate-700 text-white rounded-lg text-xs disabled:opacity-50">
          {pending ? '...' : 'تغيير'}
        </button>
      </div>
    </div>
  );
}

// ---------- shared UI ----------

function DrawerOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <div className="w-full max-w-md bg-white shadow-xl overflow-y-auto">
        <div className="flex justify-end p-2">
          <button onClick={onClose} className="text-slate-500"><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', required }: { label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean }) {
  return (
    <label className="block">
      <span className="text-xs font-medium">{label}</span>
      <input type={type} value={value} required={required} onChange={(e) => onChange(e.target.value)}
        className="block w-full border border-slate-300 rounded-lg px-2 py-2 text-sm mt-0.5" />
    </label>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between text-sm py-1.5">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border border-slate-200 rounded-xl p-3 space-y-2">
      <h4 className="text-sm font-bold">{title}</h4>
      {children}
    </section>
  );
}
