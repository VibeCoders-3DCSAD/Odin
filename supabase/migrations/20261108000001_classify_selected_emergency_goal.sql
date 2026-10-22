-- Use the explicitly selected emergency-fund goal, regardless of its display/category type.
CREATE OR REPLACE FUNCTION public.get_financial_classification_v2_input(p_user_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  WITH income AS (
    SELECT COALESCE(sum(CASE frequency
      WHEN 'daily' THEN expected_amount_centavos * 365.0 / 12
      WHEN 'weekly' THEN expected_amount_centavos * 52.0 / 12
      WHEN 'semi_monthly' THEN expected_amount_centavos * 2
      WHEN 'monthly' THEN expected_amount_centavos
      END), 0) AS amount_centavos,
      max(updated_at) AS updated_at
    FROM income_sources
    WHERE user_id = p_user_id AND is_active = true AND deleted = false
  ), essential_costs AS (
    SELECT NULLIF(raw_answers->>'monthly_essential_living_costs', '')::numeric * 100 AS amount_centavos,
      submitted_at AS updated_at
    FROM onboarding_sessions
    WHERE user_id = p_user_id AND status = 'submitted'
      AND COALESCE(raw_answers->>'monthly_essential_living_costs', '') ~ '^[0-9]+$'
    ORDER BY submitted_at DESC
    LIMIT 1
  ), emergency_fund AS (
    SELECT g.starting_amount_centavos
      + COALESCE(sum(CASE WHEN a.activity_kind = 'contribution' THEN a.amount_centavos ELSE -a.amount_centavos END), 0) AS current_amount_centavos,
      greatest(g.updated_at, max(a.updated_at)) AS updated_at
    FROM savings_goals g
    LEFT JOIN savings_goal_activities a
      ON a.savings_goal_id = g.id AND a.user_id = g.user_id AND a.deleted = false
    WHERE g.user_id = p_user_id AND g.is_emergency_fund = true
      AND g.status = 'active' AND g.deleted = false
    GROUP BY g.id, g.starting_amount_centavos, g.updated_at
    LIMIT 1
  ), debt AS (
    SELECT COALESCE(sum(minimum_payment_centavos), 0) AS amount_centavos,
      max(updated_at) AS updated_at
    FROM debt_accounts
    WHERE user_id = p_user_id AND status = 'active' AND deleted = false
  ), card_cycles AS (
    SELECT c.account_id, s.statement_date AS completed_on,
      s.statement_balance_centavos AS revolving_balance_centavos,
      greatest(c.updated_at, s.updated_at) AS updated_at
    FROM credit_card_cycles c
    JOIN credit_card_statements s ON s.cycle_id = c.id
      AND s.user_id = p_user_id AND s.authoritative = true AND s.deleted = false
    WHERE c.user_id = p_user_id AND c.deleted = false AND s.statement_date IS NOT NULL
  ), cards AS (
    SELECT account_id,
      jsonb_agg(jsonb_build_object('completed_on', completed_on, 'revolving_balance', revolving_balance_centavos / 100.0) ORDER BY completed_on DESC) AS cycles,
      max(updated_at) AS updated_at
    FROM (
      SELECT *, row_number() OVER (PARTITION BY account_id ORDER BY completed_on DESC) AS row_number
      FROM card_cycles
    ) ranked
    WHERE row_number <= 12
    GROUP BY account_id
  ), latest_card_statements AS (
    SELECT id, account_id, minimum_due_centavos, statement_balance_centavos, statement_updated_at, cycle_updated_at
    FROM (
      SELECT s.id, c.account_id, s.minimum_due_centavos, s.statement_balance_centavos,
        s.updated_at AS statement_updated_at, c.updated_at AS cycle_updated_at,
        row_number() OVER (PARTITION BY c.account_id ORDER BY s.statement_date DESC, s.updated_at DESC) AS row_number
      FROM credit_card_statements s
      JOIN credit_card_cycles c ON c.id = s.cycle_id
        AND c.user_id = p_user_id AND c.deleted = false
      WHERE s.user_id = p_user_id AND s.authoritative = true AND s.deleted = false
    ) ranked
    WHERE row_number = 1
  ), card_payments AS (
    SELECT statement_id, COALESCE(sum(amount_centavos), 0) AS paid_centavos,
      max(updated_at) AS updated_at
    FROM credit_card_payments
    WHERE user_id = p_user_id AND deleted = false AND statement_id IS NOT NULL
    GROUP BY statement_id
  ), card_debt AS (
    SELECT COALESCE(sum(greatest(statement.minimum_due_centavos - COALESCE(payment.paid_centavos, 0), 0)), 0) AS amount_centavos,
      max(greatest(statement.statement_updated_at, statement.cycle_updated_at, COALESCE(payment.updated_at, statement.statement_updated_at))) AS updated_at
    FROM latest_card_statements statement
    LEFT JOIN card_payments payment ON payment.statement_id = statement.id
  ), source_updates AS (
    SELECT updated_at FROM income
    UNION ALL SELECT updated_at FROM essential_costs
    UNION ALL SELECT updated_at FROM emergency_fund
    UNION ALL SELECT updated_at FROM debt
    UNION ALL SELECT updated_at FROM cards
    UNION ALL SELECT updated_at FROM card_debt
  )
  SELECT jsonb_build_object(
    'liquid_emergency_savings', (SELECT current_amount_centavos FROM emergency_fund)::numeric / 100,
    'average_monthly_recurring_essential_expenses', (SELECT amount_centavos FROM essential_costs)::numeric / 100,
    'monthly_disposable_income', (SELECT amount_centavos FROM income)::numeric / 100,
    'required_monthly_debt_payments', ((SELECT amount_centavos FROM debt) + (SELECT amount_centavos FROM card_debt))::numeric / 100,
    'monthly_basic_living_costs', (SELECT amount_centavos FROM essential_costs)::numeric / 100,
    'credit_card_accounts', COALESCE((SELECT jsonb_agg(jsonb_build_object('account_id', account_id, 'cycles', cycles)) FROM cards), '[]'::jsonb),
    'classification_as_of', current_date,
    'source_updated_at', (SELECT max(updated_at) FROM source_updates)
  );
$$;
