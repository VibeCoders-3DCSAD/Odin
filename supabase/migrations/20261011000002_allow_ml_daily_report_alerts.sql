-- Daily reports use their own evaluation rows, rather than the legacy
-- isolation-forest and overspending evaluation tables.
ALTER TABLE alerts DROP CONSTRAINT IF EXISTS alerts_category_source_chk;
ALTER TABLE alerts ADD CONSTRAINT alerts_category_source_chk CHECK (
  (category = 'anomaly_detection' AND source_type IN ('isolation_forest', 'experimental_model'))
  OR (category = 'budget_overspending' AND source_type IN ('budget_overspending_rule', 'experimental_model'))
  OR (category = 'forecast_advisory' AND source_type = 'forecast_advisory_rule')
  OR (category = 'savings_milestone' AND source_type = 'savings_goal_rule')
  OR (category = 'debt_management' AND source_type = 'debt_rule')
  OR source_type = 'system'
);

ALTER TABLE alerts DROP CONSTRAINT IF EXISTS alerts_budget_overspending_source_chk;
ALTER TABLE alerts ADD CONSTRAINT alerts_budget_overspending_source_chk CHECK (
  category <> 'budget_overspending'
  OR overspending_evaluation_id IS NOT NULL
  OR daily_report_evaluation_id IS NOT NULL
);
