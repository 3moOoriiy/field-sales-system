export function fmtMoney(v: string | number | null | undefined, currency = 'EGP'): string {
  if (v == null) return '-';
  const n = typeof v === 'string' ? Number(v) : v;
  if (!Number.isFinite(n)) return '-';
  return `${n.toFixed(2)} ${currency}`;
}

export function fmtNumber(v: string | number | null | undefined, digits = 2): string {
  if (v == null) return '-';
  const n = typeof v === 'string' ? Number(v) : v;
  if (!Number.isFinite(n)) return '-';
  return n.toLocaleString(undefined, { maximumFractionDigits: digits });
}

function toDate(v: string | number | Date | null | undefined): Date | null {
  if (v == null) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function fmtDate(v: string | number | Date | null | undefined): string {
  const d = toDate(v);
  if (!d) return '-';
  return d.toLocaleString(undefined, {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

export function fmtDateOnly(v: string | number | Date | null | undefined): string {
  const d = toDate(v);
  if (!d) return '-';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit' });
}

export function timeAgo(v: string | number | Date | null | undefined, locale: string = 'ar'): string {
  const d = toDate(v);
  if (!d) return '-';
  const diff = (Date.now() - d.getTime()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  if (diff < 60) return rtf.format(-Math.round(diff), 'second');
  if (diff < 3600) return rtf.format(-Math.round(diff / 60), 'minute');
  if (diff < 86400) return rtf.format(-Math.round(diff / 3600), 'hour');
  return rtf.format(-Math.round(diff / 86400), 'day');
}
