# Agent PWA (Phase 4)

React + Vite + Tailwind, installable on Android/iOS, offline-first.

## Run

```bash
cd agent-pwa
npm install
npm run dev    # http://localhost:5174
```

For production builds, `docker-compose up --build` serves the compiled SPA via nginx.

## Login

`agent01 / Agent@123` (from the seed). Tokens are stored in `localStorage`. The
axios interceptor refreshes the access token automatically on 401 (one in-flight
refresh shared across concurrent requests).

## Routes

| Path | Page |
|------|------|
| `/login` | username/password |
| `/` | Home (today's totals, quick tiles, recent invoices) |
| `/customers` | List + search (cached) |
| `/customers/new` | Create customer (offline-capable) |
| `/products` | List + search (cached) |
| `/invoices` | List |
| `/invoices/new` | Create invoice — line picker, totals, offline queue |
| `/invoices/:id` | Detail + signature pad + photo upload |
| `/visits` | Today's tasks |
| `/visits/check-in?taskId=…` | Captures GPS, posts to `/api/visits/check-in` |
| `/visits/check-out?visitId=…` | Closes the visit |
| `/payments/new` | Record payment / collection |
| `/profile` | GPS toggle, sync queue, install button, logout |

## Offline-first design

### IndexedDB schema (Dexie — `field-sales-agent`)

| Store | Purpose |
|-------|---------|
| `outbox` | Pending writes; drained by the sync engine |
| `products` | Cached catalog for offline invoice creation |
| `customers` | Cached customers (incl. `pendingSync` rows created offline) |
| `invoices` | Last-known invoice list + offline-pending rows |
| `visitTasks` | Today's tasks |
| `meta` | Misc key/value |

### Outbox kinds

- `invoice.create` — uses `clientUuid` for idempotent retry
- `customer.create` — temp UUID becomes server ID after sync
- `payment.create`
- `return.create`
- `signature.upload` — base64 → `/invoices/:id/signature`
- `visit.checkin` / `visit.checkout`
- `attachment.upload` — Blob persisted in Dexie, uploaded as `multipart/form-data` when online
- `tracking.batch` — GPS batches that didn't make it through

### Sync engine ([src/lib/sync.ts](../agent-pwa/src/lib/sync.ts))

- Drains in `createdAt` order
- Runs on `online` event, `focus`, `visibilitychange`, and every 20 s while open
- Up to 6 retries per item; failures marked with `lastError`
- Single-flight (no concurrent flushes)
- 401s trigger a token refresh via the shared axios interceptor

## GPS tracking ([src/lib/gps.ts](../agent-pwa/src/lib/gps.ts))

- Started automatically on login (in `Layout.tsx`)
- Uses `navigator.geolocation.watchPosition` for low-power continuous reads
- Buffers points; flushes every **30 s** to `/tracking/location/batch`
- Falls back to the outbox when offline
- Battery level read via `navigator.getBattery()` (where supported)
- Stops on logout (`stopTracking()` in the `Layout` cleanup) — privacy-safe

## Realtime (Socket.io)

[src/lib/socket.ts](../agent-pwa/src/lib/socket.ts) connects to `ws://host/ws` using
the access token. Reused across the app via `getSocket()`. Disconnects on logout.

## Service worker / install

`vite-plugin-pwa` produces a manifest + Workbox SW. `registerSW({ immediate: true })`
in [src/main.tsx](../agent-pwa/src/main.tsx) wires auto-update on new builds.

The `beforeinstallprompt` handler in [src/lib/pwa.ts](../agent-pwa/src/lib/pwa.ts)
captures the deferred prompt; a non-blocking banner ([components/InstallPrompt](../agent-pwa/src/components/InstallPrompt.tsx))
shows on supported browsers, plus a button on the Profile page.

> **Note:** PWA icons (`pwa-192.png`, `pwa-512.png`) are referenced in
> `vite.config.ts` but not bundled — drop real PNGs into `agent-pwa/public/` before
> shipping. Without them the manifest validates but the home-screen icon falls
> back to a generated bookmark.

## Signature pad

Canvas-based [SignaturePad](../agent-pwa/src/components/SignaturePad.tsx) — pointer
events for both touch and mouse. `canvas.toDataURL('image/png')` produces the
base64 payload for `POST /api/invoices/:id/signature`.

## Permissions used by the agent role

- `invoice.create`, `invoice.view.own`, `invoice.discount`
- `customer.create`, `customer.update`
- `product.view`
- `payment.create`, `return.create`
- `tracking.submit`, `visit.checkin`
- `attachment.upload`
