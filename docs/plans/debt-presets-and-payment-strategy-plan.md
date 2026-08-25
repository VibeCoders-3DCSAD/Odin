# Debt Presets And Payment Strategy Plan

## Goal

Deliver an offline-first Debt Manager with volatile Filipino debt presets, flat debt records, linked expense transactions, payment statuses, principal-only forecasts, user-defined priority overrides, and global Snowball/Avalanche allocation using the debt amount configured inside the current monthly budget.

## Source Of Truth

- User requirements from this conversation:
  - Support ten Filipino debt presets: credit card, personal/salary loan, auto/vehicle loan, housing/mortgage loan, informal/family/friend loan, BNPL, online lending app, product/gadget/appliance installment, government member loan, and microfinance loan.
  - Support offline debt creation, payment, deletion, and forecasting.
  - Use a user-editable persisted debt budget field while the budgeting module is still provisional.
  - Add the debt budget field to the budget creation flow.
  - Use one global Snowball/Avalanche strategy over a flat list of debts.
  - Make every debt meet its required payment first; apply only surplus money to strategy or user priority overrides.
  - Record debt payments as linked expense transactions.
  - Use principal-only forecasts in the first offline slice.
  - Keep preset definitions volatile so adding or removing a preset cannot break existing debts or other presets.
  - Keep projection persistence and projection table usage changeable.
- Requirements: `docs/requirements-engineering/system-spec.md:458-465`
- Requirements: `docs/requirements-engineering/prd.md:160-178`
- Existing budgeting plan: `plans/vib-164-execution-plan.md`
- Existing ledger plan: `plans/vib-155-execution-plan.md`
- Remote schema: `supabase/migrations/20260616064145_priority_modules_v3.sql`
- Offline repositories: `apps/app/local-db/repositories/`
- Existing sync pipeline: `apps/app/local-db/sync/` and `apps/api/src/services/`

## Non-Goals

- No debt grouping or hierarchy in v1.
- No per-group strategies in v1.
- No hardship-plan management.
- No automatic bank or lender integrations.
- No exact lender-specific interest calculations.
- No automatic transaction editing or deletion for linked debt payments.
- No full budgeting-module redesign.
- No ML or server-generated forecasts.
- No database enum for debt preset types.
- No persisted projection runs or projection points in v1.

## Execution Order

1. Add the debt envelope to the existing budget model.
2. Add volatile debt schema, local storage, priorities, and sync support.
3. Add linked debt-payment expense transactions.
4. Add flat-list strategy, priority override, forecast, and status logic.
5. Build the Debt Manager UI and budget-page integration.
6. Verify budget, ledger, debt, priority, and sync behavior together.

## PR Stacking Strategy

Use one working branch and one grouped commit per phase. Review uncommitted changes after each phase before creating the next grouped commit. Do not create stacked branches or separate PRs for each phase.

```text
current branch
├─ Phase 1 commit: budget debt envelope
├─ Phase 2 commit: debt schema, repository, priorities, and sync
├─ Phase 3 commit: linked debt-payment transactions
├─ Phase 4 commit: strategy, priorities, forecast, and status logic
├─ Phase 5 commit: budget and debt UI
└─ Phase 6 commit: tests and integration verification
```

## Linear Sub-Issue Tracking

No Linear issue was provided. Create sub-issues later if needed; they should map to the six grouped phases above.

### 1. Add The Debt Envelope To Budgets

- Touch `supabase/migrations/<timestamp>_add_budget_debt_envelope.sql`, `apps/app/local-db/migrations/017_budget_debt_envelope.ts`, `apps/app/local-db/client.ts`, `apps/app/local-db/repositories/budgets.ts`, `apps/app/features/budgeting/BudgetingScreen.tsx`, and budget sync validation files.
- Add `debt_budget_amount_centavos` remotely and `debt_budget_amount_minor` locally with a default of zero.
- Count the debt envelope inside the budget total:

  `category allocations + debt budget <= total budget`

- Add `debtBudgetMinor` to `Budget`, `BudgetTracking`, and `CreateBudgetInput`.
- Show a `Debt payments` field on the budget create/edit form.
- Only enable the field for monthly budgets in v1. Non-monthly budgets must store zero and explain that debt planning currently requires a monthly budget.
- Keep the persisted field generic enough to support future weekly or custom-period integration; do not encode a permanent monthly-only database constraint.
- Update budget payload allowlists, remote RPC validation, pull normalization, and local mapping.
- Add `getCurrentBudgetDraft(userId, asOfDate)` using the latest monthly draft covering today:

  `period_start <= today AND period_end >= today ORDER BY updated_at DESC LIMIT 1`

- Do not add budget activation or overlap rules in this slice. The budgeting module will be reconciled later.
- Update budget tracking to expose debt budget amount and debt actual payments separately.

### 2. Add Volatile Debt Schema And Offline Repositories

