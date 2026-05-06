import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, RotateCcw } from 'lucide-react';
import { api, asMessage } from '../lib/api';
import { useAuth } from '../lib/auth';
import { DataTable } from '../components/DataTable';

interface SettingsRow {
  companyName: string;
  companyNameAr: string | null;
  taxNumber: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  invoiceFooter: string | null;
  invoiceFooterAr: string | null;
  defaultCurrency: string;
  defaultLocale: string;
  logoPath: string | null;
}

interface Branch {
  id: string; code: string; name: string; address: string | null; phone: string | null; isActive: boolean;
  _count?: { users: number; customers: number; invoices: number };
}

export function Settings() {
  const user = useAuth((s) => s.user);
  const qc = useQueryClient();

  const settings = useQuery({
    queryKey: ['settings'],
    queryFn: async () => (await api.get<SettingsRow>('/settings')).data,
  });

  const [form, setForm] = useState<Partial<SettingsRow>>({});
  useEffect(() => { if (settings.data) setForm(settings.data); }, [settings.data]);

  const [savedFlash, setFlash] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async () => (await api.patch('/settings', form)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] });
      setFlash(true);
      setTimeout(() => setFlash(false), 2_000);
    },
    onError: (e) => setErr(asMessage(e)),
  });

  const uploadLogo = async (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    try {
      await api.post('/settings/logo', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      qc.invalidateQueries({ queryKey: ['settings'] });
    } catch (e) { setErr(asMessage(e)); }
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <h1 className="text-lg font-bold">الإعدادات</h1>

      <section className="bg-white border rounded-2xl p-4">
        <h3 className="font-semibold mb-3">معلومات الشركة</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="الاسم"             value={form.companyName ?? ''}    onChange={(v) => setForm((s) => ({ ...s, companyName: v }))} />
          <Field label="الاسم (عربي)"      value={form.companyNameAr ?? ''}  onChange={(v) => setForm((s) => ({ ...s, companyNameAr: v }))} />
          <Field label="الرقم الضريبي"      value={form.taxNumber ?? ''}      onChange={(v) => setForm((s) => ({ ...s, taxNumber: v }))} />
          <Field label="الهاتف"             value={form.phone ?? ''}          onChange={(v) => setForm((s) => ({ ...s, phone: v }))} />
          <Field label="البريد"             value={form.email ?? ''}          onChange={(v) => setForm((s) => ({ ...s, email: v }))} type="email" />
          <Field label="العملة الافتراضية"  value={form.defaultCurrency ?? ''} onChange={(v) => setForm((s) => ({ ...s, defaultCurrency: v }))} />
          <div className="md:col-span-2">
            <Field label="العنوان" value={form.address ?? ''} onChange={(v) => setForm((s) => ({ ...s, address: v }))} />
          </div>
          <div className="md:col-span-2">
            <Field label="تذييل الفاتورة (عربي)" value={form.invoiceFooterAr ?? ''} onChange={(v) => setForm((s) => ({ ...s, invoiceFooterAr: v }))} />
          </div>
          <div className="md:col-span-2">
            <Field label="تذييل الفاتورة (إنجليزي)" value={form.invoiceFooter ?? ''} onChange={(v) => setForm((s) => ({ ...s, invoiceFooter: v }))} />
          </div>
        </div>
        {err && <div className="text-sm text-rose-600 mt-2">{err}</div>}
        {savedFlash && <div className="text-sm text-emerald-600 mt-2">✓ محفوظ</div>}
        <button onClick={() => save.mutate()} disabled={save.isPending}
          className="mt-3 bg-indigo-600 disabled:opacity-60 text-white text-sm px-4 py-2 rounded-lg">
          {save.isPending ? '...' : 'حفظ'}
        </button>
      </section>

      <section className="bg-white border rounded-2xl p-4">
        <h3 className="font-semibold mb-3">شعار الشركة</h3>
        <div className="flex items-center gap-3">
          <input
            type="file" accept="image/png,image/jpeg" className="text-xs"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadLogo(f); e.target.value = ''; }}
          />
          {settings.data?.logoPath && (
            <span className="text-[11px] text-slate-500">المسار: {settings.data.logoPath}</span>
          )}
        </div>
      </section>

      <BranchesSection />

      <section className="bg-white border rounded-2xl p-4">
        <h3 className="font-semibold mb-3">الجلسة الحالية</h3>
        <Row label="المستخدم" value={user?.fullName ?? user?.username ?? '-'} />
        <Row label="الدور" value={user?.role ?? '-'} />
        <Row label="الفرع" value={user?.branchId ?? 'افتراضي'} />
      </section>
    </div>
  );
}

