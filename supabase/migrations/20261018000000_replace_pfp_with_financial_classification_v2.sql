-- V2 replaces personality profiles with explainable, data-backed financial condition rules.
CREATE TABLE public.financial_condition_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  assessed_at timestamptz NOT NULL DEFAULT now(),
  rule_set_version text NOT NULL,
  input_snapshot jsonb NOT NULL,
  output_snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX financial_condition_assessments_user_assessed_idx
  ON public.financial_condition_assessments (user_id, assessed_at DESC);

ALTER TABLE public.anomaly_evaluations
  ALTER COLUMN profile_label DROP NOT NULL,
  ALTER COLUMN profile_label TYPE text USING profile_label::text;

ALTER TABLE public.financial_condition_assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY financial_condition_assessments_owner_access
  ON public.financial_condition_assessments
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.submit_onboarding_session_v2(
  p_session_id uuid,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  UPDATE public.onboarding_sessions
  SET status = 'submitted',
      submitted_at = now(),
      review_snapshot = jsonb_build_object('submitted_at', now())
  WHERE id = p_session_id
    AND user_id = p_user_id
    AND status = 'in_progress';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found or not in progress';
  END IF;

  RETURN jsonb_build_object('session_id', p_session_id, 'status', 'submitted');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.submit_onboarding_session_v2(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_onboarding_session_v2(uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.get_financial_classification_v2_input(p_user_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  WITH assessment_window AS (
    SELECT date_trunc('month', current_date)::date - interval '3 months' AS starts_on,
           date_trunc('month', current_date)::date AS ends_on
  ), monthly AS (
    SELECT transaction_type, COALESCE(sum(amount_centavos), 0) AS amount_centavos
    FROM transactions, assessment_window
    WHERE user_id = p_user_id
      AND status = 'posted'
      AND deleted_at IS NULL
      AND transaction_date >= assessment_window.starts_on
      AND transaction_date < assessment_window.ends_on
      AND transaction_type IN ('income', 'expense')
    GROUP BY transaction_type
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
    'average_monthly_recurring_essential_expenses', COALESCE((SELECT amount_centavos FROM monthly WHERE transaction_type = 'expense'), 0)::numeric / 300,
    'monthly_disposable_income', COALESCE((SELECT amount_centavos FROM monthly WHERE transaction_type = 'income'), 0)::numeric / 300,
    'required_monthly_debt_payments', (SELECT amount_centavos FROM debt)::numeric / 100,
    'monthly_basic_living_costs', COALESCE((SELECT amount_centavos FROM monthly WHERE transaction_type = 'expense'), 0)::numeric / 300,
    'credit_card_accounts', '[]'::jsonb
  );
$$;

REVOKE EXECUTE ON FUNCTION public.get_financial_classification_v2_input(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_financial_classification_v2_input(uuid) TO service_role;
