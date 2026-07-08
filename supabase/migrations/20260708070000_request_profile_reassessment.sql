CREATE OR REPLACE FUNCTION request_profile_reassessment(
  p_user_id uuid,
  p_assessment_method text DEFAULT 'standard',
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_valid boolean;
  v_assessment_id uuid;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'not_authenticated');
  END IF;

  v_valid := p_assessment_method = ANY (ARRAY['manual', 'questionnaire', 'cold_start', 'standard']);
  IF NOT v_valid THEN
    RETURN jsonb_build_object('success', false, 'code', 'invalid_method');
  END IF;

  INSERT INTO financial_profile_assessments (
    user_id, status, assessment_method, requested_at, metadata
  ) VALUES (
    p_user_id, 'queued', p_assessment_method, now(), p_metadata
  )
  RETURNING id INTO v_assessment_id;

  INSERT INTO financial_profile_events (user_id, assessment_id, action, notes, payload)
  VALUES (
    p_user_id, v_assessment_id, 'assessment_requested',
    'Reassessment requested by user',
    jsonb_build_object('assessment_method', p_assessment_method, 'metadata', p_metadata)
  );

  RETURN jsonb_build_object(
    'success', true,
    'assessment_id', v_assessment_id,
    'status', 'queued',
    'assessment_method', p_assessment_method
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION request_profile_reassessment FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION request_profile_reassessment TO service_role;
