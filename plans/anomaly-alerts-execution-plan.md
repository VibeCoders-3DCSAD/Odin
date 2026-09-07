# Anomaly Alerts Execution Plan

## Goal

Deliver a usable, offline-readable anomaly and overspending alert inbox backed by Odin's existing alert schema. Detection will initially use deterministic, explainable server-side rules behind a provider interface; a future `odin-ml` adapter will implement the same normalized result contract, so the API, persistence, user actions, cache, and React Native UI remain unchanged.

## Source Of Truth

- Requirements: `docs/requirements-engineering/feature-modules.md` sections 13 and 14.3-14.5
- Alert and anomaly schema: `supabase/migrations/20260616064145_priority_modules_v3.sql`
- Forecast-provider precedent: `apps/api/src/routes/forecast.ts` and `apps/api/src/services/forecastService.ts`
- Dashboard cache precedent: `apps/app/local-db/repositories/dashboardSnapshots.ts`
- Existing placeholder route: `apps/app/components/MobileShell.tsx`

## Non-Goals

- Do not add `odin-ml`, deploy a microservice, or call an ML endpoint in this work.
- Do not add push delivery, background jobs, or external notification providers; alerts are in-app and fetched on foreground refresh.
- Do not implement every alert source from section 13.3. This release owns anomaly detection and budget overspending only; forecast, savings, debt, and synchronization sources can use the same persistence contract later.
- Do not duplicate the remote `alerts` or `anomaly_evaluations` schema in the local sync queue. The app has a read-only local inbox cache and uses authenticated alert-action endpoints.

## Execution Order

1. Define stable contracts and deterministic detection providers.
2. Add server orchestration, user-scoped alert APIs, and evaluation triggers.
3. Add local offline alert cache and app API client.
4. Build the alert inbox, details, and actions, then connect dashboard refresh and navigation.
5. Verify server, app, and end-to-end user behavior.

## PR Stacking Strategy

Inline execution on the current checkout. Do not create a Git worktree or branch; keep changes and commits in the active working tree.

```text
current checkout
├─ contracts and deterministic providers
├─ alert APIs and evaluation orchestration
├─ local cache and client
└─ inbox UI, dashboard integration, and verification
```

## Linear Sub-Issue Tracking

Create sub-issues from this plan when ready. No Linear parent issue or branch strategy was supplied; execute the numbered phases inline in order.

### 1. Define The Alert Intelligence Boundary

- Add `apps/api/src/services/alerts/types.ts`, `apps/api/src/services/alerts/providers.ts`, `apps/api/src/services/alerts/ruleBasedAnomalyProvider.ts`, and `apps/api/src/services/alerts/ruleBasedOverspendingProvider.ts`; define normalized detection inputs and outputs, including transaction/budget references, severity, explanation, feature drivers, and suppression decision, without exposing provider-specific scores to the app.
- Add provider selection in `apps/api/src/services/alerts/alertProviderFactory.ts`, controlled by `ALERT_INTELLIGENCE_PROVIDER=rules`; reserve an `ml` value for a later adapter that calls `odin-ml` with an explicit timeout and maps its response into the same contract. The factory is the only seam that may know which provider is active.
- Use explainable baseline rules for this release: compare an expense to the user's historical subcategory/merchant amounts after a documented minimum-history threshold, and compare current-cycle actual spending with the active budget allocation. Return an insufficient-history result rather than manufacturing an anomaly.
- Add focused unit tests under `apps/api/src/__tests__/services/alerts/` for cold start, normal activity, anomalous amount, expected recurring spending, and overspending severity; inject `now` and inputs so tests are deterministic.

### 2. Persist, Suppress, And Serve Alerts

- Add `apps/api/src/services/alerts/alertService.ts` and `apps/api/src/services/alerts/alertRepository.ts`; read all source records with `.eq("user_id", userId)`, persist `anomaly_evaluations`/`overspending_evaluations`, create deduplicated `alerts`, and write `alert_events` in a transaction or single database RPC so an evaluation and its alert cannot diverge.
- Implement suppression evaluation against `anomaly_whitelist_rules`, `alert_suppression_rules`, and `alert_notification_preferences` before an alert is created. Record the suppression reason on the evaluation, retain the evaluation for auditability, and never let a client select another user's source IDs or suppression rule.
- Add `apps/api/src/routes/alerts.ts` and register it in `apps/api/src/app.ts`: `GET /odin/api/alerts` returns a bounded, cursor-paginated active inbox with related record summaries; `GET /:alertId` returns detail; `PATCH /:alertId` supports only whitelisted read, acknowledge, dismiss, snooze, expected, and unexpected actions; and `POST /clear` requires an explicit confirmation token in its payload.
- Ensure action routes check alert ownership in every read/update, validate status transitions and snooze timestamps, append immutable `alert_events`, and return safe client messages. Marking an anomaly expected may create or update a user-scoped whitelist/suppression rule only after an explicit request option, never implicitly.
- Add `apps/api/src/routes/alert-evaluations.ts` or an internal authenticated orchestration endpoint for foreground evaluation after a completed sync. It must accept no raw financial payload from the app, load the user's posted transactions and active budget data server-side, and trigger only new or changed candidates idempotently.
- Add `apps/api/src/__tests__/routes/alerts.test.ts` and service tests covering unauthenticated access, user scoping, invalid action payloads, action-event persistence, confirmation-required clear, suppression, deduplication, and no-data/cold-start results.

