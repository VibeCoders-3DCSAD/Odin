ALTER TABLE public.savings_goals
  ADD COLUMN is_emergency_fund boolean NOT NULL DEFAULT false;

WITH ranked_goals AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY user_id
           ORDER BY updated_at DESC, created_at DESC
         ) AS goal_rank
  FROM public.savings_goals
  WHERE goal_type = 'emergency_fund'
    AND deleted = false
)
UPDATE public.savings_goals AS goals
SET is_emergency_fund = true
FROM ranked_goals
WHERE goals.id = ranked_goals.id
  AND ranked_goals.goal_rank = 1;

CREATE UNIQUE INDEX savings_goals_one_emergency_fund_idx
  ON public.savings_goals (user_id)
  WHERE is_emergency_fund = true AND deleted = false;

CREATE OR REPLACE FUNCTION public.get_financial_classification_v2_input(p_user_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  WITH assessment_window AS (
    SELECT date_trunc('month', current_date)::date - interval '3 months' AS starts_on,
           date_trunc('month', current_date)::date AS ends_on
  ),
  income AS (
    SELECT COALESCE(sum(expected_amount_centavos), 0) AS amount_centavos
    FROM income_sources
    WHERE user_id = p_user_id AND is_active = true AND deleted = false
  ),
  expenses AS (
    SELECT COALESCE(sum(amount_centavos), 0) AS amount_centavos
    FROM transactions, assessment_window
    WHERE transactions.user_id = p_user_id
      AND transaction_type = 'expense' AND status = 'posted' AND deleted = false
      AND transaction_date >= starts_on AND transaction_date < ends_on
  ),
  debt AS (
    SELECT COALESCE(sum(minimum_payment_centavos), 0) AS amount_centavos
    FROM debt_accounts
    WHERE user_id = p_user_id AND status = 'active' AND deleted_at IS NULL
  ),
  emergency_fund AS (
    SELECT current_amount_centavos
    FROM savings_goals
    WHERE user_id = p_user_id AND is_emergency_fund = true
      AND status = 'active' AND deleted = false
    LIMIT 1
  )
  SELECT jsonb_build_object(
    'liquid_emergency_savings', (SELECT current_amount_centavos FROM emergency_fund)::numeric / 100,
    'average_monthly_recurring_essential_expenses', (SELECT amount_centavos FROM expenses)::numeric / 300,
    'monthly_disposable_income', (SELECT amount_centavos FROM income)::numeric / 100,
    'required_monthly_debt_payments', (SELECT amount_centavos FROM debt)::numeric / 100,
    'monthly_basic_living_costs', (SELECT amount_centavos FROM expenses)::numeric / 300,
    'credit_card_accounts', '[]'::jsonb
  );
$$;

REVOKE EXECUTE ON FUNCTION public.get_financial_classification_v2_input(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_financial_classification_v2_input(uuid) TO service_role;
