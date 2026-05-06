# API reference (Phase 1 + 2)

All endpoints are prefixed with `/api`. Auth header: `Authorization: Bearer <accessToken>`
unless marked `@Public`. Full interactive docs at `http://localhost:3000/api/docs`.

## Auth

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| POST | `/auth/login` | public | Username + password → access (15m) + refresh (7d) |
| POST | `/auth/refresh` | public | Rotate refresh token |
| POST | `/auth/logout` | authed | Revoke refresh token(s) |
| GET  | `/auth/me` | authed | Current user + effective permissions |

## Users (admin)

`@Roles(SUPER_ADMIN, ADMIN)` + permission below.

| Method | Path | Permission |
|--------|------|-----------|
| GET    | `/users` | `user.manage` |
| GET    | `/users/:id` | `user.manage` |
| POST   | `/users` | `user.manage` |
| PATCH  | `/users/:id` | `user.manage` |
| POST   | `/users/:id/reset-password` | `user.manage` |
| DELETE | `/users/:id` | `user.manage` |
| POST   | `/users/:id/permissions` | `permissions.manage` |
| POST   | `/users/:id/agent-limits` | `permissions.manage` |

## Products

| Method | Path | Permission |
|--------|------|-----------|
| GET    | `/products?q=&categoryId=&skip=&take=&all=` | `product.view` |
| GET    | `/products/barcode/:code` | `product.view` |
| GET    | `/products/categories` | `product.view` |
| POST   | `/products/categories` | `product.manage` |
| GET    | `/products/:id` | `product.view` |
| POST   | `/products` | `product.manage` |
| PATCH  | `/products/:id` | `product.manage` |

## Customers

Agents see only customers they created unless they have `customer.view.all`.

| Method | Path | Permission |
|--------|------|-----------|
| GET    | `/customers?q=&branchId=` | authed |
| GET    | `/customers/top-debtors` | `report.debts` |
| GET    | `/customers/:id` | authed (scoped) |
| GET    | `/customers/:id/statement?from=&to=` | authed (scoped) |
| POST   | `/customers` | `customer.create` |
| PATCH  | `/customers/:id` | `customer.update` |

## Invoices

Agents see only their own invoices unless they have `invoice.view.all`.

| Method | Path | Permission |
|--------|------|-----------|
| POST   | `/invoices` | `invoice.create` (+ enforced agent limits) |
| GET    | `/invoices?customerId=&agentId=&status=&from=&to=` | authed (scoped) |
| GET    | `/invoices/:id` | authed (scoped) |
| PATCH  | `/invoices/:id` | `invoice.update` (+ edit-after-print check) |
| POST   | `/invoices/:id/cancel` | `invoice.cancel` |
| POST   | `/invoices/:id/print` | authed |
| POST   | `/invoices/:id/signature` | `attachment.upload` |

### Invoice creation — limit enforcement

When an agent creates an invoice, the service enforces (in order):

1. `preventBelowCost` (default true) — any item with `unitPrice < product.costPrice` blocks.
2. `maxDiscountPercent` — header discount % capped.
3. `maxDiscountAmount` — header discount amount capped.
4. `maxInvoiceTotal` — final total capped.
5. `invoice.discount` permission — required if any header discount > 0.

On any violation:
- Returns **403 Forbidden** with the failing rule names.
- Writes a `LIMIT_EXCEEDED_ATTEMPT` row to `audit_logs` with the attempted vs. limit values.

### Sequential numbering

Invoice numbers are atomically generated per branch via `branch.invoiceSeq`:
format `BR1-000001`, `BR1-000002`, …

### Offline sync (`clientUuid`)

If the client supplies `clientUuid`, repeated POSTs are idempotent — the existing
invoice is returned without side effects. Used by the PWA when re-syncing after
offline operation.

## Returns

| Method | Path | Permission |
|--------|------|-----------|
| POST   | `/returns` | `return.create` (+ agent `allowReturns` limit) |
| GET    | `/returns` | authed (scoped) |
| GET    | `/returns/:id` | authed (scoped) |

Body supports either `fullReturn: true` (all remaining qty for every line) or an
`items[]` array referencing `invoiceItemId` + qty. Server validates qty against
`originalQty − alreadyReturned`. Restocks by default (`restock: false` to skip).

Effects:
- Customer balance: `decrement` by refund total.
- `customer_balance_history` row written.
- For cash invoices: invoice `paidAmount` decremented.

## Payments / Collections

