# Odin Schema Audit Report

**Schema file:** `draft-schema-priority-modules.sql`
**PRD file:** `PRD-Full-Odin-App.md`
**Dialect:** PostgreSQL / Supabase

---

## Overall Verdict

| Area | Result |
|---|---|
| PRD coverage | Complete — every module maps to one or more tables |
| Thesis scope | Slightly over — 5 tables are deferrable |
| Indices | Mostly good — 4 missing, 1 weak |
| Constraint bugs | 3 logic errors requiring immediate fixes |
| Column issues | 2 redundant/problematic columns to address |

The schema is architecturally sound. Fix the three constraint bugs, add four missing indices, and consider deferring five marginally-used tables. Everything else is either PRD-correct or a deliberate production-grade pattern that will hold up to panel scrutiny.

---

## PRD Coverage

Every PRD module has corresponding tables. Nothing is missing.

| PRD Module | Tables | Status |
|---|---|---|
| Auth / profiles | `profiles`, `user_privacy_settings`, `user_consents`, `data_export_requests`, `account_deletion_requests` | ✅ Full |
| Onboarding questionnaire | `onboarding_sessions`, `onboarding_responses` | ✅ Full |
| Financial profile (Random Forest) | `financial_profile_assessments`, `financial_profile_explanation_drivers`, `financial_profile_assignments`, `financial_profile_events` | ✅ Full — confirmation flow, override, history all covered |
| Category taxonomy | `categories` (seeded), `category_aliases`, `user_category_settings` | ✅ Full — Filipino-context flags, protected defaults, custom labels |
| Transaction ledger | `financial_accounts`, `transactions`, `transaction_events`, `transaction_drafts`, `recurring_transaction_templates`, `recurring_transaction_occurrences` | ✅ Full — offline drafts, shape constraints, audit log |
| Obligations / income sources | `income_sources`, `financial_obligations` | ✅ Full |
| Expected spending events (cultural) | `expected_spending_events` | ✅ Full — Christmas, paluwagan, payday etc. |
| Budget management | `budgets`, `budget_allocations`, `budget_events` | ✅ Full |
| Budget recommendation (solver) | `budget_recommendations`, `budget_recommendation_allocations`, `budget_recommendation_constraints`, `budget_recommendation_events` | ✅ Full — constraints, relaxation steps, explainability fields |
| Forecasting (LSTM) | `forecast_runs`, `forecast_series`, `forecast_points`, `forecast_explanation_drivers` | ✅ Full — cold-start alpha, `actual_amount` for eval |
| Anomaly detection (Isolation Forest) | `anomaly_evaluations`, `anomaly_evaluation_features` | ✅ Full — feature vector, suppression, review status |
| Alerts & notifications | `alerts`, `alert_related_entities`, `alert_events`, `alert_notification_preferences`, `anomaly_whitelist_rules`, `alert_suppression_rules` | ✅ Full — fatigue controls, bundles, snooze |
| Savings goals | `savings_goals`, `savings_goal_contributions`, `savings_goal_progress_snapshots` | ✅ Full |
| Debt management | `debt_accounts`, `debt_payments`, `debt_strategy_preferences`, `debt_repayment_projection_runs`, `debt_repayment_projection_items`, `debt_repayment_projection_points` | ✅ Full — Avalanche/Snowball, payoff timeline points |
| Reports & analytics | `report_runs`, `report_metrics`, `report_category_breakdowns`, `report_budget_comparisons`, `report_forecast_comparisons`, `report_savings_goal_snapshots`, `report_debt_account_snapshots` | ✅ Full |
| Model evaluation (thesis) | `model_evaluation_runs`, `model_evaluation_metrics`, `model_evaluation_artifacts` | ✅ Full — MAE, RMSE, F1, precision/recall all storable |

---

## Scope Assessment — Is It Too Much for a Thesis?

The schema is not excessive, but it is at the upper edge of what one thesis team can fully exercise. Three sub-areas add real tables that may go largely unwritten during evaluation.

