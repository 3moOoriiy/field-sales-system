import { ReactNode } from 'react';

interface Props {
  title: string;
  hint?: string;
  action?: ReactNode;
  icon?: ReactNode;
}

export function Empty({ title, hint, action, icon }: Props) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl py-10 px-6 text-center">
      {icon && <div className="mb-3 text-slate-400 inline-flex">{icon}</div>}
      <div className="font-semibold">{title}</div>
      {hint && <div className="text-xs text-slate-500 mt-1">{hint}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
