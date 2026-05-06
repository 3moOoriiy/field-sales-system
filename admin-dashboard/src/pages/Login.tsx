import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { asMessage } from '../lib/api';
import { setLang, type Lang } from '../lib/i18n';

export function Login() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const login = useAuth((s) => s.login);
  const [u, setU] = useState('superadmin');
  const [p, setP] = useState('Admin@123');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null); setBusy(true);
    try {
      await login(u, p);
      navigate('/', { replace: true });
    } catch (e) {
      setErr(asMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const toggleLang = () => setLang((i18n.language === 'ar' ? 'en' : 'ar') as Lang);

  return (
    <div className="min-h-screen relative grid place-items-center p-6 bg-gradient-to-br from-slate-50 via-white to-indigo-50/40 overflow-hidden">
      {/* Decorative background blobs */}
      <div className="absolute -top-20 -left-20 w-72 h-72 rounded-full bg-indigo-200/40 blur-3xl" aria-hidden />
      <div className="absolute -bottom-32 -right-20 w-96 h-96 rounded-full bg-emerald-200/30 blur-3xl" aria-hidden />

      <form
        onSubmit={submit}
        className="relative w-full max-w-sm card p-8 space-y-5 shadow-xl shadow-indigo-900/5"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 grid place-items-center text-white font-bold shadow-md shadow-indigo-600/30">
              FS
            </div>
            <div>
              <h1 className="text-base font-bold leading-tight">{t('app.name')}</h1>
              <p className="text-[11px] text-slate-500">Field Sales</p>
            </div>
          </div>
          <button
            type="button"
            onClick={toggleLang}
            className="text-xs text-slate-500 hover:text-slate-900 flex items-center gap-1 px-2 py-1 rounded-md hover:bg-slate-100"
          >
            <Globe size={12} />
            {i18n.language === 'ar' ? 'EN' : 'AR'}
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">{t('fields.username')}</label>
            <input
              value={u} onChange={(e) => setU(e.target.value)}
              className="input" autoComplete="username" required autoFocus
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">{t('fields.password')}</label>
            <input
              type="password" value={p} onChange={(e) => setP(e.target.value)}
              className="input" autoComplete="current-password" required
            />
          </div>
        </div>

        {err && (
          <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
            {err}
          </div>
        )}

        <button
          type="submit"
          disabled={busy}
          className="btn-primary w-full py-2.5 text-base"
        >
          {busy ? '...' : i18n.language === 'ar' ? 'تسجيل دخول' : 'Sign in'}
        </button>

        <p className="text-[11px] text-slate-400 text-center">
          {i18n.language === 'ar' ? 'بيانات الدخول الافتراضية:' : 'Default credentials:'}
          {' '}
          <code className="text-slate-500">superadmin / Admin@123</code>
        </p>
      </form>
    </div>
  );
}