- Touch `supabase/migrations/<timestamp>_add_debt_offline_support.sql`, `schema/erd-create-tables.sql`, `apps/app/local-db/migrations/018_debt_management.ts`, `apps/app/local-db/client.ts`, `apps/app/local-db/types.ts`, and add `apps/app/local-db/repositories/debts.ts` and `apps/app/features/debt-manager/presets.ts`.
- Extend `debt_accounts` with common fields: `preset_key`, payment frequency, next due date, maturity date, target payoff date, interest period, interest method, preset data, sync version, tombstone state, and sync timestamps.
- Keep `preset_key` as plain text. Do not use a Postgres enum, so adding or removing a preset does not require a schema migration.
- Store preset-specific fields in `preset_data` JSON.
- Add sync metadata to `debt_payments`, `user_debt_priorities`, and `debt_strategy_preferences`.
- Keep `debt_strategy_preferences` as one global strategy row per user. It stores the global Snowball/Avalanche selection, not a debt budget.
- Support `user_debt_priorities` as an ordered user override list. A priority is a debt the user wants to receive surplus before the global strategy; it is not a debt group and does not replace required payments for other debts.
- Implement `createDebt`, `updateDebt`, `listDebts`, `getDebt`, `deleteDebt`, `listDebtPayments`, `getDebtStrategy`, `updateDebtStrategy`, `listDebtPriorities`, and `setDebtPriorities`.
- Every local mutation must validate, write SQLite, enqueue sync, and return immediately inside one transaction.
- Deleting a debt creates a tombstone and requires explicit confirmation. Existing payment history must remain readable locally.
- Preset definitions must be independent. Removing one preset must leave existing rows readable through an unknown-preset fallback.
- Add the initial registry with these independent keys:

  `credit_card`, `personal_salary_loan`, `auto_loan`, `housing_loan`, `informal_loan`, `bnpl`, `online_lending_app`, `product_installment`, `government_member_loan`, and `microfinance_loan`.

- The API should validate preset keys as safe slugs and validate `preset_data` as an object without rejecting unknown future preset keys.
- Preset-specific validation must be isolated to the selected definition. A new or changed preset validator must not change common debt CRUD, payment logging, strategy calculation, or other preset behavior.

### 3. Add Linked Debt-Payment Transactions

- Touch `apps/app/local-db/repositories/ledger.ts`, `apps/app/local-db/repositories/debts.ts`, `apps/app/features/ledger/NewTransactionScreen.tsx`, `apps/app/components/MobileShell.tsx`, and debt sync validation.
- Reuse the existing `debt_payments.transaction_id` relationship instead of adding a duplicate debt reference column to `transactions`.
- Add a focused composite use case such as `createDebtPaymentExpense`.
- The composite operation must update atomically:

  `financial account balance`, `expense transaction`, `debt payment row`, `debt account balance`, and `sync queue rows`.

- The linked payment should use `source = 'transaction'`.
- Add `debtAccountId` context to `NewTransactionScreen`.
- The Debt Manager payment action opens the existing transaction form with the expense type fixed, the selected debt displayed, the debt-payment subcategory preselected, and the source financial account selected by the user.
- Use the seeded `obligatory_debt_payments` subcategory where available.
- Generic transaction update/delete must reject linked debt-payment transactions in v1 to prevent balance corruption.
- Keep the debt-specific payment path as the only supported edit path later.
- Ensure sync queues the transaction before the linked debt payment. Add deterministic queue ordering if necessary.
- Budget tracking must exclude linked debt-payment expenses from ordinary category actuals and count them against the debt envelope instead.

### 4. Add Flat Debt Logic And Priority Overrides

- Add pure calculations under `apps/app/features/debt-manager/debtLogic.ts`.
- The calculator receives one flat list of active debts and never groups by preset.
- The stable input contract must contain common debt values, the current debt budget context, global strategy, user priority overrides, and the calculation date. It must not receive UI components, SQLite rows, or preset-specific JSON.
- Calculate each required payment:

  `targetPayment = ceil(balance / monthsRemaining)`

  `frequencyAdjustedMinimum = normalized minimum payment`

  `requiredPayment = min(balance, max(targetPayment, frequencyAdjustedMinimum))`

- Calculate:

  `requiredTotal = sum(requiredPayment)`

  `surplus = max(debtBudget - requiredTotal, 0)`

  `shortfall = max(requiredTotal - debtBudget, 0)`

- Always allocate required payments first.
- If user priorities exist, order those debts by `priority_rank` and apply surplus to them first.
- After priority debts are satisfied, remaining surplus follows the global strategy.
- Snowball sorts remaining debts by lowest balance.
- Avalanche sorts remaining debts by highest annualized interest rate.
- Ties use target payoff date, then stable debt ID.
- User priorities do not reduce or remove required payments for non-prioritized debts.
- Extra money rolls to the next debt after the current target is paid off.
- When a shortfall exists, do not apply Snowball, Avalanche, or user priority surplus behavior. Return an explicit shortfall result and allocate available money by overdue state, earliest due date, earliest target date, then stable debt ID.
- Forecast using principal-only monthly simulation. Rates affect Avalanche ordering only in v1.
- Do not persist projection runs or projection points. Forecast output remains a replaceable local derived result and may later move to a different calculation or cache model.
- Payment status is derived, not stored:

  `Ahead`: payment exceeds the required amount.

  `On Schedule`: payment exactly meets the required amount or the due cycle has not closed.

  `Behind`: the due date or payment cycle has passed with an insufficient payment.

