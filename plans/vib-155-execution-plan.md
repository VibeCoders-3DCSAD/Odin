# VIB-155 Execution Plan

## Goal

Deliver the Phase 2c offline-first ledger slice: users can create income, expense, and transfer transactions from local SQLite, see account balances and history update immediately, then sync those domain operations to Supabase without duplicates or cross-user related-record leaks.

## Source Of Truth

- Linear: https://linear.app/vibe-coders-odin/issue/VIB-155/phase-2c-ledger-and-transactions-offline-first
- Offline-first plan: `plans/odin-api-backend-implementation-plan.md`
- Remote schema: `supabase/migrations/20260616064145_priority_modules_v3.sql`
- Existing sync infra: `supabase/migrations/20260709000000_add_sync_infrastructure.sql`, `supabase/migrations/20260712000000_add_apply_sync_operation_rpc.sql`
- App design: `docs/designs/design_v1.html`, `docs/designs/components_v1.html`
- Required transaction snippets: expense entry, transfer entry, saved toast, validation/offline state, empty form header
- Standards: `AGENTS.md`, `docs/standards/REPOSITORY-STANDARDS.md`

## Non-Goals

- Do not rebuild route-by-route transaction APIs or add request replay.
- Do not add a generic arbitrary-table sync RPC.
- Do not count transfers in income or expense totals.
- Do not implement budget, savings, debt, anomaly, forecast, report, or retention features beyond FK-safe transaction links.
- Do not add a conflict review UI; keep automatic delete-wins and per-field last-write-wins.
- Do not add new dependencies unless the existing app stack cannot cover the screen.

## Execution Order

Build the ledger in dependency order: schema first, local domain behavior second, backend sync third, UI fourth, history/edit/delete fifth, templates/recurring last.

## PR Stacking Strategy

Use `feat/*` branch names and keep each PR below 200-ish changed lines where possible.

```text
main
  -> feat/vib-155-ledger-transactions-offline-first
       -> feat/vib-155-sync-schema-accounts-ledger
       -> feat/vib-155-ledger-repository
       -> feat/vib-155-ledger-sync-backend
       -> feat/vib-155-new-transaction-ui
       -> feat/vib-155-history-edit-delete
       -> feat/vib-155-templates-recurring
```

Merge order is bottom-up into the parent VIB-155 branch, then parent into `main`. With vanilla git: create each stack branch from the branch above it, open PRs against the immediate parent, and restack after each merge.

## Linear Sub-Issue Tracking

- VIB-229: Sync schema and local ledger tables.
- VIB-227: Ledger repository and balance effects.
- VIB-230: Backend push/pull sync for ledger entities.
- VIB-228: New Transaction UI from the required snippets.
- VIB-225: Transaction history, filtering, edit, and delete.
- VIB-226: Transaction templates, drafts, and recurring records.

### 1. Sync Schema And Local Ledger Tables

- Touch `supabase/migrations/<next>_add_ledger_sync_columns.sql`, `apps/app/local-db/migrations/006_financial_accounts.ts`, `apps/app/local-db/migrations/007_ledger_tables.ts`, and `apps/app/local-db/client.ts`.
- Add remote sync columns/indexes for `financial_accounts`, `transactions`, `transaction_line_items`, `transaction_templates`, `transaction_drafts`, `recurring_transaction_templates`, and `recurring_transaction_occurrences`; local tables mirror only fields the app reads, edits, syncs, or filters.
- Keep tombstone shape consistent: remote `deleted/version/updated_at`, local `deleted/version/last_synced_at`; map remote `status = 'deleted'` to local tombstones without hard deletes.

### 2. Ledger Repository And Balance Effects

- Touch `apps/app/local-db/repositories/financialAccounts.ts`, `apps/app/local-db/repositories/ledger.ts`, and small shared local helpers only if duplicated validation appears.
- Expose user actions: `createIncome`, `createExpense`, `createTransfer`, `updateTransaction`, `deleteTransaction`, `listTransactions`, and bounded account/category selector reads.
- Each mutation runs one SQLite transaction: validate shape, verify local `user_id` ownership/FK accessibility, write rows, update affected account balances, enqueue domain operations with `changed_fields` and `base_version`, then return local data immediately.

### 3. Backend Sync For Ledger Entities

- Touch `apps/api/src/services/syncService.ts`, `apps/api/src/services/syncApplyOperation.ts`, `supabase/migrations/<next>_extend_apply_sync_operation_for_ledger.sql`, and API sync tests under `apps/api/src/__tests__/`.
- Add explicit entity/table allowlists for accounts and ledger rows, with server-side validation for transaction type shape, source/destination account ownership, accessible subcategories, line-item totals, transfer invariants, and delete/update against missing or deleted records.
- Extend pull convergence in `apps/app/local-db/sync/runSync.ts` with allowed local columns and SQLite-safe boolean/JSON normalization for all new pulled tables.

### 4. New Transaction UI

- Touch `apps/app/features/ledger/NewTransactionScreen.tsx`, `apps/app/features/ledger/components/*`, `apps/app/features/ledger/hooks/*`, and `apps/app/components/MobileShell.tsx`.
- Implement the required expense and transfer designs: segmented type control, PHP amount entry with quick chips, description/date/account fields, category chips, Filipino-context chips, recurring toggle, offline banner, validation errors, save button, save-and-add-another, and saved toast.
- UI reads from local repositories and writes locally first; opportunistic `runSync(userId, deviceId, accessToken)` may fire after save but must not block navigation or success UI.

### 5. Transaction History, Filtering, Edit, And Delete

- Touch `apps/app/features/ledger/TransactionHistoryScreen.tsx`, `apps/app/features/ledger/EditTransactionScreen.tsx`, `apps/app/features/ledger/components/*`, and `apps/app/local-db/repositories/ledger.ts`.
- Add local date filtering, type filtering, search over merchant/counterparty/notes/line item labels, whitelisted sort options, edit flow, and explicit delete confirmation.
- Edits reverse old balance effects then apply new effects in the same transaction; deletes tombstone the transaction and reverse balances, never hard-delete synced rows.

### 6. Templates, Drafts, And Recurring Records

- Touch `apps/app/local-db/migrations/007_ledger_tables.ts`, `apps/app/local-db/repositories/ledgerTemplates.ts`, `apps/app/local-db/repositories/recurringTransactions.ts`, backend sync allowlists/RPC, and lightweight UI entry points only where needed.
- Implement reusable transaction templates, offline drafts for failed/incomplete local capture, recurring template CRUD, and recurring occurrence scheduling/posting state.
- Keep generated recurring transactions as normal ledger transactions with `entry_source = 'recurring'` so history, balances, and sync use the same path.

## Acceptance Criteria

- User can create income, expense, and transfer transactions while offline.
- Local account balances update immediately and correctly for income, expense, transfer, edit, and tombstone delete.
- Transfers are excluded from income and expense totals.
- Transaction rows, line items, templates, drafts, recurring templates, and occurrences are user-scoped locally and remotely.
- Sync push applies queued ledger operations idempotently and rejects invalid related IDs before remote persistence.
- Pull convergence applies newer remote versions, ignores stale versions, and applies tombstones locally.
- History supports local date filtering, search, whitelisted sorting, edits, and confirmed deletes.
- Required New Transaction visual states match the supplied snippets at 320 to 450 dp without horizontal scrolling.
- Offline save shows immediate success plus pending/offline state; sync failure never loses local data.
- Verification passes: `pnpm --filter api build`, `pnpm --filter api test`, `pnpm -r test`, and manual Expo offline/reconnect smoke checks for create -> sync -> fresh local pull.
