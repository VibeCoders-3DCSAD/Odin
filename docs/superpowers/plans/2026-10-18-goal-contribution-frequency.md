# Goal Contribution Frequency Implementation Plan

**Goal:** Offer Daily, Weekly, Twice a Month, Monthly, and None on Plan → Goals.

**Architecture:** Preserve legacy schedules when reading existing data. Store None as a null frequency with zero planned contribution and no schedule fields. Add daily scheduling throughout validation, calculation, and sync persistence.

**Tech Stack:** React Native, TypeScript, SQLite, PostgreSQL, Jest.

## Constraints

- Preserve unrelated working changes and existing saved legacy schedules.
- Manual contributions remain available when None is selected.
- Do not apply remote migrations or reset databases.

## Tasks

- [x] Update the goal form's options, conditional fields, and normalized save payload; preserve legacy schedules until explicitly changed.
- [x] Support daily schedules in calculations and validation, and unscheduled goals in local/API validation.
- [x] Add a forward PostgreSQL migration for daily frequency and sync validation; update requirements.
- [x] Verify daily required contributions, unscheduled goals, form interactions, API sync validation, and relevant existing tests.

## Validation limits

The local Supabase dry run was rejected by automatic approval review because database pushes must be performed manually by the user. The migration has not been applied or replayed. App-wide TypeScript checking also reports existing errors outside these edits.

## Follow-up: contribution timing inputs

- [x] Remove the next-contribution-date picker from the goal form.
- [x] Require a weekday for Weekly, two ascending date numbers for Twice a Month, and one date number for Monthly. Daily and None need no additional timing inputs.
- [x] Derive the next occurrence internally, preserve unchanged schedule history, and clamp dates in shorter months without shifting the chosen monthly date in later months.
- [x] Verify form interactions, schedule calculations, and Financial Plan monthly reservations.
