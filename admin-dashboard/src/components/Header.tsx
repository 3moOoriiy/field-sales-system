import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Menu, LogOut, Globe, Bell, Search } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { setLang, type Lang } from '../lib/i18n';
import { useRealtime } from './RealtimeProvider';
import { timeAgo } from '../lib/format';

interface Props {
  onToggleSidebar: () => void;
}

export function Header({ onToggleSidebar }: Props) {
  const { t, i18n } = useTranslation();
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const { alerts } = useRealtime();
  const [notifOpen, setNotifOpen] = useState(false);

  const toggle = () => setLang((i18n.language === 'ar' ? 'en' : 'ar') as Lang);

  const initials = (user?.fullName ?? user?.username ?? '??')
    .split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]).join('').toUpperCase();

  return (
    <header className="bg-white/80 backdrop-blur-xl border-b border-slate-200/70 px-4 md:px-6 h-16 flex items-center justify-between sticky top-0 z-20">
      <div className="flex items-center gap-3 flex-1 max-w-2xl">
        <button
          onClick={onToggleSidebar}
          className="md:hidden text-slate-600 p-2 -m-2 rounded-md hover:bg-slate-100"
          aria-label="menu"
        >
          <Menu size={20} />
        </button>

        {/* Global search (decorative for now — backend search is on individual list pages) */}
        <div className="relative flex-1 max-w-md hidden md:block">
          <Search size={14} className="absolute top-1/2 -translate-y-1/2 ltr:left-3 rtl:right-3 text-slate-400" />
          <input
            type="search"
            placeholder={i18n.language === 'ar' ? 'بحث سريع…' : 'Quick search…'}
            className="w-full bg-slate-100/70 hover:bg-slate-100 focus:bg-white border border-transparent focus:border-brand-500 ltr:pl-9 rtl:pr-9 pr-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-4 focus:ring-brand-500/15 transition"
          />
        </div>
      </div>

      <div className="flex items-center gap-1">
        {/* Lang toggle */}
        <button
          onClick={toggle}
          className="text-xs px-2.5 py-1.5 rounded-lg hover:bg-slate-100 flex items-center gap-1.5 text-slate-600 font-medium transition"
        >
          <Globe size={14} />
          {i18n.language === 'ar' ? 'EN' : 'AR'}
        </button>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setNotifOpen((v) => !v)}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 relative transition"
            aria-label="notifications"
          >
            <Bell size={16} />
            {alerts.length > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white" />
            )}
          </button>
          {notifOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setNotifOpen(false)} />
              <div className="absolute top-full mt-2 ltr:right-0 rtl:left-0 w-80 card p-2 z-20 animate-slide-up max-h-96 overflow-auto">
                <div className="px-3 py-2 flex items-center justify-between">
                  <span className="text-sm font-semibold">التنبيهات</span>
                  <span className="text-[10px] text-slate-400">{alerts.length}</span>
                </div>
                {alerts.length === 0 && (
                  <div className="text-xs text-slate-500 text-center py-8">
                    لا توجد تنبيهات بعد.
                  </div>
                )}
                {alerts.slice(0, 10).map((a) => (
                  <div key={a.id} className="px-3 py-2 hover:bg-slate-50 rounded-lg text-xs">
                    <div className="font-medium text-slate-700">{a.kind}</div>
                    <div className="text-[10px] text-slate-400">{timeAgo(new Date(a.at))}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="w-px h-6 bg-slate-200 mx-1.5 hidden sm:block" aria-hidden />

        {/* User chip */}
        <div className="hidden sm:flex items-center gap-2 px-1.5 py-1 rounded-lg">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 grid place-items-center text-white text-[11px] font-bold shadow-sm shadow-brand-600/30 ring-1 ring-white/30">
            {initials}
          </div>
          <div className="hidden md:block text-xs leading-tight">
            <div className="font-semibold text-slate-700">{user?.fullName ?? user?.username}</div>
            <div className="text-[10px] text-slate-400">{user?.role}</div>
          </div>
        </div>

        <button
          onClick={() => logout()}
          className="text-xs px-2.5 py-1.5 rounded-lg hover:bg-rose-50 text-rose-600 flex items-center gap-1.5 font-medium transition"
        >
          <LogOut size={14} />
          <span className="hidden sm:inline">{t('actions.logout')}</span>
        </button>
      </div>
    </header>
  );
}
