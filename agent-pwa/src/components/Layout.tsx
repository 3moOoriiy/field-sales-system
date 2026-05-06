import { useEffect } from 'react';
import { NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { startSyncEngine, stopSyncEngine } from '../lib/sync';
import { startTracking, stopTracking } from '../lib/gps';
import { connectSocket, disconnectSocket } from '../lib/socket';
import { SyncBadge } from './SyncBadge';
import { InstallPrompt } from './InstallPrompt';

export function Layout() {
  const user = useAuth((s) => s.user);
  const location = useLocation();

  useEffect(() => {
    if (!user) return;
    startSyncEngine();
    void startTracking();
    connectSocket();
    return () => {
      stopSyncEngine();
      void stopTracking();
      disconnectSocket();
    };
  }, [user]);

  if (!user) return <Navigate to="/login" replace />;

  // Hide top header on Home (it has its own hero)
  const showHeader = location.pathname !== '/';
  const initials = (user.fullName ?? user.username ?? '?').split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]).join('').toUpperCase();

  return (
    <div className="min-h-screen flex flex-col pb-20 safe-top">
      {showHeader && (
        <header className="bg-white/90 backdrop-blur-xl border-b border-slate-200/70 px-4 py-3 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 grid place-items-center text-white text-xs font-bold shadow-sm shadow-brand-600/30">
              {initials}
            </div>
            <div>
              <div className="font-semibold text-sm leading-tight">{user.fullName ?? user.username}</div>
              <div className="text-[10px] text-slate-500">{user.role}</div>
            </div>
          </div>
          <SyncBadge />
        </header>
      )}

      {/* Floating sync badge on home (since header is hidden) */}
      {!showHeader && (
        <div className="absolute top-4 ltr:right-4 rtl:left-4 z-30">
          <SyncBadge />
        </div>
      )}

      <main className="flex-1 p-4">
        <Outlet />
      </main>

      <BottomNav />
      <InstallPrompt />
    </div>
  );
}

function BottomNav() {
  return (
    <nav className="fixed bottom-3 inset-x-3 bg-white/95 backdrop-blur-xl border border-slate-200/70 rounded-2xl shadow-card-lg grid grid-cols-5 z-30 safe-bottom">
      <Tab to="/"             icon="🏠" label="الرئيسية" />
      <Tab to="/customers"    icon="🏪" label="العملاء"   />
      <Tab to="/invoices/new" icon="🧾" label="فاتورة"    primary />
      <Tab to="/visits"       icon="📍" label="زيارات"   />
      <Tab to="/profile"      icon="⚙️" label="حسابي"    />
    </nav>
  );
}

function Tab({ to, icon, label, primary }: { to: string; icon: string; label: string; primary?: boolean }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        `relative flex flex-col items-center justify-center py-2.5 transition ${
          isActive ? 'text-brand-600' : 'text-slate-500'
        }`
      }
    >
      {({ isActive }) => (
        <>
          {primary ? (
            <div className={`w-10 h-10 rounded-2xl grid place-items-center text-lg mb-0.5 transition ${
              isActive
                ? 'bg-gradient-to-b from-brand-500 to-brand-600 text-white shadow-md shadow-brand-600/30'
                : 'bg-slate-100 text-slate-600'
            }`}>
              {icon}
            </div>
          ) : (
            <span className={`text-base leading-none mb-1 ${isActive ? 'scale-110' : ''} transition`}>
              {icon}
            </span>
          )}
          <span className="text-[10px] font-semibold">{label}</span>
          {isActive && !primary && (
            <span className="absolute -top-0.5 w-1 h-1 rounded-full bg-brand-600" />
          )}
        </>
      )}
    </NavLink>
  );
}
