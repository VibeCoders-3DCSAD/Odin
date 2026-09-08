-- The old labels did not record tolerance; preserve historic rows as AT_RISK.
DROP FUNCTION IF EXISTS submit_onboarding_session(uuid, uuid);
DROP FUNCTION IF EXISTS select_profile_assignment(uuid, text);
DROP FUNCTION IF EXISTS select_profile_assignment(uuid, text, boolean);

ALTER TYPE odin_financial_profile_label RENAME TO odin_financial_profile_label_legacy;
CREATE TYPE odin_financial_profile_label AS ENUM (
  'STABLE_FLEXIBLE_TOLERANT', 'STABLE_FLEXIBLE_AT_RISK',
  'STABLE_OBLIGATED_TOLERANT', 'STABLE_OBLIGATED_AT_RISK',
  'VARIABLE_FLEXIBLE_TOLERANT', 'VARIABLE_FLEXIBLE_AT_RISK',
  'VARIABLE_OBLIGATED_TOLERANT', 'VARIABLE_OBLIGATED_AT_RISK'
);

ALTER TABLE financial_profile_assessments
  ALTER COLUMN proposed_profile_label TYPE odin_financial_profile_label
  USING (CASE proposed_profile_label::text
    WHEN 'stable_flexible' THEN 'STABLE_FLEXIBLE_AT_RISK'
    WHEN 'stable_obligated' THEN 'STABLE_OBLIGATED_AT_RISK'
    WHEN 'variable_flexible' THEN 'VARIABLE_FLEXIBLE_AT_RISK'
    WHEN 'variable_obligated' THEN 'VARIABLE_OBLIGATED_AT_RISK'
  END)::odin_financial_profile_label;
ALTER TABLE financial_profile_assignments
  ALTER COLUMN profile_label TYPE odin_financial_profile_label
  USING (CASE profile_label::text
    WHEN 'stable_flexible' THEN 'STABLE_FLEXIBLE_AT_RISK'
    WHEN 'stable_obligated' THEN 'STABLE_OBLIGATED_AT_RISK'
    WHEN 'variable_flexible' THEN 'VARIABLE_FLEXIBLE_AT_RISK'
    WHEN 'variable_obligated' THEN 'VARIABLE_OBLIGATED_AT_RISK'
  END)::odin_financial_profile_label;
ALTER TABLE budget_recommendations
  ALTER COLUMN profile_label TYPE odin_financial_profile_label
  USING (CASE profile_label::text
    WHEN 'stable_flexible' THEN 'STABLE_FLEXIBLE_AT_RISK'
    WHEN 'stable_obligated' THEN 'STABLE_OBLIGATED_AT_RISK'
    WHEN 'variable_flexible' THEN 'VARIABLE_FLEXIBLE_AT_RISK'
    WHEN 'variable_obligated' THEN 'VARIABLE_OBLIGATED_AT_RISK'
  END)::odin_financial_profile_label;
ALTER TABLE anomaly_evaluations
  ALTER COLUMN profile_label TYPE odin_financial_profile_label
  USING (CASE profile_label::text
    WHEN 'stable_flexible' THEN 'STABLE_FLEXIBLE_AT_RISK'
    WHEN 'stable_obligated' THEN 'STABLE_OBLIGATED_AT_RISK'
    WHEN 'variable_flexible' THEN 'VARIABLE_FLEXIBLE_AT_RISK'
    WHEN 'variable_obligated' THEN 'VARIABLE_OBLIGATED_AT_RISK'
  END)::odin_financial_profile_label;
DO $$
DECLARE v_remaining_columns integer;
BEGIN
  SELECT count(*) INTO v_remaining_columns
  FROM pg_attribute attribute
  JOIN pg_type type ON type.oid = attribute.atttypid
  WHERE type.typname = 'odin_financial_profile_label_legacy'
    AND attribute.attnum > 0
    AND NOT attribute.attisdropped;
  IF v_remaining_columns <> 0 THEN
    RAISE EXCEPTION 'Legacy financial profile enum still has % column dependencies', v_remaining_columns;
  END IF;
END;
$$;
DROP TYPE odin_financial_profile_label_legacy;