| Method | Path | Permission |
|--------|------|-----------|
| POST   | `/payments` | `payment.create` |
| GET    | `/payments?customerId=&invoiceId=&agentId=&from=&to=` | authed (scoped) |
| GET    | `/payments/:id` | authed (scoped) |

If `invoiceId` is provided:
- Invoice `paidAmount` is incremented.
- Status moves to `PAID` (when paid ≥ total) or `PARTIALLY_PAID`.
- Cash invoices stay `PAID` (already fully paid at creation).

Receipt numbers: `RC-{branchCode}-{seq}` per branch via `branch.paymentSeq`.

## Tracking

| Method | Path | Permission |
|--------|------|-----------|
| POST | `/tracking/location` | `tracking.submit` |
| POST | `/tracking/location/batch` | `tracking.submit` (offline catch-up, max 50 pts) |
| GET  | `/tracking/agents-live?branchId=` | `tracking.view` |
| GET  | `/tracking/agent-history?agentId=&from=&to=` | `tracking.view` |

`agents-live` returns each agent's last point + `isOnline` (point received in last 90s).

## Visits

| Method | Path | Permission |
|--------|------|-----------|
| POST   | `/visits/tasks` | `visit.assign` |
| GET    | `/visits/tasks` | authed (scoped) |
| PATCH  | `/visits/tasks/:id/status` | `visit.assign` |
| POST   | `/visits/check-in` | `visit.checkin` |
| POST   | `/visits/:id/check-out` | `visit.checkin` |
| GET    | `/visits` | authed (scoped) |
| GET    | `/visits/:id` | authed (scoped) |
| GET    | `/visits/ranking?from=&to=` | `visit.view.all` |

Check-in body must include `latitude`, `longitude`, and either `taskId` (planned visit)
or `customerId` (ad-hoc). Server computes Haversine distance vs. customer GPS pin and
rejects if > 100m (configurable per call via `allowedRadiusMeters`). Admins (or holders
of `visit.assign`) may pass `force: true` to bypass.

## Attachments

| Method | Path | Permission |
|--------|------|-----------|
| POST   | `/attachments` | `attachment.upload` |
| GET    | `/attachments?invoiceId=&...` | authed (scoped to parent) |
| GET    | `/attachments/:id/download` | authed (scoped to parent) |
| DELETE | `/attachments/:id` | `attachment.upload` (uploader or admin) |

`POST` is multipart/form-data with `file`, `kind`, and at least one parent ID
(`invoiceId`, `returnId`, `paymentId`, `visitId`). Allowed mime types: jpeg, png, webp,
heic, heif, gif, pdf. Max size: `MAX_UPLOAD_MB` env (default 10 MB). Files saved to
`UPLOAD_DIR/{kind}/{yyyy-mm}/{uuid}.{ext}`.

## Signatures

`POST /invoices/:id/signature` (permission `attachment.upload`) accepts:

```json
{ "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..." }
```

Saves the PNG as an Attachment (`kind=SIGNATURE`) and updates `invoice.signaturePath`,
which the print template will reference in Phase 6.

## Socket.io (real-time)

Server: `ws://localhost:3000/ws` (path is `/ws`).

Auth: pass JWT access token via `socket.io({ auth: { token } })` or
`Authorization: Bearer <token>` header. Connections without a valid token are dropped.

Rooms (auto-joined on connect):
- `user:<userId>` — direct notifications to one user
- `agent:<userId>` — per-agent stream (agents only)
- `admins` — ADMIN + SUPER_ADMIN see live business events

Events emitted to `admins`:

| Event | Payload |
|-------|---------|
| `invoice.created` | `{ id, invoiceNumber, branchId, customerId, createdById, totalAmount, status, issuedAt }` |
| `invoice.cancelled` | `{ id, reason }` |
| `return.created` | `{ id, returnNumber, invoiceId, customerId, totalAmount, createdById }` |
| `payment.created` | `{ id, receiptNumber, customerId, invoiceId, amount, createdById }` |
| `agent.location` | `{ agentId, latitude, longitude, accuracy, speed, recordedAt }` |
| `visit.checkin` | `{ visitId, agentId, customerId, customerName, distanceMeters, forced, at }` |
| `visit.checkout` | `{ visitId, agentId, at }` |
| `alert.limit_exceeded` | `{ agentId, username, violations, customerId }` |

Events emitted to `user:<id>`:
- `notification` — generic UI notification

## Reports (Phase 6 — pending)

## Reports (Phase 6 — pending)

`/reports/sales`, `/reports/profit`, `/reports/returns`, `/reports/debts`,
`/reports/collections`, `/reports/agent-performance`
