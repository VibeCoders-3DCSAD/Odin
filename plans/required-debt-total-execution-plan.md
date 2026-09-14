# Required Debt Total Execution Plan

## Goal

Create a read-only, user-scoped Debt Manager calculation that gives Budgeting the total remaining debt payments required during an inclusive budget period. It will honor each Credit Card's saved repayment strategy, default a strategy-less active Card to Pay in Full, and count each active non-credit-card debt by payment frequency without applying Snowball or Avalanche surplus allocation yet.

## Source Of Truth

- Debt and payment data: `apps/app/local-db/repositories/debtAccounts.ts` and `apps/app/local-db/repositories/debtPayments.ts`.
- Credit Card statements, payments, and strategies: `apps/app/local-db/repositories/creditCardStatements.ts`, `apps/app/local-db/repositories/creditCardPayments.ts`, and `apps/app/local-db/repositories/creditCardRepaymentPlans.ts`.
- Existing payment-schedule behavior: `apps/app/features/debt-manager/debtForecast.ts`.
- Current Debt Manager allocation seam: `apps/app/features/debt-manager/debtRepaymentAllocation.ts`.
- Product benchmark: `docs/requirements-engineering/feature-modules.md`, sections 6.5 through 6.12, 7.1, 7.8, 7.9 through 7.10.1, and 7.26.
- Budget period and local-first contract: `apps/app/local-db/repositories/budgets.ts` and `docs/requirements-engineering/budgetting-implementation-details.md`.

## Non-Goals

- Do not persist a new debt-budget amount, mutate a budget, or change sync or database schema.
- Do not allocate a budget surplus with Snowball, Avalanche, or manual priority ordering in this slice.
- Do not create payment transactions, mark statements paid, or change a debt balance.
- Do not invent a statement when no authoritative statement exists; an active card without a saved repayment strategy defaults to the required Pay in Full strategy.
- Do not use `getCurrentBudgetDraft` as the calculation input because it is limited to current monthly drafts; Budgeting must supply its selected period directly.

## Execution Order

## PR Stacking Strategy

Keep the period calculation, debt-envelope sync correction, and Budgeting consumer in one vertical slice. The existing Snowball/Avalanche allocation work remains a follow-up branch because requirements place it after required payments.

```text
main
└─ feat/required-debt-total
   └─ feat/debt-surplus-allocation
      └─ feat/debt-manager-repayment-presentation
```

```bash
git switch -c feat/required-debt-total
```

## Linear Sub-Issue Tracking

No Linear issue was provided. Create sub-issues from this plan when ready.

### 1. Define The Period-Based Required-Payment Contract

- Touch `apps/app/features/debt-manager/requiredDebtTotal.ts` (new) and colocated tests. Export `getRequiredDebtTotal` as a pure function taking an inclusive `periodStart` and `periodEnd` ISO-date range plus already-loaded debts, statements, Credit Card strategies, and recorded Credit Card payments; a single `Date` is insufficient to determine which recurring payments belong in a budget.
- Return a centavo-safe total and per-obligation breakdown so Budgeting can explain the number: debt/account ID, kind, scheduled due date(s), configured target, recorded amount, and remaining required amount. Reject invalid or inverted ISO-date ranges rather than silently treating them as empty, and keep the result independent of Snowball, Avalanche, and priority state.

### 2. Calculate Credit Card Requirements From Saved Strategies

- Replace `apps/app/features/debt-manager/creditCardPaymentRequirement.ts` with the Card portion of `requiredDebtTotal.ts`, retaining its useful Pay in Full fallback and `statementPaymentTargetCentavos` reuse. Include only authoritative, non-deleted statements due in the requested period whose parent Card is active and user-owned; do not use the current as-of-date/latest-statement shortcut.
- For each applicable statement, calculate `max(0, strategyTarget - recordedStatementPayments)` and include that remaining amount. When an active Card has no saved strategy, apply the required Pay in Full fallback; do not apply Snowball or Avalanche to any Credit Card statement target.

