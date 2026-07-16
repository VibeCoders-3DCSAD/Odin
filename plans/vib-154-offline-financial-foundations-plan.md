# VIB-154 Offline Financial Foundations Plan

## Goal

Deliver the offline-first financial foundation slice for financial accounts, income sources, and financial obligations so users can create, edit, delete, view, and later sync these records through the existing SQLite `sync_queue` pipeline without adding route replay or a second sync engine.

## Source Of Truth

- Linear: `VIB-154 - Phase 2b: Financial Accounts, Income Sources & Obligations offline-first`
- Design pattern: account list and add-account bottom sheet pasted in planning thread.
- Remote schema: `supabase/migrations/20260616064145_priority_modules_v3.sql:1222-1292` and `:1426-1455`
- Offline implementation guide: `plans/odin-api-backend-implementation-plan.md`
- Existing local sync shape: `apps/app/local-db/repositories/taxonomy.ts`, `apps/app/local-db/sync/runSync.ts`, `apps/api/src/services/syncApplyOperation.ts`, `apps/api/src/services/syncService.ts`
- Sync infrastructure: `supabase/migrations/20260709000000_add_sync_infrastructure.sql` and `supabase/migrations/20260712000000_add_apply_sync_operation_rpc.sql`

## Non-Goals

- Do not build transaction ledger CRUD in this ticket.
- Do not introduce request replay, `offlineFetch()`, or route-by-route offline APIs.
- Do not add a generic arbitrary-table sync RPC.
- Do not compute dashboard aggregates beyond exposing local account balances needed by later dashboard work.
- Do not build recurring transaction generation from obligations; only store the obligation records and optional link field.

## Execution Order

## PR Stacking Strategy

```text
main
└─ feat/vib-154-phase-2b-financial-accounts-income-sources-obligations
   ├─ feat/vib-154-remote-sync-schema
   │  └─ feat/vib-154-local-financial-repositories
   │     └─ feat/vib-154-sync-convergence
   │        └─ feat/vib-154-accounts-ui
   │           └─ feat/vib-154-income-obligations-ui
```

Merge from the bottom of each dependency chain upward: remote sync schema, local repositories, sync convergence, accounts UI, then income/obligations UI. With Graphite, create each branch from the branch above it with `gt create`; with vanilla git, `git switch -c <next-branch>` while on the current stack tip and target each PR at its parent branch.

## Linear Sub-Issue Tracking

- `VIB-220`: Remote sync schema and backend validation.
- `VIB-221`: Local SQLite financial tables and repositories.
- `VIB-224`: Pull convergence and sync behavior tests.
- `VIB-223`: Financial accounts UI wired to local repositories.
- `VIB-222`: Income sources and obligations UI wired to local repositories.

### 1. Remote Sync Schema And Backend Validation

- Touch `supabase/migrations/<timestamp>_sync_financial_foundations.sql`, `apps/api/src/services/syncApplyOperation.ts`, and `apps/api/src/services/syncService.ts`.
- Add `version`, `deleted`, sync indexes, `SYNCED_TABLES`, `SYNCED_ENTITIES`, and explicit create/update field allowlists for `financial_accounts`, `income_sources`, and `financial_obligations`.
- Keep ownership checks explicit: account/income/obligation rows must be `user_id = auth.uid()`, and `financial_obligations.subcategory_id` must reference an accessible expense subcategory.

### 2. Local SQLite Tables And Repositories

- Touch `apps/app/local-db/migrations/006_financial_foundations.ts`, `apps/app/local-db/client.ts`, `apps/app/local-db/types.ts`, and add `apps/app/local-db/repositories/financialFoundations.ts`.
- Mirror only app-needed remote fields, include `user_id`, `version`, `deleted`, `created_at`, `updated_at`, and `last_synced_at`, then implement `create/update/delete/list/get` actions that write SQLite and call `enqueueOperation()` in one transaction.
- Validate enum values, money ranges, date ranges, delete tombstones, and local foreign-key ownership before enqueueing.

### 3. Pull Convergence And Sync Behavior Tests

- Touch `apps/app/local-db/sync/runSync.ts`, `apps/api/src/__tests__/services/syncApplyOperation.test.ts` if service tests exist or the nearest existing sync test location, and app local-db tests if present.
- Add the three tables to local pull convergence with boolean/JSON/date normalization and ensure newer remote versions win while stale rows are ignored.
- Prove duplicate operation idempotency, rejected inaccessible subcategory IDs, delete wins, local tombstones, and failed queue rows retaining failure details.

### 4. Financial Accounts UI

- Touch the existing app navigation shell in `apps/app/components/MobileShell.tsx` only as needed, and add a focused feature under `apps/app/features/financial-accounts/`.
- Build account list and create/edit/delete flows that read and mutate through `financialFoundations.ts`, show local results immediately, and expose balances for later transaction entry/dashboard use.
- Follow the pasted account-list pattern: cream app shell, Manrope-like hierarchy, dark green total cash card, rounded account rows, warning styling for negative balances, floating add button, and existing bottom nav treatment.
- Keep destructive delete/archive actions confirmed and keep mobile layouts usable at 320-450 dp.

### 5. Income Sources And Obligations UI

- Add focused features under `apps/app/features/income-sources/` and `apps/app/features/financial-obligations/`, reusing the same repository instead of direct network calls.
- Build create/edit/delete flows for income sources and obligations, including subcategory selection from local taxonomy for obligations.
- Trigger `runSync()` opportunistically after local mutations when auth, device, and network are available, but never block the UI on sync success.

## Design Pattern

- Financial accounts screen: mobile-first cream background, top status/header row, dark green summary card for `Total cash position`, compact account cards with 44px rounded icon tiles, right-aligned PHP balances, and red-tinted warning row for negative credit/loan balances.
- Add account flow: use a dimmed backdrop and rounded bottom sheet with drag handle, account-type segmented cards, warm filled inputs, and a full-width dark green primary button.
- Icons should use existing app icon libraries; do not add a new icon dependency.
- Preserve the current app navigation shell unless a minimal local route addition is needed.

## Acceptance Criteria

- A user can create, edit, list, and delete financial accounts offline.
- Account balances are stored locally and available for later transaction entry and dashboard summaries.
- A user can create, edit, list, and delete income sources offline.
- A user can create, edit, list, and delete financial obligations offline.
- Local mutations enqueue domain operations with `changed_fields`, `base_version`, and clear failure messages.
- `/odin/api/sync/push` rejects unsyncable fields and inaccessible related IDs.
- `apply_sync_operation()` is idempotent by `operation_id` and applies create/update/delete for all three entities.
- `/odin/api/sync/pull` returns newer financial foundation rows scoped to the authenticated user.
- Pull convergence applies newer versions, ignores stale versions, and applies tombstones locally.
- Deletes are tombstones locally and remotely; no synced records are hard-deleted.
- Core flows work offline first and converge after reconnecting and running sync.
- Verification includes `pnpm --filter api test`, `pnpm --filter api build`, and an app smoke run for the new screens.
