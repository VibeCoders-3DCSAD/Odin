# Debt Repayment Planning And Early Settlement Execution Plan

## Goal

Implement the next Debt Management slice: a user-selected Snowball or Avalanche repayment plan that derives payment-history progress and interest-aware payoff forecasts for active non-credit-card debts, includes required Credit Card statement targets in the debt budget, and supports issuer-recognized Credit Card installment early settlement.

## Source Of Truth

- Product requirements: `docs/requirements-engineering/feature-modules.md`, sections 7.1, 7.5, 7.7 through 7.8, 7.10.1, 7.16, 7.22, 7.26, and 12.9 through 12.15.
- Existing non-credit-card debt persistence: `apps/app/local-db/repositories/debtAccounts.ts`, `apps/app/local-db/repositories/debtPayments.ts`, and `apps/app/features/debt-manager/debtForecast.ts`.
- Existing Credit Card persistence: `apps/app/local-db/repositories/creditCardInstallments.ts`, `apps/app/local-db/repositories/creditCardStatements.ts`, and `apps/app/local-db/repositories/creditCardPayments.ts`.
- Existing strategy and settlement tables: `apps/app/local-db/migrations/019_debt_management.ts` and `apps/app/local-db/migrations/024_credit_cards.ts`.
- Sync boundaries: `apps/app/local-db/types.ts`, `apps/app/local-db/sync/queueOrder.ts`, `apps/app/local-db/sync/pullConvergence.ts`, `apps/api/src/services/syncApplyOperation.ts`, `apps/api/src/services/syncService.ts`, and `supabase/migrations/`.

## Non-Goals

- No bank integration, statement import, or automatic issuer reconciliation.
- No changes to the transaction-first non-credit-card debt-payment workflow defined in sections 7.12 and 12.9.
- No separate repayment engine for loan presets; all active non-credit-card debts use the Common Loan Model.
- No automatic installment completion or alteration from a Credit Card statement payment; only an explicit issuer-recognized early settlement can complete an installment.

## Execution Order

## PR Stacking Strategy

Deliver this as a short stack so repayment calculations and sync invariants are reviewed before UI wiring.

```text
main
└─ feat/debt-repayment-domain
   └─ feat/debt-repayment-planning
      └─ feat/credit-card-early-settlement
```

```bash
git switch -c feat/debt-repayment-domain
```

## Linear Sub-Issue Tracking

No Linear issue was provided. Create sub-issues from this plan when ready.

### 1. Define Repayment Inputs And Derived Calculation Seams

- Touch `apps/app/local-db/repositories/debtAccounts.ts`, `apps/app/local-db/repositories/debtPayments.ts`, `apps/app/features/debt-manager/debtForecast.ts`, and new focused calculation tests beside their callers. Replace `deriveDebtProgress` with a pure, history-aware calculation that compares payments due through today against active payment history and returns Ahead, On Schedule, Behind, or Finished independently from debt record status.
- Extend the forecast calculation to model supported payment intervals, configured interest method/rate/period, payment amount, next payment date, and target payoff date; return Not in Schedule whenever a required supported input is absent rather than inventing a date. Keep calculations centavo-safe and deterministic with an injected as-of date in tests.

### 2. Persist And Sync Global Repayment Preferences

- Touch `apps/app/local-db/repositories/debtRepaymentPlans.ts` (new), `apps/app/local-db/migrations/` for any missing local constraints, `apps/app/local-db/types.ts`, `apps/app/local-db/sync/queueOrder.ts`, and `apps/app/local-db/sync/pullConvergence.ts`. Build a user-scoped repository over `debt_strategy_preferences` and `user_debt_priorities`, validating only Snowball/Avalanche and active user-owned non-credit-card debt IDs.
- Touch `apps/api/src/services/syncApplyOperation.ts`, `apps/api/src/services/syncService.ts`, focused API tests, and forward Supabase migrations. Add both entities to every allowlist, RPC route, ownership check, idempotency rule, and pull table; do not rely on dormant local tables or accept client-provided user IDs.