### 3. Calculate Non-Credit-Card Requirements From Payment Frequency

- Touch `apps/app/features/debt-manager/requiredDebtTotal.ts` and reuse or extract the existing payment-period date advancement in `apps/app/features/debt-manager/debtForecast.ts` so weekly, biweekly, semi-monthly, monthly, and quarterly schedules cannot diverge between forecasting and budgeting. Exclude archived, deleted, paid-off, zero-balance, incomplete, and unsupported custom-frequency debts.
- Generate every scheduled due date in the inclusive budget range starting from the debt's configured due-date anchor; each occurrence requires `min(minimumPaymentCentavos, remainingBalanceCentavos)`, and the aggregate for one debt must never exceed its current balance. This slice counts scheduled obligations in the selected budget period only; handling arrears before the period is a later explicit product decision.

### 4. Complete The Debt-Envelope Local And Sync Contract

- Touch `apps/app/local-db/repositories/budgets.ts`, `apps/app/local-db/sync/pullConvergence.ts`, `apps/api/src/services/syncApplyOperation.ts`, and a new forward Supabase migration. Keep one canonical minor-unit field name across local persistence, queued payloads, API validation, remote storage, and pull convergence; validate it as a non-negative safe integer and include it in the total-allocation ceiling check.
- Extend the existing local migration/test coverage for `debt_budget_amount_minor` and repair the remote `debt_budget_amount_centavos` mapping explicitly. Run `supabase migration list --linked` and `supabase db push --dry-run`, but do not deploy a remote migration without explicit approval.

### 5. Add A User-Scoped Query Boundary And Initial Budgeting Consumer

- Touch `apps/app/features/debt-manager/requiredDebtTotalQueries.ts` (new) and `apps/app/features/budgeting/BudgetingScreen.tsx`. Add a thin query function that accepts `userId` and the selected date range, batch-loads required local records through existing user-scoped repositories, then passes plain data to the pure calculator; do not query in a per-debt loop.
- Display the calculated total while creating or editing a Budget. Keep the debt allocation user-editable, but show the required amount and a deficit when the entered debt allocation is lower; Budgeting owns this validation because the requirements define a deficit when required payments cannot be covered. Do not wire the calculator through `getCurrentBudgetDraft` or alter forecasts in this slice.

### 6. Test The Calculation And Consumer Boundary

- Add `apps/app/features/debt-manager/__tests__/requiredDebtTotal.test.ts`, Budget repository/sync tests, and new Budgeting screen coverage. Cover all Credit Card strategies, the Pay in Full default for a missing strategy, partial recorded payments, non-authoritative/deleted/out-of-period statements, and multiple statements for separate Cards.
- Cover weekly, biweekly, semi-monthly, monthly, and quarterly non-credit schedules; range boundaries; multiple occurrences; balance caps; inactive/paid-off debts; invalid dates; no double-counting; an entered debt allocation below requirements; sync round trips; and cross-device field-name mapping. Run `pnpm --filter app test -- --runInBand`, `pnpm --filter app exec tsc --noEmit`, `pnpm --filter api test`, and `pnpm test`.

## Acceptance Criteria

- Budgeting can request one deterministic required-debt total for a selected inclusive budget period without mutating any data.
- The total includes each applicable Credit Card statement's remaining strategy target, defaulting an active card without a saved strategy to Pay in Full.
- The total includes every scheduled non-credit-card payment in the period according to its configured frequency, never exceeding the current balance for a debt.
- The Budgeting form keeps debt allocation within the overall budget total and clearly identifies a debt-allocation deficit when required payments cannot be covered.
- All data access remains scoped by `userId`, uses existing repositories, and avoids per-debt database queries.
- Snowball, Avalanche, priorities, and surplus allocation have no effect on this required-total result.
- Debt allocation persists and pull-converges across devices with one canonical field mapping.
- Focused app and API tests, TypeScript checking, migration dry-run, and the root test command pass.
