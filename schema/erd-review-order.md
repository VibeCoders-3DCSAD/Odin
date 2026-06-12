# ERD Review Order

Use this order when reviewing `erd-create-tables.sql`. It starts with root tables, then moves into tables that depend on them, and ends with snapshots, reports, and model-evaluation outputs.

For each table, check these in order:

1. Primary key
2. Required fields
3. Foreign keys
4. Unique constraints
5. Check constraints
6. Snapshot, derived, or `jsonb` fields

## 0. External References And Enums

- [x] `auth.users`
  - External Supabase/Auth table referenced by `profiles.user_id`.
- [ ] enum types
  - Check the `odin_*` enum definitions before reviewing table constraints.

## 1. User Identity And Account Governance

- [x] `profiles`
  - Root app-owned user table.
  - Depends on: `auth.users`.
- [x] `user_privacy_settings`
  - One privacy-settings row per user.
  - Depends on: `profiles`.
- [x] `user_consents`
  - Consent history for terms, privacy, model training, research, etc.
  - Depends on: `profiles`.
- [x] `data_export_requests`
  - User data export request lifecycle.
  - Depends on: `profiles`.
- [x] `account_deletion_requests`
  - User account deletion request lifecycle.
  - Depends on: `profiles`.

## 2. Onboarding And Financial Profile

- [x] `onboarding_sessions`
  - One onboarding attempt for a user.
  - Depends on: `profiles`.
- [x] `onboarding_responses`
  - Per-question answers within an onboarding session.
  - Depends on: `onboarding_sessions`.
- [x] `financial_profile_assessments`
  - Model assessment output for a user or onboarding session.
  - Depends on: `profiles`, `onboarding_sessions`.
- [x] `financial_profile_explanation_drivers`
  - Explanation rows for a financial profile assessment.
  - Depends on: `financial_profile_assessments`.
- [x] `financial_profile_assignments`
  - Actual profile label assigned to the user.
  - Depends on: `profiles`, `financial_profile_assessments`.
- [x] `financial_profile_events`
  - Audit/event log for profile assessment and assignment actions.
  - Depends on: `profiles`, `financial_profile_assessments`, `financial_profile_assignments`.

## 3. Category Taxonomy

- [x] `categories`
  - Broad budget buckets such as Essentials, Obligatory, Discretionary, and Financial Allocation.
  - Depends on: nothing inside the app schema.
- [x] `subcategories`
  - Specific categories used by transactions, budgets, forecasts, reports, and alerts.
  - Contains both seeded system categories and user-created categories.
  - Depends on: `category_groups`, `profiles` for user-created rows.

## 4. Income Sources And Accounts

- [x] `income_sources`
  - Expected income sources and pay schedules.
  - Depends on: `profiles`.
- [x] `financial_accounts`
  - User-owned cash, bank, wallet, credit, or other financial accounts.
  - Depends on: `profiles`.

## 5. Transactions, Recurring Rules, And Obligations

- [x] `recurring_transaction_templates`
  - Rule/template for generating repeated income, expense, or transfer records.
  - Depends on: `profiles`, `categories`, `financial_accounts`.
- [x] `financial_obligations`
  - Recurring required obligations such as bills, debt payments, or support.
  - Depends on: `profiles`, `categories`, `recurring_transaction_templates`.
- [x] `transactions`
  - Posted or tracked money movements.
  - Depends on: `profiles`, `categories`, `financial_accounts`, `recurring_transaction_templates`.
- [x] `transaction_events`
  - Audit/event log for transaction changes.
  - Depends on: `transactions`, `profiles`.
- [x] `transaction_drafts`
  - Offline or pending transaction payloads before sync/posting.
  - Depends on: `profiles`, `transactions`.
- [x] `recurring_transaction_occurrences`
  - Scheduled/generated occurrences from recurring templates.
  - Depends on: `recurring_transaction_templates`, `profiles`, `transactions`.
- [x] `expected_spending_events`
  - Calendar-like expected events that affect forecasts or anomaly suppression.
  - Depends on: `profiles`, `category_groups`, `categories`.

## 6. Budgets

- [x] `budgets`
  - Budget header for a period.
  - Depends on: `profiles`.
- [x] `budget_allocations`
  - Category-group or specific-category allocation lines within a budget.
  - Depends on: `budgets`, `category_groups`, `categories`.
- [x] `budget_events`
  - Audit/event log for budget actions.
  - Depends on: `budgets`, `profiles`.

## 7. Savings Goals

- [x] `savings_goals`
  - User savings targets and current progress state.
  - Depends on: `profiles`, `financial_accounts`.
- [x] `savings_goal_allocation_preferences`
  - User preference for Snowball or Avalanche savings allocation.
  - Depends on: `profiles`.
- [x] `savings_goal_contributions`
  - Contributions toward a savings goal.
  - Depends on: `savings_goals`, `profiles`, `transactions`.
- [x] `savings_goal_budget_allocations`
  - Accepted budget Financial Allocation distribution across active savings goals.
  - Depends on: `budget_allocations`, `savings_goals`.
- [x] `savings_goal_progress_snapshots` **Deprecated, not needed**
  - Dated snapshots of savings-goal progress.
  - Depends on: `savings_goals`.

## 8. Debt Management

- [x] `debt_accounts`
  - Debt balances and payment terms.
  - Depends on: `profiles`, `financial_accounts`.
