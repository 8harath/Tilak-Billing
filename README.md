# Tilak-Billing

School fee billing application for Tilak School.  
Goal: help office/accounting staff search students, collect fees, and print a dual-copy A4 receipt (management copy + parent copy).

## Current Project Status

This repository is in **active development**. Core UI flow exists, but production readiness is not complete yet.

What currently works:
- Login UI and Supabase auth wiring
- Local demo mode (app can run even before Supabase is configured)
- 3-step fee collection UI:
  1. Search/select student
  2. Select fee items and amounts
  3. Generate printable receipt
- A4 dual-receipt print layout:
  - Top half: management copy
  - Bottom half: parent copy
- API route scaffolding for students, fee structures, transactions, sync
- Supabase schema + seed scripts
- Basic offline queue utilities (IndexedDB)

What is still pending:
- Frontend is still using static mock student/fee data in the main form
- End-to-end API integration from form -> transaction save is incomplete
- Receipt number strategy should be made sequential/business-friendly
- Full role-based workflows for school accountant/admin are incomplete
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
  - Falls back to **local demo mode** if env vars are missing
- `components/login-form.tsx`
  - Staff login form
  - Demo setup trigger via `/api/auth/setup-demo`
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
- `app/api/auth/setup-demo/route.ts`

### Offline utilities
- `lib/db/indexed-db.ts`
- `hooks/use-offline-mode.ts`

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
```

Notes:
- `NEXT_PUBLIC_*` values are required by browser and server routes.
- `SUPABASE_SERVICE_ROLE_KEY` is required for demo setup endpoint/script.

### 3) Run database setup (Supabase SQL editor)

Execute in order:
1. `scripts/01-init-schema.sql`
2. `scripts/02-setup-demo-data.sql`

### 4) Run app

```bash
npm run dev
```

Open: `http://localhost:3000`

## Demo login

- Email: `staff@school.com`
- Password: `Password123!`

If user does not exist yet:
- click `Setup & Test Demo` in login UI
- or run `node scripts/03-create-demo-user.js`

## Local Demo Mode (without Supabase)

If Supabase env vars are missing, app now starts in **Local Demo Mode** so you can practice the UI/receipt flow before DB integration.

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

1. Replace hardcoded `STUDENTS` and `FEE_TYPES` in `fee-collection-form.tsx` with API fetch from Supabase.
2. On "Generate Receipt", persist transaction via `POST /api/transactions`.
3. Store transaction line items in `transaction_items`.
4. Add receipt print template fields for school logo and required legal text.
5. Add class-wise filters (Pre-Nursery to 10th standard) and robust student search by roll/admission/name.
6. Add tests for receipt generation, auth guard, and transaction persistence.

## Validation Commands

```bash
npx tsc --noEmit
npm run build
```

## Important

This codebase is a strong foundation, but not fully production-complete yet.  
Use it as the base to finish Supabase-backed data flow and accountant-friendly operations.
