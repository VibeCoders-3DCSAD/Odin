CREATE OR REPLACE FUNCTION submit_onboarding_session(
  p_session_id uuid,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_session_id uuid;
  v_eligibility_id uuid;
  v_eligibility_confirmed_at timestamptz;
  v_raw_answers jsonb;
  v_income_type text;
  v_income_type_label odin_income_type;
  v_monthly_income numeric;
  v_monthly_obligations numeric;
  v_has_dependents boolean;
  v_obligation_load_bps integer;
  v_confidence_score numeric;
  v_profile_label odin_financial_profile_label;
  v_explanation_summary text;
  v_input_snapshot jsonb;
  v_output_snapshot jsonb;
  v_drivers jsonb;
  v_review_snapshot jsonb;
  v_assessment_id uuid;
  v_assignment_id uuid;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT id INTO v_session_id
  FROM onboarding_sessions
  WHERE id = p_session_id AND user_id = p_user_id AND status = 'in_progress'
  FOR UPDATE;

  IF v_session_id IS NULL THEN
    RAISE EXCEPTION 'Session not found or not in progress';
  END IF;

  SELECT user_id, eligibility_confirmed_at INTO v_eligibility_id, v_eligibility_confirmed_at
  FROM user_eligibility_profiles
  WHERE user_id = p_user_id;

  IF v_eligibility_id IS NULL OR v_eligibility_confirmed_at IS NULL THEN
    RAISE EXCEPTION 'Eligibility profile incomplete';
  END IF;

  SELECT raw_answers INTO v_raw_answers
  FROM onboarding_sessions
  WHERE id = p_session_id;

  v_income_type := v_raw_answers ->> 'income_type';
  v_monthly_income := COALESCE(NULLIF(v_raw_answers ->> 'monthly_income', '')::numeric, 0);
  v_monthly_obligations := COALESCE(NULLIF(v_raw_answers ->> 'monthly_obligations', '')::numeric, 0);
  v_has_dependents := COALESCE((v_raw_answers ->> 'has_dependents')::boolean, false);

  IF v_income_type = 'stable' THEN
    v_income_type_label := 'stable';
    v_input_snapshot := jsonb_build_object('income_type', 'stable');
    v_drivers := jsonb_build_array(jsonb_build_object(
      'driver_key', 'income_type',
      'driver_label', 'Income Type',
      'value_text', 'Stable',
      'impact_label', 'primary',
      'explanation', 'Your income source is stable — regular salary with predictable monthly earnings.',
      'sort_order', 1
    ));
  ELSE
    v_income_type_label := 'variable';
    v_input_snapshot := jsonb_build_object('income_type', CASE WHEN v_income_type = 'variable' THEN 'variable' ELSE 'unknown_fallback' END);
    v_drivers := jsonb_build_array(jsonb_build_object(
      'driver_key', 'income_type',
      'driver_label', 'Income Type',
      'value_text', CASE WHEN v_income_type = 'variable' THEN 'Variable' ELSE 'Unknown' END,
      'impact_label', 'primary',
      'explanation', CASE WHEN v_income_type = 'variable'
        THEN 'Your income source is variable — freelance, commission, or irregular earnings.'
        ELSE 'Income type was not explicitly provided; defaulted to variable.' END,
      'sort_order', 1
    ));
  END IF;

  IF v_monthly_income > 0 AND v_monthly_obligations >= 0 THEN
    v_obligation_load_bps := round((v_monthly_obligations / v_monthly_income) * 10000)::integer;
    v_input_snapshot := v_input_snapshot || jsonb_build_object(
      'monthly_income', v_monthly_income,
      'monthly_obligations', v_monthly_obligations,
      'obligation_load_bps', v_obligation_load_bps
    );

    IF v_obligation_load_bps >= 3000 THEN
      v_drivers := v_drivers || jsonb_build_array(jsonb_build_object(
        'driver_key', 'obligation_load',
        'driver_label', 'Obligation Load',
        'value_text', round(v_obligation_load_bps / 100)::text || '%',
        'impact_label', 'primary',
        'explanation', 'Your fixed obligations are ' || round(v_obligation_load_bps / 100)::text || '% of income, at or above the 30% threshold.',
        'sort_order', 2
      ));
    ELSE
      v_drivers := v_drivers || jsonb_build_array(jsonb_build_object(
        'driver_key', 'obligation_load',
        'driver_label', 'Obligation Load',
        'value_text', round(v_obligation_load_bps / 100)::text || '%',
        'impact_label', 'primary',
        'explanation', 'Your fixed obligations are ' || round(v_obligation_load_bps / 100)::text || '% of income, below the 30% threshold.',
        'sort_order', 2
      ));
    END IF;
    v_confidence_score := 0.85;
  ELSE
    v_obligation_load_bps := NULL;
    v_confidence_score := 0.6;
    IF v_has_dependents THEN
      v_drivers := v_drivers || jsonb_build_array(jsonb_build_object(
        'driver_key', 'dependents',
        'driver_label', 'Dependents',
        'value_text', 'Has dependents',
        'impact_label', 'secondary',
        'explanation', 'Having dependents suggests higher financial obligations.',
        'sort_order', 2
      ));
    END IF;
  END IF;

  -- ponytail: deterministic placeholder until ML classifier is ready
  v_profile_label := 'stable_obligated';

  v_output_snapshot := jsonb_build_object(
    'profile_label', v_profile_label,
    'confidence_score', v_confidence_score,
    'obligation_threshold_bps', 3000,
    'rule', 'deterministic_placeholder_v1'
  );

  v_explanation_summary := 'Profile assessed as ' || v_profile_label
    || ' based on income type (' || v_income_type_label || ')' ||
    CASE WHEN v_obligation_load_bps IS NOT NULL
      THEN ' and obligation load (' || round(v_obligation_load_bps / 100)::text || '% of income).'
      ELSE '.' END;

  v_review_snapshot := v_input_snapshot || jsonb_build_object('submitted_at', now());

  UPDATE onboarding_sessions
  SET status = 'submitted',
      submitted_at = now(),
      review_snapshot = v_review_snapshot
  WHERE id = p_session_id;

  INSERT INTO financial_profile_assessments (
    user_id, onboarding_session_id, status, assessment_method,
    assessed_at, model_kind, proposed_profile_label, confidence_score,
    income_type, obligation_load_bps, explanation_summary,
    input_snapshot, output_snapshot
  ) VALUES (
    p_user_id, p_session_id, 'suggested', 'questionnaire',
    now(), 'deterministic_placeholder_v1', v_profile_label, v_confidence_score,
    v_income_type_label, v_obligation_load_bps, v_explanation_summary,
    v_input_snapshot, v_output_snapshot
  )
  RETURNING id INTO v_assessment_id;

  INSERT INTO financial_profile_explanation_drivers
    (assessment_id, driver_key, driver_label, value_text, impact_label, explanation, sort_order)
  SELECT
    v_assessment_id,
    d ->> 'driver_key',
    d ->> 'driver_label',
    d ->> 'value_text',
    d ->> 'impact_label',
    d ->> 'explanation',
    COALESCE((d ->> 'sort_order')::integer, 0)
  FROM jsonb_array_elements(v_drivers) AS d;

  UPDATE financial_profile_assignments
  SET is_active = false, effective_to = now()
  WHERE user_id = p_user_id AND is_active = true;

  INSERT INTO financial_profile_assignments (
    user_id, assessment_id, profile_label, is_active,
    confirmation_required, explanation
  ) VALUES (
    p_user_id, v_assessment_id, v_profile_label, true, true, v_explanation_summary
  )
  RETURNING id INTO v_assignment_id;

  INSERT INTO financial_profile_events (user_id, assessment_id, assignment_id, action, notes)
  VALUES
    (p_user_id, v_assessment_id, v_assignment_id, 'assessment_generated', 'Assessment generated from onboarding questionnaire'),
    (p_user_id, v_assessment_id, v_assignment_id, 'change_suggested', 'Profile change suggested based on assessment');

  RETURN jsonb_build_object(
    'assessment_id', v_assessment_id,
    'assignment_id', v_assignment_id,
    'profile_label', v_profile_label
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION submit_onboarding_session FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION submit_onboarding_session TO service_role;
