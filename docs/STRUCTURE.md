# Project structure

```
field-sales-system/
├── README.md
├── docker-compose.yml
├── .env.example
├── .gitignore
│
├── backend/                          # NestJS + Prisma + Socket.io
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   ├── nest-cli.json
│   ├── prisma/
│   │   ├── schema.prisma             # 24+ tables, full schema (Phase 1–6)
│   │   └── seed.ts                   # Roles, permissions, sample users + data
│   └── src/
│       ├── main.ts                   # bootstrap (helmet, CORS, swagger)
│       ├── app.module.ts             # root module
│       ├── config/configuration.ts   # Joi env validation
│       ├── prisma/                   # Prisma service + module (global)
│       ├── auth/                     # JWT + refresh + lockout + login history
│       │   ├── auth.module.ts
│       │   ├── auth.controller.ts    # /api/auth/login | /refresh | /logout | /me
│       │   ├── auth.service.ts
│       │   ├── dto/login.dto.ts
│       │   ├── strategies/jwt.strategy.ts
│       │   ├── guards/{jwt-auth,roles,permissions}.guard.ts
│       │   └── decorators/{current-user,roles,permissions}.decorator.ts
│       ├── audit/                    # Polymorphic audit logger
│       ├── users/                    # Users CRUD + permissions + agent limits
│       ├── health/                   # /health
│       └── common/
│           ├── filters/http-exception.filter.ts
│           └── interceptors/logging.interceptor.ts
│
├── admin-dashboard/                  # React + Vite + Tailwind (RTL/LTR)
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── tsconfig.json
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── api.ts
│       ├── index.css
│       └── pages/
│           ├── Login.tsx
│           └── Dashboard.tsx
│
├── agent-pwa/                        # React + Vite + PWA
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── package.json
│   ├── vite.config.ts                # vite-plugin-pwa, Workbox
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── App.tsx                   # home tiles + online/offline badge
│       ├── api.ts
│       ├── index.css
│       └── pages/Login.tsx
│
└── docs/
    └── STRUCTURE.md
```

## Schema highlights

24 tables grouped by domain. All money fields use `Decimal(14, 2)`,
quantities use `Decimal(14, 3)`, GPS uses `Float`.

| Domain | Tables |
|--------|--------|
| RBAC | `roles`, `permissions`, `role_permissions`, `user_permissions`, `users`, `agent_limits`, `refresh_tokens`, `login_history` |
| Org | `branches`, `settings` |
| Catalog | `product_categories`, `products` |
| Customers | `customers`, `customer_balance_history` |
| Sales | `invoices`, `invoice_items`, `returns`, `return_items`, `payments` |
| Field | `agent_locations`, `visits`, `visit_tasks`, `visit_photos` |
| Cross-cutting | `attachments`, `notifications`, `audit_logs` |

## Permission model

Three layers, evaluated in order at request time:

1. **Role** → base permission set defined in seed
2. **Per-user grant** → adds permissions on top of role
3. **Per-user deny** → removes permissions even if role grants them

Plus a separate **AgentLimits** record per agent for invoice-level caps
(max discount %, max discount amount, max invoice total, prevent-below-cost,
allow edit after print, allow returns) — enforced inside business logic, not in guards.

`SUPER_ADMIN` bypasses all permission checks.

## Auth flow

```
POST /api/auth/login    → { accessToken (15m), refreshToken (7d), user }
POST /api/auth/refresh  → rotates refreshToken (revokes old, issues new)
POST /api/auth/logout   → revokes refresh token(s)
GET  /api/auth/me       → returns current user + effective permissions
```

- bcrypt(12) password hashing
- 5 failed attempts → 15-min lockout
- Every attempt logged to `login_history`
- All sensitive actions logged to `audit_logs`
```
