-- Classification V2 consumes declared essential living costs and verified balances;
-- it must not infer a favourable result from all spending or missing card history.
CREATE OR REPLACE FUNCTION public.get_financial_classification_v2_input(p_user_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  WITH income AS (
    SELECT COALESCE(sum(CASE frequency
      WHEN 'weekly' THEN expected_amount_centavos * 52.0 / 12
      WHEN 'biweekly' THEN expected_amount_centavos * 26.0 / 12
      WHEN 'semi_monthly' THEN expected_amount_centavos * 2
      WHEN 'monthly' THEN expected_amount_centavos
      ELSE 0 END), 0) AS amount_centavos,
      max(updated_at) AS updated_at
    FROM income_sources
    WHERE user_id = p_user_id AND is_active = true AND deleted = false
      AND expected_amount_centavos IS NOT NULL
  ), essential_costs AS (
    SELECT NULLIF(raw_answers->>'monthly_essential_living_costs', '')::numeric * 100 AS amount_centavos,
      submitted_at AS updated_at
    FROM onboarding_sessions
    WHERE user_id = p_user_id AND status = 'submitted'
      AND COALESCE(raw_answers->>'monthly_essential_living_costs', '') ~ '^[0-9]+$'
    ORDER BY submitted_at DESC
    LIMIT 1
  ), emergency_fund AS (
    SELECT current_amount_centavos, updated_at
    FROM savings_goals
    WHERE user_id = p_user_id AND goal_type = 'emergency_fund'
      AND status = 'active' AND deleted = false
    ORDER BY updated_at DESC
    LIMIT 1
  ), debt AS (
    SELECT COALESCE(sum(minimum_payment_centavos), 0) AS amount_centavos,
      max(updated_at) AS updated_at
    FROM debt_accounts
    WHERE user_id = p_user_id AND status = 'active' AND deleted = false
  ), card_cycles AS (
    SELECT c.account_id, s.statement_date AS completed_on,
      s.statement_balance_centavos AS revolving_balance_centavos
    FROM credit_card_cycles c
    JOIN credit_card_statements s ON s.cycle_id = c.id
      AND s.user_id = p_user_id AND s.authoritative = true AND s.deleted = false
    WHERE c.user_id = p_user_id AND c.deleted = false AND s.statement_date IS NOT NULL
  ), cards AS (
    SELECT account_id,
      jsonb_agg(jsonb_build_object('completed_on', completed_on, 'revolving_balance', revolving_balance_centavos / 100.0) ORDER BY completed_on DESC) AS cycles
    FROM (
      SELECT *, row_number() OVER (PARTITION BY account_id ORDER BY completed_on DESC) AS row_number
      FROM card_cycles
    ) ranked
    WHERE row_number <= 12
    GROUP BY account_id
  ), source_updates AS (
    SELECT updated_at FROM income
    UNION ALL SELECT updated_at FROM essential_costs
    UNION ALL SELECT updated_at FROM emergency_fund
    UNION ALL SELECT updated_at FROM debt
  )
  SELECT jsonb_build_object(
    'liquid_emergency_savings', (SELECT current_amount_centavos FROM emergency_fund)::numeric / 100,
    'average_monthly_recurring_essential_expenses', (SELECT amount_centavos FROM essential_costs)::numeric / 100,
    'monthly_disposable_income', (SELECT amount_centavos FROM income)::numeric / 100,
    'required_monthly_debt_payments', (SELECT amount_centavos FROM debt)::numeric / 100,
    'monthly_basic_living_costs', (SELECT amount_centavos FROM essential_costs)::numeric / 100,
    'credit_card_accounts', COALESCE((SELECT jsonb_agg(jsonb_build_object('account_id', account_id, 'cycles', cycles)) FROM cards), '[]'::jsonb),
    'source_updated_at', (SELECT max(updated_at) FROM source_updates)
  );
$$;
