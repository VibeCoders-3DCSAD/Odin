-- Use configured income sources as the monthly disposable-income contract.
CREATE OR REPLACE FUNCTION public.get_financial_classification_v2_input(p_user_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  WITH assessment_window AS (
    SELECT date_trunc('month', current_date)::date - interval '3 months' AS starts_on,
           date_trunc('month', current_date)::date AS ends_on
  ), expenses AS (
    SELECT COALESCE(sum(amount_centavos), 0) AS amount_centavos
    FROM transactions, assessment_window
    WHERE user_id = p_user_id
      AND status = 'posted'
      AND deleted_at IS NULL
      AND transaction_date >= assessment_window.starts_on
      AND transaction_date < assessment_window.ends_on
      AND transaction_type = 'expense'
  ), income AS (
    SELECT COALESCE(sum(
      CASE frequency
        WHEN 'weekly' THEN expected_amount_centavos * 52.0 / 12
        WHEN 'biweekly' THEN expected_amount_centavos * 26.0 / 12
        WHEN 'semi_monthly' THEN expected_amount_centavos * 2
        WHEN 'monthly' THEN expected_amount_centavos
        ELSE 0
      END
    ), 0) AS amount_centavos
    FROM income_sources
    WHERE user_id = p_user_id
      AND is_active = true
      AND deleted = false
      AND expected_amount_centavos IS NOT NULL
  ), emergency_fund AS (
    SELECT starting_amount_centavos
    FROM savings_goals
    WHERE user_id = p_user_id
      AND goal_type = 'emergency_fund'
      AND status = 'active'
      AND deleted = false
    ORDER BY updated_at DESC
    LIMIT 1
  ), debt AS (
    SELECT COALESCE(sum(minimum_payment_centavos), 0) AS amount_centavos
    FROM debt_accounts
    WHERE user_id = p_user_id
      AND status = 'active'
      AND deleted_at IS NULL
  )
  SELECT jsonb_build_object(
    'liquid_emergency_savings', (SELECT starting_amount_centavos FROM emergency_fund)::numeric / 100,
    'average_monthly_recurring_essential_expenses', (SELECT amount_centavos FROM expenses)::numeric / 300,
    'monthly_disposable_income', (SELECT amount_centavos FROM income)::numeric / 100,
    'required_monthly_debt_payments', (SELECT amount_centavos FROM debt)::numeric / 100,
    'monthly_basic_living_costs', (SELECT amount_centavos FROM expenses)::numeric / 300,
    'credit_card_accounts', '[]'::jsonb
  );
$$;
