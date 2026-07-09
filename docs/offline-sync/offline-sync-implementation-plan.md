# Offline Sync Implementation Plan

**Scope:** `odin/apps/app`, `odin/apps/api`, and Supabase/Postgres schema
**Inputs:** `offline-sync-engine.md`, `fetch-catalog.md`, `../PRD-Full-Odin-App.md`
**Status:** Draft implementation plan

## Goal

Implement Odin's offline-first data path and migrate the currently implemented
offline-capable frontend `fetch()` call sites. The first implementation should
create the local DB, cloud sync schema, backend sync endpoints, app sync engine,
and replace existing taxonomy/profile/privacy offline-capable calls with local
repositories. Online-only auth, account deletion, and data export calls stay on
the network path.

The target data path is:

```text
local SQLite write -> sync_queue operation -> runSync() -> /sync/push -> /sync/pull -> local SQLite convergence
```

Not:

```text
save route + payload -> replay original fetch later
```

The queue must store domain operations, not HTTP requests. A queued operation
should say `transactions.create`, `categories.update`, or `savings_goals.delete`,
not `POST /odin/api/categories`.

## Non-Goals

- Do not replace online-only `fetch()` calls in this pass.
- Do not make registration, login, logout, forgot password, or password update
  work offline.
- Do not store passwords, auth credentials, access tokens, or refresh tokens in
  the local business database.
- Do not add a conflict review UI. Conflicts resolve automatically and are
  logged for audit/recovery.
- Do not implement fresh LSTM forecasting offline. Offline mode can show cached
  forecast results only.

## Current Fetch Catalog Impact

Online-only calls stay online-only:

| Area | Endpoints / Calls | Offline behavior |
|---|---|---|
| Auth | Supabase auth, `/auth/login`, `/auth/register`, `/auth/password-reset`, `/auth/password-update`, `/auth/logout` | Require internet |
| Session bootstrap | `/auth/session` | Require internet for auth refresh/session validation |
| Account deletion | `/account-deletion-requests*` | Require internet |
| Data export | `/data-export-requests` | Require internet |

Offline-capable calls to migrate in this pass:

| Area | Current endpoints | Future path |
|---|---|---|
| Profile/privacy settings | `/me`, `/privacy/settings` | Read/write local settings, queue mutation where allowed |
| Consents | `/consents` | Keep submit online during onboarding; cache synced consent state locally |
| Taxonomy | `/category-groups`, `/categories`, `/categories/:id` | Local repositories + queued domain operations |

The PRD's larger offline scope also needs local repositories even where fetch
call sites do not exist yet: transactions, accounts, budgets, savings goals,
debts, alerts, notification preferences, and profile classification data.

## Phase 1: Local SQLite Foundation

Add a local persistence boundary in `odin/apps/app`:

```text
apps/app/src/local-db/
├─ client.ts
├─ migrations/
├─ repositories/
└─ sync/
```

Create the DB client and migration runner first. Keep it boring: one local DB,
versioned migrations, and repository functions that hide SQL from screens.

Minimum local sync tables:

```sql
sync_state (
  user_id text primary key,
  device_id text not null,
  pull_cursor text,
  last_sync_at text
);

sync_queue (
  operation_id text primary key,
  user_id text not null,
  device_id text not null,
  entity text not null,
  record_id text not null,
  operation_type text not null,
  base_version integer,
  changed_fields text not null,
  payload text not null,
  status text not null,
  attempts integer not null default 0,
  last_error text,
  created_at text not null
);

sync_errors (
  id text primary key,
  operation_id text,
  message text not null,
  created_at text not null
);
```

Every synced local table should carry:

```sql
id text primary key,
user_id text not null,
version integer not null default 1,
deleted integer not null default 0,
created_at text not null,
updated_at text not null,
last_synced_at text
```

Start local domain tables in this order:

1. `category_groups`, `categories`, `subcategories`, because the current fetch
   catalog already has taxonomy reads/writes.
2. `financial_accounts`, because transactions need account ownership and balance
   effects.
3. `transactions`, because this is the main offline thesis flow.
4. `budgets`, `budget_categories`, and `budget_strategies`.
5. `savings_goals` and `debt_accounts`.
6. `alerts`, `notification_preferences`, and cached model outputs.

## Phase 2: Local Repository Contract

