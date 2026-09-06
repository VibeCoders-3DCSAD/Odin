# Credit Cards as Financial Accounts Implementation Plan

## Goal

Establish credit cards as real financial accounts at the data and UX foundation. A credit-card account is a `financial_accounts` row with `kind = 'credit_card'` plus a matching `credit_card_details` row, created, read, updated, and deleted as one transactional unit. The account form follows section 4.2 (opening balance, institution name, opening date, credit limit, billing cycle, cut-off day, statement day, alert threshold); credit-limit and card specifics live only in `credit_card_details`, and the financial-account page reads details when the account is a credit card. Validation follows 4.6 (with the cut-off/statement day deviation below).

## Source Of Truth

- `docs/requirements-engineering/feature-modules.md` — section 4.2 (Account Form, incl. Credit Card fields), 4.3 (placeholders), 4.6 (validation), and 7.2 (Credit Cards are persistent financial accounts, not debt records).
- Decision log: account form follows 4.2 over 7.3; `financial_accounts.credit_limit_centavos` is removed (details is the single source); no dashboard-inclusion special-casing (KPI researchers decided).
- Remote schema `supabase/migrations/20260902000002_credit_card_vertical_slice.sql` (live) — `credit_card_details` table + RLS + `apply_credit_card_sync_operation` RPC.
- Local schema `apps/app/local-db/migrations/011_financial_accounts.ts` and `024_credit_cards.ts` (live, registered in `client.ts:71-81`).
- Commit history for the deleted repos (removed by `02d0d82`) only as reference; this milestone re-implements deliberately, not by restore.

## Non-Goals

- Credit-card billing cycles, statements, transactions, installments, payments, credit applications, settlements, and repayment strategies (7.4-7.8).
- The Debt Manager credit-card surface (7.3 / 7.3.1 / 7.3.2 field set, "available credit" field, notes) — the account form uses 4.2 instead; 7.3 applies to the later Debt Manager detail view.
- Non-credit-card debt, Debt Manager UI, repayment projections, hardships (7.9-7.26).
- Sync of `credit_card_details` to/from Supabase.
- `loan` account kind, budget debt envelope, dashboard credit-card surfaces.

## Execution Order

## PR Stacking Strategy

```
main → feat/cc-as-accounts-repo → feat/cc-as-accounts-ui
```

- Each PR targets the one below it; merge bottom-up. The schema PR is the foundation and the only mandatory one.
- Third PR (`feat/cc-as-accounts-sync`) is deferred; branch it off `feat/cc-as-accounts-ui` when started so it inherits the final domain shape.

## Linear Sub-Issue Tracking

No Linear context provided; create sub-issues from this plan when ready. Branch names above are already aligned with the repo's `feat/<slug>` convention.

### 1. Schema

**Files:**
- Add: `apps/app/local-db/migrations/032_drop_account_credit_limit.ts` (register in `client.ts`)
- Add: `supabase/migrations/20260907000000_credit_card_account_fields.sql`
- Modify: the two remote sync RPCs that read/write `financial_accounts.credit_limit_centavos` (`20260716000001_extend_apply_sync_operation.sql`, `20260717015111_add_income_sources_and_obligations_to_sync_allowlist.sql`) — the replacement migration rewrites them without the column.

**Change:**
- Drop `credit_limit_centavos` from `financial_accounts` (local + remote). Sweep every consumer before dropping; only these sync RPCs reference it.
- Add to `credit_card_details`: `billing_cycle_days integer` (`CHECK` 28-31) and `alert_threshold_percent integer` (`CHECK` 0-100), local + remote, keeping `4.6` validation at the schema boundary too.

### 2. Domain Types and Local Repository

**Files:**
- Modify: `apps/app/local-db/repositories/financialFoundations.ts`, `apps/app/local-db/repositories/financialAccounts.ts`
- Add: `apps/app/local-db/repositories/__tests__/creditCardAccounts.test.ts`

**Change:**
- Re-add `credit_card` to `FinancialAccountKind` and `VALID_ACCOUNT_KINDS` (`financialFoundations.ts`) and to `VALID_KINDS` (`financialAccounts.ts`). Remove `credit_limit_centavos` from the account row/type.
- Add a `FinancialCreditCardAccount` type: the account fields plus joined details (`billing_cycle_days`, `alert_threshold_percent`, `credit_limit_centavos`, `cutoff_day`, `statement_day`). `listFinancialAccounts` / `getFinancialAccount` LEFT JOIN `credit_card_details` and expose details only when `kind = 'credit_card'`.
- Extend `createFinancialAccount` / `updateFinancialAccount` / `deleteFinancialAccount`: when kind is `credit_card`, upsert or soft-delete `credit_card_details` inside the same `withTransactionAsync` block. Enqueue only the existing `financial_accounts` sync operation (details sync is a non-goal).
- Validate per 4.6: name required, type required, opening balance a finite integer, credit limit positive when provided, billing cycle 28-31, cut-off and statement days integer 1-31, alert threshold 0-100 when provided.

### 3. Credit Card Account Form UI

**Files:**
- Modify: `apps/app/features/financial-accounts/FinancialAccountsScreen.tsx`
- Add: `apps/app/features/financial-accounts/__tests__/CreditCardAccountForm.test.tsx`

**Change:**
- Re-add `credit_card` to `ACCOUNT_KINDS`, `KIND_LABELS`, and `kindIcon`.
- When the selected kind is `credit_card`, show the 4.2 card fields: credit limit, billing cycle (28-31 days), cut-off day, statement day, and alert threshold percentage, with placeholders from 4.3. The generic fields (name, type, opening balance, institution name, opening date) stay visible for all kinds.
- Submit passes credit-card fields to the repo for storage in `credit_card_details`; validation errors show beside the affected field; valid entries survive failed submission.

> **Deviation from 4.2/4.6:** cut-off and statement dates are modeled as a recurring **day of the month** (`cutoff_day` / `statement_day`, integer 1-31, short months clamp to the last day), matching the PH convention where the cut-off is "every 5th of the month" and the statement day equals the cut-off day. `credit_card_cycles` keeps concrete `statement_date`/`cutoff_date` calendar dates computed from these rules. Migration `033_credit_card_day_of_month_columns` renames and converts the columns in place on databases that already ran the old `024`.

## Acceptance Criteria

- Creating a credit-card account writes `financial_accounts` (kind `credit_card`) and `credit_card_details` in one transaction and the card appears in the accounts list with its credit limit read from details.
- Validation rejects: empty name, non-positive credit limit, billing cycle outside 28-31, missing or malformed cut-off/statement days (non-integer or outside 1-31), alert threshold outside 0-100.
- Editing a credit-card account updates both rows; deleting soft-deletes both.
- `financial_accounts.credit_limit_centavos` no longer exists; no code or sync RPC references it.
- Non-credit-card account flows are unchanged.
- Verification passes:
  - `pnpm exec tsc -p apps/app/tsconfig.json --noEmit`
  - `pnpm --dir apps/app test -- --runInBand`