import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, X, Search } from 'lucide-react';
import { api, asMessage } from '../lib/api';
import { fmtMoney, fmtNumber } from '../lib/format';
import { DataTable } from '../components/DataTable';
import { PageHeader } from '../components/PageHeader';

interface Product {
  id: string; sku: string; barcode: string | null; name: string; nameAr: string | null;
  unitType: string; costPrice: string; sellingPrice: string;
  taxPercent: string; stockQty: string; isActive: boolean;
}

export function Products() {
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Product | 'new' | null>(null);

  const list = useQuery({
    queryKey: ['products', q],
    queryFn: async () => {
      const { data } = await api.get<{ items: Product[]; total: number }>('/products', {
        params: { q: q || undefined, take: 200, all: 'true' },
      });
      return data;
    },
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="المنتجات"
        subtitle={list.data ? `${list.data.total} منتج في الكتالوج` : undefined}
        actions={
          <>
            <div className="relative">
              <Search size={14} className="absolute top-1/2 -translate-y-1/2 ltr:left-3 rtl:right-3 text-slate-400" />
              <input
                value={q} onChange={(e) => setQ(e.target.value)}
                placeholder="SKU / باركود / اسم"
                className="input ltr:pl-9 rtl:pr-9 w-64"
              />
            </div>
            <button onClick={() => setEditing('new')} className="btn-primary">
              <Plus size={16} /> منتج جديد
            </button>
          </>
        }
      />

      <DataTable<Product>
        rowKey={(p) => p.id}
        loading={list.isLoading}
        rows={list.data?.items ?? []}
        empty="لا توجد منتجات."
        onRowClick={(p) => setEditing(p)}
        columns={[
          { key: 'sku', header: 'SKU' },
          { key: 'name', header: 'الاسم', render: (p) => p.nameAr ?? p.name },
          { key: 'sellingPrice', header: 'سعر البيع', align: 'end', render: (p) => fmtMoney(p.sellingPrice) },
          { key: 'costPrice', header: 'التكلفة', align: 'end', render: (p) => fmtMoney(p.costPrice) },
          { key: 'taxPercent', header: 'ضريبة %', align: 'end', render: (p) => `${p.taxPercent}%` },
          { key: 'stockQty', header: 'المخزون', align: 'end', render: (p) => `${fmtNumber(p.stockQty, 3)} ${p.unitType}` },
          {
            key: 'isActive', header: 'الحالة',
            render: (p) => (
              <span className={`text-[11px] px-2 py-0.5 rounded ${p.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                {p.isActive ? 'مفعّل' : 'معطّل'}
              </span>
            ),
          },
        ]}
      />

      {editing && (
        <ProductEditor
          product={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { qc.invalidateQueries({ queryKey: ['products'] }); setEditing(null); }}
        />
      )}
    </div>
  );
}

function ProductEditor({ product, onClose, onSaved }: { product: Product | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<Partial<Product>>(product ?? {
    sku: '', barcode: '', name: '', nameAr: '', unitType: 'piece',
    costPrice: '0', sellingPrice: '0', taxPercent: '15', stockQty: '0', isActive: true,
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const set = <K extends keyof Product>(k: K, v: Product[K]) => setForm((s) => ({ ...s, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(null);
    try {
      const payload = {
        ...form,
        costPrice: Number(form.costPrice ?? 0),
        sellingPrice: Number(form.sellingPrice ?? 0),
        taxPercent: Number(form.taxPercent ?? 0),
        stockQty: Number(form.stockQty ?? 0),
      };
      if (product) await api.patch(`/products/${product.id}`, payload);
      else         await api.post('/products', payload);
      onSaved();
    } catch (e) { setErr(asMessage(e)); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <form onSubmit={submit} className="w-full max-w-md bg-white shadow-xl p-4 space-y-3 overflow-y-auto">
        <div className="flex justify-between items-center">
          <h3 className="font-bold">{product ? 'تعديل منتج' : 'منتج جديد'}</h3>
          <button type="button" onClick={onClose} className="text-slate-500"><X size={20} /></button>
        </div>

        <Field label="SKU"     value={form.sku ?? ''}       onChange={(v) => set('sku', v)} required disabled={!!product} />
        <Field label="باركود"  value={form.barcode ?? ''}   onChange={(v) => set('barcode', v)} />
        <Field label="الاسم"    value={form.name ?? ''}      onChange={(v) => set('name', v)} required />
        <Field label="الاسم (عربي)" value={form.nameAr ?? ''} onChange={(v) => set('nameAr', v)} />
        <div className="grid grid-cols-2 gap-2">
          <Field label="الوحدة"     value={form.unitType ?? ''}     onChange={(v) => set('unitType', v)} />
          <Field label="ضريبة %"    value={String(form.taxPercent ?? 0)}    onChange={(v) => set('taxPercent', v)} type="number" />
          <Field label="سعر البيع"  value={String(form.sellingPrice ?? 0)} onChange={(v) => set('sellingPrice', v)} type="number" />
          <Field label="التكلفة"    value={String(form.costPrice ?? 0)}    onChange={(v) => set('costPrice', v)} type="number" />
          <Field label="المخزون"   value={String(form.stockQty ?? 0)}      onChange={(v) => set('stockQty', v)} type="number" />
        </div>

        <label className="flex items-center justify-between text-sm py-1.5">
          <span>مفعّل</span>
          <input type="checkbox" checked={form.isActive ?? true} onChange={(e) => set('isActive', e.target.checked)} />
        </label>

        {err && <div className="text-sm text-red-600">{err}</div>}

        <button type="submit" disabled={busy} className="w-full bg-indigo-600 disabled:opacity-60 text-white rounded-lg py-2 text-sm font-semibold">
          {busy ? '...' : 'حفظ'}
        </button>
      </form>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', required, disabled }: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; required?: boolean; disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium">{label}</span>
      <input
        type={type} value={value} required={required} disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="block w-full border border-slate-300 rounded-lg px-2 py-2 text-sm mt-0.5 disabled:bg-slate-100"
      />
    </label>
  );
}
