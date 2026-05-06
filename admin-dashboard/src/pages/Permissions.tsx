import { ALL_PERMISSIONS, PERMISSION_GROUPS } from '../lib/permissions';

/**
 * Reference page: lists every permission code in the system, grouped.
 * The actual per-user grant/deny editing happens in the Agents drawer.
 */
export function Permissions() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold">الصلاحيات</h1>
        <p className="text-xs text-slate-500">
          قائمة جميع رموز الصلاحيات. تعيين الصلاحيات لكل مستخدم يتم من صفحة المندوبين.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {PERMISSION_GROUPS.map((group) => (
          <section key={group} className="bg-white border border-slate-200 rounded-2xl p-4">
            <h3 className="font-semibold mb-2">{group}</h3>
            <ul className="text-sm divide-y divide-slate-100">
              {ALL_PERMISSIONS.filter((p) => p.group === group).map((p) => (
                <li key={p.code} className="py-2">
                  <code className="text-[11px] text-slate-400 block">{p.code}</code>
                  <div>{p.descriptionAr}</div>
                  <div className="text-[11px] text-slate-500">{p.description}</div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