| Area | Tables | Assessment |
|---|---|---|
| Core domain | profiles → budgets → transactions → forecasts → alerts → goals → debt | Right-sized. All these tables will be populated by normal app use. |
| Debt projection detail | `debt_repayment_projection_points` | **Marginal.** Useful for a balance-over-time chart, but `projection_runs` + `projection_items` already give payoff dates. Drop it if you are not rendering a monthly balance graph. |
| Savings progress snapshots | `savings_goal_progress_snapshots` | **Marginal.** Useful for a progress graph over time, but a view over contributions gives the same numbers. Keep only if you pre-compute snapshots on a schedule. |
| Report sub-tables | `report_budget_comparisons`, `report_forecast_comparisons`, `report_savings_goal_snapshots`, `report_debt_account_snapshots` | **Possibly premature.** `report_metrics` + `report_category_breakdowns` cover most report views. If reports are generated on-demand from live data, you may never need materialized rows here. |
| Model evaluation tables | `model_evaluation_runs`, `model_evaluation_metrics`, `model_evaluation_artifacts` | **Thesis-required.** ISO 25010 and SUS sections need measurable model outputs. Keep these. |
| Alert suppression machinery | `alert_suppression_rules`, `anomaly_whitelist_rules` | **Keep.** Both are PRD-required and modest in column count. |

---

## Bug Fixes — Constraint Errors (Fix These First)

### Bug 1 — `profiles.birth_year` upper bound

**Problem:** The check allows `birth_year BETWEEN 1900 AND 2100`. A birth year of 2090 passes validation.

```sql
-- Current (wrong)
CONSTRAINT profiles_birth_year_chk
  CHECK (birth_year IS NULL OR birth_year BETWEEN 1900 AND 2100)
```

**Fix:**

```sql
-- Option A: Hard cap appropriate for target demographic
CONSTRAINT profiles_birth_year_chk
  CHECK (birth_year IS NULL OR birth_year BETWEEN 1920 AND 2010)

-- Option B: Dynamic cap (minimum 13-year-old user)
CONSTRAINT profiles_birth_year_chk
  CHECK (
    birth_year IS NULL
    OR (
      birth_year >= 1920
      AND birth_year <= EXTRACT(YEAR FROM now())::integer - 13
    )
  )
```

---

### Bug 2 — `forecast_runs.horizon_days` constraint is a no-op

**Problem:** The `OR horizon_days > 0` branch makes the `IN` list meaningless — any positive integer passes.

```sql
-- Current (wrong)
CONSTRAINT forecast_runs_horizon_days_chk
  CHECK (horizon_days IN (7, 14, 30, 90, 180) OR horizon_days > 0)
```

**Fix — choose one:**

```sql
-- Option A: Enforce the enumerated set strictly
CONSTRAINT forecast_runs_horizon_days_chk
  CHECK (horizon_days IN (7, 14, 30, 90, 180))

-- Option B: Allow any positive value (drop the enumeration)
CONSTRAINT forecast_runs_horizon_days_chk
  CHECK (horizon_days > 0)
```

---

### Bug 3 — `budget_recommendations.budget_period_days` missing semi-monthly

**Problem:** The check uses `IN (7, 14, 30, 90)` but `odin_budget_period_kind` includes `semi_monthly` (~15 days), which is a common Philippine payroll cycle. A semi-monthly budget recommendation will fail this constraint.

```sql
-- Current (wrong)
CONSTRAINT budget_recommendations_budget_period_days_chk
  CHECK (budget_period_days IN (7, 14, 30, 90))
```

**Fix:**

```sql
-- Option A: Add 15 to the allowed set
CONSTRAINT budget_recommendations_budget_period_days_chk
  CHECK (budget_period_days IN (7, 14, 15, 30, 90))

-- Option B: Align with budgets table and allow any positive integer
CONSTRAINT budget_recommendations_budget_period_days_chk
  CHECK (budget_period_days > 0)
```

---

## Column Issues

### Issue 1 — `budgets.budget_period_days` is redundant

**Problem:** Derivable from `period_end - period_start`. Storing it risks drift if dates are updated without recalculating this column.