CREATE FUNCTION submit_onboarding_session_with_classification(
  p_session_id uuid,
  p_user_id uuid,
  p_profile_label odin_financial_profile_label DEFAULT NULL,
  p_confidence_score numeric DEFAULT NULL,
  p_model_kind text DEFAULT NULL,
  p_model_version text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_raw_answers jsonb;
  v_income_pattern text;
  v_obligation_load text;
  v_emergency_runway text;
  v_income_type odin_income_type;
  v_profile_label odin_financial_profile_label;
  v_confidence_score numeric;
  v_model_kind text;
  v_model_version text;
  v_assessment_id uuid;
  v_assignment_id uuid;
  v_drivers jsonb;
BEGIN
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT raw_answers INTO v_raw_answers
  FROM onboarding_sessions
  WHERE id = p_session_id AND user_id = p_user_id AND status = 'in_progress'
  FOR UPDATE;
  IF v_raw_answers IS NULL THEN RAISE EXCEPTION 'Session not found or not in progress'; END IF;

  v_income_pattern := v_raw_answers ->> 'income_pattern';
  v_obligation_load := v_raw_answers ->> 'obligation_load';
  v_emergency_runway := v_raw_answers ->> 'emergency_runway';
  IF v_income_pattern NOT IN ('no_current_income', 'predictable_income', 'variable_income')
    OR v_obligation_load NOT IN ('no_income_with_obligations', 'no_income_without_obligations', 'low', 'medium', 'high')
    OR v_emergency_runway NOT IN ('less_than_1_month', '1_to_3_months', '3_to_6_months', '6_plus_months') THEN
    RAISE EXCEPTION 'Invalid questionnaire answers';
  END IF;

  v_income_type := CASE WHEN v_income_pattern = 'predictable_income' THEN 'stable' ELSE 'variable' END;
  IF p_profile_label IS NULL THEN
    v_profile_label := (CASE
      WHEN v_income_type = 'stable' AND v_obligation_load IN ('low', 'no_income_without_obligations') AND v_emergency_runway IN ('3_to_6_months', '6_plus_months') THEN 'STABLE_FLEXIBLE_TOLERANT'
      WHEN v_income_type = 'stable' AND v_obligation_load IN ('low', 'no_income_without_obligations') THEN 'STABLE_FLEXIBLE_AT_RISK'
      WHEN v_income_type = 'stable' AND v_emergency_runway IN ('3_to_6_months', '6_plus_months') THEN 'STABLE_OBLIGATED_TOLERANT'
      WHEN v_income_type = 'stable' THEN 'STABLE_OBLIGATED_AT_RISK'
      WHEN v_obligation_load IN ('low', 'no_income_without_obligations') AND v_emergency_runway IN ('3_to_6_months', '6_plus_months') THEN 'VARIABLE_FLEXIBLE_TOLERANT'
      WHEN v_obligation_load IN ('low', 'no_income_without_obligations') THEN 'VARIABLE_FLEXIBLE_AT_RISK'
      WHEN v_emergency_runway IN ('3_to_6_months', '6_plus_months') THEN 'VARIABLE_OBLIGATED_TOLERANT'
      ELSE 'VARIABLE_OBLIGATED_AT_RISK'
    END)::odin_financial_profile_label;
    v_confidence_score := 0.85;
    v_model_kind := 'heuristic_v1';
    v_model_version := NULL;
  ELSE
    IF p_confidence_score IS NULL OR p_confidence_score NOT BETWEEN 0 AND 1
      OR p_model_kind IS NULL OR btrim(p_model_kind) = ''
      OR p_model_version IS NULL OR btrim(p_model_version) = '' THEN
      RAISE EXCEPTION 'Invalid classifier metadata';
    END IF;
    v_profile_label := p_profile_label;
    v_confidence_score := p_confidence_score;
    v_model_kind := p_model_kind;
    v_model_version := p_model_version;
  END IF;

  v_drivers := jsonb_build_array(
    jsonb_build_object('driver_key', 'income_pattern', 'driver_label', 'Income Pattern', 'value_text', v_income_pattern, 'impact_label', 'primary', 'explanation', 'Based directly on your reported income pattern.', 'sort_order', 1),
    jsonb_build_object('driver_key', 'obligation_load', 'driver_label', 'Obligation Load', 'value_text', v_obligation_load, 'impact_label', 'primary', 'explanation', 'Based directly on your reported required payments.', 'sort_order', 2),
    jsonb_build_object('driver_key', 'emergency_runway', 'driver_label', 'Emergency Runway', 'value_text', v_emergency_runway, 'impact_label', 'primary', 'explanation', 'Based directly on your reported savings runway.', 'sort_order', 3)
  );

  UPDATE onboarding_sessions SET status = 'submitted', submitted_at = now(),
    review_snapshot = jsonb_build_object('submitted_at', now(), 'income_pattern', v_income_pattern, 'obligation_load', v_obligation_load, 'emergency_runway', v_emergency_runway)
  WHERE id = p_session_id AND user_id = p_user_id;
  INSERT INTO financial_profile_assessments (
    user_id, onboarding_session_id, status, assessment_method, assessed_at, model_kind,
    model_version, proposed_profile_label, confidence_score, income_type, explanation_summary,
    input_snapshot, output_snapshot, metadata
  ) VALUES (
    p_user_id, p_session_id, 'suggested', 'questionnaire', now(), v_model_kind,
    v_model_version, v_profile_label, v_confidence_score, v_income_type,
    'Profile assessed from your questionnaire answers.',
    jsonb_build_object('income_pattern', v_income_pattern, 'obligation_load', v_obligation_load, 'emergency_runway', v_emergency_runway),
    jsonb_build_object('profile_label', v_profile_label, 'confidence_score', v_confidence_score),
    jsonb_build_object('strategy', CASE WHEN p_profile_label IS NULL THEN 'HEURISTIC_FALLBACK' ELSE 'QUESTIONNAIRE' END)
  ) RETURNING id INTO v_assessment_id;
  INSERT INTO financial_profile_explanation_drivers (assessment_id, driver_key, driver_label, value_text, impact_label, explanation, sort_order)
  SELECT v_assessment_id, d ->> 'driver_key', d ->> 'driver_label', d ->> 'value_text', d ->> 'impact_label', d ->> 'explanation', (d ->> 'sort_order')::integer FROM jsonb_array_elements(v_drivers) d;
  UPDATE financial_profile_assignments SET is_active = false, effective_to = now() WHERE user_id = p_user_id AND is_active = true;
  INSERT INTO financial_profile_assignments (user_id, assessment_id, profile_label, is_active, confirmation_required, explanation)
  VALUES (p_user_id, v_assessment_id, v_profile_label, true, true, 'Profile assessed from your questionnaire answers.') RETURNING id INTO v_assignment_id;
  INSERT INTO financial_profile_events (user_id, assessment_id, assignment_id, action, notes) VALUES
    (p_user_id, v_assessment_id, v_assignment_id, 'assessment_generated', 'Assessment generated from onboarding questionnaire'),
    (p_user_id, v_assessment_id, v_assignment_id, 'change_suggested', 'Profile change suggested based on assessment');
  RETURN jsonb_build_object('assessment_id', v_assessment_id, 'assignment_id', v_assignment_id, 'profile_label', v_profile_label);
END;
$$;
REVOKE EXECUTE ON FUNCTION submit_onboarding_session_with_classification(uuid, uuid, odin_financial_profile_label, numeric, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION submit_onboarding_session_with_classification(uuid, uuid, odin_financial_profile_label, numeric, text, text) TO service_role;

CREATE FUNCTION select_profile_assignment(p_user_id uuid, p_profile_label text, p_reject_current boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE v_previous_assignment_id uuid; v_assignment_id uuid;
BEGIN
  IF p_user_id IS NULL THEN RETURN jsonb_build_object('success', false, 'code', 'not_authenticated'); END IF;
  IF p_profile_label <> ALL (ARRAY['STABLE_FLEXIBLE_TOLERANT', 'STABLE_FLEXIBLE_AT_RISK', 'STABLE_OBLIGATED_TOLERANT', 'STABLE_OBLIGATED_AT_RISK', 'VARIABLE_FLEXIBLE_TOLERANT', 'VARIABLE_FLEXIBLE_AT_RISK', 'VARIABLE_OBLIGATED_TOLERANT', 'VARIABLE_OBLIGATED_AT_RISK']) THEN RETURN jsonb_build_object('success', false, 'code', 'invalid_label'); END IF;
  SELECT id INTO v_previous_assignment_id FROM financial_profile_assignments WHERE user_id = p_user_id AND is_active = true FOR UPDATE;
  IF v_previous_assignment_id IS NOT NULL THEN
    UPDATE financial_profile_assignments SET is_active = false, effective_to = now(), rejected_at = CASE WHEN p_reject_current THEN now() ELSE rejected_at END, override_reason = CASE WHEN p_reject_current THEN 'User chose a manual profile.' ELSE override_reason END WHERE id = v_previous_assignment_id AND user_id = p_user_id;
    INSERT INTO financial_profile_events (user_id, assignment_id, action, notes) VALUES (p_user_id, v_previous_assignment_id, CASE WHEN p_reject_current THEN 'rejected' ELSE 'deactivated' END, 'Previous assignment replaced by manual selection');
  END IF;
  INSERT INTO financial_profile_assignments (user_id, profile_label, is_active, confirmation_required, confirmed_at, explanation) VALUES (p_user_id, p_profile_label::odin_financial_profile_label, true, false, now(), 'Manual profile selection') RETURNING id INTO v_assignment_id;
  INSERT INTO financial_profile_events (user_id, assignment_id, action, notes) VALUES (p_user_id, v_assignment_id, 'manual_override', 'Profile manually selected by user'), (p_user_id, v_assignment_id, 'activated', 'Manual assignment activated');
  RETURN jsonb_build_object('success', true, 'assignment_id', v_assignment_id, 'profile_label', p_profile_label);
END;
$$;
REVOKE EXECUTE ON FUNCTION select_profile_assignment(uuid, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION select_profile_assignment(uuid, text, boolean) TO service_role;
