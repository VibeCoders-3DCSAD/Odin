# Fixed Interest Form Implementation Plan

**Goal:** Replace tiered/reference controls with the agreed fixed-interest configuration entirely within Advanced Options.

**Architecture:** Focused React Native sections edit a versioned configuration carried by the existing interest-reference JSON. Shared validation protects app/API boundaries; an additive Postgres validator permits the configuration through sync. New configurations explicitly omit the legacy direct-credit schedule so the old worker cannot ignore their rules and post actual income.

**Scope:** Form, validation, save/reopen and sync contract. Projected-credit accounting, reconciliation and the calculation engine are follow-up work; do not claim they operate from these form settings.

- [x] Add shared `SavingsInterestConfiguration`, strict configuration normalization and version checks. Preserve legacy JSON when untouched.
- [x] Replace `SavingsInterestFields` and schedule controls with small section components: method/basis/rate, credit timing, start and ADB period, limits/tax/day count, dated rates and projection preferences. Hide all interest configuration behind Advanced Options. None saves a zero rate and no auto-credit schedule.
- [x] Extend the existing form builder to attach validated configuration, require a starting balance for newly backdated starts, and preserve unrelated saved account data.
- [x] Add a new SQL validation migration for the configuration without enabling the legacy worker. Replay on a disposable database; do not push to the developer database.
- [x] Verify conditional controls, no tiers, None, defaults, custom intervals, persistence and API validation. Run focused Jest suites under Node 24.15.0, API build and app type checking; document unrelated baseline failures. Update requirements, README and Graphify.

## Verification

- 48 focused app tests and 17 API tests pass under Node 24.15.0. API build passes.
- App TypeScript checking retains the known forecast snapshot, financial-plan, savings-allocation and older fixture failures. No interest-file diagnostics.
- All 202 migrations replay on a clean disposable Supabase instance. Fixed configuration, legacy scheduling/reference, goal-account-link and unique-goal-name SQL suites pass.
- SQL checks verify that new configuration does not activate the legacy direct-credit engine or create actual transactions, and that configuration/None can save through sync.
- Saved configuration round trips through SQLite and the sync payload. Form tests exercise collapsed controls, None, custom timing, ADB periods, default tax, backdated balance and dated rates.
- Migration deployment remains manual under the previously reported approval restriction. No developer database reset, migration push, remote deployment or device interaction was performed.
- Graphify updated locally. Revised projection calculation/accounting remains explicitly outside this form task.

## Follow-up: remove automation and Savings selector

- Removed the automatic-interest and stopping-policy controls. Configuration normalization disables old `autoProject` flags, including older incoming API payloads.
- Migration 20261116000009 retires the savings-interest cron job and posting function, preserving balances and transaction history. Regression checks cover stale schedule callers, manual/historical interest, and migration upgrade with existing enabled configuration.
- Removed Savings from new account type choices. Existing savings accounts show a read-only stored type and retain editable details; no existing records are converted or deleted.
- Focused app checks pass (46 tests); API checks pass (17 tests). Updated tests replace obsolete Savings-creation assertions with selector and existing-account edit coverage.
- Migration installation remains a manual step; no development or remote database push was attempted.
