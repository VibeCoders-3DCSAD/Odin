-- Integration test for submit_onboarding_session()
--
-- Run against a Supabase instance with the odin schema loaded:
--   psql <DATABASE_URL> -f apps/api/src/__tests__/fixtures/submit_onboarding_session_integration.sql
--
-- Proves the RPC returns stable_obligated regardless of stored answers.

BEGIN;

DO $$
DECLARE
  v_user_id uuid := '00000000-0000-0000-0000-000000000001';
  v_session_id uuid;
  v_result jsonb;
BEGIN
  INSERT INTO profiles (user_id, email) VALUES (v_user_id, 'test@example.com')
    ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO user_eligibility_profiles (
    user_id, date_of_birth, is_filipino, metro_manila_presence,
    primary_employment_classification, eligibility_confirmed_at
  ) VALUES (
    v_user_id, '2000-01-01', true, 'within_metro_manila',
    'employed_private', now()
  )
  ON CONFLICT (user_id) DO UPDATE SET eligibility_confirmed_at = now();

  -- Test 1: stable income, low obligations
  INSERT INTO onboarding_sessions (user_id, status, raw_answers)
  VALUES (v_user_id, 'in_progress', jsonb_build_object(
    'income_type', 'stable', 'monthly_income', 50000, 'monthly_obligations', 5000
  ))
  RETURNING id INTO v_session_id;

  v_result := submit_onboarding_session(v_session_id, v_user_id);
  ASSERT v_result ->> 'profile_label' = 'stable_obligated',
    format('Test 1 (stable/low obligations) failed: got %s', v_result ->> 'profile_label');

  -- Test 2: variable income, high obligations
  INSERT INTO onboarding_sessions (user_id, status, raw_answers)
  VALUES (v_user_id, 'in_progress', jsonb_build_object(
    'income_type', 'variable', 'monthly_income', 30000, 'monthly_obligations', 12000
  ))
  RETURNING id INTO v_session_id;

  v_result := submit_onboarding_session(v_session_id, v_user_id);
  ASSERT v_result ->> 'profile_label' = 'stable_obligated',
    format('Test 2 (variable/high obligations) failed: got %s', v_result ->> 'profile_label');

  -- Test 3: no income, has dependents
  INSERT INTO onboarding_sessions (user_id, status, raw_answers)
  VALUES (v_user_id, 'in_progress', jsonb_build_object(
    'income_type', 'variable', 'monthly_income', 0, 'monthly_obligations', 0, 'has_dependents', true
  ))
  RETURNING id INTO v_session_id;

  v_result := submit_onboarding_session(v_session_id, v_user_id);
  ASSERT v_result ->> 'profile_label' = 'stable_obligated',
    format('Test 3 (no income/has dependents) failed: got %s', v_result ->> 'profile_label');

  RAISE NOTICE 'All RPC integration assertions passed';
END;
$$;

ROLLBACK;
