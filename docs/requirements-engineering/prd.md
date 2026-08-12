# Products Requirement Document

## Metadata

```json
{
    "document-type": "prd",
    "version": 0.1.0,
    "date": "2026.08.07",
    "authors": [
        "Gabion, Stefanie S.",
        "Guevarra, Joaquin Luis T.",
        "San Jose, Alexa Joanne Paula G.",
        "Togle, Charles Nathaniel B."
    ],
}
```

## Problem Statement

Filipino working young adults need a personal finance management system that remains useful in the real conditions where they manage money: intermittent internet, variable income, fixed obligations, family support, culturally patterned expenses, debt pressure, and limited time for manual tracking.

Generic expense trackers help users record what already happened, but they do not adequately support Filipino budgeting behavior, protected obligations, financial behavioral profiling, forward-looking cash planning, offline transaction entry, local-first dashboards, or thesis-grade evaluation of intelligent finance modules.

Odin must therefore solve two problems at once:

1. Give users a mobile-first personal finance app that lets them record, review, and act on their money even when the network is unreliable.
2. Give the thesis team a defensible, testable system that implements the specified modules, model boundaries, privacy controls, and evaluation criteria.

The current implementation direction is offline-first. The app must not treat the network as the main interaction path for ordinary financial activity. The user interface should read from local data, write local changes immediately, and synchronize with the server in the background when connectivity is available.

## Solution

Build Odin as an Android-first personal finance management application for Filipino working young adults, with all offline-capable modules backed by local SQLite repositories and background synchronization.

The canonical implementation model is:

```text
UI -> local repository -> SQLite table -> sync_queue -> runSync() -> /odin/api/sync/push -> apply_sync_operation() -> /odin/api/sync/pull -> SQLite convergence
```

The UI reads from local SQLite and writes through feature repositories. Network sync is background convergence, not the primary user interaction path. Queued changes represent domain operations such as transaction creation or category update, not stored HTTP requests.

Odin remains a decision-support system, not a licensed financial adviser. It must explain outputs in plain language, keep users in control of final decisions, and avoid shame-based financial messaging.

The app shall support general users, but the thesis target population and model-training target remain Filipino working young adults aged 20 to 40 who live or work in Metro Manila. During onboarding, Odin shall inform users that the app is a thesis project designed primarily for that target group, that all users may use the app, and that only qualifying target-user data will be used to train or improve AI models when consent allows it.

Android is the primary supported platform. iOS-specific development, testing, and distribution are out of scope unless a future requirement explicitly changes this. Web access may exist for development or wider-layout review flows, but mobile remains the primary product experience.

Confirmed primary product areas are:

1. Identity and authenticated app entry
2. Consent, privacy, and governance
3. Onboarding and profile assessment
4. Taxonomy and restriction levels
5. Financial accounts, income sources, and obligations
6. Ledger, transactions, templates, and recurring records
7. Dashboard
8. Budgets and allocations
9. Budget recommendations
10. Forecasts and expected events
11. Anomalies and overspending
12. Alerts and notifications
13. Savings goals
14. Debt management
15. Reports and analytics
16. Help and problem reporting
17. Offboarding and account governance
18. Offline sync status, recovery, and discard flows

## User Stories

### General User

