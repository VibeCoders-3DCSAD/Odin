CREATE UNIQUE INDEX IF NOT EXISTS onboarding_sessions_one_in_progress_per_user
  ON onboarding_sessions (user_id)
  WHERE status = 'in_progress';

CREATE OR REPLACE FUNCTION create_onboarding_session(
  p_raw_answers jsonb DEFAULT '{}'::jsonb,
  p_current_step_key text DEFAULT NULL
)
RETURNS SETOF onboarding_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('onboarding_session_' || v_user_id::text));

  UPDATE onboarding_sessions
  SET status = 'superseded', superseded_at = now()
  WHERE user_id = v_user_id AND status = 'in_progress';

  RETURN QUERY
  INSERT INTO onboarding_sessions (user_id, raw_answers, current_step_key)
  VALUES (v_user_id, COALESCE(p_raw_answers, '{}'::jsonb), p_current_step_key)
  RETURNING *;
END;
$$;