Do not build a generic `offlineFetch(route, payload)` helper. That keeps the app
tied to transport details and makes conflict handling messy.

Use feature repositories/use-cases instead:

```ts
createCategory(input)
updateCategory(id, patch)
deleteCategory(id)
createTransaction(input)
updateTransaction(id, patch)
deleteTransaction(id)
```

Each mutating repository function should do one local transaction:

```text
validate input
write local row or tombstone
enqueue domain operation with changed_fields and base_version
return the local row immediately
```

Queue operation shape:

```ts
type SyncOperation = {
  operationId: string;
  userId: string;
  deviceId: string;
  entity: "categories" | "transactions" | "financial_accounts";
  recordId: string;
  operationType: "create" | "update" | "delete";
  baseVersion: number | null;
  changedFields: string[];
  payload: Record<string, unknown>;
  createdAt: string;
};
```

This gives the backend enough information to apply optimistic versioning,
delete-wins, and per-field LWW without guessing from an HTTP route.

## Phase 3: Cloud DB Sync Columns

Modify every synced Postgres table to include:

```sql
user_id uuid not null,
version integer not null default 1,
deleted boolean not null default false,
created_at timestamptz not null default now(),
updated_at timestamptz not null default now()
```

Add sync infrastructure tables:

```sql
user_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  device_id text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz,
  unique (user_id, device_id)
);

applied_operations (
  operation_id uuid primary key,
  user_id uuid not null,
  device_id text not null,
  entity text not null,
  record_id uuid not null,
  operation_type text not null,
  result jsonb not null,
  created_at timestamptz not null default now()
);

edit_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  operation_id uuid,
  entity text not null,
  record_id uuid not null,
  reason text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);
```

Keep RLS/user scoping strict: every synced row and sync log must resolve inside
the authenticated `user_id` boundary.

## Phase 4: Backend Sync API

Add sync routes in `odin/apps/api`:

```text
POST /odin/api/sync/push
GET  /odin/api/sync/pull?cursor=...
POST /odin/api/sync/register-device
```

Backend service layout:

```text
apps/api/src/routes/sync.ts
apps/api/src/controllers/syncController.ts
apps/api/src/services/syncService.ts
apps/api/src/services/syncApplyOperation.ts
```

`/sync/push` should:

1. Authenticate the user.
2. Validate the device is active.
3. Receive a bounded batch of queued operations.
4. Check `applied_operations` first for idempotency.
5. Apply new operations inside a DB transaction.
6. Reject update-vs-missing-row instead of upserting.
7. Apply delete-wins before edit-vs-edit resolution.
8. Resolve edit-vs-edit per changed field.
9. Log losing/rejected operations in `edit_history`.
10. Return per-operation results so the app can mark local queue rows synced or
    failed.

`/sync/pull` should:

1. Authenticate the user.
2. Return changed rows since the cursor for synced tables.
3. Include tombstones (`deleted = true`).
4. Return a new cursor generated by the backend.

## Phase 5: App Sync Engine

Create one public sync entrypoint:

```ts
runSync(): Promise<SyncResult>
```

Put it under:

```text
apps/app/src/local-db/sync/runSync.ts
```

Algorithm:

```text
if no authenticated session: stop softly
if offline: stop softly
if sync already running: return current run
load sync_state
push pending sync_queue rows in created_at order
mark accepted operations as synced
record failed/rejected operations without deleting local data
pull remote changes since cursor
apply pulled rows to local SQLite by version/deleted rules
save new cursor
return counts and status
```

Trigger `runSync()` from:

1. App startup after auth hydration.
2. Network reconnect.
3. App foreground/resume.
4. After local queued mutation, as a best-effort fire-and-forget call.
5. Manual user retry from a sync status UI, if added later.

No screen should call `/sync/push` or `/sync/pull` directly.

## Phase 6: Replace Current Offline-Capable Fetches

Replace currently implemented offline-capable fetches with domain-level helpers,
not a route replay helper.

Bad helper:

```ts
queueRequest(userId, route, payload)
```

Better helper:

```ts
mutateLocal({
  entity: "categories",
  operationType: "update",
  recordId,
  baseVersion,
  changedFields: ["name", "restriction_level"],
  payload,
  applyLocal: tx => updateCategoryRow(tx, recordId, payload),
});
```

