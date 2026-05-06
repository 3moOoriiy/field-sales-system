import { useEffect, useState } from 'react';
import { onPendingChange, flushOutbox } from '../lib/sync';

export function SyncBadge() {
  const [pending, setPending] = useState(0);
  const [online, setOnline] = useState(navigator.onLine);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const off = onPendingChange(setPending);
    const on = () => setOnline(true);
    const off2 = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off2);
    return () => {
      off();
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off2);
    };
  }, []);

  const click = async () => {
    setSyncing(true);
    try { await flushOutbox(); } finally { setSyncing(false); }
  };

  if (online && pending === 0) {
    return <span className="text-[11px] px-2 py-1 rounded-full bg-emerald-500 text-white">متصل</span>;
  }

  return (
    <button
      onClick={click}
      disabled={syncing}
      className={`text-[11px] px-2 py-1 rounded-full text-white ${
        online ? 'bg-amber-500' : 'bg-slate-500'
      }`}
    >
      {!online && 'غير متصل'}
      {online && pending > 0 && (syncing ? 'جاري المزامنة…' : `قيد المزامنة (${pending})`)}
    </button>
  );
}
