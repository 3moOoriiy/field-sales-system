# Phase 6 — Print, PDF, Reports, Audit, Settings

## New endpoints

### Print / PDF

| Method | Path | Permission |
|--------|------|-----------|
| GET | `/api/print/invoices/:id/html?format=A4\|A5\|58\|80` | invoice scoping |
| GET | `/api/print/invoices/:id/pdf?format=A4\|A5\|58\|80`  | invoice scoping |

The HTML template is a single-file render with embedded CSS, Cairo (web font),
QR code as a data URL, and the customer signature inlined as base64. Page sizes:

- `A4` / `A5`: standard Puppeteer paper sizes with 12mm / 8mm margins
- `58` / `80`: thermal — `@page { size: NNmm auto }` + `preferCSSPageSize: true`,
  body width fixed to NNmm so content auto-clips at end-of-paper

Cancelled invoices show a translucent "ملغاة / CANCELLED" stamp diagonally on
A4/A5 (hidden on thermal).

### Audit logs

| Method | Path | Permission |
|--------|------|-----------|
| GET | `/api/audit-logs?action=&userId=&entityType=&entityId=&from=&to=&skip=&take=` | `audit.view` |

`BigInt` ids are serialised via the global `toJSON` polyfill from Phase 3.

### Settings

| Method | Path | Permission |
|--------|------|-----------|
| GET   | `/api/settings`        | authed |
| PATCH | `/api/settings`        | `settings.manage` |
| POST  | `/api/settings/logo`   | `settings.manage` (multipart `file`) |

The logo POST persists the upload as an `Attachment(kind=COMPANY_LOGO)` and stores
the relative path on `Setting.logoPath`, which the print template inlines as a
data URL.

### Branches

| Method | Path | Permission |
|--------|------|-----------|
| GET   | `/api/branches`        | authed |
| GET   | `/api/branches/:id`    | authed |
| POST  | `/api/branches`        | `settings.manage` |
| PATCH | `/api/branches/:id`    | `settings.manage` |

### Reports

| Method | Path | Permission |
|--------|------|-----------|
| GET | `/api/reports/sales?from=&to=`           | `report.sales` |
| GET | `/api/reports/sales.xlsx?from=&to=`      | `report.sales` |
| GET | `/api/reports/debts`                     | `report.debts` |
| GET | `/api/reports/debts.xlsx`                | `report.debts` |
| GET | `/api/reports/collections?from=&to=`     | `report.collections` |
| GET | `/api/reports/collections.xlsx?from=&to=` | `report.collections` |

Excel files are streamed as
`application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
with `Content-Disposition: attachment`. ExcelJS renders headers in bold,
formats money columns as `#,##0.00`, dates as `yyyy-mm-dd hh:mm`.

## Arabic font rendering

The Dockerfile installs `fonts-noto`, `fonts-noto-cjk`, and `fonts-noto-color-emoji`
via apt. The print template additionally pulls Cairo via Google Fonts:

```css
@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap');
```

`PdfService.htmlToPdf` waits for `document.fonts.ready` before rendering so glyphs
are guaranteed to be embedded, and emulates print media so `@page` rules apply.

## Puppeteer in Docker

- Backend image switched to `node:20-bookworm-slim`
- `chromium` installed via apt; `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium`
- `PUPPETEER_SKIP_DOWNLOAD=true` to avoid bundled Chromium download in the image
- Launched with `--no-sandbox --disable-dev-shm-usage --disable-gpu --lang=ar`
- Single shared `Browser` per process; one short-lived `Page` per render to avoid
  cross-render leaks. `disconnected` event clears the cached browser so the next
  call relaunches.

## Admin dashboard wiring

- `AuditLogs` page now hits `/api/audit-logs` with action/from/to filters
- `Settings` page is fully editable: company info form, logo upload, branches CRUD
  (`/branches` GET/POST)
- `Reports` page has three Excel download buttons that respect the date range
- `InvoiceDetail` page has a print menu with 8 buttons (HTML preview + PDF for
  each of A4 / A5 / 80mm / 58mm)

## Run locally

```bash
docker-compose up --build
docker-compose exec backend npm run seed
```

Then visit `http://localhost:5173/`, open any invoice, and try the print menu —
PDF opens in a new tab, HTML opens for `Ctrl+P` browser print.
