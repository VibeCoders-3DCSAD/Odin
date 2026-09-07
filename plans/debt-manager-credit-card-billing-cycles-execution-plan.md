# Debt Manager Credit Card Billing Cycles Execution Plan

## Goal

Add the first Debt Manager screen and make it display credit cards already stored as financial accounts, including each card's current billing cycle with a start date, cutoff date, and statement date. Keep the implementation local-first and compatible with the existing sync model without adding credit-card purchase, statement, payment, installment, or repayment-strategy workflows.

## Source Of Truth

- Product source of truth: `docs/requirements-engineering/feature-modules.md`, sections 4.2 and 7.
- Existing screens, repositories, migrations, and sync code are implementation context only; they must be changed when they disagree with the requirements document.
- The implementation must not invent user-facing fields, states, calculations, or messages outside the source-of-truth document.

## Non-Goals

- No credit-card transactions or transaction-triggered routing from the transaction form.
- No bank statement recording, payments, minimum-due calculations, finance charges, credit balances, installments, settlements, or repayment strategies.
- No generic debt-record redesign or changes to non-credit-card debt behavior.
- No new API endpoint or dependency; the screen reads and writes through the existing local SQLite and sync queue patterns.

## Execution Order

## PR Stacking Strategy

Work directly on `main`. Do not create a feature branch, stacked branch, pull request, or git worktree for this work.

```text
main
├─ local cycle model and repository
├─ Debt Manager screen
├─ navigation and transaction safety boundary
└─ verification
```

Suggested workflow:

```bash
# remain on main
# implement the local cycle seam
# add the Debt Manager screen
# wire navigation and run focused tests
```

## Linear Sub-Issue Tracking

No Linear issue was provided. Create sub-issues from this plan when ready; keep them grouped under the parent feature if one exists.

### 1. Define And Persist The Billing-Cycle Seam

- Touch `apps/app/local-db/types.ts`, `apps/app/local-db/repositories/` (add a focused `creditCardCycles.ts`), and add the next local migration only if the existing `credit_card_cycles` table needs an invariant or index adjustment; register it in `apps/app/local-db/client.ts`.
- Reuse the section 4.2 credit-card account fields as defaults, while treating each billing-cycle record required by section 7.4 as a historical snapshot containing `cycle_start_date`, `cutoff_date`, and `statement_date`.
- Add user-scoped list/read and current-cycle creation/maintenance helpers. Enqueue only the existing `credit_card_cycles` sync entity, transactionally, if the local cycle is materialized.
- Validate ISO dates, require `start <= cutoff`, and require the statement date to be on or after the cutoff for that cycle; equal dates are valid only for an explicitly same-day issuer rule. Preserve old cycle rows when card defaults change.

### 2. Make Billing-Cycle Date Rules Explicit

- Keep date arithmetic in the cycle repository or a small feature-local date helper, not in JSX.
- Calculate a cycle from the effective recurring cutoff day: the cycle starts on the day after the previous effective cutoff and ends on the current effective cutoff. Clamp recurring day values to the last day of short months, as required by section 4.2.
- Place the statement on the first effective statement day after the cutoff; if the configured statement day is not after the cutoff in that month, roll it into the following month and clamp it there. Treat `billing_cycle_days` as an issuer-provided validity/configuration value, not as a replacement for the actual calendar dates.
- If an issuer uses one date for both events, store the same effective date for cutoff and statement only when that is explicitly configured; do not silently infer a different issuer rule.
- Cover month boundaries, February, day 31, cutoff/statement ordering, and current-cycle selection with pure unit tests before wiring the screen.

### 3. Build The Debt Manager Display

- Add `apps/app/features/debt-manager/DebtManagerScreen.tsx` and any small colocated presentational component needed for a card/cycle row.
- Load active `credit_card` financial accounts and their current/prior cycle rows through the repository; show issuer/card name, credit limit, available credit when supplied, cutoff date, cycle start date, and statement date.
- Implement the requirements states that apply to this pass: loading, no-credit-card list, card-with-no-cycle, loaded, stale/error-safe recovery, and success after a cycle is materialized. Use the exact section 7 messages where they apply, especially the empty card/cycle and stale-data notices.
- Do not render transaction, statement, payment, installment, or repayment controls yet. Make the read-only boundary obvious in the UI rather than showing disabled fake actions.

### 4. Protect The Out-Of-Scope Transaction Boundary

- Inspect the existing transaction form and ledger repository for credit-card source accounts. Because section 7.4 requires every credit-card transaction to belong to a billing cycle, do not leave a path that silently creates an ordinary unlinked credit-card expense.
- For this pass, either block credit-card expense creation until the section 7.5 transaction flow exists, or add the exact blocked state and message to `feature-modules.md` before implementation; never invent copy in code.
- Do not implement transaction-to-cycle routing in this pass. The later transaction slice must use posting date first, transaction date only as an estimate, and save the transaction/cycle relationship atomically.

### 5. Wire Navigation And Verify The Vertical Slice

- Touch `apps/app/components/MobileShell.tsx` to add a `debt-manager` page, drawer item, page metadata, and render branch; leave existing financial-account navigation unchanged.
- Add focused repository/date tests under `apps/app/local-db/repositories/__tests__/` and `apps/app/features/debt-manager/__tests__/DebtManagerScreen.test.tsx` using the existing Jest and React Native Testing Library conventions. If the transaction safety boundary is implemented, test that a credit-card expense cannot be saved without a cycle.
- Verify the offline-first path: existing credit card account -> Debt Manager -> current cycle with all three dates -> refresh/reopen without losing the historical cycle.
- Run `pnpm --filter app test` and the relevant TypeScript check/build command used by the app before considering the work complete. Add a Maestro smoke flow only after an installed APK/emulator path is available; do not block the implementation plan on cloud-only UI testing.

## Acceptance Criteria

- Debt Manager is reachable from the app drawer.
- Every active credit-card financial account appears separately from generic non-credit-card debt records.
- Each displayed billing cycle includes `cycle_start_date`, `cutoff_date`, and `statement_date`.
- Current-cycle dates are derived from the card's recurring cutoff/statement defaults with short-month clamping and correct month rollover.
- Existing cycles remain historical when card defaults are edited.
- Empty card, empty cycle, loading, and safe error states are visible and use requirements-aligned copy.
- No credit-card expense can be silently saved without the billing-cycle relationship required by section 7.4; full transaction routing remains deferred.
- No credit-card transaction routing, statement, payment, installment, or repayment-strategy workflow is implemented; only the safety guard against silently unlinked card expenses is allowed.
- Local data remains user-scoped, transactional, and compatible with the existing sync queue.
- Focused tests pass, followed by `pnpm --filter app test`.
