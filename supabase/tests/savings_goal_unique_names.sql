BEGIN;

INSERT INTO auth.users (id) VALUES
  ('7e000000-0000-4000-8000-000000000001'),
  ('7e000000-0000-4000-8000-000000000002');

INSERT INTO public.savings_goals (id, user_id, name, goal_type, target_amount_centavos) VALUES
  ('7e000000-0000-4000-8000-0000000000a1', '7e000000-0000-4000-8000-000000000001', 'Travel', 'custom', 100000),
  ('7e000000-0000-4000-8000-0000000000a2', '7e000000-0000-4000-8000-000000000001', 'Emergency', 'custom', 100000),
  ('7e000000-0000-4000-8000-0000000000a3', '7e000000-0000-4000-8000-000000000002', 'Travel', 'custom', 100000);

DO $$
DECLARE
  v_name text;
  v_constraint text;
BEGIN
  FOREACH v_name IN ARRAY ARRAY['Travel', 'TRAVEL', ' travel '] LOOP
    BEGIN
      INSERT INTO public.savings_goals (id, user_id, name, goal_type, target_amount_centavos)
      VALUES (gen_random_uuid(), '7e000000-0000-4000-8000-000000000001', v_name, 'custom', 100000);
      RAISE EXCEPTION 'duplicate goal name must be rejected';
    EXCEPTION WHEN unique_violation THEN
      GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
      IF v_constraint <> 'savings_goals_user_name_live_idx' THEN RAISE; END IF;
    END;
  END LOOP;

  BEGIN
    UPDATE public.savings_goals SET name = ' travel '
    WHERE id = '7e000000-0000-4000-8000-0000000000a2';
    RAISE EXCEPTION 'renaming to another goal must be rejected';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;

  UPDATE public.savings_goals SET name = ' TRAVEL ', status = 'archived'
  WHERE id = '7e000000-0000-4000-8000-0000000000a1';
  BEGIN
    INSERT INTO public.savings_goals (id, user_id, name, goal_type, target_amount_centavos)
    VALUES (gen_random_uuid(), '7e000000-0000-4000-8000-000000000001', 'Travel', 'custom', 100000);
    RAISE EXCEPTION 'archived goal must reserve its name';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;

  UPDATE public.savings_goals SET deleted = true, status = 'deleted'
  WHERE id = '7e000000-0000-4000-8000-0000000000a1';
  INSERT INTO public.savings_goals (id, user_id, name, goal_type, target_amount_centavos)
  VALUES (gen_random_uuid(), '7e000000-0000-4000-8000-000000000001', 'Travel', 'custom', 100000);
END;
$$;

ROLLBACK;
