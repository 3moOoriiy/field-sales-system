import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import {
  ReceiptText, Wallet, Undo2, Users as UsersIcon, AlertTriangle, TrendingUp, ArrowUpRight, Sparkles,
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { fmtMoney, fmtDate, timeAgo } from '../lib/format';
import { useRealtime } from '../components/RealtimeProvider';
import { useAuth } from '../lib/auth';

interface InvoiceRow {
  id: string; invoiceNumber: string; totalAmount: string; status: string;
  issuedAt: string;
  customer: { storeName: string };
  createdBy: { fullName: string; username: string };
}

export function Dashboard() {
  const { t } = useTranslation();
  const user = useAuth((s) => s.user);
  const { alerts } = useRealtime();
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(id); }, []);

  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);

  const invoicesQuery = useQuery({
    queryKey: ['invoices', 'today'],
    queryFn: async () => (await api.get<{ items: InvoiceRow[]; total: number }>('/invoices', {
      params: { from: today.toISOString(), take: 50 },
    })).data,
    refetchInterval: 60_000,
  });

  const paymentsQuery = useQuery({
    queryKey: ['payments', 'today'],
    queryFn: async () => (await api.get<{ items: { amount: string }[] }>('/payments', {
      params: { from: today.toISOString(), take: 200 },
    })).data,
    refetchInterval: 60_000,
  });

  const returnsQuery = useQuery({
    queryKey: ['returns', 'today'],
    queryFn: async () => (await api.get<{ items: { totalAmount: string }[] }>('/returns', {
      params: { from: today.toISOString(), take: 200 },
    })).data,
    refetchInterval: 60_000,
  });

  const debtsQuery = useQuery({
    queryKey: ['customers', 'top-debtors'],
    queryFn: async () => (await api.get<{ id: string; storeName: string; balance: string }[]>('/customers/top-debtors', {
      params: { limit: 10 },
    })).data,
  });

  const todayTotal = invoicesQuery.data?.items.reduce((acc, i) => i.status !== 'CANCELLED' ? acc + Number(i.totalAmount) : acc, 0) ?? 0;
  const todayInvoiceCount = invoicesQuery.data?.items.filter((i) => i.status !== 'CANCELLED').length ?? 0;
  const collectionsTotal = paymentsQuery.data?.items.reduce((acc, p) => acc + Number(p.amount), 0) ?? 0;
  const returnsTotal = returnsQuery.data?.items.reduce((acc, r) => acc + Number(r.totalAmount), 0) ?? 0;
  const debt = debtsQuery.data?.reduce((a, c) => a + Number(c.balance), 0) ?? 0;

  // Bucket invoices by hour for the chart
  const chart = useMemo(() => {
    const buckets = Array.from({ length: 24 }, (_, h) => ({ hour: `${h}:00`, sales: 0 }));
    for (const inv of invoicesQuery.data?.items ?? []) {
      if (inv.status === 'CANCELLED') continue;
      const h = new Date(inv.issuedAt).getHours();
      buckets[h].sales += Number(inv.totalAmount);
    }
    return buckets;
  }, [invoicesQuery.data]);

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 text-white p-6 md:p-8">
        <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-white/10 blur-3xl" aria-hidden />
        <div className="absolute -bottom-32 -left-20 w-96 h-96 rounded-full bg-violet-500/20 blur-3xl" aria-hidden />
        <div className="relative">
          <div className="flex items-center gap-2 text-indigo-100 text-sm">
            <Sparkles size={16} />
            <span>أهلاً، {user?.fullName ?? user?.username}</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mt-2 tracking-tight">
            {fmtMoney(todayTotal)}
          </h1>
          <p className="text-indigo-100 text-sm mt-1">
            مبيعات اليوم من {todayInvoiceCount} فاتورة
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              to="/invoices"
              className="bg-white/15 hover:bg-white/25 backdrop-blur text-sm px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition"
            >
              عرض الفواتير <ArrowUpRight size={14} />
            </Link>
            <Link
              to="/map"
              className="bg-white/15 hover:bg-white/25 backdrop-blur text-sm px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition"
            >
              خريطة المندوبين <ArrowUpRight size={14} />
            </Link>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi tone="emerald" icon={TrendingUp}  label={t('kpi.todaySales')}       value={fmtMoney(todayTotal)} />
        <Kpi tone="amber"   icon={Wallet}      label={t('kpi.totalCollections')} value={fmtMoney(collectionsTotal)} />
        <Kpi tone="rose"    icon={Undo2}       label={t('kpi.totalReturns')}     value={fmtMoney(returnsTotal)} />
        <Kpi tone="indigo"  icon={UsersIcon}   label={t('kpi.outstandingDebt')}  value={fmtMoney(debt)} />
      </div>

      {/* Chart + Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <section className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold">المبيعات على مدار اليوم</h3>
              <p className="text-xs text-slate-500 mt-0.5">{fmtDate(now)}</p>
            </div>
            <div className="badge-indigo">مباشر</div>
          </div>
          <div className="h-72">
            <ResponsiveContainer>
              <AreaChart data={chart} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="hour" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
                  formatter={(v: number) => fmtMoney(v)}
                  labelStyle={{ fontWeight: 600, color: '#0f172a' }}
                />
                <Area type="monotone" dataKey="sales" stroke="#6366f1" strokeWidth={2.5} fill="url(#salesGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">تنبيهات لحظية</h3>
            {alerts.length > 0 && <span className="badge-indigo">{alerts.length}</span>}
          </div>
          <ul className="space-y-2 max-h-72 overflow-auto -mx-1 px-1">
            {alerts.length === 0 && (
              <li className="text-xs text-slate-500 py-8 text-center">
                <ReceiptText size={24} className="mx-auto text-slate-300 mb-2" />
                لم تصل تنبيهات بعد.
              </li>
            )}
            {alerts.slice(0, 20).map((a) => {
              const isAlert = a.kind === 'alert.limit_exceeded';
              const label = a.kind === 'invoice.created' ? 'فاتورة جديدة'
                : a.kind === 'invoice.cancelled' ? 'إلغاء فاتورة'
                : a.kind === 'return.created' ? 'مرتجع جديد'
                : a.kind === 'payment.created' ? 'تحصيل جديد'
                : a.kind === 'visit.checkin' ? 'تسجيل زيارة'
                : a.kind === 'alert.limit_exceeded' ? 'تجاوز حد!'
                : a.kind;
              return (
                <li key={a.id} className={`p-2.5 rounded-xl flex items-start gap-2.5 ${
                  isAlert ? 'bg-rose-50 ring-1 ring-rose-200' : 'bg-slate-50'
                }`}>
                  {isAlert
                    ? <AlertTriangle size={14} className="text-rose-600 mt-0.5 shrink-0" />
                    : <span className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <div className={`text-xs font-semibold ${isAlert ? 'text-rose-800' : 'text-slate-700'}`}>{label}</div>
                    <div className="text-[10px] text-slate-400">{timeAgo(new Date(a.at))}</div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      {/* Recent invoices */}
      <section className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-semibold">آخر الفواتير</h3>
            <p className="text-xs text-slate-500 mt-0.5">آخر 8 فواتير اليوم</p>
          </div>
          <Link to="/invoices" className="text-xs text-indigo-600 font-medium hover:underline">عرض الكل</Link>
        </div>
        <ul className="divide-y divide-slate-100">
          {(invoicesQuery.data?.items ?? []).slice(0, 8).map((inv) => (
            <li key={inv.id}>
              <Link
                to={`/invoices/${inv.id}`}
                className="flex items-center justify-between py-3 px-1 -mx-1 rounded-lg hover:bg-slate-50 transition"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-600 grid place-items-center text-xs font-bold shrink-0">
                    {inv.customer.storeName.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">{inv.customer.storeName}</div>
                    <div className="text-[11px] text-slate-500 truncate">
                      {inv.invoiceNumber} · {inv.createdBy.fullName} · {fmtDate(inv.issuedAt)}
                    </div>
                  </div>
                </div>
                <div className="text-end shrink-0">
                  <div className="font-bold" data-numeric="true">{fmtMoney(inv.totalAmount)}</div>
                  <div className={`text-[10px] ${
                    inv.status === 'CANCELLED' ? 'text-rose-600'
                    : inv.status === 'PAID' ? 'text-emerald-600'
                    : 'text-slate-500'
                  }`}>
                    {inv.status}
                  </div>
                </div>
              </Link>
            </li>
          ))}
          {invoicesQuery.data && invoicesQuery.data.items.length === 0 && (
            <li className="text-xs text-slate-500 py-12 text-center">
              <ReceiptText size={32} className="mx-auto text-slate-300 mb-2" />
              لا توجد فواتير اليوم بعد.
            </li>
          )}
        </ul>
      </section>
    </div>
  );
}

