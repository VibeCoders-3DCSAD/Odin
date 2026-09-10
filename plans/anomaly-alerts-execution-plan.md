# Daily Financial Report Execution Plan

## Goal

Replace foreground, transaction-triggered anomaly evaluation with a daily,
server-owned financial report. The report evaluates the user's posted
transactions and active budgets once per day, persists any model-derived
findings as alerts, and is available to the app on its next sync or refresh.

The model is still under experimentation. This work establishes the scheduling,
input, persistence, and sync boundaries without shipping a deterministic rules
provider or a product alert inbox.

## Decisions

- Do not call anomaly detection from transaction entry, sync completion, or
  dashboard refresh.
- Do not implement a rules provider. A model adapter will be selected only when
  experimentation produces a stable, versioned result contract.
- Run one daily report per active user at 18:00 Philippine time
  (`Asia/Manila`).
- Evaluate the prior six months of posted financial data for every report.
- Backfill missed report dates individually during the current week. For a
  fully missed prior week, create one weekly report covering that Monday through
  Sunday period instead of recreating seven daily reports.
- Defer alert inbox, alert detail, dashboard badge, and related-record UI.
- Sync `alert_notification_preferences`, `anomaly_whitelist_rules`, and
  `alert_suppression_rules` through the local CRUD queue. Alerts and evaluation
  records remain server-owned, read-only cache data.

## Non-Goals

- Do not add `odin-ml`, deploy a model, or select a production anomaly model.
- Do not add push delivery or background processing in the mobile app.
- Do not build alert product UI while the report output and model behavior are
  still experimental.
- Do not evaluate transactions on every input or accept raw financial payloads
  from the app for evaluation.

## Anomaly Configuration

Add `apps/api/src/services/alerts/anomalyConfig.ts` as the single source of
non-secret report behavior. Keep model URLs, API keys, and other secrets in the
environment rather than this file.

```ts
export const anomalyConfig = {
  schedule: {
    cron: "0 18 * * *",
    timezone: "Asia/Manila",
    weekStartsOn: "monday",
  },
  history: { lookbackMonths: 6 },
  scoring: {
    anomalousAtScore: 0.7,
    criticalAtScore: 0.9,
  },
  reports: {
    currentWeekCadence: "daily",
    pastWeekCadence: "weekly",
    backfillCurrentWeekDaily: true,
    backfillPastWeeksWeekly: true,
  },
  idempotency: {
    reportKey: "user_id + report_date + cadence + model_version",
  },
  retries: { maxAttempts: 3, backoffMs: [1_000, 5_000, 25_000] },
  findings: {
    createAlertsFor: ["unusual_transaction", "budget_overspending"],
    reportOnly: ["insufficient_history", "model_unavailable"],
  },
  severity: {
    budgetOverspending: {
      warningAtPercentOverBudget: 10,
      criticalAtPercentOverBudget: 25,
    },
  },
  retention: { reportDays: 28, evaluationDays: 28, failureDays: 28 },
} as const;
```

The configuration maps model `anomaly_score` values at or above `0.7` to an
unusual-transaction finding. Overspending is derived from actual category spend,
the budgeted amount, `budget_excess`, and the report period. The report is
financial data, not financial advice.

## Preconditions

1. Choose the scheduler host and invocation mechanism. The current API has no
   durable job scheduler, so the 18:00 `Asia/Manila` cron job cannot be
   implemented solely as an Express route.
2. Define the model adapter's versioned normalized result contract, including
   the model version, candidate identity, finding category, severity,
   explanation, source references, and no-finding/failure result.
   For now, derive the anomaly decision in the API adapter from
   `anomaly_score >= 0.70`; the model does not need to return a separate boolean.

## Data And Idempotency Contract

- Add a forward Supabase migration. The existing alert tables do not provide a
  transactional report-write RPC, a unique report candidate identity, or an
  alert revision timestamp.
- Persist each report run keyed by `user_id`, report date, cadence, and model
  version. A retry resumes or replaces that same run rather than creating a
  second report. Weekly catch-up reports use the week's Monday date and the
  `weekly` cadence.
- Persist each evaluated candidate with a deterministic key scoped to the run.
  Enforce it with a unique constraint so concurrent scheduler invocations
  cannot duplicate evaluations or alerts.
- Write the report run, evaluations, alert rows, related entities, and events
  through one database RPC/transaction. The API must not chain independent
  Supabase inserts for a logically atomic report.
- Add a monotonic alert revision, updated timestamp, or equivalent server
  revision token. Cursor pagination must order by `(triggered_at DESC, id DESC)`
  and encode both fields in the cursor.
- Update the alert source enum before model integration. `isolation_forest`
  cannot describe an arbitrary experimental model; store the selected model in
  a truthful source type/model-version field.

## Execution Order

