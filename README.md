# Field Sales System (نظام إدارة المندوبين)

Production-ready system for managing field sales agents: invoices, returns, collections,
GPS tracking, customer visits, multi-branch, and full Arabic/English support.

## Architecture

Monorepo with three deployable units:

```
/backend           NestJS + Prisma + PostgreSQL + Socket.io
/admin-dashboard   React + Vite + Tailwind + Shadcn (RTL/LTR)
/agent-pwa         React + Vite PWA (offline-first, GPS, signature)
```

## Phase status

This repo is being built in phases. Current state:

| Phase | Scope | Status |
|-------|-------|--------|
| 1 | Foundation: schema, auth, RBAC, audit log, Docker, seed | **DONE** |
| 2 | Products, Customers, Invoices (limit-enforced), Returns, Payments | **DONE** |
| 3 | GPS tracking, Visits, Attachments, Signatures, Socket.io | **DONE** |
| 4 | Agent PWA (offline IndexedDB sync, GPS, signature, install) | **DONE** |
| 5 | Admin dashboard UI (full RTL/LTR, live map, real-time updates) | **DONE** |
| 6 | Print templates A4/A5/58mm/80mm + Puppeteer PDF + Excel reports + Audit + Settings | **DONE** |

All six phases complete. The system is feature-complete for production use.

## Quick start

```bash
# 1. Copy env file
cp .env.example .env

# 2. Build and start the stack
docker-compose up --build

# 3. Run migrations + seed (in another terminal, first time only)
docker-compose exec backend npx prisma migrate deploy
docker-compose exec backend npm run seed
```

Services:

- Backend API: http://localhost:3000
- Swagger docs: http://localhost:3000/api/docs
- Admin dashboard: http://localhost:5173
- Agent PWA: http://localhost:5174
- PostgreSQL: localhost:5432

## Default credentials (after seeding)

| Role | Username | Password |
|------|----------|----------|
| Super Admin | `superadmin` | `Admin@123` |
| Admin | `admin` | `Admin@123` |
| Agent | `agent01` | `Agent@123` |

**Change these immediately in production.**

## Tech stack

- **Backend:** NestJS 10, Prisma 5, PostgreSQL 16, JWT + refresh, Socket.io, Swagger, Zod, bcrypt, Helmet, rate-limit
- **Frontend:** React 18, TypeScript, Vite, TailwindCSS, Shadcn UI, Recharts, i18next (ar/en RTL)
- **PWA:** Vite PWA plugin, Workbox, IndexedDB (Dexie), Leaflet + OpenStreetMap
- **Infra:** Docker, docker-compose, local filesystem uploads

## Project layout

See [docs/STRUCTURE.md](docs/STRUCTURE.md) for full file tree.
See [backend/prisma/schema.prisma](backend/prisma/schema.prisma) for the database schema.

## Security

- bcrypt password hashing (12 rounds)
- JWT short-lived access tokens + rotating refresh tokens
- RBAC + per-user permission overrides + per-agent limits
- Account lockout after 5 failed login attempts (15 min)
- Login history with IP + user agent
- Audit log for all sensitive actions
- Helmet, CORS allowlist, rate limiting (100 req/min/IP)
- Input validation on every endpoint (class-validator + Zod)
- File upload type/size validation
- Prisma parameterized queries (no raw SQL)

## Development

```bash
# Backend
cd backend
npm install
npx prisma migrate dev
npm run seed
npm run start:dev

# Admin dashboard
cd admin-dashboard
npm install
npm run dev

# Agent PWA
cd agent-pwa
npm install
npm run dev
```

## License

Proprietary — all rights reserved.