1. As a user, I want to create an Odin account with email and password, so that I can keep my financial records under my own account.
2. As an email/password user, I want to confirm my email before entering Odin, so that my account ownership is verified.
3. As a user, I want to register or log in with Google and enter Odin automatically after provider authentication, so that account access is fast and simple.
4. As a user, I want Odin to clearly explain when internet access is required, so that I understand why some actions cannot continue offline.
5. As a user, I want to keep using available financial features when I am already signed in and lose internet access, so that poor connectivity does not stop ordinary money tracking.
6. As a user, I want login or network problems to never erase my saved financial records, so that my data remains safe.
7. As a user, I want a guided onboarding flow, so that Odin can understand my financial situation before giving recommendations.
8. As a user, I want to resume onboarding if I leave the app, so that I do not lose partially completed answers.
9. As a user, I want to understand my financial behavioral profile, so that Odin's guidance feels explainable instead of arbitrary.
10. As a user, I want to review, accept, reject, or change my assigned profile, so that I stay in control of how Odin represents me.
11. As a user, I want spending categories that reflect Filipino financial realities, so that my records are not forced into generic labels.
12. As a user, I want to customize categories where appropriate, so that Odin matches my actual financial language.
13. As a user, I want to mark important expenses as protected or fixed, so that Odin does not casually recommend reducing non-negotiable spending.
14. As a user, I want to manage my accounts, income sources, and obligations, so that Odin understands where money comes from, where it is held, and what payments must be made.
15. As a user, I want to record income, expenses, and transfers quickly, so that my financial records stay current.
16. As a user, I want transaction templates and recurring records, so that repeated income and expenses take less effort to track.
17. As a user, I want to edit, delete, search, sort, and filter transactions, so that I can correct mistakes and review history easily.
18. As a user, I want my dashboard to show my current financial picture, so that I can quickly understand balance, recent activity, budget status, alerts, goals, debts, and forecasts.
19. As a user, I want the dashboard to show only information Odin can present responsibly, so that I do not rely on misleading guidance.
20. As a user, I want to create and manage budgets, so that I can plan spending around my real income cycle.
21. As a user, I want budget guidance to respect protected expenses, so that essential obligations are not treated as easy cuts.
22. As a user, I want Odin to explain budget recommendations, so that I can decide whether to accept, modify, or reject them.
23. As a user, I want to view forecasts for future financial activity by total and category, so that I can plan upcoming budget periods.
24. As a user, I want forecast results to say whether they are personalized, fallback, or cold-start estimates, so that I understand how much to trust them.
25. As a user, I want Odin to identify unusual spending or overspending risks, so that I can respond before problems grow.
26. As a user, I want to mark unusual but intentional spending as expected, so that Odin learns not to repeatedly warn me about planned behavior.
27. As a user, I want useful alerts and notification controls, so that important warnings remain visible without becoming overwhelming.
28. As a user, I want to create and monitor savings goals, so that I can track progress toward important financial objectives.
29. As a user, I want savings goals to reflect Filipino savings categories once validated, so that goal tracking fits local priorities.
30. As a user, I want to approve or reject any recommendation to move money between savings goals, so that Odin never reallocates my goals without consent.
31. As a user, I want reminders to rebuild a lower-priority savings goal after approved reallocation, so that temporary reductions do not become forgotten losses.
32. As a user, I want to track debts by category or type, so that different kinds of debt can be managed appropriately.
33. As a user, I want to choose repayment strategies per debt group once validated, so that different debt groups can follow different repayment plans.
34. As a user, I want debt payments and payoff projections to influence future savings forecasts, so that freed cash flow is reflected after a debt ends.
35. As a user, I want weekly, monthly, and custom reports, so that I can review spending, budgets, forecasts, savings, debts, and obligations over time.
36. As a user, I want FAQ/help content in the app, so that I can understand Odin even without leaving the screen.
37. As a user, I want to report a problem to the development team, so that I can ask for help or flag issues.
38. As a user, I want to export my data, so that I can keep a copy of my financial records.
39. As a user, I want account deletion to be explicit and understandable, so that I know what will happen before anything destructive occurs.
40. As a user, I want Odin to protect unsynced changes before logout or account deletion, so that local financial records are not silently lost.
41. As a user, I want visible sync status and recovery options, so that I can understand and resolve unsynced or failed changes.
42. As a user, I want any discard of failed local changes to require clear confirmation, so that accidental data loss is avoided.

### Thesis Participant

