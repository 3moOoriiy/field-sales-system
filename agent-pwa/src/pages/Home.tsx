import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';
import { fmtMoney, fmtTime } from '../lib/format';

interface InvoiceRow {
  id: string;
  invoiceNumber: string;
  totalAmount: string;
  status: string;
  issuedAt: string;
  customer: { storeName: string };
}

export function Home() {
  const user = useAuth((s) => s.user);
  const [todaysInvoices, setTodaysInvoices] = useState<InvoiceRow[]>([]);
  const [todaysTotal, setTodaysTotal] = useState(0);
  const [pendingTasks, setPendingTasks] = useState(0);

  useEffect(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    api.get<{ items: InvoiceRow[]; total: number }>('/invoices', {
      params: { from: today.toISOString(), take: 30 },
    }).then(({ data }) => {
      const active = data.items.filter((i) => i.status !== 'CANCELLED');
      setTodaysInvoices(active);
      setTodaysTotal(active.reduce((acc, i) => acc + Number(i.totalAmount), 0));
    }).catch(() => {});

    api.get<{ items: { id: string }[]; total: number }>('/visits/tasks', {
      params: { status: 'PLANNED' },
    }).then(({ data }) => setPendingTasks(data.total)).catch(() => {});
  }, []);

  return (
    <div className="space-y-5">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 via-brand-700 to-violet-800 text-white p-5 shadow-card-lg">
        <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-16 -left-12 w-56 h-56 rounded-full bg-violet-400/20 blur-3xl" />
        <div className="relative">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[11px] text-brand-100/80 font-medium">أهلاً</div>
              <div className="font-semibold text-base mt-0.5">{user?.fullName ?? user?.username}</div>
            </div>
            <div className="text-[10px] bg-white/15 backdrop-blur px-2.5 py-1 rounded-full">{user?.role}</div>
          </div>

          <div className="mt-5">
            <div className="text-[11px] uppercase tracking-wider text-brand-200/80 font-semibold">مبيعات اليوم</div>
            <div className="text-3xl font-extrabold mt-1 tracking-tight" data-numeric="true">
              {fmtMoney(todaysTotal)}
            </div>
            <div className="grid grid-cols-2 gap-3 mt-4">
              <Stat label="فواتير" value={String(todaysInvoices.length)} />
              <Stat label="مهام زيارة" value={String(pendingTasks)} />
            </div>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3">
        <ActionTile to="/invoices/new" icon="🧾" label="فاتورة جديدة" tone="indigo" />
        <ActionTile to="/customers"    icon="🏪" label="العملاء"      tone="emerald" />
        <ActionTile to="/visits"       icon="📍" label="زيارات اليوم"  tone="amber"
                    badge={pendingTasks > 0 ? String(pendingTasks) : undefined} />
        <ActionTile to="/payments/new" icon="💰" label="تحصيل دفعة"   tone="rose" />
      </div>

      {/* Recent invoices */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-bold text-slate-700">آخر الفواتير</h2>
          <Link to="/invoices" className="text-xs text-brand-600 font-medium">عرض الكل ←</Link>
        </div>
        {todaysInvoices.length === 0 ? (
          <div className="card p-8 text-center">
            <div className="text-3xl mb-2">🧾</div>
            <div className="text-sm font-medium text-slate-700">لم تصدر فواتير اليوم بعد</div>
            <Link to="/invoices/new" className="btn-primary mt-3">إنشاء فاتورة جديدة</Link>
          </div>
        ) : (
          <ul className="space-y-2">
            {todaysInvoices.slice(0, 6).map((inv) => (
              <li key={inv.id}>
                <Link to={`/invoices/${inv.id}`} className="card p-3 flex items-center gap-3 active:scale-[0.98] transition-transform">
                  <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 grid place-items-center font-bold text-sm shrink-0">
                    {inv.customer.storeName.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate">{inv.customer.storeName}</div>
                    <div className="text-[11px] text-slate-500 truncate">
                      {inv.invoiceNumber} · {fmtTime(inv.issuedAt)}
                    </div>
                  </div>
                  <div className="text-end shrink-0">
                    <div className="font-bold text-sm" data-numeric="true">{fmtMoney(inv.totalAmount)}</div>
                    <div className={`text-[10px] mt-0.5 ${
                      inv.status === 'PAID' ? 'text-emerald-600'
                      : inv.status === 'CANCELLED' ? 'text-rose-600'
                      : 'text-slate-500'
                    }`}>
                      {inv.status === 'PAID' ? '✓ مدفوعة' : inv.status === 'CANCELLED' ? 'ملغاة' : inv.status}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white/10 backdrop-blur rounded-xl p-3 border border-white/10">
      <div className="text-[10px] uppercase tracking-wider text-brand-200/80 font-semibold">{label}</div>
      <div className="text-xl font-bold mt-0.5" data-numeric="true">{value}</div>
    </div>
  );
}

function ActionTile({ to, icon, label, tone, badge }: {
  to: string; icon: string; label: string;
  tone: 'indigo' | 'emerald' | 'amber' | 'rose';
  badge?: string;
}) {
  const tones = {
    indigo:  { bg: 'bg-brand-50',   text: 'text-brand-700',   ring: 'ring-brand-200/60' },
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-200/60' },
    amber:   { bg: 'bg-amber-50',   text: 'text-amber-700',   ring: 'ring-amber-200/60' },
    rose:    { bg: 'bg-rose-50',    text: 'text-rose-700',    ring: 'ring-rose-200/60' },
  } as const;
  const c = tones[tone];
  return (
    <Link
      to={to}
      className={`relative card p-4 flex flex-col items-center justify-center text-center active:scale-[0.97] transition-transform`}
    >
      {badge && (
        <span className="absolute top-2 left-2 bg-rose-500 text-white text-[10px] font-bold rounded-full px-1.5 min-w-[18px] h-[18px] grid place-items-center">
          {badge}
        </span>
      )}
      <div className={`w-12 h-12 rounded-2xl ${c.bg} ${c.text} ring-4 ${c.ring} grid place-items-center text-2xl mb-2`}>
        {icon}
      </div>
      <div className="text-xs font-semibold text-slate-700">{label}</div>
    </Link>
  );
}
