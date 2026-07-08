CREATE OR REPLACE FUNCTION confirm_profile_assignment(
  p_assignment_id uuid,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_current boolean;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'not_authenticated');
  END IF;

  SELECT is_active INTO v_current
  FROM financial_profile_assignments
  WHERE id = p_assignment_id AND user_id = p_user_id AND is_active = true
  FOR UPDATE;

  IF v_current IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'not_found');
  END IF;

  UPDATE financial_profile_assignments
  SET confirmed_at = now(), confirmation_required = false
  WHERE id = p_assignment_id AND user_id = p_user_id;

  INSERT INTO financial_profile_events (user_id, assignment_id, action, notes)
  VALUES (p_user_id, p_assignment_id, 'confirmed', 'Assignment confirmed by user');

  RETURN jsonb_build_object('success', true, 'assignment_id', p_assignment_id, 'status', 'confirmed');
END;
$$;

CREATE OR REPLACE FUNCTION reject_profile_assignment(
  p_assignment_id uuid,
  p_user_id uuid,
  p_override_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_current boolean;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'not_authenticated');
  END IF;

  SELECT is_active INTO v_current
  FROM financial_profile_assignments
  WHERE id = p_assignment_id AND user_id = p_user_id AND is_active = true
  FOR UPDATE;

  IF v_current IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'not_found');
  END IF;

  UPDATE financial_profile_assignments
  SET rejected_at = now(), is_active = false, override_reason = p_override_reason
  WHERE id = p_assignment_id AND user_id = p_user_id;

  INSERT INTO financial_profile_events (user_id, assignment_id, action, notes, payload)
  VALUES (p_user_id, p_assignment_id, 'rejected', 'Assignment rejected by user', jsonb_build_object('override_reason', p_override_reason));

  RETURN jsonb_build_object('success', true, 'assignment_id', p_assignment_id, 'status', 'rejected');
END;
$$;

CREATE OR REPLACE FUNCTION select_profile_assignment(
  p_user_id uuid,
  p_profile_label text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_previous_assignment_id uuid;
  v_assignment_id uuid;
  v_valid boolean;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'not_authenticated');
  END IF;

  v_valid := p_profile_label = ANY (ARRAY['stable_flexible', 'stable_obligated', 'variable_flexible', 'variable_obligated']);
  IF NOT v_valid THEN
    RETURN jsonb_build_object('success', false, 'code', 'invalid_label');
  END IF;

  SELECT id INTO v_previous_assignment_id
  FROM financial_profile_assignments
  WHERE user_id = p_user_id AND is_active = true
  FOR UPDATE;

  IF v_previous_assignment_id IS NOT NULL THEN
    UPDATE financial_profile_assignments
    SET is_active = false, effective_to = now()
    WHERE id = v_previous_assignment_id AND user_id = p_user_id;

    INSERT INTO financial_profile_events (user_id, assignment_id, action, notes)
    VALUES (p_user_id, v_previous_assignment_id, 'deactivated', 'Previous assignment deactivated by manual override');
  END IF;

  INSERT INTO financial_profile_assignments (
    user_id, profile_label, is_active,
    confirmation_required, confirmed_at, explanation
  ) VALUES (
    p_user_id, p_profile_label, true, false, now(), 'Manual profile selection'
  )
  RETURNING id INTO v_assignment_id;

  INSERT INTO financial_profile_events (user_id, assessment_id, assignment_id, action, notes)
  VALUES
    (p_user_id, NULL, v_assignment_id, 'manual_override', 'Profile manually selected by user'),
    (p_user_id, NULL, v_assignment_id, 'activated', 'Manual assignment activated');

  RETURN jsonb_build_object(
    'success', true,
    'assignment_id', v_assignment_id,
    'profile_label', p_profile_label,
    'previous_deactivated', v_previous_assignment_id IS NOT NULL
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION confirm_profile_assignment FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION reject_profile_assignment FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION select_profile_assignment FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION confirm_profile_assignment TO service_role;
GRANT EXECUTE ON FUNCTION reject_profile_assignment TO service_role;
GRANT EXECUTE ON FUNCTION select_profile_assignment TO service_role;