1. As a thesis participant, I want Odin to explain the thesis target population, so that I understand whether my data may be used for model training or evaluation.
2. As a thesis participant, I want to give or withhold consent for approved data uses, so that participation is informed and voluntary.
3. As a thesis participant, I want privacy and data-use settings to remain visible, so that I can review my choices later.
4. As a thesis participant, I want Odin to distinguish app access from research eligibility, so that I can use the app even if I am outside the model-training target group.
5. As a thesis participant, I want intelligent outputs to include explanations, so that I can evaluate whether the system is understandable and trustworthy.

### Thesis Evaluator

1. As a thesis evaluator, I want the system's offline-first flows to be testable end to end, so that reliability can be assessed under realistic connectivity conditions.
2. As a thesis evaluator, I want intelligent module outputs evaluated separately from the UI, so that model quality is not confused with interface quality.
3. As a thesis evaluator, I want usability measured through SUS, so that user experience can be evaluated consistently.
4. As a thesis evaluator, I want ISO 25010 quality characteristics mapped to concrete app behavior, so that system quality can be defended.
5. As a thesis evaluator, I want savings and debt features to identify pending SME/RRL validation, so that provisional requirements are not presented as final findings.

### Development Team

1. As a development team member, I want problem reports to include enough safe context to respond, so that issues can be diagnosed without exposing unnecessary sensitive data.
2. As a development team member, I want offline-capable modules to have clear sync boundaries, so that implementation does not drift back into direct network-dependent screens.
3. As a development team member, I want savings and debt category standards to remain marked as pending until validated, so that the product does not lock in unsupported assumptions.

## Implementation Decisions

- Odin is offline-first for business data. Screens for offline-capable modules read from local repositories and mutate local repositories.
- Local SQLite is the UI source of truth for offline-capable modules.
- Sync queues domain operations, not HTTP requests.
- The sync engine is the only app path that calls push and pull sync endpoints.
- Synced user-owned rows must preserve `user_id`, versioning, deletion state, timestamps, and last-sync metadata locally where applicable.
- Remote synced rows must support ownership scoping, versioning, tombstones, and auditability.
- Deletes for synced entities are tombstones, not hard deletes.
- Conflict resolution is automatic: delete wins, then per-field last-write-wins for concurrent edits.
- Duplicate operations are idempotent through operation IDs and applied-operation tracking.
- Rejected or losing operations are logged for audit/recovery instead of silently disappearing.
- User-owned data must always be scoped to the authenticated user locally and remotely.
- Foreign keys and related record references must be validated against the current user's ownership boundary before local persistence and before remote sync application.
- Auth, registration, login, logout, password reset, password update, account deletion, data export, and push token registration are online-only unless explicitly changed later.
- Auth credentials, passwords, access tokens, refresh tokens, and raw auth payloads must not be stored in local business tables.
- Onboarding drafts may be local-first after authentication; server-side profile classification remains online execution unless a future local classifier is explicitly approved.
- Current profile assignment and explanation are cached locally for offline display.
- Category groups and system taxonomy are pull-only catalog data.
- User-created categories, subcategories, and approved restrictions use user CRUD sync.
- Financial accounts, income sources, obligations, transactions, transaction templates, recurring records, budgets, savings goals, debt records, alert actions, notification preferences, and approved user feedback entities use user CRUD sync where included.
- Dashboard and reports prefer local aggregate reads over server-only read endpoints.
- Budget recommendation generation is online execution or server-side calculation, with cached results for offline display.
- LSTM forecast generation and refresh are online execution, with cached forecast runs, series, points, explanations, and metadata for offline display.
- Isolation Forest anomaly detection is online execution or server-derived output where applicable, with cached results for offline display.
- User feedback, whitelist rules, expected-event suppression, and alert suppression rules may use user CRUD sync when approved by schema and ownership validation.
- Savings and debt projection outputs are cached snapshots unless implemented as local calculations in a future validated design.
- Savings goals and debt management are still under active consultation. The PRD records directional requirements, but final category standards and some algorithms require RRL, informal interviews, and SME validation.
- Savings goals must support target amount, current progress, target date, category/type, contribution history, priority data, and cached projections.
- Savings category standardization must be based on a Top 10 Filipino savings category set supported by RRL, informal interviews, and SME validation.
- Emergency fund is a likely high-priority savings category, but final default prioritization must follow validation.
- Savings reallocation from lower-priority to higher-priority goals may be recommended only after the savings standardization and user-consent behavior are validated.
- Any accepted savings reallocation must create replenishment reminders for the reduced lower-priority goal.
- Debt records must support lender/creditor, debt category/type, outstanding balance, payment schedule, interest or fee fields where applicable, minimum payment, due date, payment history, priority, hardship state, strategy preference, and cached projection.
- Debt category standardization must be based on a Top 10 Filipino debt category set supported by RRL, informal interviews, and SME validation.
- Debts are grouped by category or type, and users may choose a repayment strategy per group.
- Debt strategies include Snowball and Avalanche where validated, but their default mapping by category remains pending SME validation.
- Forecasting must account for credit card and loan payment computations when enough terms are available, rather than treating all debt payments as flat user-entered expenses.
- When a debt is forecasted to be paid off, subsequent savings forecasts should reflect freed cash flow according to the final debt standardization.
- Help/FAQ content is static or locally bundled.
- Problem reporting is online-only email dispatch with subject, message body, registered email reply-to, and internal user ID.
- No admin ticketing system, agent role, or support workflow is included for problem reporting.
- Offline sync recovery is part of the product. The app must expose sync status, manual retry, exhausted-failure recovery, explicit discard confirmation, and safe user-facing failure copy.
- Discarded sync rows are marked discarded and retained temporarily before cleanup, rather than deleted immediately.
- Mobile layout is primary and must remain usable across narrow phone widths without horizontal scrolling.
- Light and dark themes are supported, with light as the default unless product design changes.