```sql
-- Option A: Drop the column and compute in application layer
ALTER TABLE budgets DROP COLUMN budget_period_days;

-- Option B: Convert to a generated column (computed automatically, stays in sync)
ALTER TABLE budgets DROP COLUMN budget_period_days;
ALTER TABLE budgets
  ADD COLUMN budget_period_days integer
  GENERATED ALWAYS AS (period_end - period_start) STORED;
```

Note: if you keep a generated column, the `budgets_period_days_chk` constraint becomes redundant and can also be dropped since the value is derived.

---

### Issue 2 — `financial_accounts.current_balance_centavos` sync policy undocumented

**Problem:** This is a denormalized cached balance that must be kept in sync with the `transactions` table. The schema has no trigger or comment documenting how it is updated. This is a valid pattern for performance, but it is a hidden invariant.

**Fix — add a schema comment:**

```sql
COMMENT ON COLUMN financial_accounts.current_balance_centavos IS
  'Cached running balance in centavos. Must be updated atomically with every INSERT/UPDATE/DELETE on transactions where source_account_id or destination_account_id = this account. Do not read directly for reports — sum from transactions for point-in-time accuracy.';
```

If you want to enforce it with a trigger instead:

```sql
CREATE OR REPLACE FUNCTION update_account_balance() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- Recalculate balance for affected accounts after any transaction change.
  -- Income: adds to destination_account. Expense: subtracts from source_account.
  -- Transfer: subtracts from source, adds to destination.
  IF TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND OLD.status = 'posted') THEN
    UPDATE financial_accounts
    SET current_balance_centavos = (
      SELECT COALESCE(SUM(
        CASE
          WHEN transaction_type = 'income'   AND destination_account_id = financial_accounts.id THEN  amount_centavos
          WHEN transaction_type = 'expense'  AND source_account_id      = financial_accounts.id THEN -amount_centavos
          WHEN transaction_type = 'transfer' AND destination_account_id = financial_accounts.id THEN  amount_centavos
          WHEN transaction_type = 'transfer' AND source_account_id      = financial_accounts.id THEN -amount_centavos
          ELSE 0
        END
      ), 0)
      FROM transactions
      WHERE status = 'posted'
        AND (source_account_id = financial_accounts.id OR destination_account_id = financial_accounts.id)
    )
    WHERE id IN (OLD.source_account_id, OLD.destination_account_id);
  END IF;

  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.status = 'posted') THEN
    UPDATE financial_accounts
    SET current_balance_centavos = (
      SELECT COALESCE(SUM(
        CASE
          WHEN transaction_type = 'income'   AND destination_account_id = financial_accounts.id THEN  amount_centavos
          WHEN transaction_type = 'expense'  AND source_account_id      = financial_accounts.id THEN -amount_centavos
          WHEN transaction_type = 'transfer' AND destination_account_id = financial_accounts.id THEN  amount_centavos
          WHEN transaction_type = 'transfer' AND source_account_id      = financial_accounts.id THEN -amount_centavos
          ELSE 0
        END
      ), 0)
      FROM transactions
      WHERE status = 'posted'
        AND (source_account_id = financial_accounts.id OR destination_account_id = financial_accounts.id)
    )
    WHERE id IN (NEW.source_account_id, NEW.destination_account_id);
  END IF;

  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_sync_account_balance
  AFTER INSERT OR UPDATE OR DELETE ON transactions
  FOR EACH ROW EXECUTE FUNCTION update_account_balance();
```

---

## Missing Indices

### Index 1 — `forecast_points`: add leading `forecast_series_id`

**Problem:** The existing `forecast_points_period_idx` on `(period_start, period_end)` alone is weak — the dashboard query fetches all points for a series, not all points in a date range globally.

```sql
CREATE INDEX forecast_points_series_period_idx
  ON forecast_points (forecast_series_id, period_start);
```

The existing `forecast_points_period_idx` can be dropped unless you have a global date-range scan use case:

```sql
DROP INDEX forecast_points_period_idx;
```

---

### Index 2 — `savings_goal_contributions`: add user-level index

**Problem:** The dashboard fetches all contributions for a user across goals. The existing index leads with `savings_goal_id`, which is fine for per-goal queries but forces a full scan when querying by user.