### 1. Establish Daily Report Infrastructure

- Add the forward migration for report runs, deterministic evaluation identity,
  alert revision, required indexes, and an atomic user-scoped report-write RPC.
- Add RLS and ownership constraints for each new user-owned record. The RPC
  receives a user ID only from trusted scheduler authentication, never from a
  mobile request body.
- Implement a scheduler entrypoint that finds eligible users by timezone and
  invokes the report service idempotently at 18:00 `Asia/Manila`. Every active
  user is eligible. Authenticate the scheduler with a server-only secret, use
  explicit timeouts, and log only safe IDs, run IDs, counts, status, and model
  version.
- Add retry and failure recording. A failed user report must not block reports
  for other users or alter existing alerts. Retry each report three times with
  exponential backoffs of one, five, and twenty-five seconds.
- For a successful current-week run, backfill each missed daily report date.
  For fully missed completed weeks, create one weekly report per week.
- Test duplicate scheduler delivery, concurrent runs, timezone boundaries,
  retry behavior, and transaction rollback.

### 2. Define The Experimental Model Boundary

- Add one provider interface describing a versioned normalized result. It must
  represent `unusual_transaction`, `budget_overspending`, no finding,
  `insufficient_history`, and `model_unavailable`.
- Map `anomaly_score >= 0.7` to an unusual-transaction finding. Map scores at
  or above `0.9` to critical severity; lower qualifying scores are warnings.
- Derive overspending findings from actual spend, budgeted amount,
  `budget_excess`, and the report period. Map 10% over budget to warning and
  25% over budget to critical.
- Do not add `ruleBasedAnomalyProvider`, `ruleBasedOverspendingProvider`, or an
  `ALERT_INTELLIGENCE_PROVIDER=rules` fallback.
- Keep the model adapter disabled until a model is selected. Its eventual HTTP
  client needs explicit authentication, timeout, response validation, and a
  bounded retry policy.
- A model failure records the run/evaluation outcome but creates no alert and
  never deletes existing alerts.
- Treat insufficient history and model unavailability as report-only status,
  never as alerts or financial advice.
- Add contract fixtures that the selected model must pass before it is enabled.

### 3. Sync User Feedback And Cache Server Results

- Add `alert_notification_preferences`, `anomaly_whitelist_rules`, and
  `alert_suppression_rules` to the local `SyncableEntity` type, queue payload
  validation, API sync routing, Supabase RPC allowlist/handler, and pull-table
  list together.
- Add/update the necessary forward Supabase migration for the remote sync RPC.
  Verify it with `supabase migration list --linked` and `supabase db push
  --dry-run`; do not deploy it without approval.
- Keep `alerts`, report runs, and evaluation records out of the mutation queue.
  Add a bounded, user-scoped local alert cache only when a read surface is
  scheduled.
- When the inbox returns, use the composite cursor and server revision contract
  above. On a failed refresh, retain the prior cache and mark it stale.
- Test local queue payloads, user scoping, remote allowlists, pull behavior,
  and stale-cache preservation.

### 4. Defer Product Surfaces

- Remove or disable unfinished alert evaluation calls from dashboard refresh.
- Do not ship the alert inbox, alert detail, badge, action UI, or Maestro alert
  flow in this phase. Preserve any in-progress code only if it compiles and is
  isolated from active navigation.
- Create the UI implementation plan only after the daily report produces
  stable, seeded results and the model contract is approved.

### 5. Verify

- Run the API and app test suites, builds, and type checks after each phase.
- Verify forward migrations locally and with `supabase db push --dry-run`.
- Run a scheduler smoke test with one eligible user, a duplicate delivery, a
  model failure, a successful result set, current-week daily backfill, and a
  completed-week weekly catch-up. Confirm one report run per user/date/cadence/
  model version and no duplicate alerts.
- Verify feedback changes travel through the local sync queue and affect the
  next eligible daily report without requiring a mobile foreground evaluation.

## Acceptance Criteria

- Transaction entry, sync, and dashboard refresh do not invoke anomaly
  detection.
- A trusted scheduler can run one idempotent 18:00 `Asia/Manila` report per
  active user and uses daily or weekly catch-up according to the configuration.
- Daily report writes are atomic and cannot create duplicate evaluations or
  alerts during retries or concurrent invocations.
- The model boundary is versioned and provider-agnostic, with no deterministic
  rules fallback in production code.
- Findings use the configured score and overspending thresholds, while
  insufficient history and model unavailability remain data-only report states.
- Alert preferences, whitelist rules, and suppression rules use the local CRUD
  sync queue end-to-end.
- Existing alerts survive model failures; reports, evaluations, and failures are
  retained for four weeks and remain available for a future cached read surface.
- No unfinished alert UI is reachable from the product while model experiments
  continue.