## Testing Decisions

- Tests should verify external behavior and user-visible outcomes, not internal implementation details.
- Offline-capable modules need at least one vertical slice proving local create/edit/delete or action, immediate UI/read-model update, queued sync operation, reconnect push, pull convergence, and no duplication.
- Local repository tests should cover validation, ownership checks, related-record checks, local writes, queue rows, changed fields, base version, tombstones, and immediate read results.
- Sync tests should cover soft-stop without auth/network, idempotent push, update-vs-missing-row rejection, delete-wins behavior, per-field merge behavior, pull of tombstones, failed operation handling, and stale-version handling.
- Auth tests should cover online-required registration/login/password flows, auth hydration before protected render, and auth failure preserving local data and sync queue rows.
- Governance tests should cover consent visibility, privacy settings cache behavior, online-only export/deletion, explicit deletion confirmation, and pending-sync safeguards.
- Onboarding/profile tests should cover local resume, eligibility field capture, profile explanation display, manual selection, confirmation/rejection, reassessment request, and offline cached-profile behavior.
- Taxonomy tests should cover pull-only category groups, local category/subcategory CRUD for user rows, restriction availability, tombstones, and downstream budget validation use.
- Account/income/obligation tests should cover offline CRUD, ownership scoping, local balance availability, tombstone deletes, and sync convergence.
- Ledger tests should cover income, expense, transfer invariants, line items, templates, recurring records, drafts where implemented, local balance effects, history filters, edits, and deletes.
- Dashboard tests should cover local rendering offline, immediate update after local ledger writes, stale/cached labels, and graceful degradation for missing downstream modules.
- Budget tests should cover offline CRUD, allocations, restriction-aware validation, activation/closure/archive actions, budget health, and sync convergence.
- Budget recommendation tests should cover online refresh, cached offline display, explanation fields, protected-category behavior, and accept/modify/reject boundary behavior.
- Forecasting tests should cover online refresh, cached offline display, cold-start/fallback/personalized metadata, expected events where included, and the four-line next-month category-group graph.
- Anomaly/overspending tests should cover cached display, explanations, user feedback actions where syncable, whitelist/suppression rules, culturally expected spending cases, and ownership checks.
- Alerts tests should cover cached inbox display, acknowledge/dismiss/snooze/clear actions, preference updates, in-app overspending visibility, and push-token online boundary.
- Savings tests should cover goal CRUD, contributions, immediate progress updates, priority data, projection cache staleness, and validated category behavior once finalized.
- Debt tests should cover debt CRUD, payment logging, immediate balance/progress updates, category grouping, per-group strategy preferences, hardship records, projection cache staleness, and validated debt-standard behavior once finalized.
- Reports tests should cover local week/month/custom date ranges, category summaries, budget-vs-actual, cached comparison labels, and mobile/desktop layout behavior.
- Help/problem reporting tests should cover local FAQ availability, required problem-report fields, online submission, offline network-required messaging, and no admin workflow.
- Sync recovery tests should cover visible sync status, pending and failed counts, manual sync, exhausted failure sheet, friendly failure messages, pagination, discard confirmation, discarded-row retention, cleanup cutoff, and logout retry behavior.
- Mobile UI tests should cover core workflows on narrow viewports: onboarding, transaction entry, dashboard, budgets, forecasts, alerts, savings, debt, reports, settings, and sync recovery.
- Model evaluation remains separate from UI tests. Random Forest classification, LSTM forecasting, Isolation Forest anomaly detection, and Linear Programming recommendation quality should be measured with thesis-approved metrics and datasets.
- Usability evaluation should use SUS for the complete user-facing app.
- Software quality evaluation should map ISO 25010 characteristics to concrete behavior, including functional suitability, usability, reliability, performance efficiency, security, maintainability, and portability.