Even better for normal app code: hide that helper behind feature repositories so
screens only call `updateCategory(id, patch)`.

Current migration targets from `fetch-catalog.md`:

1. `features/taxonomy/TaxonomyScreen.tsx`
   - Replace `GET /category-groups` with local `listCategoryGroups()`.
   - Replace `DELETE /categories/:id` with local `deleteCategory()` tombstone +
     queued `categories.delete` operation.
2. `features/taxonomy/CategoryFormScreen.tsx`
   - Replace `POST /categories` with local `createCategory()` + queued
     `categories.create` operation.
   - Replace `PATCH /categories/:id` with local `updateCategory()` + queued
     `categories.update` operation.
3. `features/governance/PrivacySettingsScreen.tsx`
   - Replace `GET /privacy/settings` with local cached settings read once the
     initial server state has been synced.
   - Replace `PATCH /privacy/settings` with local `updatePrivacySettings()` +
     queued operation if this setting is approved as offline-capable.
4. `components/AuthExperience.tsx` and governance screens using
   `/me?include=consents`
   - Keep auth/session calls online-only.
   - Read cached profile/consent state locally after login hydration and sync.

Keep these fetches unchanged because they are online-only by requirement:

1. Supabase auth calls.
2. `/odin/api/auth/*` calls.
3. `/odin/api/data-export-requests` calls.
4. `/odin/api/account-deletion-requests*` calls.

## Phase 7: Auth and Offline Boundaries

Auth remains internet-required:

| Flow | Offline behavior |
|---|---|
| Register | Block with internet-required message |
| Login | Block with internet-required message |
| Logout | Require internet and block while the current user has pending sync queue rows |
| Forgot password | Block with internet-required message |
| Password update | Block with internet-required message |

For an already authenticated user, offline app access depends on existing auth
session hydration. The local DB may store user-owned business data, but not auth
secrets in business tables.

Logout policy for v1:

```text
logout requested
check sync_queue for pending or failed rows for the current user
if queue is empty: call online logout
if queue has rows and internet is available: runSync()
if sync succeeds and queue is empty: call online logout
if queue still has rows: block logout and show a sync-required message
if offline: block logout and show a sync-required message
```

Do not allow local-only logout while financial mutations are still queued. That
would leave user-owned offline data in an ambiguous state after the session is
gone and complicate account switching, recovery, and queue ownership.

Suggested user-facing message:

```text
Finish syncing before logging out.

You have unsynced changes on this device. Connect to the internet and sync
before logging out so your financial data is not lost.
```

## Phase 8: Migration Order

Implement in this order:

1. Add local DB/migrations and sync metadata tables.
2. Add local repositories for taxonomy only.
3. Add cloud sync columns and sync infrastructure tables.
4. Add backend `/sync/register-device`, `/sync/push`, and `/sync/pull`.
5. Add app `runSync()` and queue processing.
6. Replace current taxonomy fetches with local repository calls.
7. Prove one vertical slice: create/update/delete category offline, then sync.
8. Replace current offline-capable profile/privacy reads with local cached reads.
9. Add transaction/account local tables and repositories.
10. Prove the thesis-critical vertical slice: create transaction offline, update
   local balance immediately, sync later without duplication.
11. Expand to budgets, savings, debts, alerts, and cached model outputs.
12. As new fetch call sites appear, route offline-capable ones through local
    repositories immediately instead of adding direct fetches first.

## Minimum Test Plan

Test the smallest behavior that protects the sync system:

1. Local repository create writes SQLite and enqueues exactly one operation.
2. Local update records `changed_fields` and the current `base_version`.
3. Local delete creates a tombstone, not a hard delete.
4. `runSync()` does nothing without auth or network and does not delete queue
   rows.
5. `/sync/push` is idempotent for duplicate `operation_id`.
6. `/sync/push` rejects update-vs-missing-row.
7. Delete beats later edit.
8. Disjoint field edits both survive.
9. Same-field edits resolve deterministically and write `edit_history`.
10. `/sync/pull` applies tombstones locally.

## Open Decisions

- Confirm tombstone retention window. ADR proposes 90 days.
- Decide whether `device_id` remains the tiebreaker or backend sequence wins.
- Decide whether consent submission remains online-only during onboarding or gets
  a local pending state after account creation.
