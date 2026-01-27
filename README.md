# Watchtower (Website Change Tracker)

Watchtower is a Next.js + Postgres app that monitors web pages for changes and
emails a human-readable diff + summary. It includes a minimal dashboard UI,
scheduled jobs via pg-boss, and a worker that fetches pages with Playwright.

## Stack
- Next.js App Router + TypeScript
- Postgres + Prisma ORM (Prisma 7 + PG adapter)
- NextAuth (credentials)
- pg-boss jobs
- Playwright + undici fallback
- Resend email provider

## Local setup

### 1) Install dependencies
```bash
pnpm install
```

### 2) Configure env
```bash
cp .env.example .env
```

Update the values in `.env`, especially:
- `DATABASE_URL`
- `NEXTAUTH_SECRET`
- `RESEND_API_KEY`
- `FROM_EMAIL`

### 3) Start Postgres
Use Docker if available:
```bash
docker compose up -d
```

### 4) Generate Prisma client + run migrations
```bash
pnpm prisma:generate
pnpm prisma:migrate
```

### 5) Seed a demo user (optional)
```bash
pnpm seed
```

Default credentials:
```
demo@watchtower.dev / watchtower123
```

### 6) Install Playwright browser
```bash
pnpm exec playwright install chromium
```

### 7) Run the app
```bash
pnpm dev
```

### 8) Run the worker (in another terminal)
```bash
pnpm worker
```

If you want a dedicated scheduler process:
```bash
pnpm scheduler
```

## Scripts
- `pnpm dev` – Next.js dev server
- `pnpm worker` – pg-boss worker (scheduler + monitor jobs)
- `pnpm scheduler` – scheduler-only worker
- `pnpm prisma:generate` – generate Prisma client
- `pnpm prisma:migrate` – run migrations
- `pnpm seed` – seed demo user + project

## Environment variables
```
DATABASE_URL=postgresql://watchtower:watchtower@localhost:5432/watchtower
NEXTAUTH_SECRET=change-me
NEXTAUTH_URL=http://localhost:3000
EMAIL_PROVIDER=resend
RESEND_API_KEY=
FROM_EMAIL=watchtower@example.com
APP_URL=http://localhost:3000
FEATURE_ENFORCE_PLAN=false
```

## Notes
- Plan enforcement is feature-flagged via `FEATURE_ENFORCE_PLAN`.
- The worker uses Playwright first, then falls back to undici if rendering fails.
- pg-boss uses Postgres; ensure the database is reachable before running worker.
