# Deployment Checklist

## 1) Environment and Secrets
- Set `NEXT_PUBLIC_SUPABASE_URL`
- Set `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Set `SUPABASE_SERVICE_ROLE_KEY`
- Set `SUPABASE_URL`
- Keep demo flags off in production:
  - `NEXT_PUBLIC_ENABLE_LOCAL_DEMO_MODE=false`
  - `NEXT_PUBLIC_ENABLE_DEMO_SETUP=false`
  - `ENABLE_DEMO_SETUP=false`

## 2) Database Baseline
- Run `scripts/01-init-schema.sql` in Supabase SQL editor
- Run `scripts/02-setup-demo-data.sql` only for staging/demo environments
- Run `scripts/04-atomic-sequential-receipts.sql` for existing databases upgrading to latest APIs
- Verify RLS policies are enabled for:
  - `students`
  - `fee_structures`
  - `transactions`
  - `transaction_items`
  - `users`
  - `schools`

## 3) Build and Quality Gates
- `npm install`
- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`

## 4) Runtime Verification
- Login as active user (`admin` or `accountant` or `fee_operator`)
- Confirm student search works by class + roll number
- Confirm fee selection loads from DB
- Confirm receipt generation persists to `transactions`
- Confirm line items persist to `transaction_items`
- Confirm `/api/reports/collection-summary` works for admin/accountant

## 5) Operational Safety
- Confirm backups for Supabase/Postgres are enabled
- Confirm monitoring and alerting are configured for API errors
- Confirm audit retention policy for transactions and receipts
- Confirm TLS and domain setup for production URL
