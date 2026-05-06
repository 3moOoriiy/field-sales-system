import Dexie, { Table } from 'dexie';

export type OutboxKind =
  | 'invoice.create'
  | 'customer.create'
  | 'payment.create'
  | 'return.create'
  | 'signature.upload'
  | 'visit.checkin'
  | 'visit.checkout'
  | 'attachment.upload'
  | 'tracking.batch';

export type OutboxStatus = 'pending' | 'sending' | 'failed' | 'done';

export interface OutboxItem {
  id?: number;
  kind: OutboxKind;
  payload: unknown;
  /**
   * For uploads: the optional binary blob. Stored alongside metadata.
   */
  blob?: Blob;
  blobName?: string;
  blobMime?: string;
  /** UUID generated on the device for idempotent invoice creation */
  clientUuid?: string;
  status: OutboxStatus;
  tries: number;
  lastError?: string;
  createdAt: number;
  updatedAt: number;
}

export interface CachedProduct {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  nameAr: string | null;
  unitType: string;
  costPrice: string;
  sellingPrice: string;
  taxPercent: string;
  stockQty: string;
  isActive: boolean;
}

export interface CachedCustomer {
  id: string;
  code: string;
  storeName: string;
  contactName: string | null;
  phone: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  balance: string;
  pendingSync?: boolean;
}

export interface CachedInvoice {
  id: string;            // server id, or temp clientUuid before sync
  invoiceNumber: string; // 'PENDING' for offline
  customerId: string;
  customerName: string;
  totalAmount: string;
  status: string;
  issuedAt: string;
  pendingSync?: boolean;
}

export interface CachedVisitTask {
  id: string;
  customerId: string;
  customerName: string;
  scheduledAt: string;
  status: string;
}

export interface MetaRow {
  key: string;
  value: unknown;
}

export class FsDB extends Dexie {
  outbox!: Table<OutboxItem, number>;
  products!: Table<CachedProduct, string>;
  customers!: Table<CachedCustomer, string>;
  invoices!: Table<CachedInvoice, string>;
  visitTasks!: Table<CachedVisitTask, string>;
  meta!: Table<MetaRow, string>;

  constructor() {
    super('field-sales-agent');
    this.version(1).stores({
      outbox: '++id, kind, status, createdAt',
      products: 'id, sku, barcode, isActive',
      customers: 'id, code, storeName, pendingSync',
      invoices: 'id, customerId, issuedAt, status, pendingSync',
      visitTasks: 'id, customerId, scheduledAt, status',
      meta: 'key',
    });
  }
}

export const db = new FsDB();

export async function enqueue(item: Omit<OutboxItem, 'id' | 'status' | 'tries' | 'createdAt' | 'updatedAt'>) {
  const now = Date.now();
  return db.outbox.add({
    ...item,
    status: 'pending',
    tries: 0,
    createdAt: now,
    updatedAt: now,
  });
}

export async function pendingOutboxCount(): Promise<number> {
  return db.outbox.where('status').anyOf('pending', 'failed').count();
}