function BranchesSection() {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);

  const list = useQuery({
    queryKey: ['branches'],
    queryFn: async () => (await api.get<Branch[]>('/branches')).data,
  });

  const softDelete = async (b: Branch) => {
    if (!confirm(`تعطيل الفرع "${b.name}"؟ سيتم إخفاؤه دون مسح بياناته (الفواتير والعملاء المرتبطين به سيظلون سليمين).`)) return;
    try {
      await api.delete(`/branches/${b.id}`);
      qc.invalidateQueries({ queryKey: ['branches'] });
    } catch (e) { alert(asMessage(e)); }
  };

  const hardDelete = async (b: Branch) => {
    const refs = (b._count?.users ?? 0) + (b._count?.customers ?? 0) + (b._count?.invoices ?? 0);
    if (refs > 0) {
      alert(`لا يمكن الحذف النهائي: الفرع مرتبط بـ ${b._count?.users ?? 0} مستخدم، ${b._count?.customers ?? 0} عميل، ${b._count?.invoices ?? 0} فاتورة. اعمل تعطيل بدلاً من ذلك.`);
      return;
    }
    if (!confirm(`حذف نهائي للفرع "${b.name}"؟ لا يمكن التراجع.`)) return;
    try {
      await api.delete(`/branches/${b.id}?hard=true`);
      qc.invalidateQueries({ queryKey: ['branches'] });
    } catch (e) { alert(asMessage(e)); }
  };

  const restore = async (b: Branch) => {
    try {
      await api.post(`/branches/${b.id}/restore`);
      qc.invalidateQueries({ queryKey: ['branches'] });
    } catch (e) { alert(asMessage(e)); }
  };

  return (
    <section className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold">الفروع</h3>
        <button onClick={() => setCreating(true)} className="btn-primary">
          <Plus size={16} /> فرع جديد
        </button>
      </div>

      <DataTable<Branch>
        rowKey={(b) => b.id}
        loading={list.isLoading}
        rows={list.data ?? []}
        empty="لا توجد فروع."
        columns={[
          { key: 'code', header: 'الكود', width: '100px' },
          { key: 'name', header: 'الاسم' },
          { key: 'usage', header: 'مرتبط بـ',
            render: (b) => b._count
              ? <span className="text-[11px] text-slate-500">
                  {b._count.users} مستخدم · {b._count.customers} عميل · {b._count.invoices} فاتورة
                </span>
              : '-' },
          { key: 'isActive', header: 'الحالة',
            render: (b) => b.isActive
              ? <span className="badge-success">مفعّل</span>
              : <span className="badge-neutral">معطّل</span>,
          },
          { key: 'actions', header: 'الإجراءات', align: 'end',
            render: (b) => {
              const refs = (b._count?.users ?? 0) + (b._count?.customers ?? 0) + (b._count?.invoices ?? 0);
              const canHard = refs === 0;
              return (
                <div className="flex justify-end gap-1">
                  {b.isActive ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); softDelete(b); }}
                      className="btn-ghost text-amber-700 hover:bg-amber-50 px-2"
                      title="تعطيل"
                    >
                      <Trash2 size={14} />
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={(e) => { e.stopPropagation(); restore(b); }}
                        className="btn-ghost text-emerald-700 hover:bg-emerald-50 px-2"
                        title="إعادة تفعيل"
                      >
                        <RotateCcw size={14} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); hardDelete(b); }}
                        className={`btn-ghost px-2 ${canHard ? 'text-rose-600 hover:bg-rose-50' : 'text-slate-400 cursor-not-allowed'}`}
                        title={canHard ? 'حذف نهائي' : 'لا يمكن الحذف — مرتبط بسجلات'}
                        disabled={!canHard}
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </div>
              );
            },
          },
        ]}
      />

      {creating && (
        <CreateBranch
          onClose={() => setCreating(false)}
          onCreated={() => { qc.invalidateQueries({ queryKey: ['branches'] }); setCreating(false); }}
        />
      )}
    </section>
  );
}

function CreateBranch({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ code: '', name: '', address: '', phone: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(null);
    try {
      await api.post('/branches', form);
      onCreated();
    } catch (e) { setErr(asMessage(e)); } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <form onSubmit={submit} className="w-full max-w-sm bg-white shadow-xl p-4 space-y-2">
        <h3 className="font-bold">فرع جديد</h3>
        <Field label="الكود" value={form.code} onChange={(v) => setForm((s) => ({ ...s, code: v }))} required />
        <Field label="الاسم" value={form.name} onChange={(v) => setForm((s) => ({ ...s, name: v }))} required />
        <Field label="العنوان" value={form.address} onChange={(v) => setForm((s) => ({ ...s, address: v }))} />
        <Field label="الهاتف" value={form.phone} onChange={(v) => setForm((s) => ({ ...s, phone: v }))} />
        {err && <div className="text-xs text-rose-600">{err}</div>}
        <button type="submit" disabled={busy} className="w-full bg-indigo-600 disabled:opacity-60 text-white rounded-lg py-2 text-sm">
          {busy ? '...' : 'إنشاء'}
        </button>
      </form>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', required }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium">{label}</span>
      <input
        type={type} value={value} required={required}
        onChange={(e) => onChange(e.target.value)}
        className="block w-full border border-slate-300 rounded-lg px-2 py-2 text-sm mt-0.5"
      />
    </label>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-2 border-b border-slate-100 last:border-0">
      <span className="text-slate-500 text-sm">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
