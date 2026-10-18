# Savings Type Form UX

**Goal:** Review a simple type-aware savings form in Plan → Goals before adding persistence.

**Architecture:** A separate form preview keeps common details and per-type drafts in memory. Existing goal editing still uses SavingsGoalForm. No new database writes, sync operations, rate calculations, or mission tracking are introduced by the preview.

**Tech stack:** React Native, existing Budgie form controls, Jest.

## Implemented flow

- [x] Plan → Goals → Add savings opens the preview.
- [x] HYSA, Traditional Savings, and Time Deposit share name, institution, balance/principal, and notes.
- [x] HYSA captures base rate and credit frequency; an optional active boost reveals total boosted rate, balance cap, and effective dates.
- [x] Traditional Savings captures regular interest and credit frequency.
- [x] Time Deposit captures principal, annual rate, start/maturity dates, and optional withdrawal terms; duration comes from the dates.
- [x] HYSA and Traditional Savings retain the five contribution frequencies and optional savings target. No next-contribution-date or category input is shown.
- [x] Switching types preserves drafts. Review shows applicable fields only, with a return-to-edit action.
- [x] The preview clearly says that details are not saved yet.

## Verification

Interaction tests cover opening the form from Goals, type-specific visibility, draft retention, review validation, and returning to edit. Validation covers optional boosts, hidden Time Deposit fields, weekdays, and invalid dates. Full app type checking still reports existing errors outside the new form files.

## Next stage

Connect the agreed form to persistence, including daily credit frequencies, boost effective-date history, and actual interest receipts. Keep recorded balances separate from projected interest.
