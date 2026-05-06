import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, asMessage } from '../lib/api';
import { enqueue } from '../lib/db';
import { fmtMoney, fmtDate } from '../lib/format';
import { SignaturePad } from '../components/SignaturePad';
import { PhotoUpload } from '../components/PhotoUpload';

interface InvoiceDetail {
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
  items: Array<{
    id: string; productName: string; productSku: string;
    unitPrice: string; quantity: string; lineTotal: string;
  }>;
}

export function InvoiceDetail() {
  const { id } = useParams();
  const [inv, setInv] = useState<InvoiceDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [savedSig, setSavedSig] = useState(false);
  const [showSign, setShowSign] = useState(false);

  const refresh = async () => {
    try {
      const { data } = await api.get<InvoiceDetail>(`/invoices/${id}`);
      setInv(data);
      setSavedSig(!!data.signaturePath);
    } catch (e) {
      setErr(asMessage(e));
    }
  };
  useEffect(() => { void refresh(); }, [id]);

  const saveSignature = async () => {
    if (!signature) return;
    try {
      if (navigator.onLine) {
        await api.post(`/invoices/${id}/signature`, { dataUrl: signature });
      } else {
        await enqueue({ kind: 'signature.upload', payload: { invoiceId: id, dataUrl: signature } });
      }
      setSavedSig(true);
      setShowSign(false);
      await refresh();
    } catch (e) {
      setErr(asMessage(e));
    }
  };

  const print = () => window.print();

  if (err) return <div className="text-sm text-red-600">{err}</div>;
  if (!inv) return <div className="text-xs text-slate-500">جارٍ التحميل…</div>;

  return (
    <div className="space-y-3">
      <div className="bg-white border rounded-2xl p-4">
        <div className="flex items-center justify-between mb-2">
          <h1 className="font-bold">{inv.invoiceNumber}</h1>
          <span className="text-[11px] px-2 py-1 rounded bg-slate-100">{inv.status}</span>
        </div>
        <div className="text-xs text-slate-500">{fmtDate(inv.issuedAt)}</div>
        <div className="mt-3 text-sm">
          <div className="font-semibold">{inv.customer.storeName}</div>
          <div className="text-xs text-slate-500">{inv.customer.phone ?? '-'} · {inv.customer.address ?? '-'}</div>
        </div>
      </div>

      <ul className="bg-white border rounded-2xl divide-y">
        {inv.items.map((it) => (
          <li key={it.id} className="px-4 py-3">
            <div className="flex justify-between text-sm">
              <span>{it.productName}</span>
              <span className="font-semibold">{fmtMoney(it.lineTotal)}</span>
            </div>
            <div className="text-[11px] text-slate-500">
              {it.productSku} · {Number(it.quantity)} × {fmtMoney(it.unitPrice)}
            </div>
          </li>
        ))}
      </ul>

      <div className="bg-white border rounded-2xl p-4 text-sm space-y-1">
        <Row label="الإجمالي قبل" value={fmtMoney(inv.subtotal)} />
        <Row label="خصم" value={`- ${fmtMoney(inv.discountAmount)}`} />
        <Row label="ضريبة" value={fmtMoney(inv.taxAmount)} />
        <Row label="مدفوع" value={fmtMoney(inv.paidAmount)} />
        <div className="border-t pt-1 mt-1">
          <Row label="الإجمالي" value={fmtMoney(inv.totalAmount)} bold />
        </div>
      </div>

      <div className="bg-white border rounded-2xl p-4 space-y-3">
        <h3 className="text-sm font-bold">توقيع العميل</h3>
        {savedSig && !showSign && (
          <div className="text-xs text-emerald-600">
            ✓ تم حفظ التوقيع.{' '}
            <button onClick={() => { setShowSign(true); setSavedSig(false); }} className="underline">
              إعادة التوقيع
            </button>
          </div>
        )}
        {(!savedSig || showSign) && (
          <>
            <SignaturePad onChange={setSignature} />
            <button
              onClick={saveSignature}
              disabled={!signature}
              className="w-full bg-indigo-600 disabled:opacity-50 text-white text-sm rounded-xl py-2"
            >
              حفظ التوقيع
            </button>
          </>
        )}
      </div>

      <div className="bg-white border rounded-2xl p-4 space-y-2">
        <h3 className="text-sm font-bold">المرفقات</h3>
        <PhotoUpload parent={{ invoiceId: id }} kind="INVOICE_PHOTO" onUploaded={refresh} />
      </div>

      <button onClick={print} className="w-full bg-slate-900 text-white text-sm rounded-xl py-3 font-semibold">
        طباعة (Phase 6)
      </button>
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
