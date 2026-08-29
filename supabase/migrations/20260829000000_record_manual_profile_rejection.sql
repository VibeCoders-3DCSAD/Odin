DROP FUNCTION IF EXISTS select_profile_assignment(uuid, text);

CREATE FUNCTION select_profile_assignment(
  p_user_id uuid,
  p_profile_label text,
  p_reject_current boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_previous_assignment_id uuid;
  v_assignment_id uuid;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'not_authenticated');
  END IF;

  IF p_profile_label <> ALL (ARRAY['stable_flexible', 'stable_obligated', 'variable_flexible', 'variable_obligated']) THEN
    RETURN jsonb_build_object('success', false, 'code', 'invalid_label');
  END IF;

  SELECT id INTO v_previous_assignment_id
  FROM financial_profile_assignments
  WHERE user_id = p_user_id AND is_active = true
  FOR UPDATE;

  IF v_previous_assignment_id IS NOT NULL THEN
    UPDATE financial_profile_assignments
    SET is_active = false,
        effective_to = now(),
        rejected_at = CASE WHEN p_reject_current THEN now() ELSE rejected_at END,
        override_reason = CASE WHEN p_reject_current THEN 'User chose a manual profile.' ELSE override_reason END
    WHERE id = v_previous_assignment_id AND user_id = p_user_id;

    INSERT INTO financial_profile_events (user_id, assignment_id, action, notes)
    VALUES (
      p_user_id,
      v_previous_assignment_id,
      CASE WHEN p_reject_current THEN 'rejected' ELSE 'deactivated' END,
      CASE WHEN p_reject_current THEN 'Assignment rejected by manual profile selection' ELSE 'Previous assignment deactivated by manual override' END
    );
  END IF;

  INSERT INTO financial_profile_assignments (
    user_id, profile_label, is_active, confirmation_required, confirmed_at, explanation
  ) VALUES (
    p_user_id, p_profile_label, true, false, now(), 'Manual profile selection'
  )
  RETURNING id INTO v_assignment_id;

  INSERT INTO financial_profile_events (user_id, assignment_id, action, notes)
  VALUES
    (p_user_id, v_assignment_id, 'manual_override', 'Profile manually selected by user'),
    (p_user_id, v_assignment_id, 'activated', 'Manual assignment activated');

  RETURN jsonb_build_object('success', true, 'assignment_id', v_assignment_id, 'profile_label', p_profile_label);
END;
$$;

REVOKE EXECUTE ON FUNCTION select_profile_assignment(uuid, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION select_profile_assignment(uuid, text, boolean) TO service_role;