### 3. Add Offline Alert Storage And Client Integration

- Add `apps/app/local-db/migrations/035_alert_cache.ts` and register it through the local migration runner. Create a read-only, user-scoped `alert_cache` table plus cached related-record data sufficient to render the inbox and details offline; include remote revision/timestamps, current status, payload JSON where needed, and indexes by `user_id`, active status, and trigger time.
- Add `apps/app/local-db/repositories/alerts.ts` with bounded `replaceAlertPage`, `getActiveAlerts`, `getAlertDetail`, and cache-expiry helpers. Local data is a cache, not a second source of truth: remote action success updates the matching cache row, and a later pull reconciles it from the server.
- Add `apps/app/features/alerts/types.ts` and `apps/app/features/alerts/api.ts`, following `features/forecast/api.ts` for timeout and bearer authentication. Keep the app contract provider-agnostic: it consumes alert category, severity, explanation, state, related entities, and allowed actions, not rule scores or ML-specific fields.
- Add alert evaluation and refresh to `apps/app/features/dashboard/hooks/useDashboardData.ts` after successful `runSync`, independently from forecast refresh: request server-side evaluation, then fetch the inbox cache. Upsert the alert summary snapshot only after the inbox cache refresh succeeds; failures remain partial-data failures and must preserve an existing stale cache.
- Add repository and migration tests beside the local database code for user scoping, stale cache, replacement/upsert behavior, and retaining readable cached alerts when network refresh fails.

### 4. Build The Alert Inbox And Related Navigation

- Add `apps/app/features/alerts/AnomalyAlertsScreen.tsx` and focused presentational components under `apps/app/features/alerts/components/`. Replace the `anomaly-alerts` placeholder branch in `apps/app/components/MobileShell.tsx`, remove the hard-coded badge of `3`, and derive the unread badge from cached data.
- The inbox must render loading, empty, unread, offline/stale, error, and success states using the messages in section 13.5. Each alert shows severity, category, plain-language title/body, explanation, and timestamp; details expose mark-read, acknowledge, dismiss, snooze, mark-expected, and related-record actions only when the API identifies them as valid.
- Use explicit confirmation UI before clearing alerts and before creating a persistent expected-spending suppression rule. Item-level actions must track pending/error state by alert ID so one action never disables unrelated alerts.
- Connect related-record navigation to existing transaction, budgeting, debt, and savings destinations only where those screens support the referenced record. For unsupported routes, preserve the alert detail and show the specified safe recovery message rather than sending the user to a broken destination.
- Add React Native Testing Library coverage for empty, cached offline, severity rendering, per-alert pending state, destructive clear confirmation, expected-spending confirmation, and navigation requests. Add a Maestro flow once the app screen is installed on an emulator: refresh with seeded alert data, open an anomaly, acknowledge it, and confirm its inbox state changes.

### 5. Prepare The ML Adapter Without Coupling To It

- Document the required future adapter at `apps/api/src/services/alerts/mlAlertProvider.ts` as an unimplemented module or architecture note, specifying the request fields, normalized response contract, authentication mechanism, request timeout, retries, and fallback behavior. Do not import or call `odin-ml` until that service ships.
- When `ALERT_INTELLIGENCE_PROVIDER=ml` is enabled later, the adapter must fail closed to a recorded `model_failure`/no-alert evaluation and let the in-app alert API continue serving existing alerts. It must not block sync, erase cached alerts, or make the React Native feature branch on model availability.
- Add contract tests shared by the rules provider and future adapter fixture data. The tests must prove both providers produce the same normalized decisions and that the alert service, routes, cache, and UI need no changes for the provider swap.

### 6. Verify

- Run `pnpm --filter api test` and `pnpm --filter app test`; add the new suites to the relevant test discovery configuration if necessary.
- Run `pnpm --filter api build` and `pnpm --filter app exec tsc --noEmit`, then run `pnpm test` as the final suite.
- Manual smoke: create sufficient historical spending, sync, trigger evaluation, refresh the dashboard, open an anomaly alert, mark it expected, confirm a matching later transaction is suppressed, go offline, and verify the cached inbox remains readable.
- Verify the remote schema migration containing `alerts`, `anomaly_evaluations`, suppression tables, ownership constraints, and RLS is applied in the target Supabase environment before enabling the routes. Do not add a parallel schema migration for tables that already exist.

## Acceptance Criteria

- A signed-in user can view a bounded, user-scoped anomaly/overspending inbox with category, severity, explanation, related record summary, and the required empty/loading/error/offline states.
- The app stores a readable local alert cache and shows stale cached alerts when an online refresh fails.
- Deterministic rules create auditable anomaly and overspending evaluations only from server-loaded, user-scoped data; insufficient history does not produce false alerts.
- Users can read, acknowledge, dismiss, snooze, and explicitly mark anomaly spending expected; actions validate ownership, persist alert events, and update only the selected item in the UI.
- Clearing alerts and creating persistent expected-spending suppression rules require explicit confirmation.
- Suppression, notification preference, duplicate cooldown, and repeated-evaluation behavior prevent unwanted duplicate anomaly alerts while preserving evaluations for audit.
- Dashboard alert count and summary refresh independently of forecasts and never cause a full dashboard failure when alert refresh is unavailable.
- No app screen, API route, repository, or UI component depends on an ML-specific request or response shape; replacing the rules provider with an `odin-ml` adapter requires changes only inside the alert provider boundary and configuration.
