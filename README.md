# Tilak-Billing

School fee billing application for Tilak School.  
Goal: help office/accounting staff search students, collect fees, and print a dual-copy A4 receipt (management copy + parent copy).

## Current Project Status

This repository is in **active development**. Core UI flow exists, but production readiness is not complete yet.

What currently works:
- Login UI and Supabase auth wiring
- Optional local demo mode (explicitly opt-in via env flag)
- 3-step fee collection UI:
  1. Search/select student
  2. Select fee items and amounts (from DB fee structures or custom line item)
  3. Save transaction and generate printable receipt
- A4 dual-receipt print layout:
  - Top half: management copy
  - Bottom half: parent copy
- Student API search by name/roll and class filter
- Fee structure API class filtering
- Transactions API with item-level persistence (`transaction_items`)
- Receipt preview built from persisted transaction data
- Offline queue with auto/manual sync to `/api/transactions/sync`
- Centralized API authorization with active-user and role checks
- Profile endpoint for UI role display (`/api/me`)
- Collection summary report endpoint (`/api/reports/collection-summary`)
- Supabase schema + seed scripts
- Deployment and UAT checklists in `docs/`

What is still pending:
- Receipt number strategy should be made sequential/business-friendly
- Full admin/staff management workflow UI is incomplete
- Automated tests are not present yet

## Tech Stack

- Next.js 16 (App Router)
- React 19 + TypeScript
- Tailwind CSS 4
- Supabase (Auth + Postgres + RLS)
- IndexedDB (offline queue primitives)

## Repository Overview

### App entry and auth
- `app/page.tsx`
  - Main route
  - Uses Supabase auth if configured
  - Shows setup guidance if Supabase env vars are missing
  - Can run in **local demo mode** only when explicitly enabled in development
- `components/login-form.tsx`
  - Staff login form
  - Demo setup trigger via `/api/auth/setup-demo` (disabled by default)
- `components/dashboard.tsx`
  - Header + logout + `FeeCollectionForm`

### Fee collection and receipt UI
- `components/fee-collection-form.tsx`
  - 3-step flow for student selection, fee selection, and receipt generation
  - Printable two-copy receipt on A4

### Supabase and backend routes
- `lib/supabase/client.ts`
  - Browser Supabase client
- `lib/supabase/server.ts`
  - Server-safe Supabase client for route handlers
- `app/api/students/route.ts`
- `app/api/fee-structures/route.ts`
- `app/api/transactions/route.ts`
- `app/api/transactions/sync/route.ts`
- `app/api/reports/collection-summary/route.ts`
- `app/api/me/route.ts`
- `app/api/auth/setup-demo/route.ts`

### Offline utilities
- `lib/db/indexed-db.ts`
- `hooks/use-offline-mode.ts`

### Go-Live docs
- `docs/DEPLOYMENT_CHECKLIST.md`
- `docs/UAT_CHECKLIST.md`

### Database scripts
- `scripts/01-init-schema.sql`
  - Schema + RLS policies + indexes
- `scripts/02-setup-demo-data.sql`
  - Seed school/students/fee structures
- `scripts/03-create-demo-user.js`
  - Creates demo auth user profile in Supabase

## Setup

### 1) Install dependencies

```bash
npm install
```

### 2) Configure environment

Copy `.env.example` to `.env.local` and fill:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_URL=... # same as NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_ENABLE_LOCAL_DEMO_MODE=false
NEXT_PUBLIC_ENABLE_DEMO_SETUP=false
ENABLE_DEMO_SETUP=false
DEMO_SETUP_TOKEN=
```

Notes:
- `NEXT_PUBLIC_*` values are required by browser and server routes.
- `SUPABASE_SERVICE_ROLE_KEY` is required for demo setup endpoint/script.
- `ENABLE_DEMO_SETUP` and `NEXT_PUBLIC_ENABLE_DEMO_SETUP` must be `true` to show and use demo-setup flow.
- Demo setup endpoint is blocked in production.

### 3) Run database setup (Supabase SQL editor)

Execute in order:
1. `scripts/01-init-schema.sql`
2. `scripts/02-setup-demo-data.sql`

### 4) Run app

```bash
npm run dev
```

Open: `http://localhost:3000`

## Demo login (development only)

- Email: `staff@school.com`
- Password: `Password123!`

If user does not exist yet:
- set `ENABLE_DEMO_SETUP=true` and `NEXT_PUBLIC_ENABLE_DEMO_SETUP=true`
- optionally set `DEMO_SETUP_TOKEN` and send it via `x-demo-setup-token`
- click `Setup & Test Demo` in login UI
- or run `node scripts/03-create-demo-user.js`

## Local Demo Mode (without Supabase)

If Supabase env vars are missing, the app shows setup guidance by default.
To practice UI flow without Supabase, explicitly enable local demo mode in development:

```bash
NEXT_PUBLIC_ENABLE_LOCAL_DEMO_MODE=true
```

This mode:
- bypasses auth
- opens dashboard + fee collection form
- keeps data as local mock data only

## Receipt Format Goal

Current receipt layout is designed for A4 split into two parts:
- Top section: administration/management copy
- Bottom section: parent copy

This matches the target operating model for school office/account staff.

## Recommended Next Development Steps

1. Make receipt numbering deterministic and sequential for accounting (current format is timestamp-based).
2. Add receipt print template fields for school logo and required legal text.
3. Complete admin/staff management UI for role assignment and activation.
4. Add automated tests for receipt generation, auth guard, offline sync, and reporting.

## Validation Commands

```bash
npm run lint
npx tsc --noEmit
npm run build
```

## Important

This codebase is a strong foundation, but not fully production-complete yet.  
Use it as the base to finish Supabase-backed data flow and accountant-friendly operations.
