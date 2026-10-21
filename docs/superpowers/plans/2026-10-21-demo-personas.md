# Demo Personas Implementation Plan

**Goal:** Provision four confirmed demo accounts with distinct, coherent financial histories.

**Architecture:** Keep `seed.ts` as the CLI and persistence orchestrator. Add a pure persona history builder beside the existing default builder, reusing its date helpers and data contract. Persona credentials are fixed; other accounts take runtime passwords.

**Tech Stack:** TypeScript, existing Supabase client, tsx, Jest, pnpm.

## Constraints

- Preserve existing default seed behavior and unrelated working changes.
- Scope all persisted demo data to its user; require existing email confirmation for replacement.
- Persona logins are fixed demo credentials kept in `seed-personas.ts`; seeding resets a persona account to them and prints them. Never print a non-persona existing account's password or log tokens.
- No dependency additions, migrations, or device operations.

## Tasks

- [ ] Add validated `--persona seasonal-mom|debt-burdened|healthy-worker|family-breadwinner` selection and persona names.
- [ ] Generate 14 months of salary, daily expenses, tuition, debt repayments, savings contributions, and monthly plans appropriate to each persona. Verify cash never goes negative and all row references remain within the generated user.
- [ ] Persist savings goals before linked transactions and activities after transactions; preserve cleanup ordering.
- [ ] Test seasonal tuition, debt pressure/no savings, healthy funded reserves with spending variance and large purchases, the breadwinner's 80% remittance, and ledger reconciliation across dates.
- [ ] Document CLI usage; preview and provision new confirmed accounts with runtime-only passwords; verify password login and persisted totals.
- [ ] Run focused Jest tests, TypeScript checks, and graphify update.