- A paid-off debt is always `Ahead`.
- The logic module must be independently replaceable. Changes to forecasting must not alter debt CRUD, payment transaction linking, preset validation, or budget persistence.

### 5. Build Budget And Debt UI

- Touch `apps/app/features/budgeting/BudgetingScreen.tsx`, `apps/app/features/budgeting/constant.ts`, `apps/app/features/debt-manager/`, and `apps/app/components/MobileShell.tsx`.
- Add the debt budget field to the existing budget form and show it separately from category allocations.
- Display the debt envelope in budget detail and include it in allocated/unallocated totals.
- Replace the `debt-manager` placeholder with `DebtManagerScreen`.
- Keep all debts in one flat list. Preset is a label and form selector only, never an algorithmic group.
- Add create, edit, delete, and linked payment actions.
- Add one global Snowball/Avalanche selector.
- Add a user-priority editing flow that orders individual debts above the global strategy.
- Read the latest monthly budget covering today through the budget repository.
- If no current monthly budget exists, show a clear setup message and treat the available debt budget as zero.
- Show required payments, debt budget, surplus, shortfall, payment statuses, and principal-only forecast.
- The UI must work without network access and trigger sync only after local success.
- Unknown or removed preset keys must render as `Unknown preset` with common debt fields still available.

### 6. Test Cross-Module Behavior

- Touch `apps/app/local-db/repositories/__tests__/budgets.test.ts`, add `apps/app/local-db/repositories/__tests__/debts.test.ts`, add debt logic tests, update ledger tests, budget tracking tests, API sync tests, and add a Maestro debt flow.
- Budget tests must cover debt envelope mapping, debt amount plus category allocations exceeding total, latest monthly budget covering today, non-monthly budgets storing zero, and debt actuals excluded from category actuals.
- Debt tests must cover all ten initial presets, unknown preset fallback, adding/removing a preset definition without affecting stored rows, local CRUD and tombstones, ownership validation, and payment balance updates.
- Priority tests must cover rank ordering, partial priority lists, priority debt payoff, and fallback to Snowball/Avalanche after priorities are satisfied.
- Transaction tests must cover linked expense creation, account balance update, debt balance update, transaction/payment queue operations, and rejection of generic edits/deletes for linked debt payments.
- Strategy tests must cover required payments before surplus, Snowball, Avalanche, user priority overrides, surplus rollover, shortfall behavior, and Ahead/On Schedule/Behind.
- Sync tests must cover linked transaction ordering, payment ownership, duplicate operations, stale versions, tombstones, unknown preset keys, and priority-row convergence.
- Verify with:

  `pnpm --filter app test`

  `pnpm --filter app exec tsc --noEmit`

  `pnpm --filter api test`

  `pnpm --filter api build`

## Open Items

- The budgeting module currently permits draft behavior and will be reconciled later. This slice uses the latest monthly draft covering today without adding activation or overlap enforcement.
- The debt budget field is monthly-only in v1, but its storage and calculation input must remain extensible for future weekly or custom-period support.
- Principal-only forecasting is explicitly accepted for v1 and must be labeled as an estimate.
- Strategy is global and flat; user priorities are ordered individual-debt overrides, not groups.
- Preset definitions are intentionally volatile and must not be represented as database enums or foreign keys.
- Generic edits/deletes of linked debt-payment transactions are deferred to avoid inconsistent balances.
- Projection persistence is intentionally deferred and may change without affecting CRUD, payments, presets, priorities, or strategy selection.
- A change in one business-logic area must not change the contracts of other debt areas. Keep preset validation, repository CRUD, transaction linking, priority ordering, strategy selection, status calculation, and forecasting behind separate seams and tests.

## Acceptance Criteria

- The budget create page accepts and persists a debt-payment budget.
- Debt budget counts inside the total budget.
- Non-monthly budgets persist zero for the debt budget and explain the current monthly-only limitation.
- Debt Manager uses the latest monthly budget covering today.
- Debts remain a flat list with one global strategy.
- User-defined debt priorities can override where surplus is applied before Snowball/Avalanche.
- Adding or removing a preset does not break existing debt records or other preset definitions.
- Users can create, edit, view, and delete debts offline.
- Users can create a linked expense transaction for a specific debt.
- Linked payments update both financial-account and debt balances immediately.
- Linked debt payments do not double-count ordinary category spending.
- Snowball and Avalanche apply only after all required payments and user-priority overrides.
- Shortfalls are explicitly reported and use urgency allocation instead of silently applying a strategy.
- Payment statuses are derived correctly.
- Principal-only forecasts work offline and remain replaceable.
- Projection runs and projection points are not required for the feature to work.
- Local changes enqueue sync operations and converge after reconnecting.
- Debt logic changes do not alter CRUD, preset validation, linked transactions, priorities, or budget persistence behavior.
- Budget, ledger, debt, priority, and sync tests pass.
