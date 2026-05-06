import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, asMessage } from '../lib/api';
import { fmtMoney, fmtDate } from '../lib/format';

interface Detail {
  id: string;
  invoiceNumber: string;
  status: string;
  paymentType: string;
  issuedAt: string;
  totalAmount: string;
  subtotal: string;
  taxAmount: string;
  discountAmount: string;
  paidAmount: string;
  signaturePath: string | null;
  notes: string | null;
  customer: { storeName: string; phone: string | null; address: string | null };
  createdBy: { fullName: string; username: string };
  items: Array<{ id: string; productName: string; productSku: string; unitPrice: string; quantity: string; lineTotal: string }>;
  payments: Array<{ id: string; receiptNumber: string; amount: string; paidAt: string; method: string }>;
  returns: Array<{ id: string; returnNumber: string; totalAmount: string; createdAt: string }>;
}

export function InvoiceDetail() {
  const { id } = useParams();
  const qc = useQueryClient();
  const detail = useQuery({
    queryKey: ['invoices', id],
    queryFn: async () => (await api.get<Detail>(`/invoices/${id}`)).data,
  });
  const inv = detail.data;
  const [reason, setReason] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const cancel = useMutation({
    mutationFn: async () => { await api.post(`/invoices/${id}/cancel`, { reason }); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices'] }); },
    onError: (e) => setErr(asMessage(e)),
  });

  if (detail.isLoading) return <div className="text-sm text-slate-500">جارٍ التحميل…</div>;
  if (!inv) return <div className="text-sm text-rose-600">غير موجود</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Link to="/invoices" className="text-xs text-indigo-600">← الفواتير</Link>
        <span className="flex-1" />
        <PrintMenu invoiceId={inv.id} />
      </div>

      <div className="bg-white border rounded-2xl p-4 grid md:grid-cols-3 gap-3">
        <div>
          <div className="text-xs text-slate-500">رقم الفاتورة</div>
          <div className="font-bold text-lg">{inv.invoiceNumber}</div>
          <div className="text-xs text-slate-500 mt-1">{fmtDate(inv.issuedAt)}</div>
        </div>
        <div>
          <div className="text-xs text-slate-500">العميل</div>
          <div className="font-semibold">{inv.customer.storeName}</div>
          <div className="text-xs text-slate-500">{inv.customer.phone ?? '-'} · {inv.customer.address ?? '-'}</div>
        </div>
        <div>
          <div className="text-xs text-slate-500">المندوب · الدفع · الحالة</div>
          <div className="font-semibold">{inv.createdBy.fullName}</div>
          <div className="text-xs text-slate-500">{inv.paymentType} · {inv.status}</div>
        </div>
      </div>

      <div className="bg-white border rounded-2xl overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-600">
            <tr>
              <th className="text-start px-3 py-2">الصنف</th>
              <th className="text-end px-3 py-2">السعر</th>
              <th className="text-end px-3 py-2">الكمية</th>
              <th className="text-end px-3 py-2">الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            {inv.items.map((it) => (
              <tr key={it.id} className="border-t border-slate-100">
                <td className="px-3 py-2">
                  {it.productName}
                  <div className="text-[10px] text-slate-400">{it.productSku}</div>
                </td>
                <td className="px-3 py-2 text-end">{fmtMoney(it.unitPrice)}</td>
                <td className="px-3 py-2 text-end">{Number(it.quantity)}</td>
                <td className="px-3 py-2 text-end font-semibold">{fmtMoney(it.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-white border rounded-2xl p-4 max-w-md ml-auto text-sm space-y-1">
        <Row label="الإجمالي قبل" value={fmtMoney(inv.subtotal)} />
        <Row label="خصم" value={`- ${fmtMoney(inv.discountAmount)}`} />
        <Row label="ضريبة" value={fmtMoney(inv.taxAmount)} />
        <Row label="مدفوع" value={fmtMoney(inv.paidAmount)} />
        <div className="border-t pt-1 mt-1">
          <Row label="الإجمالي" value={fmtMoney(inv.totalAmount)} bold />
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Section title={`التحصيلات (${inv.payments.length})`}>
          <ul className="text-xs divide-y">
            {inv.payments.map((p) => (
              <li key={p.id} className="py-1.5 flex justify-between">
                <span>{p.receiptNumber} · {fmtDate(p.paidAt)} · {p.method}</span>
                <span className="font-semibold text-emerald-700">{fmtMoney(p.amount)}</span>
              </li>
            ))}
            {inv.payments.length === 0 && <li className="text-slate-500">لا يوجد.</li>}
          </ul>
        </Section>
        <Section title={`المرتجعات (${inv.returns.length})`}>
          <ul className="text-xs divide-y">
            {inv.returns.map((r) => (
              <li key={r.id} className="py-1.5 flex justify-between">
                <span>{r.returnNumber} · {fmtDate(r.createdAt)}</span>
                <span className="font-semibold text-rose-700">{fmtMoney(r.totalAmount)}</span>
              </li>
            ))}
            {inv.returns.length === 0 && <li className="text-slate-500">لا يوجد.</li>}
          </ul>
        </Section>
      </div>

      {inv.status !== 'CANCELLED' && (
        <Section title="إلغاء الفاتورة">
          <input
            value={reason} onChange={(e) => setReason(e.target.value)}
            placeholder="سبب الإلغاء"
            className="w-full border border-slate-300 rounded-lg px-2 py-2 text-sm mb-2"
          />
          {err && <div className="text-xs text-red-600 mb-2">{err}</div>}
          <button
            disabled={!reason || cancel.isPending}
            onClick={() => cancel.mutate()}
            className="w-full bg-rose-600 disabled:opacity-50 text-white rounded-lg py-2 text-sm"
          >
            {cancel.isPending ? '...' : 'تأكيد الإلغاء'}
          </button>
        </Section>
      )}
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? 'font-bold text-base' : ''}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-4">
      <h4 className="text-sm font-bold mb-2">{title}</h4>
      {children}
    </section>
  );
}

function PrintMenu({ invoiceId }: { invoiceId: string }) {
  const formats: Array<{ key: 'A4' | 'A5' | '58' | '80'; label: string }> = [
    { key: 'A4', label: 'A4' },
    { key: 'A5', label: 'A5' },
    { key: '80', label: 'حراري 80mm' },
    { key: '58', label: 'حراري 58mm' },
  ];

  const openPdf = async (fmt: string) => {
    const res = await api.get(`/print/invoices/${invoiceId}/pdf`, {
      params: { format: fmt }, responseType: 'blob',
    });
    const url = URL.createObjectURL(res.data);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  const openHtml = async (fmt: string) => {
    const res = await api.get(`/print/invoices/${invoiceId}/html`, {
      params: { format: fmt },
      responseType: 'text',
      transformResponse: (v) => v,
    });
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(res.data as unknown as string);
    w.document.close();
  };

  return (
    <div className="flex gap-1 flex-wrap">
      {formats.map((f) => (
        <div key={f.key} className="flex">
          <button onClick={() => openHtml(f.key)}
            className="text-xs px-2 py-1.5 rounded-s-lg bg-slate-700 text-white">
            عرض {f.label}
          </button>
          <button onClick={() => openPdf(f.key)}
            className="text-xs px-2 py-1.5 rounded-e-lg bg-indigo-600 text-white">
            PDF
          </button>
        </div>
      ))}
    </div>
  );
}