function Kpi({ tone, icon: Icon, label, value }: {
  tone: 'indigo'|'emerald'|'amber'|'rose'; icon: React.ComponentType<{size?: number; strokeWidth?: number}>; label: string; value: string;
}) {
  const tones = {
    indigo:  { bg: 'from-indigo-500 to-indigo-700', iconBg: 'bg-indigo-50', iconText: 'text-indigo-600' },
    emerald: { bg: 'from-emerald-500 to-emerald-700', iconBg: 'bg-emerald-50', iconText: 'text-emerald-600' },
    amber:   { bg: 'from-amber-500 to-orange-600', iconBg: 'bg-amber-50', iconText: 'text-amber-600' },
    rose:    { bg: 'from-rose-500 to-rose-700', iconBg: 'bg-rose-50', iconText: 'text-rose-600' },
  } as const;
  const c = tones[tone];
  return (
    <div className="card p-4 relative overflow-hidden card-hover">
      <div className={`absolute -top-10 -right-10 w-24 h-24 rounded-full bg-gradient-to-br ${c.bg} opacity-10 blur-2xl`} aria-hidden />
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl ${c.iconBg} ${c.iconText} grid place-items-center`}>
          <Icon size={20} strokeWidth={2.2} />
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold">{label}</div>
          <div className="text-lg font-bold mt-0.5" data-numeric="true">{value}</div>
        </div>
      </div>
    </div>
  );
}
