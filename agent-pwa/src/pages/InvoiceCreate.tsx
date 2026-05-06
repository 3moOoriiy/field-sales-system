import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuid } from 'uuid';
import { api, asMessage } from '../lib/api';
import { db, enqueue, CachedProduct, CachedCustomer } from '../lib/db';
import { fmtMoney } from '../lib/format';
import { getCurrentPosition } from '../lib/gps';
import { flushOutbox } from '../lib/sync';
import { BarcodeScanner } from '../components/BarcodeScanner';

interface LineItem {
  productId: string;
  sku: string;
  name: string;
  unitType: string;
  unitPrice: number;
  quantity: number;
  taxPercent: number;
}

export function InvoiceCreate() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<CachedProduct[]>([]);
  const [customers, setCustomers] = useState<CachedCustomer[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [lines, setLines] = useState<LineItem[]>([]);
  const [paymentType, setPaymentType] = useState<'CASH' | 'CREDIT' | 'PARTIAL'>('CASH');
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanFlash, setScanFlash] = useState<{ kind: 'ok' | 'warn'; text: string } | null>(null);

  useEffect(() => {
    (async () => {
      const [p, c] = await Promise.all([db.products.toArray(), db.customers.toArray()]);
      setProducts(p);
      // Only let user pick synced customers (offline-created customers have no real ID yet)
      setCustomers(c.filter((x) => !x.pendingSync));
      // Refresh from server in background
      try {
        const [pr, cr] = await Promise.all([
          api.get<{ items: CachedProduct[] }>('/products', { params: { take: 200 } }),
          api.get<{ items: CachedCustomer[] }>('/customers', { params: { take: 200 } }),
        ]);
        setProducts(pr.data.items);
        setCustomers(cr.data.items);
        await db.products.clear(); await db.products.bulkPut(pr.data.items);
        // Don't blow away local pending rows
        await db.customers.bulkPut(cr.data.items);
      } catch { /* offline */ }
    })();
  }, []);

  const filteredProducts = useMemo(() => {
    if (!search) return products.slice(0, 50);
    const q = search.toLowerCase();
    return products.filter((p) =>
      [p.sku, p.barcode, p.name, p.nameAr].filter(Boolean).some((s) => s!.toLowerCase().includes(q)),
    ).slice(0, 50);
  }, [products, search]);

  const addLine = (p: CachedProduct) => {
    setLines((cur) => {
      const existing = cur.find((l) => l.productId === p.id);
      if (existing) {
        return cur.map((l) => l.productId === p.id ? { ...l, quantity: l.quantity + 1 } : l);
      }
      return [
        ...cur,
        {
          productId: p.id, sku: p.sku, name: p.nameAr ?? p.name,
          unitType: p.unitType, unitPrice: Number(p.sellingPrice),
          quantity: 1, taxPercent: Number(p.taxPercent),
        },
      ];
    });
    setSearch('');
  };

  const updateLine = (productId: string, patch: Partial<LineItem>) => {
    setLines((cur) => cur.map((l) => l.productId === productId ? { ...l, ...patch } : l));
  };
  const removeLine = (productId: string) => {
    setLines((cur) => cur.filter((l) => l.productId !== productId));
  };

  const totals = useMemo(() => {
    let subtotal = 0;
    let tax = 0;
    for (const l of lines) {
      const lineNet = l.unitPrice * l.quantity;
      subtotal += lineNet;
      tax += lineNet * (l.taxPercent / 100);
    }
    const headerDiscount = subtotal * (discountPercent / 100);
    const total = subtotal - headerDiscount + tax;
    return { subtotal, tax, headerDiscount, total };
  }, [lines, discountPercent]);

  const submit = async () => {
    if (!customerId) { setErr('اختر عميلاً'); return; }
    if (!lines.length) { setErr('أضف منتجاً واحداً على الأقل'); return; }
    setErr(null); setBusy(true);

    let pos: GeolocationPosition | null = null;
    try { pos = await getCurrentPosition(); } catch { /* gps optional */ }

    const clientUuid = uuid();
    const payload = {
      customerId,
      paymentType,
      discountPercent: discountPercent || undefined,
      notes: notes || undefined,
      items: lines.map((l) => ({
        productId: l.productId,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
      })),
      clientUuid,
      createLat: pos?.coords.latitude,
      createLng: pos?.coords.longitude,
    };

    try {
      if (navigator.onLine) {
        const { data } = await api.post('/invoices', payload);
        await db.invoices.put({
          id: data.id, invoiceNumber: data.invoiceNumber,
          customerId, customerName: customers.find((c) => c.id === customerId)?.storeName ?? '',
          totalAmount: String(data.totalAmount), status: data.status,
          issuedAt: data.issuedAt,
        });
        navigate(`/invoices/${data.id}`, { replace: true });
      } else {
        // Optimistic local invoice + queue
        await db.invoices.put({
          id: clientUuid, invoiceNumber: 'PENDING',
          customerId, customerName: customers.find((c) => c.id === customerId)?.storeName ?? '',
          totalAmount: totals.total.toFixed(2), status: 'ISSUED',
          issuedAt: new Date().toISOString(), pendingSync: true,
        });
        await enqueue({ kind: 'invoice.create', payload, clientUuid });
        // Try to send right now in case of flaky network
        void flushOutbox();
        navigate('/invoices', { replace: true });
      }
    } catch (e) {
      setErr(asMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <h1 className="text-lg font-bold">فاتورة جديدة</h1>

      <select
        value={customerId}
        onChange={(e) => setCustomerId(e.target.value)}
        className="w-full border border-slate-300 rounded-xl px-3 py-3 bg-white"
      >
        <option value="">اختر العميل…</option>
        {customers.map((c) => (
          <option key={c.id} value={c.id}>{c.storeName} — {c.code}</option>
        ))}
      </select>

      <div className="flex gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="بحث منتج (SKU / باركود / اسم)…"
          className="flex-1 border border-slate-300 rounded-xl px-3 py-2 bg-white"
        />
        <button
          type="button"
          onClick={() => setScannerOpen(true)}
          className="bg-indigo-600 text-white rounded-xl px-3 py-2 text-sm font-semibold flex items-center gap-1.5 whitespace-nowrap shadow-md shadow-indigo-600/20"
          title="مسح باركود بالكاميرا"
        >
          <span className="text-base">📷</span>
          <span className="hidden sm:inline">مسح</span>
        </button>
      </div>
      {scanFlash && (
        <div className={`text-xs rounded-lg px-3 py-2 ${
          scanFlash.kind === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
        }`}>
          {scanFlash.text}
        </div>
      )}
      {search && (
        <ul className="bg-white border rounded-xl divide-y max-h-64 overflow-auto">
          {filteredProducts.map((p) => (
            <li key={p.id}>
              <button
                onClick={() => addLine(p)}
                className="w-full text-right px-3 py-2 text-sm hover:bg-slate-50 flex justify-between"
              >
                <div>
                  <div>{p.nameAr ?? p.name}</div>
                  <div className="text-[11px] text-slate-500">{p.sku}</div>
                </div>
                <div className="font-bold">{fmtMoney(p.sellingPrice)}</div>
              </button>
            </li>
          ))}
          {filteredProducts.length === 0 && (
            <li className="text-xs text-slate-500 px-3 py-2">لا توجد نتائج.</li>
          )}
        </ul>
      )}

      <ul className="space-y-2">
        {lines.map((l) => (
          <li key={l.productId} className="bg-white border rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="font-semibold text-sm">{l.name}</div>
              <button onClick={() => removeLine(l.productId)} className="text-rose-600 text-xs">حذف</button>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <label>
                <span className="text-slate-500">الكمية</span>
                <input type="number" min={0.001} step={0.001} value={l.quantity}
                  onChange={(e) => updateLine(l.productId, { quantity: Number(e.target.value) })}
                  className="w-full border border-slate-300 rounded-lg px-2 py-2 mt-0.5" />
              </label>
              <label>
                <span className="text-slate-500">السعر</span>
                <input type="number" min={0} step={0.01} value={l.unitPrice}
                  onChange={(e) => updateLine(l.productId, { unitPrice: Number(e.target.value) })}
                  className="w-full border border-slate-300 rounded-lg px-2 py-2 mt-0.5" />
              </label>
              <div className="text-left">
                <span className="text-slate-500">الإجمالي</span>
                <div className="font-bold mt-1.5">{fmtMoney(l.unitPrice * l.quantity)}</div>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <div className="bg-white border rounded-xl p-3 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <label className="text-sm">
            <span className="font-medium">طريقة الدفع</span>
            <select value={paymentType}
              onChange={(e) => setPaymentType(e.target.value as 'CASH' | 'CREDIT' | 'PARTIAL')}
              className="w-full border border-slate-300 rounded-lg px-2 py-2 mt-1 bg-white">
              <option value="CASH">نقدي</option>
              <option value="CREDIT">آجل</option>
              <option value="PARTIAL">جزئي</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="font-medium">خصم %</span>
            <input type="number" min={0} max={100} step={0.01} value={discountPercent}
              onChange={(e) => setDiscountPercent(Number(e.target.value))}
              className="w-full border border-slate-300 rounded-lg px-2 py-2 mt-1" />
          </label>
        </div>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="ملاحظات…"
          className="w-full border border-slate-300 rounded-lg px-2 py-2 text-sm" rows={2} />
      </div>

      <div className="bg-white border rounded-xl p-3 text-sm space-y-1">
        <Row label="الإجمالي قبل" value={fmtMoney(totals.subtotal)} />
        <Row label="خصم" value={`- ${fmtMoney(totals.headerDiscount)}`} />
        <Row label="ضريبة" value={fmtMoney(totals.tax)} />
        <div className="border-t pt-1 mt-1">
          <Row label="الإجمالي" value={fmtMoney(totals.total)} bold />
        </div>
      </div>

      {err && <div className="text-sm text-red-600">{err}</div>}

      <button disabled={busy} onClick={submit}
        className="w-full bg-indigo-600 disabled:opacity-60 text-white rounded-xl py-3 font-semibold">
        {busy ? '...' : 'حفظ الفاتورة'}
      </button>

      <BarcodeScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onDetected={async (code) => {
          // 1. Try to find in cached products first (works offline too)
          const local = products.find((p) => p.barcode === code || p.sku === code);
          if (local) {
            addLine(local);
            setScanFlash({ kind: 'ok', text: `✓ ${local.nameAr ?? local.name}` });
            setTimeout(() => setScanFlash(null), 2500);
            return;
          }
          // 2. Fall back to backend lookup (online only)
          if (!navigator.onLine) {
            setScanFlash({ kind: 'warn', text: `لم يُعثر على المنتج محلياً (الجهاز غير متصل): ${code}` });
            setTimeout(() => setScanFlash(null), 4000);
            return;
          }
          try {
            const { data } = await api.get<CachedProduct>(`/products/barcode/${encodeURIComponent(code)}`);
            // Cache for next time
            await db.products.put(data);
            setProducts((cur) => cur.some((p) => p.id === data.id) ? cur : [...cur, data]);
            addLine(data);
            setScanFlash({ kind: 'ok', text: `✓ ${data.nameAr ?? data.name}` });
          } catch {
            setScanFlash({ kind: 'warn', text: `منتج غير موجود: ${code}` });
          }
          setTimeout(() => setScanFlash(null), 3000);
        }}
      />
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