## Out of Scope

- iOS-specific development, testing, or distribution.
- Bank API integration.
- E-wallet API integration.
- Automatic transaction import.
- OCR or receipt scanning.
- External CSV or spreadsheet transaction import unless separately approved.
- Licensed financial advice, investment advice, retirement planning, legal advice, or tax advice.
- Automated bill payment.
- Credit score monitoring.
- Full production-grade fraud detection.
- Merchant-level enrichment from third-party providers.
- Public marketplace deployment requirements beyond thesis needs unless separately approved.
- Multi-tenant, organization, company, or workspace-scoped architecture.
- Generic arbitrary-table sync.
- HTTP request replay as an offline strategy.
- Blocking manual conflict review UI.
- Admin dashboards, agent roles, or ticketing workflows for problem reporting.
- Finalizing Top 10 Filipino savings categories without RRL, interviews, and SME validation.
- Finalizing Top 10 Filipino debt categories without RRL, interviews, and SME validation.
- Finalizing savings reallocation algorithms or debt strategy defaults before SME validation.

## Further Notes

- This PRD supersedes the older route-first interpretation of Odin. Future implementation should extend the offline-first sync shape instead of adding direct fetch paths for offline-capable modules.
- Savings goals and debt management intentionally remain partly provisional. Recent consultation recommends SME validation, RRL-backed Top 10 Filipino savings categories, RRL-backed Top 10 Filipino debt categories, and informal interviews about common savings and debt categories.
- The strongest product thesis is that Odin is not just a tracker. It turns local-first manual logging into culturally grounded, profile-aware, forecast-aware budget guidance.
- The strongest technical risk is data correctness under offline sync. Tombstones, idempotency, ownership checks, sync recovery, and audit logs are product requirements, not optional engineering details.
- The strongest UX risk is manual logging fatigue. Transaction entry, templates, recurring records, immediate dashboard updates, and visible value after logging are essential.
- The strongest trust risk is sensitive financial data. Odin must explain data use, preserve local data during auth/sync failures, avoid raw technical error messages, and make destructive actions explicit.
