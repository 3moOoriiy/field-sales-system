import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { asMessage } from '../lib/api';

export function Login() {
  const navigate = useNavigate();
  const login = useAuth((s) => s.login);
  const [u, setU] = useState('agent01');
  const [p, setP] = useState('Agent@123');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await login(u, p);
      navigate('/', { replace: true });
    } catch (e) {
      setErr(asMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen relative grid place-items-center p-6 overflow-hidden">
      {/* Premium background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-brand-700 via-brand-800 to-violet-900" />
      <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-brand-400/20 blur-3xl animate-pulse" />
      <div className="absolute -bottom-40 -right-32 w-[28rem] h-[28rem] rounded-full bg-violet-500/20 blur-3xl" />

      <div className="relative w-full max-w-sm animate-slide-up">
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 grid place-items-center text-white text-2xl font-extrabold shadow-2xl">
            FS
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Field Sales</h1>
          <p className="text-brand-200/80 text-sm mt-1">تطبيق المندوب</p>
        </div>

        <form
          onSubmit={submit}
          className="bg-white/95 backdrop-blur-xl rounded-3xl p-6 shadow-2xl border border-white/40 space-y-4"
        >
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1.5 block">اسم المستخدم</label>
            <input
              value={u}
              onChange={(e) => setU(e.target.value)}
              autoComplete="username"
              required
              className="input"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1.5 block">كلمة المرور</label>
            <input
              type="password"
              value={p}
              onChange={(e) => setP(e.target.value)}
              autoComplete="current-password"
              required
              className="input"
            />
          </div>

          {err && (
            <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2.5">
              {err}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="btn-primary w-full text-base py-3 mt-2"
          >
            {busy ? '...' : 'دخول'}
          </button>
        </form>

        <p className="text-center text-[11px] text-white/50 mt-4">
          النسخة 1.0 · 2026 ©
        </p>
      </div>
    </div>
  );
}
