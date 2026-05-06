import { LucideIcon } from 'lucide-react';

interface Props {
  title: string;
  value: string | number;
  icon: LucideIcon;
  hint?: string;
  tone?: 'indigo' | 'emerald' | 'amber' | 'rose' | 'slate';
}

const tones: Record<NonNullable<Props['tone']>, { iconBg: string; iconText: string; ring: string }> = {
  indigo:  { iconBg: 'bg-indigo-50',  iconText: 'text-indigo-600',  ring: 'ring-indigo-100' },
  emerald: { iconBg: 'bg-emerald-50', iconText: 'text-emerald-600', ring: 'ring-emerald-100' },
  amber:   { iconBg: 'bg-amber-50',   iconText: 'text-amber-600',   ring: 'ring-amber-100' },
  rose:    { iconBg: 'bg-rose-50',    iconText: 'text-rose-600',    ring: 'ring-rose-100' },
  slate:   { iconBg: 'bg-slate-100',  iconText: 'text-slate-600',   ring: 'ring-slate-200' },
};

export function StatCard({ title, value, icon: Icon, hint, tone = 'indigo' }: Props) {
  const c = tones[tone];
  return (
    <div className="card card-hover p-4 flex items-center gap-3">
      <div className={`w-11 h-11 rounded-xl ${c.iconBg} ${c.iconText} grid place-items-center ring-4 ${c.ring}`}>
        <Icon size={20} strokeWidth={2.2} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] uppercase tracking-wide text-slate-500 font-medium">{title}</div>
        <div className="text-xl font-bold truncate" data-numeric="true">{value}</div>
        {hint && <div className="text-[11px] text-slate-400">{hint}</div>}
      </div>
    </div>
  );
}