- [x] `debt_payments`
  - Payments against debt accounts.
  - Depends on: `debt_accounts`, `profiles`, `transactions`.
- [x] `debt_strategy_preferences`
  - User preference for debt payoff strategy.
  - Depends on: `profiles`.
- [x] `debt_repayment_projection_runs`
  - Header for generated debt payoff projections.
  - Depends on: `profiles`.
- [x] `debt_repayment_projection_items`
  - Per-debt-account results inside a projection run.
  - Depends on: `debt_repayment_projection_runs`, `debt_accounts`.
- [x] `debt_repayment_projection_points`
  - Period-by-period balance/payment points for a projection item.
  - Depends on: `debt_repayment_projection_items`.

## 9. Forecasting

- [x] `forecast_runs`
  - Header for generated spending, savings, or debt forecasts.
  - Depends on: `profiles`.
- [x] `forecast_series`
  - One forecasted series within a run.
  - Depends on: `forecast_runs`, `category_groups`, `categories`.
- [x] `forecast_points`
  - Period-by-period forecast values.
  - Depends on: `forecast_series`.
- [x] `forecast_explanation_drivers`
  - Explanation rows for forecast series.
  - Depends on: `forecast_series`.

## 10. Budget Recommendations

- [x] `budget_recommendations`
  - Generated recommended budget for a user and period.
  - Depends on: `profiles`, `forecast_runs`, `budgets`.
- [x] `budget_recommendation_allocations`
  - Recommended allocation lines.
  - Depends on: `budget_recommendations`, `category_groups`, `categories`.
- [x] `savings_goal_recommendation_allocations`
  - Recommended Financial Allocation distribution across active savings goals.
  - Depends on: `budget_recommendations`, `budget_recommendation_allocations`, `savings_goals`.
- [x] `budget_recommendation_constraints`
  - Constraints used by the recommendation solver.
  - Depends on: `budget_recommendations`, `category_groups`, `categories`.
- [x] `budget_recommendation_events`
  - Audit/event log for recommendation actions.
  - Depends on: `budget_recommendations`, `profiles`.

## 11. Anomaly Detection

- [x] `anomaly_evaluations`
  - Model output for transaction anomaly detection.
  - Depends on: `profiles`, `transactions`, `category_groups`, `categories`.
- [x] `anomaly_evaluation_features`
  - Feature-level anomaly details.
  - Depends on: `anomaly_evaluations`.

## 12. Alerts And Suppression

- [x] `alerts`
  - User-facing alerts with optional links into many domain tables.
  - Depends on: `profiles`, `transactions`, `categories`, `budgets`, `debt_accounts`, `savings_goals`, `forecast_runs`, `budget_recommendations`, `anomaly_evaluations`, itself through `parent_alert_id`.
- [x] `alert_related_entities`
  - Generic related-entity list for an alert.
  - Depends on: `alerts`.
- [x] `alert_events`
  - Audit/event log for alert actions.
  - Depends on: `alerts`, `profiles`.
- [x] `alert_notification_preferences`
  - User preference by alert category.
  - Depends on: `profiles`.
- [x] `anomaly_whitelist_rules`
  - User-created rules for expected anomaly patterns.
  - Depends on: `profiles`, `alerts`, `anomaly_evaluations`, `categories`.
- [x] `alert_suppression_rules`
  - General alert suppression rules.
  - Depends on: `profiles`, `alerts`, `category_groups`, `categories`.

## 13. Reports

- [x] `report_runs`
  - Header for generated reports.
  - Depends on: `profiles`.
- [x] `report_metrics`
  - Summary metrics within a report.
  - Depends on: `report_runs`.
- [x] `report_category_breakdowns`
  - Category-group or specific-category report breakdowns.
  - Depends on: `report_runs`, `category_groups`, `categories`.
- [x] `report_budget_comparisons`
  - Budget-vs-actual report rows.
  - Depends on: `report_runs`, `budgets`, `budget_allocations`, `category_groups`, `categories`.
- [x] `report_forecast_comparisons`
  - Forecast-vs-actual report rows.
  - Depends on: `report_runs`, `forecast_runs`, `forecast_series`, `category_groups`, `categories`.
- [x] `report_savings_goal_snapshots`
  - Report-time savings-goal snapshots.
  - Depends on: `report_runs`, `savings_goals`.
- [x] `report_debt_account_snapshots`
  - Report-time debt-account snapshots.
  - Depends on: `report_runs`, `debt_accounts`.

## 14. Model Evaluation

- [x] `model_evaluation_runs`
  - Header for model evaluation jobs.
  - Depends on: `profiles` optionally.
- [x] `model_evaluation_metrics`
  - Metrics for a model evaluation run.
  - Depends on: `model_evaluation_runs`.
- [x] `model_evaluation_artifacts`
  - Stored outputs or content for a model evaluation run.
  - Depends on: `model_evaluation_runs`.

## Relationship Review Tips

- Start every section by identifying the parent table.
- Follow required foreign keys before optional foreign keys.
- Treat `jsonb` fields as flexible payloads or snapshots, not as normal relational children.
- Treat columns named `*_snapshot`, `current_*`, `total_*`, `actual_*`, `predicted_*`, or `projected_*` as likely derived or historical values.
- For self-referencing tables, check the base row first, then the parent-child relationship.
- For event tables, review the table they audit first, then the event table.
