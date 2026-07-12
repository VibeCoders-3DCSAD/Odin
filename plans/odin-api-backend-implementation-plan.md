# Odin Offline-First Module Implementation Plan

> Replaces the old API-route-first backend plan.
>
> Current source of truth: `docs/offline-sync/`, `supabase/migrations/`, `docs/PRD-Full-Odin-App.md`, and `docs/Specification.md`.
>
> Baseline assumption: the current offline-sync implementation has already been audited. New module work should extend that shape instead of introducing a second backend or request-replay architecture.

## TOC

- [Purpose](#purpose)
- [Current Implementation Shape](#current-implementation-shape)
- [Core Rules](#core-rules)
- [Sync Strategy Types](#sync-strategy-types)
- [How To Implement A Module](#how-to-implement-a-module)
- [Module Build Order](#module-build-order)
- [Product Requirements By Module](#product-requirements-by-module)
- [Testing Checklist](#testing-checklist)
- [Do Not Rebuild](#do-not-rebuild)

## Purpose

Odin is now an offline-first app, not a route-first API app. The implementation path is:

```text
UI -> local repository -> SQLite table -> sync_queue -> runSync() -> /odin/api/sync/push -> apply_sync_operation() -> /odin/api/sync/pull -> SQLite convergence
```

The UI must read from local SQLite and write through local repositories. Network sync is background convergence, not the primary user interaction path.

Authentication, account deletion, and data export remain online-only. LSTM forecasting requires server connectivity, but cached forecast outputs may be shown offline.

## Current Implementation Shape

The audited baseline already has these pieces:

- `apps/app/local-db/client.ts`: opens `odin.db` and runs numbered local migrations.
- `apps/app/local-db/migrations/001_sync_tables.ts`: creates `sync_state`, `sync_queue`, and `sync_errors`.
- `apps/app/local-db/migrations/002_taxonomy_tables.ts`: creates local taxonomy tables.
- `apps/app/local-db/migrations/003_privacy_settings.ts`: creates local privacy settings.
- `apps/app/local-db/repositories/taxonomy.ts`: local taxonomy reads/writes and queued sync operations.
- `apps/app/local-db/repositories/privacySettings.ts`: local privacy settings access.
- `apps/app/local-db/sync/runSync.ts`: registers the device, pushes pending operations, pulls changed rows, applies remote rows locally.
- `apps/api/src/routes/sync.ts`: exposes `/odin/api/sync/register-device`, `/odin/api/sync/push`, and `/odin/api/sync/pull`.
- `apps/api/src/services/syncService.ts`: sync push/pull service and synced table list.
- `apps/api/src/services/syncApplyOperation.ts`: server-side operation allowlist and payload validation before RPC.
- `supabase/migrations/20260709000000_add_sync_infrastructure.sql`: sync columns, device table, applied operation log, edit history.
- `supabase/migrations/20260712000000_add_apply_sync_operation_rpc.sql`: `apply_sync_operation()` for currently syncable taxonomy entities.

Current synced entities are `categories` and `subcategories`. Current pulled tables are `category_groups`, `categories`, and `subcategories`.

## Core Rules

- Local SQLite is the UI source of truth for offline-capable modules.
- Queue domain operations, not HTTP requests. Use `transactions.create`, not `POST /transactions` replay.
- Every user-owned row must stay scoped by `user_id` locally and remotely.
- Every synced remote table needs `version`, `deleted`, `created_at`, and `updated_at`.
- Deletes are tombstones. Do not hard-delete synced records from local or remote tables.
- Server idempotency checks `applied_operations` before applying a mutation.
- Conflict policy is automatic: delete wins, then per-field last-write-wins.
- Losing or rejected operation details go to `edit_history`.
- Screens do not call `/sync/push` or `/sync/pull` directly.
- New module work must extend the current sync lists and RPC validation deliberately; do not add a parallel sync engine.

## Sync Strategy Types

Pick one strategy before writing code.

| Strategy | Use for | Implementation |
|---|---|---|
| Pull-only catalog | System/reference data like category groups and seeded taxonomy | Local table plus `/sync/pull`; no local queued writes |
| User CRUD sync | User-created records like accounts, transactions, budgets, savings goals, debts | Local table, repository mutations, `sync_queue`, RPC allowlist, push/pull |
| Derived snapshot cache | Reports, budget health, alerts, model outputs | Pull server-calculated rows; local UI may cache and display offline |
| Online execution with cached result | LSTM forecasting and other server inference | Online action creates/refreshes result; local table stores last successful result |
| Online-only governance | Auth, data export, account deletion | Keep direct API/Supabase calls; no offline queue |

If a module has mixed behavior, split it. Example: forecasting generation is online execution, but forecast result display is a derived snapshot cache.

## How To Implement A Module

### 1. Confirm Product Scope

Read `docs/PRD-Full-Odin-App.md` and `docs/Specification.md` for the module. Capture only the user-visible requirements needed for the current slice.

For each slice, write down:

- Screen or flow that proves the module works.
- Server table or tables from `supabase/migrations/` that are the canonical remote shape.
- Whether the module is pull-only, user CRUD sync, derived snapshot cache, online execution, or online-only.
- Required ownership checks and foreign-key ownership checks.
- Required offline behavior and online-only boundaries.

### 2. Start From The Supabase Migration

Find the remote table in `supabase/migrations/`, usually in `20260616064145_priority_modules_v3.sql` or later migrations.

Use the remote schema as the source for the local schema, but do not blindly copy server-only details. Keep only what the app must read, edit, sync, or display.

For user-owned synced tables, verify the remote table has or gets:

```sql
user_id uuid not null,
version integer not null default 1,
deleted boolean not null default false,
created_at timestamptz not null default now(),
updated_at timestamptz not null default now()
```

If those columns are missing, add a Supabase migration before wiring the module to sync.

### 3. Create The Local Table

Add the next numbered migration in `apps/app/local-db/migrations/`.

Use the existing local migration style:

```text
00N_module_name.ts
```

Every synced local table should include:

```sql
id text primary key,
user_id text not null,
version integer not null default 1,
deleted integer not null default 0,
created_at text not null,
updated_at text not null,
last_synced_at text
```

Add only indexes needed by actual screens or sync lookups. Do not pre-index every possible filter.

Register the migration in `apps/app/local-db/client.ts`.

### 4. Build The Local Repository

Create or extend `apps/app/local-db/repositories/<module>.ts`.

Repository functions should match user actions, not HTTP routes:

```ts
createTransaction(input)
updateTransaction(id, patch)
deleteTransaction(id)
listTransactions(filters)
```

For mutating offline-capable functions, do one local transaction:

```text
validate input
verify local ownership / local foreign-key accessibility
write local row or tombstone
enqueue domain operation with changed_fields and base_version
return the local row immediately
```

Use `enqueueOperation()` from `apps/app/local-db/helpers.ts`. Do not queue raw URLs.

### 5. Extend Backend Sync Lists

For user CRUD sync, update the backend allowlists in the smallest places possible:

- Add the remote table to `SYNCED_TABLES` in `apps/api/src/services/syncService.ts` if it must be pulled.
- Add the entity to `SYNCED_ENTITIES` in `apps/api/src/services/syncApplyOperation.ts` if it can be pushed.
- Add create/update field allowlists in `syncApplyOperation.ts`.
- Validate foreign keys against the authenticated user's boundary before passing the operation to the RPC.

Do not make a generic arbitrary-table sync path. Financial data needs explicit validation.

### 6. Modify The RPC If Needed

Update `apply_sync_operation()` in a new Supabase migration when the module needs push sync.

For each new entity, the RPC must handle:

- `create`: insert only allowed fields, set `user_id = auth.uid()`, initialize `version = 1`, `deleted = false`.
- `update`: reject missing records, reject deleted records, update only changed allowed fields, bump version.
- `delete`: set `deleted = true`, set inactive/status fields when the table has them, bump version.
- Duplicate `operation_id`: return the cached `applied_operations.result`.
- Rejected operations: store reason and keep the local queue row failed.
- Conflict/audit cases: write `edit_history`.

If the module is pull-only or derived-cache-only, do not modify the RPC. Add it to pull only.

### 7. Wire Pull Convergence

Update local `runSync.ts` for any newly pulled table:

- Add the table to `SYNCED_TABLES`.
- Add the table's allowed local columns to `LOCAL_COLUMNS`.
- Normalize boolean values and JSON fields from Supabase to SQLite-safe values.
- Preserve tombstone handling.
- Apply incoming rows only when the remote version is newer than the local version.

Keep `runSync()` as the only public sync entrypoint.

### 8. Build The UI

Build the screen or modal named by the PRD/spec, using existing app structure under `apps/app/features/` or `apps/app/components/`.

UI rules:

- Read from the local repository.
- Mutate through the local repository.
- Show local results immediately.
- Show pending/failed sync state only where it affects user trust.
- Do not block core offline-capable flows on network calls.
- Keep destructive actions explicitly confirmed.
- Keep mobile layouts usable from 320 to 450 dp without horizontal scrolling.

### 9. Trigger Sync Opportunistically

After a successful local mutation, call `runSync(userId, deviceId, accessToken)` as best effort if auth and network are available.

Do not await sync before updating the UI unless the action is online-only by product requirement.

### 10. Prove The Vertical Slice

Each module is done only when one real user flow works end-to-end:

```text
open screen offline -> create/edit/delete locally -> see local UI update -> reconnect -> run sync -> remote row changes -> pull into a fresh local DB
```

For online execution modules, prove:

```text
open screen offline -> see cached result -> reconnect -> refresh server result -> cache result locally -> reopen offline
```

## Module Build Order

Follow dependency order from the PRD and Specification. Do not build dependent screens before their local data source exists.

1. Taxonomy and restrictions: category groups, categories, subcategories, category restrictions, subcategory restrictions.
2. Financial accounts: wallets, bank accounts, e-wallet accounts, cash accounts, balance containers.
3. Transaction ledger: income, expenses, transfers, line items, templates, recurring templates, transaction history filters.
4. Profile data cache: current profile assignment, profile explanations, reassessment status.
5. Budgets: budget periods, allocations, strategy configs, health snapshots, recommendation results.
6. Dashboard: local aggregate cards from accounts, transactions, budgets, alerts, cached forecasts, savings, and debt.
7. Savings goals: goals, contributions, priority table, allocation strategy inputs, cached projections.
8. Debt management: debt accounts, payments, priorities, hardship records, cached projections.
9. Alerts and notifications: alert inbox, acknowledgement, suppression, notification preferences.
10. Forecasting cache: cached LSTM outputs, category-group forecast lines, fallback metadata.
11. Anomaly and overspending cache: anomaly results, user feedback, whitelist rules, suppression rules.
12. Reports and analytics: generated report snapshots and date-range local reads.
13. Settings/governance: privacy settings where offline-safe; data export and account deletion remain online-only.

## Product Requirements By Module

### Taxonomy

Requirements:

- Four-tier classification: items, subcategories, categories, expense groups.
- Expense groups are fixed: Essentials, Obligatory, Discretionary, Financial Allocation.
- Categories and subcategories are based on PSA PCOICOP.
- Filipino-context categories include family support, remittances, paluwagan, religious donations, community collections, government contributions, debt payments, insurance, emergency fund, savings, and investments.
- Users may create custom categories/subcategories but not custom expense groups.
- Each item must resolve to exactly one expense group; split mixed items.

Sync strategy: pull-only for system taxonomy, user CRUD sync for user-created categories/subcategories and restrictions.

### Financial Accounts

Requirements:

- Users can manage multiple accounts.
- Accounts may represent cash, wallets, banks, e-wallets, savings, debt/loan containers where supported by schema.
- Balances can be positive or negative when the account type allows it.
- Total cash position comes from the sum of included account balances.

Sync strategy: user CRUD sync.

### Transaction Ledger

Requirements:

- Manual income, expense, and transfer entry.
- Transfer transactions must not distort income/expense totals.
- Expense items support subcategory/category/group classification.
- Transaction templates support fast repeated logging.
- Recurring transactions can be paused, resumed, stopped, and surfaced in history.
- Transaction history supports search, filtering, sorting, editing, and deletion.
- Offline transaction entry is thesis-critical.

Sync strategy: user CRUD sync. This is the main proof slice after taxonomy/accounts.

### Financial Behavioral Profile

Requirements:

- Four fixed profiles: Stable-Flexible, Stable-Obligated, Variable-Flexible, Variable-Obligated.
- Classification supports questionnaire, manual selection, cold-start fallback where applicable, standard classification, and user-confirmed reassignment.
- Profile outputs must include user-facing explanations.

Sync strategy: online execution for classifier runs; derived snapshot cache for current assignment and explanations; user CRUD sync for manual selection/confirmation if the schema supports local-first confirmation.

### Budgets And Recommendations

Requirements:

- Budget periods match real pay cycles.
- Users set total budget size and allocations.
- Restriction levels are Free, Protected, and Locked.
- Protected categories must not be reduced unless the user explicitly changes protection settings.
- Named strategies include 50/30/20 and Savings-First; custom strategies are allowed.
- Recommendations use Linear Programming and include explanations.
- Budget health shows prescribed vs actual status.
- Infeasible budgets reduce Discretionary first, then Financial Allocation, then Obligatory; Essentials and Protected categories remain protected.

Sync strategy: user CRUD sync for budgets/configs; online execution or server-derived cache for generated recommendations; local cache for accepted recommendations and health snapshots.

### Forecasting

Requirements:

- LSTM forecasting is server-side and requires internet.
- Offline mode may show the last cached forecast.
- Forecasts include cold-start and personalized metadata.
- Primary visualization shows next-month lines for Essentials, Obligatory, Discretionary, and Financial Allocation.

Sync strategy: online execution with cached result.

### Anomaly And Overspending Detection

Requirements:

- Isolation Forest detects unusual transactions.
- Rule-based overspending detects budget risk.
- Cold-start anomaly behavior must still be useful.
- Culturally expected spending should avoid misleading alerts.
- Users can mark unusual transactions as intentional and whitelist repeated cases.
- Outputs must include explanations.

Sync strategy: online execution or derived snapshot cache for detector results; user CRUD sync for feedback, whitelists, and suppression rules.

### Savings Goals

Requirements:

- Goals track target amount, saved amount, remaining amount, target date, progress state, priority, and strategy inputs.
- Contributions may link to Financial Allocation transactions.
- Multiple goals appear in a priority table.
- Snowball prioritizes smallest remaining amount first.
- Avalanche follows the ranked or highest-impact goal first.

Sync strategy: user CRUD sync for goals/contributions/priorities; derived snapshot cache for projections.

### Debt Management

Requirements:

- Debt accounts track balances, interest rates, minimum payments, and payoff strategy.
- Users compare Avalanche and Snowball repayment strategies.
- Debt hardship records are supported.
- Projections regenerate when balance, payment, strategy, extra payment, or hardship assumptions change.

Sync strategy: user CRUD sync for debt accounts/payments/priorities/hardship; derived snapshot cache for projections.

### Reports And Analytics

Requirements:

- Week, month, and custom date ranges.
- Budget vs actual, forecast vs actual, category summaries, savings progress, debt progress, and protected-category/obligation summaries.
- Wider desktop views are allowed, but mobile remains primary.

Sync strategy: mostly local reads plus derived snapshot cache when reports are generated server-side.

### Settings And Governance

Requirements:

- Privacy settings and consent state must be visible to the user.
- Data export and account deletion must be clear and auditable.
- Problem reporting sends email via configured server; no admin ticketing system is required by the Specification.

Sync strategy: privacy settings may be offline-capable if queued safely; data export, account deletion, auth, password flows, and problem-report email submission stay online-only.

## Testing Checklist

Minimum checks for every offline-capable module:

- Local create writes SQLite and enqueues one operation.
- Local update records only changed fields and the current base version.
- Local delete creates a tombstone, not a hard delete.
- Repository rejects invalid input before writing local data.
- Repository verifies local user ownership and accessible related IDs.
- `/sync/push` rejects unsyncable fields and inaccessible related IDs.
- Duplicate `operation_id` is idempotent.
- Update against a missing or deleted remote record is rejected.
- Delete wins over later edit.
- Pull applies newer remote versions and ignores stale versions.
- Pull applies tombstones locally.
- UI works offline for the core flow.
- UI sync failure does not lose local data.
- Mobile layout works at 320 to 450 dp without horizontal scroll.

Minimum checks for online execution modules:

- Offline screen shows cached result or a clear unavailable state.
- Online refresh stores the result locally.
- Cached result labels fallback/cold-start/personalized metadata correctly.
- Explanation fields render in user-facing language.

## Do Not Rebuild

- Do not revive the old route-by-route API implementation plan.
- Do not create `offlineFetch()` or request replay.
- Do not add a generic arbitrary-table sync RPC.
- Do not make auth, account deletion, or data export offline-first.
- Do not add a conflict review UI unless a later requirement explicitly asks for it.
- Do not make screens depend on network success for offline-capable writes.
