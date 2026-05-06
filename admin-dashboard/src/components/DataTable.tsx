import { ReactNode } from 'react';

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
  width?: string;
  align?: 'start' | 'center' | 'end';
}

interface Props<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  empty?: string;
  onRowClick?: (row: T) => void;
}

export function DataTable<T>({ columns, rows, rowKey, loading, empty = '—', onRowClick }: Props<T>) {
  if (loading) {
    return (
      <div className="card p-4">
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-3">
              <div className="skeleton h-4 flex-1" />
              <div className="skeleton h-4 w-24" />
              <div className="skeleton h-4 w-20" />
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <div className="card p-10 text-center">
        <div className="text-sm text-slate-500">{empty}</div>
      </div>
    );
  }
  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-slate-50/80 border-b border-slate-200">
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={`text-${c.align ?? 'start'} px-4 py-2.5 text-[11px] uppercase tracking-wide font-semibold text-slate-500`}
                  style={{ width: c.width }}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={rowKey(r)}
                onClick={onRowClick ? () => onRowClick(r) : undefined}
                className={`border-t border-slate-100/80 ${
                  onRowClick ? 'cursor-pointer hover:bg-indigo-50/30 transition' : ''
                }`}
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={`px-4 py-3 text-${c.align ?? 'start'} text-slate-700`}
                  >
                    {c.render ? c.render(r) : String((r as Record<string, unknown>)[c.key] ?? '-')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
