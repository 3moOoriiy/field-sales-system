import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../lib/auth';

export function RequireAuth() {
  const user = useAuth((s) => s.user);
  const loading = useAuth((s) => s.loading);
  const logout = useAuth((s) => s.logout);

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center text-slate-500 text-sm">
        جارٍ التحميل…
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'AGENT') {
    // Agents shouldn't be using the admin dashboard
    return (
      <div className="min-h-screen grid place-items-center p-6 text-center">
        <div className="space-y-3">
          <p className="font-semibold">هذه اللوحة للإدارة فقط</p>
          <p className="text-xs text-slate-500">
            دخلت بحساب مندوب ({user.username}). للوصول للوحة الأدمن سجّل خروج وادخل بحساب أدمن.
          </p>
          <p className="text-xs text-slate-500">
            تطبيق المندوب على{' '}
            <a href="http://localhost:5174" className="text-indigo-600 underline">
              localhost:5174
            </a>
          </p>
          <button
            onClick={() => logout()}
            className="bg-rose-600 text-white text-sm px-4 py-2 rounded-lg"
          >
            تسجيل خروج
          </button>
        </div>
      </div>
    );
  }
  return <Outlet />;
}
