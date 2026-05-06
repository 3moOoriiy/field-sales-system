import { api, asMessage } from './api';
import { db, OutboxItem, pendingOutboxCount } from './db';

const MAX_TRIES = 6;

type Listener = (count: number) => void;
const listeners = new Set<Listener>();

export function onPendingChange(fn: Listener) {
  listeners.add(fn);
  pendingOutboxCount().then(fn).catch(() => fn(0));
  return () => { listeners.delete(fn); };
}

async function notify() {
  const c = await pendingOutboxCount();
  for (const fn of listeners) fn(c);
}

let running = false;

export async function flushOutbox(): Promise<{ done: number; failed: number; remaining: number }> {
  if (running) return { done: 0, failed: 0, remaining: await pendingOutboxCount() };
  if (!navigator.onLine) return { done: 0, failed: 0, remaining: await pendingOutboxCount() };
  running = true;
  let done = 0;
  let failed = 0;
  try {
    const items = await db.outbox
      .where('status').anyOf('pending', 'failed')
      .sortBy('createdAt');

    for (const item of items) {
      if (item.id == null) continue;
      if (item.tries >= MAX_TRIES) continue;
      await db.outbox.update(item.id, { status: 'sending', updatedAt: Date.now() });
      try {
        await dispatch(item);
        await db.outbox.delete(item.id);
        done++;
      } catch (err) {
        failed++;
        await db.outbox.update(item.id, {
          status: 'failed',
          tries: item.tries + 1,
          lastError: asMessage(err),
          updatedAt: Date.now(),
        });
      }
      notify();
    }
  } finally {
    running = false;
  }
  return { done, failed, remaining: await pendingOutboxCount() };
}

async function dispatch(item: OutboxItem): Promise<void> {
  switch (item.kind) {
    case 'invoice.create': {
      // payload includes clientUuid → idempotent
      await api.post('/invoices', item.payload);
      return;
    }
    case 'customer.create': {
      await api.post('/customers', item.payload);
      return;
    }
    case 'payment.create': {
      await api.post('/payments', item.payload);
      return;
    }
    case 'return.create': {
      await api.post('/returns', item.payload);
      return;
    }
    case 'signature.upload': {
      const p = item.payload as { invoiceId: string; dataUrl: string };
      await api.post(`/invoices/${p.invoiceId}/signature`, { dataUrl: p.dataUrl });
      return;
    }
    case 'visit.checkin': {
      await api.post('/visits/check-in', item.payload);
      return;
    }
    case 'visit.checkout': {
      const p = item.payload as { visitId: string } & Record<string, unknown>;
      const { visitId, ...body } = p;
      await api.post(`/visits/${visitId}/check-out`, body);
      return;
    }
    case 'attachment.upload': {
      if (!item.blob) throw new Error('attachment.upload missing blob');
      const fd = new FormData();
      fd.append('file', item.blob, item.blobName ?? 'file');
      const meta = item.payload as Record<string, string>;
      for (const [k, v] of Object.entries(meta)) {
        if (v != null) fd.append(k, String(v));
      }
      await api.post('/attachments', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return;
    }
    case 'tracking.batch': {
      await api.post('/tracking/location/batch', item.payload);
      return;
    }
    default: {
      const _exhaustive: never = item.kind;
      void _exhaustive;
      throw new Error(`Unknown outbox kind: ${(item as { kind: string }).kind}`);
    }
  }
}

let intervalHandle: number | null = null;

export function startSyncEngine() {
  if (intervalHandle) return;
  // Sync on connect, on visibility, and every 20s while open
  const tick = () => { void flushOutbox(); };
  tick();
  intervalHandle = window.setInterval(tick, 20_000);
  window.addEventListener('online', tick);
  window.addEventListener('focus', tick);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') tick();
  });
}

export function stopSyncEngine() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}
