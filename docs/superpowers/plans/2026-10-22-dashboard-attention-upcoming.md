# Dashboard Attention and Upcoming Implementation Plan

> **For agentic workers:** Execute inline in this session; the user requested implementation.

**Goal:** Implement Dashboard section 5.9 using user-owned local records.

**Architecture:** A local repository assembles independent attention and reminder feeds. Reuse the debt, biller, and savings schedule engines; keep loading and recovery in a hook and presentation in a focused card. Pass typed item destinations to the mobile shell.

**Tech Stack:** React Native, TypeScript, Expo SQLite, Jest, React Native Testing Library.

## Global Constraints

- Use the existing dependencies and pnpm; Node 24.15.0.
- Scope reads and related records by authenticated user.
- Seven calendar days inclusive through the due date, using Asia/Manila dates.
- Expected income never changes balances. Exclude completed occurrences and confirmed recurring observations.
- Preserve existing workspace changes. No device interaction is authorized.

### Task 1: Assemble the feeds

**Files:** `apps/app/local-db/repositories/dashboardReminders.ts`, feature-local `types.ts` and `helpers/`, repository tests.

- [x] Query scheduled income and unpaid auto-post occurrences in batches.
- [x] Reuse debt schedule and payment math across month boundaries; retain partial amounts.
- [x] Reuse savings schedule advancement and account for recorded contributions.
- [x] Return independent errors for attention and upcoming so failures never appear as empty feeds.
- [x] Test dates, partial/completed occurrences, ownership, and resolving records with real SQLite where applicable.

### Task 2: Render and navigate

**Files:** Dashboard screen, reminder hook/card, MobileShell, savings and observation entry points, component tests.

- [x] Render both sections, including empty, loading, retry, and partial failure feedback.
- [x] Route each item to its related details and the existing frequent-spending confirmation flow.
- [x] Reload on synchronization, foregrounding, date rollover, and dashboard refresh; discard stale user requests.
- [x] Keep feeds visible in empty and partial dashboard states.
- [x] Run targeted Jest suites, TypeScript, diff checks, and update the local graph.

## Validation

- Targeted Jest checks: 11 suites, 89 tests passed.
- Full app typecheck remains blocked by existing forecast payload, financial-plan, savings-allocation, and legacy test errors; new files are checked for additional diagnostics.
- The offline auto-post path now guards source balances and reports only committed posts.
- No on-device testing performed.
