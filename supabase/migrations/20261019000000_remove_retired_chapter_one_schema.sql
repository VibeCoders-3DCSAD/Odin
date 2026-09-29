-- Retire storage and database routines that do not support Chapter 1 features.
-- This migration runs after the financial-condition classification replacement.

ALTER TABLE public.alerts
  DROP COLUMN IF EXISTS forecast_run_id,
  DROP COLUMN IF EXISTS budget_recommendation_id;

ALTER TABLE public.budgets
  DROP COLUMN IF EXISTS source_recommendation_id,
  DROP COLUMN IF EXISTS forecast_run_id;

DROP FUNCTION IF EXISTS public.confirm_profile_assignment(uuid, uuid);
DROP FUNCTION IF EXISTS public.reject_profile_assignment(uuid, uuid, text);
DROP FUNCTION IF EXISTS public.request_profile_reassessment(uuid, text, jsonb);
DROP FUNCTION IF EXISTS public.select_profile_assignment(uuid, text, boolean);
DROP FUNCTION IF EXISTS public.submit_onboarding_session_with_classification(
  uuid,
  uuid,
  public.odin_financial_profile_label,
  numeric,
  text,
  text
);

DROP TABLE IF EXISTS public.report_forecast_comparisons;
DROP TABLE IF EXISTS public.report_budget_comparisons;
DROP TABLE IF EXISTS public.report_category_breakdowns;
DROP TABLE IF EXISTS public.report_savings_goal_snapshots;
DROP TABLE IF EXISTS public.report_debt_account_snapshots;
DROP TABLE IF EXISTS public.report_metrics;
DROP TABLE IF EXISTS public.report_runs;

DROP TABLE IF EXISTS public.savings_goal_recommendation_allocations;
DROP TABLE IF EXISTS public.budget_recommendation_events;
DROP TABLE IF EXISTS public.budget_recommendation_constraints;
DROP TABLE IF EXISTS public.budget_recommendation_allocations;
DROP TABLE IF EXISTS public.budget_recommendations;

DROP TABLE IF EXISTS public.forecast_explanation_drivers;
DROP TABLE IF EXISTS public.forecast_points;
DROP TABLE IF EXISTS public.forecast_series;
DROP TABLE IF EXISTS public.forecast_runs;

DROP TABLE IF EXISTS public.savings_goal_budget_allocations;
DROP TABLE IF EXISTS public.savings_goal_progress_snapshots;
DROP TABLE IF EXISTS public.savings_goal_contributions;
DROP TABLE IF EXISTS public.savings_goal_allocation_preferences;

DROP TABLE IF EXISTS public.debt_repayment_projection_points;
DROP TABLE IF EXISTS public.debt_repayment_projection_items;
DROP TABLE IF EXISTS public.debt_repayment_projection_runs;
DROP TABLE IF EXISTS public.debt_hardship_plan_events;
DROP TABLE IF EXISTS public.debt_hardship_plans;

DROP TABLE IF EXISTS public.budget_strategy_rules;
DROP TABLE IF EXISTS public.budget_strategy_configs;
DROP TABLE IF EXISTS public.budget_health_snapshots;
DROP TABLE IF EXISTS public.user_subcategory_restrictions;
DROP TABLE IF EXISTS public.user_category_restrictions;
DROP TABLE IF EXISTS public.expected_spending_events;
DROP TABLE IF EXISTS public.budget_events;

DROP TABLE IF EXISTS public.transaction_line_items;
DROP TABLE IF EXISTS public.transaction_templates;
DROP TABLE IF EXISTS public.transaction_events;
DROP TABLE IF EXISTS public.transaction_retention_events;
DROP TABLE IF EXISTS public.user_transaction_retention_settings;

DROP TABLE IF EXISTS public.credit_card_credit_applications;
DROP TABLE IF EXISTS public.problem_reports;

DROP TABLE IF EXISTS public.financial_profile_explanation_drivers;
DROP TABLE IF EXISTS public.financial_profile_events;
DROP TABLE IF EXISTS public.financial_profile_reclassification_schedules;
DROP TABLE IF EXISTS public.financial_profile_assignments;
DROP TABLE IF EXISTS public.financial_profile_assessments;

DROP TYPE IF EXISTS public.odin_budget_constraint_type;
DROP TYPE IF EXISTS public.odin_debt_hardship_action;
DROP TYPE IF EXISTS public.odin_debt_hardship_status;
DROP TYPE IF EXISTS public.odin_expected_event_kind;
DROP TYPE IF EXISTS public.odin_expected_event_status;
DROP TYPE IF EXISTS public.odin_financial_profile_label;
DROP TYPE IF EXISTS public.odin_forecast_granularity;
DROP TYPE IF EXISTS public.odin_forecast_model_kind;
DROP TYPE IF EXISTS public.odin_forecast_status;
DROP TYPE IF EXISTS public.odin_forecast_target;
DROP TYPE IF EXISTS public.odin_profile_assessment_method;
DROP TYPE IF EXISTS public.odin_profile_assessment_status;
DROP TYPE IF EXISTS public.odin_profile_event_action;
DROP TYPE IF EXISTS public.odin_profile_reclassification_status;
DROP TYPE IF EXISTS public.odin_recommendation_action;
DROP TYPE IF EXISTS public.odin_recommendation_status;
DROP TYPE IF EXISTS public.odin_report_kind;
DROP TYPE IF EXISTS public.odin_report_status;
DROP TYPE IF EXISTS public.odin_restriction_level;
DROP TYPE IF EXISTS public.odin_savings_allocation_strategy;
DROP TYPE IF EXISTS public.odin_transaction_retention_action;
DROP TYPE IF EXISTS public.odin_transaction_template_status;
