# Credit-Card Payment Available-Credit Plan

## Goal

Restore a credit card's available credit when a statement payment is recorded,
while keeping the card's configured credit limit unchanged. The local SQLite
state and the authoritative Supabase sync path must make the same adjustment
atomically and remain correct when a payment is edited or deleted.

## Source Of Truth

- User-reported behavior: recording a credit-card payment does not replenish available credit.
- `apps/app/local-db/repositories/creditCardPayments.ts`
- `supabase/migrations/20260915000000_allow_credit_card_over_limit_purchases.sql`
- `supabase/migrations/20260924000002_credit_card_statement_payments.sql`

## Non-Goals

- Do not change `credit_limit_centavos`; it is the configured card limit.
- Do not alter debt-account payment behavior.
- Do not introduce issuer-recognition as a prerequisite for locally recorded payments.
- Do not deploy a Supabase migration without explicit approval.

## Execution Order

## PR Stacking Strategy

`main -> fix/credit-card-payment-available-credit`

Use one small branch and PR because the local and remote changes form one
atomic sync contract. Target `main`; no stacked sub-PRs are needed.

## Linear Sub-Issue Tracking

No Linear issue was supplied. Create sub-issues from this plan when ready.

### 1. Restore Local Available Credit

- Touch `apps/app/local-db/repositories/creditCardPayments.ts`.
- On payment creation, add the payment amount to `available_credit_centavos`, capped at `credit_limit_centavos`; on edit, apply the old-minus-new delta; on delete, subtract the removed payment amount.
- Keep each adjustment within the existing SQLite transaction containing the payment and its linked ledger transaction so local state cannot partially apply.

### 2. Restore Synced Available Credit

- Add one forward migration under `supabase/migrations/` that wraps the current `apply_credit_card_sync_operation` implementation.
- For an applied `credit_card_payments` create, update, or delete, resolve the card from the owned cycle and apply the same amount delta to `credit_card_details.available_credit_centavos`; cap only the upper bound at `credit_limit_centavos`.
- Apply the adjustment only after the delegated versioned operation reports `applied`, so duplicate replay, conflicts, rejection, and ownership failures cannot change available credit.
- Do not change the API sync allowlist: `credit_card_payments` is already accepted, routed to the credit-card RPC, and included in user-scoped pulls. Keep `available_credit_centavos` out of payment payloads, because it is a server-derived value.
- This is not an automatic payment-table trigger today. Set `odin.credit_card_invariant_path` within the RPC before updating `credit_card_details`, so the derived-write guard permits the paired update in the same database transaction.

### 3. Lock Down The Regression

- Touch `apps/app/local-db/repositories/__tests__/creditCardPayments.test.ts` and add focused repository tests for payment creation, amendment, and deletion.
- Assert the exact available-credit update direction and parameters, including the configured-limit cap, alongside the existing transaction and queued-operation behavior.
- Run `pnpm --filter app test -- creditCardPayments.test.ts`, then run `pnpm exec supabase migration list --linked` and `pnpm exec supabase db push --dry-run`; do not deploy.

## Acceptance Criteria

- Recording a PHP 1,000 statement payment increases local and synced available credit by PHP 1,000 without changing the configured limit.
- Editing a payment adjusts available credit by the payment delta.
- Deleting a payment reverses its available-credit restoration.
- Available credit never exceeds the configured credit limit.
- Sync retries, conflicts, rejected operations, and duplicate operation IDs do not apply the adjustment twice.
- Focused local tests pass and the new migration passes dry-run validation.
