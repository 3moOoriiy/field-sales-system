import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard, Users, Shield, Map, Store, Package, ReceiptText,
  Undo2, Wallet, ClipboardList, BarChart3, Settings as SettingsIcon, ScrollText,
  type LucideIcon,
} from 'lucide-react';

interface NavEntry {
  to: string;
  label: keyof typeof labels;
  icon: LucideIcon;
}
type Group = { heading: keyof typeof labels | null; items: NavEntry[] };

const labels = {
  dashboard: '', agents: '', permissions: '', map: '', customers: '',
  products: '', invoices: '', returns: '', payments: '', visits: '',
  reports: '', settings: '', audit: '',
  // Section headers
  overview: '', sales: '', operations: '', admin: '',
} as const;

const groups: Group[] = [
  {
    heading: 'overview',
    items: [
      { to: '/',     label: 'dashboard', icon: LayoutDashboard },
      { to: '/map',  label: 'map',       icon: Map },
    ],
  },
  {
    heading: 'sales',
    items: [
      { to: '/customers', label: 'customers', icon: Store },
      { to: '/products',  label: 'products',  icon: Package },
      { to: '/invoices',  label: 'invoices',  icon: ReceiptText },
      { to: '/returns',   label: 'returns',   icon: Undo2 },
      { to: '/payments',  label: 'payments',  icon: Wallet },
    ],
  },
  {
    heading: 'operations',
    items: [
      { to: '/visits',  label: 'visits',  icon: ClipboardList },
      { to: '/reports', label: 'reports', icon: BarChart3 },
    ],
  },
  {
    heading: 'admin',
    items: [
      { to: '/agents',      label: 'agents',      icon: Users },
      { to: '/permissions', label: 'permissions', icon: Shield },
      { to: '/settings',    label: 'settings',    icon: SettingsIcon },
      { to: '/audit',       label: 'audit',       icon: ScrollText },
    ],
  },
];

const sectionLabels: Record<NonNullable<Group['heading']>, string> = {
  overview:   'نظرة عامة',
  sales:      'المبيعات',
  operations: 'العمليات',
  admin:      'الإدارة',
  // unused but typed
  dashboard: '', agents: '', permissions: '', map: '', customers: '',
  products: '', invoices: '', returns: '', payments: '', visits: '',
  reports: '', settings: '', audit: '',
};

interface Props {
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ open, onClose }: Props) {
  const { t } = useTranslation();
  return (
    <>
      <aside
        className={`fixed inset-y-0 z-30 w-64 bg-slate-950 text-slate-100 flex flex-col
          transition-transform duration-300 ease-out shadow-2xl ${
            open ? 'translate-x-0' : 'translate-x-full md:translate-x-0'
          } ltr:left-0 ltr:right-auto rtl:right-0 rtl:left-auto`}
      >
        <div className="px-5 py-5 border-b border-white/5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 grid place-items-center text-white font-extrabold shadow-lg shadow-brand-900/40 ring-1 ring-white/10">
            FS
          </div>
          <div>
            <div className="font-semibold text-sm leading-tight tracking-tight">{t('app.name')}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">v1.0 · Admin Console</div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-5">
          {groups.map((g, gi) => (
            <div key={gi}>
              {g.heading && (
                <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 px-2 mb-1.5">
                  {sectionLabels[g.heading]}
                </div>
              )}
              <div className="space-y-0.5">
                {g.items.map((n) => (
                  <NavLink
                    key={n.to}
                    to={n.to}
                    end={n.to === '/'}
                    onClick={onClose}
                    className={({ isActive }) =>
                      `relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 ${
                        isActive
                          ? 'bg-white/[0.07] text-white font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]'
                          : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && (
                          <span className="absolute ltr:left-0 rtl:right-0 inset-y-1 w-0.5 rounded-full bg-brand-400" />
                        )}
                        <n.icon size={17} strokeWidth={isActive ? 2.4 : 2} className={isActive ? 'text-brand-400' : ''} />
                        <span>{t(`nav.${n.label}`)}</span>
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="px-5 py-3 text-[10px] text-slate-600 border-t border-white/5">
          © 2026 Field Sales System
        </div>
      </aside>

      {open && (
        <button
          aria-label="close"
          onClick={onClose}
          className="fixed inset-0 z-20 bg-slate-900/50 backdrop-blur-sm md:hidden animate-fade-in"
        />
      )}
    </>
  );
}
