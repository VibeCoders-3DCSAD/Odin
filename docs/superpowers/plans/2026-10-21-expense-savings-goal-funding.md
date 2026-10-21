# Expense Savings Goal Funding Implementation Plan

**Goal:** Ordinary expenses use the linked account's shared unallocated money before requiring explicit withdrawals from one or more goals.

**Architecture:** Query account funding and goal balances together, excluding the expense being edited. Persist selected withdrawals as transaction-owned activities atomically, including on the sync server. Keep contribution transfers on their existing path.

**Tech Stack:** Expo, TypeScript, SQLite, Express sync validation, PostgreSQL, Jest.

## Global Constraints

- Scope all data reads and writes to authenticated user_id.
- Use integer centavos, validate the exact withdrawal total and each goal's available amount.
- Preserve existing working tree changes; install no dependencies.
- Do not reset local data or operate the connected phone.

## Tasks

- [x] Add funding query and validation in `apps/app/local-db/repositories/savingsExpenseFunding.ts`; cover two goals, unallocated spending, splits, stale/foreign goals, and edit exclusions with real SQLite tests.
- [x] Add migration 086 to allow one live activity per transaction and goal. Register it in `local-db/client.ts`.
- [x] Integrate expense creation and updates in `ledger.ts`; replace transaction-owned withdrawals on edit and restore all on deletion, without enqueueing independent expense activity operations.
- [x] Add `SavingsExpenseFundingSheet.tsx` to load funding, collect exact splits, and confirm them before saving in `NewTransactionScreen.tsx`.
- [x] Validate the bounded split payload in API sync; add a PostgreSQL dispatcher wrapper that locks account/goals, checks funding and ownership, and applies transaction plus activities atomically. Replays must be idempotent.
- [x] Replay migrations on an isolated clean database, run focused Jest and TypeScript checks, document behavior in savings requirements, update graphify.

## Verification

- 61 focused app tests pass, including real SQLite transaction rollback and activity convergence.
- 216 API sync tests pass; API TypeScript check passes.
- Full PostgreSQL migration sequence replays on an isolated clean Supabase Postgres container. Expense funding, account linking, and uncategorized repayment SQL tests pass.
- Local database dry run lists existing pending migrations 08 and 09 plus funding migration 10. No changes were applied to the developer database.
- App TypeScript checking retains unrelated errors in forecast payloads, financial plan presentation, savings envelope queries, and existing tests. The existing taxonomy pull test also fails independently of the savings activity path.
- Automatic posting and manual bill payment paths were included after sweeping direct expense writers.
