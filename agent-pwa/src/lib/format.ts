export function fmtMoney(v: string | number, currency = 'EGP'): string {
  const n = typeof v === 'string' ? Number(v) : v;
  if (!Number.isFinite(n)) return '-';
  return `${n.toFixed(2)} ${currency}`;
}

export function fmtNumber(v: string | number, digits = 2): string {
  const n = typeof v === 'string' ? Number(v) : v;
  if (!Number.isFinite(n)) return '-';
  return n.toLocaleString(undefined, { maximumFractionDigits: digits });
}

export function fmtDate(v: string | number | Date): string {
  const d = typeof v === 'number' ? new Date(v) : typeof v === 'string' ? new Date(v) : v;
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('ar-SA-u-ca-gregory', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

export function fmtTime(v: string | number | Date): string {
  const d = typeof v === 'number' ? new Date(v) : typeof v === 'string' ? new Date(v) : v;
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}
