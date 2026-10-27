BEGIN;

INSERT INTO auth.users (id) VALUES
  ('7f000000-0000-4000-8000-000000000001');

DO $$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count
  FROM public.subcategories
  WHERE user_id = '7f000000-0000-4000-8000-000000000001'
    AND kind = 'income'
    AND category_id IS NULL
    AND deleted = false;
  IF v_count <> 12 THEN
    RAISE EXCEPTION 'new account must receive 12 income categories, got %', v_count;
  END IF;

  -- A deleted default must stay deleted when provisioning runs again.
  UPDATE public.subcategories SET deleted = true
  WHERE user_id = '7f000000-0000-4000-8000-000000000001' AND slug = 'income_tips';

  PERFORM public.seed_hfce_taxonomy_for_user('7f000000-0000-4000-8000-000000000001');

  SELECT count(*) INTO v_count
  FROM public.subcategories
  WHERE user_id = '7f000000-0000-4000-8000-000000000001'
    AND kind = 'income'
    AND deleted = false;
  IF v_count <> 11 THEN
    RAISE EXCEPTION 'reseeding must not duplicate or restore income categories, got %', v_count;
  END IF;
END;
$$;

ROLLBACK;