### 3. Calculate And Display The Debt Budget And Repayment Plan

- Touch `apps/app/features/debt-manager/DebtManagerOverview.tsx`, `apps/app/features/debt-manager/NonCreditDebtCard.tsx`, new debt-manager presentation components, and a focused debt-budget helper. Calculate total payment requirements from the active authoritative Credit Card statement target plus each active non-credit-card required payment, then derive debt-envelope surplus or shortfall from the current budget allocation.
- Apply Snowball only after required payments by lowest remaining balance, and Avalanche only after required payments by highest applicable interest rate; Credit Card statement targets remain independent. Show each debt's repayment forecast and payment-history progress separately, show the selected global strategy, and use the exact required debt states/messages without blocking unrelated cards when one action saves.

### 4. Add Per-Statement Credit Card Repayment Targets

- Touch `apps/app/local-db/repositories/creditCardStatements.ts` or a narrowly scoped repayment-target repository, the next local migration, `apps/app/features/debt-manager/CreditCardCollections.tsx`, and focused tests. Persist one repayment strategy per active authoritative statement, deriving Pay in Full from the balance, Pay Minimum from the minimum due, and validating Custom Payment as at least the minimum and less than the statement balance.
- Sync repayment-target data through the full local/API/Supabase contract, including user ownership and statement lifecycle guards. The debt-budget helper reads these selected targets, surfaces finance-charge warnings for Pay Minimum and Custom Payment, and blocks due-date planning until every active statement has a strategy.

### 5. Implement Credit Card Installment Early Settlement

- Touch `apps/app/local-db/repositories/creditCardInstallments.ts`, a dedicated `creditCardSettlements.ts` repository, local migration(s), `apps/app/features/debt-manager/CreditCardCollections.tsx`, and a focused settlement form component. Record installment, settlement date, remaining principal, settlement amount, optional pre-termination fee, and requested status; validate user ownership and keep the installment active until explicit issuer recognition.
- Add the settlement entity and recognition transition to local queueing, API validation, remote RPC allowlists/handlers, and pull convergence with forward Supabase migrations. On recognized settlement, atomically mark only the selected installment completed and preserve its history; statement payments and overpayments must never use this path implicitly.

### 6. Verify Calculations, Lifecycle Rules, And Sync

- Add calculation tests covering ahead/on-schedule/behind/finished progress, interest methods, supported frequencies, target-payoff edge cases, Snowball/Avalanche ordering, shortfall/surplus, and independently selected Credit Card statement targets. Add repository/UI/API tests for cross-user IDs, inactive/archived debts, invalid custom payment amounts, stale statements, duplicate priorities, settlement request versus recognition, and transaction-payment regressions.
- Run `pnpm --filter app test -- --runInBand`, `pnpm --filter api test`, `pnpm --filter api build`, `pnpm --filter app exec tsc --noEmit`, and `pnpm test`. Before deployment, run `supabase migration list --linked` and `supabase db push --dry-run`; do not deploy a remote migration without explicit user approval, and run a Maestro debt-manager smoke flow when an emulator or device is available.

## Acceptance Criteria

- Debt payment progress is based on payment history versus expected schedule and can report Ahead, On Schedule, Behind, or Finished independently of active, archived, deleted, and paid-off status.
- The payoff forecast accounts for supported interest configuration, payment schedule, current balance, and target payoff date, and safely reports Not in Schedule for incomplete or unsupported schedules.
- Users can select and persist one global Snowball or Avalanche strategy, manage active-debt priorities, and view a debt budget with requirements, surplus, and shortfall.
- Required Credit Card statement targets are selected independently and included before non-credit-card strategy surplus allocation.
- An early-settlement request retains the installment as active until issuer recognition; recognition completes only that installment and preserves its historical record.
- New sync entities and mutations are user-scoped, validated locally and remotely, queue in dependency order, pull-converge correctly, and have forward Supabase migrations.
- Focused repository, UI, API, migration, TypeScript, and root tests pass; remote migration deployment remains explicitly unperformed.
