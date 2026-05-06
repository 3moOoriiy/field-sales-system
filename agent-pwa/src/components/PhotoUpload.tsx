import { useState } from 'react';
import { api, asMessage } from '../lib/api';
import { enqueue } from '../lib/db';

interface Props {
  parent: { invoiceId?: string; returnId?: string; paymentId?: string; visitId?: string };
  kind:
    | 'INVOICE_PHOTO' | 'STORE_PHOTO' | 'DELIVERY_PROOF'
    | 'PAYMENT_RECEIPT' | 'VISIT_PHOTO' | 'OTHER';
  onUploaded?: () => void;
}

/**
 * Captures a photo (camera or library) and uploads.
 * If offline, queues the file as a Blob in Dexie outbox.
 */
export function PhotoUpload({ parent, kind, onUploaded }: Props) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handle = async (file: File) => {
    setBusy(true); setErr(null); setDone(false);
    try {
      if (navigator.onLine) {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('kind', kind);
        for (const [k, v] of Object.entries(parent)) if (v) fd.append(k, v);
        await api.post('/attachments', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      } else {
        await enqueue({
          kind: 'attachment.upload',
          payload: { kind, ...parent },
          blob: file,
          blobName: file.name,
          blobMime: file.type,
        });
      }
      setDone(true);
      onUploaded?.();
    } catch (e) {
      setErr(asMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-1">
      <label className="block">
        <span className="text-sm font-medium">إضافة صورة</span>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="block w-full mt-1 text-xs"
          disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handle(f);
            e.target.value = '';
          }}
        />
      </label>
      {busy && <div className="text-xs text-slate-500">جاري الرفع…</div>}
      {done && <div className="text-xs text-emerald-600">تم الرفع{!navigator.onLine ? ' (في قائمة المزامنة)' : ''}</div>}
      {err && <div className="text-xs text-red-600">{err}</div>}
    </div>
  );
}
