import { ReactNode } from 'react';
import { Filter } from 'lucide-react';

export function FilterBar({ children }: { children: ReactNode }) {
  return (
    <div className="card p-3 flex items-center gap-2 flex-wrap mb-4">
      <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium pr-1">
        <Filter size={14} />
        <span>تصفية</span>
      </div>
      {children}
    </div>
  );
}
