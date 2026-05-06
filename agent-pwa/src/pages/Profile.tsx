import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import { onTrackingStatus, startTracking, stopTracking } from '../lib/gps';
import { onPendingChange, flushOutbox } from '../lib/sync';
import { promptInstall, onInstallable, isStandalone } from '../lib/pwa';
import { fmtTime } from '../lib/format';

export function Profile() {
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);

  const [tracking, setTracking] = useState(false);
  const [lastSentAt, setLastSentAt] = useState<number | undefined>();
  const [pending, setPending] = useState(0);
  const [canInstall, setCanInstall] = useState(false);

  useEffect(() => {
    const offTracking = onTrackingStatus((s) => {
      setTracking(s.tracking);
      setLastSentAt(s.lastSentAt);
    });
    const offSync = onPendingChange(setPending);
    const offInstall = onInstallable(setCanInstall);
    return () => { offTracking(); offSync(); offInstall(); };
  }, []);

  return (
    <div className="space-y-4">
      <div className="bg-white border rounded-2xl p-4">
        <div className="text-sm font-bold">{user?.fullName ?? user?.username}</div>
        <div className="text-xs text-slate-500">{user?.username} · {user?.role}</div>
      </div>

      <Card title="تتبع الموقع (GPS)">
        <div className="text-xs text-slate-500 mb-2">
          يُستخدم لإثبات الزيارات والتأكد من خدمة العملاء. يتم إيقاف التتبع تلقائياً عند تسجيل الخروج.
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm">{tracking ? 'مفعّل' : 'متوقف'}</span>
          <button
            onClick={() => (tracking ? stopTracking() : startTracking())}
            className={`text-xs px-3 py-2 rounded-lg ${tracking ? 'bg-rose-100 text-rose-700' : 'bg-indigo-600 text-white'}`}
          >
            {tracking ? 'إيقاف' : 'تشغيل'}
          </button>
        </div>
        {lastSentAt && (
          <div className="text-[11px] text-slate-400 mt-2">آخر إرسال: {fmtTime(lastSentAt)}</div>
        )}
      </Card>

      <Card title="المزامنة">
        <div className="flex items-center justify-between">
          <span className="text-sm">عناصر بانتظار المزامنة: {pending}</span>
          <button
            onClick={() => flushOutbox()}
            className="text-xs px-3 py-2 rounded-lg bg-indigo-600 text-white"
          >
            مزامنة الآن
          </button>
        </div>
      </Card>

      {!isStandalone() && canInstall && (
        <Card title="تثبيت التطبيق">
          <button
            onClick={() => promptInstall()}
            className="w-full bg-indigo-600 text-white text-sm rounded-xl py-2"
          >
            تثبيت
          </button>
        </Card>
      )}

      <button
        onClick={() => logout()}
        className="w-full bg-rose-600 text-white text-sm rounded-xl py-3 font-semibold"
      >
        تسجيل الخروج
      </button>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white border rounded-2xl p-4">
      <h3 className="text-sm font-bold mb-2">{title}</h3>
      {children}
    </section>
  );
}
