import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { connectSocket, disconnectSocket } from '../lib/socket';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { RealtimeProvider } from './RealtimeProvider';

export function AppShell() {
  const user = useAuth((s) => s.user);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    connectSocket();
    return () => disconnectSocket();
  }, [user]);

  return (
    <RealtimeProvider>
      <div className="min-h-screen bg-slate-50">
        <Sidebar open={open} onClose={() => setOpen(false)} />
        <div className="md:ltr:pl-64 md:rtl:pr-64">
          <Header onToggleSidebar={() => setOpen((v) => !v)} />
          <main className="p-4 md:p-6 max-w-[1600px] mx-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </RealtimeProvider>
  );
}