```sql
CREATE INDEX savings_goal_contributions_user_date_idx
  ON savings_goal_contributions (user_id, contribution_date DESC);
```

---

### Index 3 — `report_runs`: add status to the index

**Problem:** The report list screen filters by status (available vs queued) before sorting by date. The existing index on `(user_id, period_start DESC, period_end DESC)` does not help that filter.

```sql
-- Drop existing
DROP INDEX report_runs_user_period_idx;

-- Replace with status-aware index
CREATE INDEX report_runs_user_status_period_idx
  ON report_runs (user_id, status, period_start DESC);
```

---

### Index 4 — `alerts`: add expiry index

**Problem:** A background job that clears expired alerts must scan all user alerts without an index on `expires_at`.

```sql
CREATE INDEX alerts_expiry_idx
  ON alerts (user_id, expires_at)
  WHERE expires_at IS NOT NULL;
```

---

### Index 5 — `transactions`: add partial index for posted status

**Problem:** Most application queries filter to `status = 'posted'` only. Without a partial index, queries scan voided and deleted rows unnecessarily.

```sql
CREATE INDEX transactions_user_date_posted_idx
  ON transactions (user_id, transaction_date DESC)
  WHERE status = 'posted';
```

---

## Notable Good Decisions

- **Centavos as `bigint`** — avoids floating-point rounding errors on financial amounts. Correct.
- **`odin_broad_group` enum** maps exactly to the PRD's four forecast lines (essentials / obligatory / discretionary / financial_allocation). The forecast dashboard multi-line graph and budget allocation both rely on this alignment.
- **`odin_forecast_model_kind`** supports the three-model thesis architecture (lstm, population_fallback, blended) without hardcoding model names in column constraints.
- **`odin_anomaly_feature_key` as an enum** on the feature-level audit table prevents free-text key drift between model versions.
- **`odin_income_frequency` includes `semi_monthly`** — critical for Philippine payroll cycles.
- **Shape constraints on `transactions` and `recurring_transaction_templates`** enforce income/expense/transfer structural rules at the database level, not just in application code.
- **Partial unique index on `financial_profile_assignments (user_id) WHERE is_active = true`** — correctly enforces one active profile per user without blocking historical rows.
- **`forecast_points.actual_amount_centavos`** — storing actuals on the forecast row enables forecast-vs-actual reporting and model evaluation (MAE, RMSE) without a separate join table.
- **Soft deletes with `deleted_at` + status checks** — consistent across all major entities, supports the RA 10173 data deletion flow.
- **`client_mutation_id` on `transactions`** — idempotency key for offline/intermittent connectivity, which the PRD explicitly requires.
- **`personalization_alpha` on `forecast_runs`** — the blending weight between LSTM and population fallback is stored per run, making cold-start vs personalized transitions auditable for the thesis.

---

## Recommended Actions (Priority Order)

| # | Action | Type | Effort |
|---|---|---|---|
| 1 | Fix `profiles.birth_year` upper bound | Bug fix | 1 line |
| 2 | Fix `forecast_runs.horizon_days` constraint | Bug fix | 1 line |
| 3 | Fix `budget_recommendations.budget_period_days` to include 15 or relax | Bug fix | 1 line |
| 4 | Add `(forecast_series_id, period_start)` index on `forecast_points` | New index | 1 line |
| 5 | Add `(user_id, contribution_date DESC)` index on `savings_goal_contributions` | New index | 1 line |
| 6 | Add `(user_id, status, period_start DESC)` index on `report_runs` | Index change | 2 lines |
| 7 | Add `(user_id, expires_at)` partial index on `alerts` | New index | 1 line |
| 8 | Add partial `status = 'posted'` index on `transactions` | New index | 2 lines |
| 9 | Drop or convert `budgets.budget_period_days` to a generated column | Column change | Small migration |
| 10 | Add comment or trigger for `financial_accounts.current_balance_centavos` sync policy | Documentation | 1–50 lines |
| 11 | Defer `debt_repayment_projection_points` and the 4 report sub-tables if timeline is tight | Migration defer | — |