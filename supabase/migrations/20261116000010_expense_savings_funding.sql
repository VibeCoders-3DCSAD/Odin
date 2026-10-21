-- A single expense may withdraw from several goals. Expense activities are
-- created by the transaction dispatcher, never by separate client operations.
DROP INDEX public.savings_goal_activities_live_transaction_idx;
CREATE UNIQUE INDEX savings_goal_activities_live_transaction_idx
  ON public.savings_goal_activities(user_id, transaction_id, savings_goal_id) WHERE deleted = false;

ALTER FUNCTION public.apply_sync_operation(uuid, text, text, uuid, text, integer, text[], jsonb)
  RENAME TO apply_sync_operation_before_expense_savings_funding;
CREATE FUNCTION public.apply_sync_operation(
  p_operation_id uuid, p_device_id text, p_entity text, p_record_id uuid,
  p_operation_type text, p_base_version integer, p_changed_fields text[], p_payload jsonb
) RETURNS TABLE(status text, reason text, current_version integer, conflicted_fields text[])
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private, auth AS $$
DECLARE
  v_user uuid := auth.uid();
  v_old public.transactions%ROWTYPE;
  v_account uuid;
  v_amount bigint;
  v_balance bigint;
  v_reserved bigint;
  v_required bigint;
  v_total bigint;
  v_written integer;
  v_previous_marker text;
  v_split jsonb := COALESCE(p_payload->'savings_goal_withdrawals', '[]'::jsonb);
  v_result record;
  v_is_expense boolean := false;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF p_entity = 'transactions' THEN
    IF p_operation_type <> 'create' THEN
      SELECT * INTO v_old FROM public.transactions WHERE id = p_record_id AND user_id = v_user AND deleted = false FOR UPDATE;
    END IF;
    v_is_expense := COALESCE(p_payload->>'transaction_type', v_old.transaction_type::text) = 'expense';
    -- Duplicate retries must return without applying the split again.
    IF EXISTS (SELECT 1 FROM public.applied_operations WHERE operation_id = p_operation_id)
      OR (p_operation_type <> 'create' AND v_old.id IS NULL) THEN
      RETURN QUERY SELECT * FROM public.apply_sync_operation_before_expense_savings_funding(
        p_operation_id, p_device_id, p_entity, p_record_id, p_operation_type, p_base_version,
        array_remove(p_changed_fields, 'savings_goal_withdrawals'), p_payload - 'savings_goal_withdrawals');
      RETURN;
    END IF;
    -- Funding and the expense must be reviewed together on concurrent edits;
    -- field-level merges could otherwise apply a stale split to a new balance.
    IF v_is_expense AND p_operation_type <> 'create' AND p_base_version IS DISTINCT FROM v_old.version THEN
      RETURN QUERY SELECT 'conflict'::text, 'expense version changed'::text, v_old.version, p_changed_fields;
      RETURN;
    END IF;
    IF p_payload ? 'savings_goal_withdrawals' AND NOT COALESCE(v_is_expense, false) THEN
      RAISE EXCEPTION 'savings goal funding requires an expense';
    END IF;
    IF v_is_expense AND p_operation_type IN ('create', 'update') THEN
      IF jsonb_typeof(v_split) <> 'array' OR jsonb_array_length(v_split) > 100 THEN RAISE EXCEPTION 'invalid savings withdrawal split'; END IF;
      v_account := COALESCE((p_payload->>'source_account_id')::uuid, v_old.source_account_id);
      v_amount := COALESCE((p_payload->>'amount_centavos')::bigint, v_old.amount_centavos);
      -- Serialize expense funding against the account and its linked goals.
      PERFORM id FROM public.financial_accounts
        WHERE user_id = v_user AND id IN (v_account, v_old.source_account_id) ORDER BY id FOR UPDATE;
      SELECT current_balance_centavos INTO v_balance FROM public.financial_accounts
        WHERE id = v_account AND user_id = v_user AND deleted = false;
      IF NOT FOUND THEN RAISE EXCEPTION 'source account is unavailable'; END IF;
      IF v_old.source_account_id = v_account THEN v_balance := v_balance + v_old.amount_centavos; END IF;
      PERFORM id FROM public.savings_goals WHERE user_id = v_user AND linked_account_id = v_account AND deleted = false ORDER BY id FOR UPDATE;
      SELECT COALESCE(SUM(balance), 0) INTO v_reserved FROM (
        SELECT g.id, GREATEST(0, g.starting_amount_centavos + COALESCE(SUM(
          CASE WHEN a.activity_kind = 'contribution' THEN a.amount_centavos ELSE -a.amount_centavos END), 0)) AS balance
        FROM public.savings_goals g LEFT JOIN public.savings_goal_activities a
          ON a.user_id = g.user_id AND a.savings_goal_id = g.id AND a.deleted = false
          AND (v_old.id IS NULL OR a.transaction_id <> v_old.id)
        WHERE g.user_id = v_user AND g.linked_account_id = v_account AND g.deleted = false
        GROUP BY g.id
      ) balances;
      v_required := LEAST(v_reserved, GREATEST(0, v_amount - GREATEST(0, v_balance - v_reserved)));
      IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_split) e WHERE jsonb_typeof(e) <> 'object'
          OR NOT (e ?& ARRAY['id', 'savings_goal_id', 'amount_centavos'])
          OR (SELECT count(*) FROM jsonb_object_keys(e)) <> 3
          OR jsonb_typeof(e->'amount_centavos') <> 'number'
          OR (e->>'amount_centavos') !~ '^[1-9][0-9]*$'
          OR (e->>'amount_centavos')::numeric > 9007199254740991
          OR e->>'id' IS NULL OR e->>'savings_goal_id' IS NULL)
        OR (SELECT count(DISTINCT e->>'savings_goal_id') FROM jsonb_array_elements(v_split) e) <> jsonb_array_length(v_split)
        OR (SELECT count(DISTINCT e->>'id') FROM jsonb_array_elements(v_split) e) <> jsonb_array_length(v_split)
      THEN RAISE EXCEPTION 'invalid savings withdrawal split'; END IF;
      IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_split) e JOIN public.savings_goal_activities a
        ON a.user_id = v_user AND a.transaction_id = p_record_id AND a.savings_goal_id = (e->>'savings_goal_id')::uuid
        WHERE a.id <> (e->>'id')::uuid) THEN RAISE EXCEPTION 'preserve the existing goal withdrawal identity'; END IF;
      SELECT COALESCE(SUM((e->>'amount_centavos')::bigint), 0) INTO v_total FROM jsonb_array_elements(v_split) e;
      IF v_total <> v_required THEN RAISE EXCEPTION 'choose savings goals covering the amount beyond unallocated money'; END IF;
      IF EXISTS (
        SELECT 1 FROM jsonb_array_elements(v_split) e
        LEFT JOIN public.savings_goals g ON g.id = (e->>'savings_goal_id')::uuid AND g.user_id = v_user AND g.linked_account_id = v_account AND g.deleted = false
        WHERE g.id IS NULL OR (e->>'amount_centavos')::bigint > g.starting_amount_centavos + COALESCE((
          SELECT SUM(CASE WHEN a.activity_kind = 'contribution' THEN a.amount_centavos ELSE -a.amount_centavos END)
          FROM public.savings_goal_activities a WHERE a.user_id = v_user AND a.savings_goal_id = g.id AND a.deleted = false
            AND (v_old.id IS NULL OR a.transaction_id <> v_old.id)
        ), 0)
      ) THEN RAISE EXCEPTION 'withdrawal exceeds linked goal savings'; END IF;
    END IF;
  END IF;

  v_previous_marker := current_setting('odin.validated_savings_expense', true);
  IF v_is_expense THEN PERFORM set_config('odin.validated_savings_expense', p_record_id::text, true); END IF;
  SELECT * INTO v_result FROM public.apply_sync_operation_before_expense_savings_funding(
    p_operation_id, p_device_id, p_entity, p_record_id, p_operation_type, p_base_version,
    array_remove(p_changed_fields, 'savings_goal_withdrawals'), p_payload - 'savings_goal_withdrawals');
  PERFORM set_config('odin.validated_savings_expense', COALESCE(v_previous_marker, ''), true);
  IF v_result.status = 'applied' AND v_is_expense THEN
    UPDATE public.savings_goal_activities SET deleted = true, version = version + 1, updated_at = now()
      WHERE user_id = v_user AND transaction_id = p_record_id AND deleted = false;
    IF p_operation_type <> 'delete' THEN
      INSERT INTO public.savings_goal_activities(id, user_id, savings_goal_id, transaction_id, activity_kind, amount_centavos, activity_date, notes)
        SELECT (e->>'id')::uuid, v_user, (e->>'savings_goal_id')::uuid, p_record_id, 'withdrawal', (e->>'amount_centavos')::bigint,
          COALESCE((p_payload->>'transaction_date')::date, v_old.transaction_date), COALESCE(p_payload->>'notes', v_old.notes)
        FROM jsonb_array_elements(v_split) e
        ON CONFLICT (id) DO UPDATE SET amount_centavos = EXCLUDED.amount_centavos,
          activity_date = EXCLUDED.activity_date, notes = EXCLUDED.notes,
          deleted = false, version = savings_goal_activities.version + 1, updated_at = now()
        WHERE savings_goal_activities.user_id = v_user AND savings_goal_activities.transaction_id = p_record_id
          AND savings_goal_activities.savings_goal_id = EXCLUDED.savings_goal_id;
      GET DIAGNOSTICS v_written = ROW_COUNT;
      IF v_written <> jsonb_array_length(v_split) THEN RAISE EXCEPTION 'invalid withdrawal activity identity'; END IF;
    END IF;
  END IF;
  RETURN QUERY SELECT v_result.status, v_result.reason, v_result.current_version, v_result.conflicted_fields;
END;
$$;
REVOKE ALL ON FUNCTION public.apply_sync_operation(uuid, text, text, uuid, text, integer, text[], jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_sync_operation(uuid, text, text, uuid, text, integer, text[], jsonb) TO authenticated;
-- Only the current entrypoint may handle expenses; old dispatchers bypass funding.
REVOKE ALL ON FUNCTION public.apply_sync_operation_before_expense_savings_funding(uuid, text, text, uuid, text, integer, text[], jsonb) FROM PUBLIC, anon, authenticated;

-- Earlier public dispatchers are implementation details. Revoking each alias
-- closes alternate RPC routes that would skip the current funding checks.
DO $$
DECLARE v_signature text;
BEGIN
  FOR v_signature IN SELECT p.oid::regprocedure::text FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname LIKE 'apply_sync_operation%'
      AND p.proname <> 'apply_sync_operation'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', v_signature);
  END LOOP;
END;
$$;

-- Direct writers (including automatic bill posting) must use free money only.
-- The dispatcher validates an explicit split before temporarily authorizing its
-- own transaction write. The marker is restored before the RPC returns.
CREATE FUNCTION private.guard_expense_reserved_savings()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_opening bigint;
  v_balance bigint;
  v_reserved bigint;
  v_required bigint;
  v_existing bigint;
  v_old_id uuid;
BEGIN
  IF NEW.transaction_type <> 'expense' OR NEW.deleted OR NEW.status <> 'posted'
    OR current_setting('odin.validated_savings_expense', true) = NEW.id::text THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' THEN v_old_id := OLD.id; END IF;
  SELECT opening_balance_centavos INTO v_opening FROM public.financial_accounts
    WHERE id = NEW.source_account_id AND user_id = NEW.user_id AND kind <> 'credit_card' AND deleted = false FOR UPDATE;
  IF NOT FOUND THEN RETURN NEW; END IF;
  PERFORM id FROM public.savings_goals WHERE user_id = NEW.user_id AND linked_account_id = NEW.source_account_id AND deleted = false ORDER BY id FOR UPDATE;
  SELECT COALESCE(SUM(balance), 0) INTO v_reserved FROM (
    SELECT g.id, GREATEST(0, g.starting_amount_centavos + COALESCE(SUM(
      CASE WHEN a.activity_kind = 'contribution' THEN a.amount_centavos ELSE -a.amount_centavos END), 0)) AS balance
    FROM public.savings_goals g LEFT JOIN public.savings_goal_activities a
      ON a.user_id = g.user_id AND a.savings_goal_id = g.id AND a.deleted = false
      AND (v_old_id IS NULL OR a.transaction_id <> v_old_id)
    WHERE g.user_id = NEW.user_id AND g.linked_account_id = NEW.source_account_id AND g.deleted = false GROUP BY g.id
  ) balances;
  IF v_reserved = 0 THEN RETURN NEW; END IF;
  SELECT v_opening + COALESCE(SUM(CASE
    WHEN t.destination_account_id = NEW.source_account_id THEN t.amount_centavos ELSE -t.amount_centavos END), 0)
    INTO v_balance FROM public.transactions t
    WHERE t.user_id = NEW.user_id AND t.deleted = false AND t.status = 'posted'
      AND (t.source_account_id = NEW.source_account_id OR t.destination_account_id = NEW.source_account_id)
      AND (v_old_id IS NULL OR t.id <> v_old_id);
  v_required := LEAST(v_reserved, GREATEST(0, NEW.amount_centavos - GREATEST(0, v_balance - v_reserved)));
  SELECT COALESCE(SUM(a.amount_centavos), 0) INTO v_existing FROM public.savings_goal_activities a
    JOIN public.savings_goals g ON g.id = a.savings_goal_id AND g.user_id = a.user_id
    WHERE a.user_id = NEW.user_id AND a.transaction_id = NEW.id AND a.deleted = false AND a.activity_kind = 'withdrawal'
      AND g.linked_account_id = NEW.source_account_id AND g.deleted = false;
  IF v_required <> v_existing THEN RAISE EXCEPTION 'confirm savings goal withdrawals before recording this expense'; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.guard_expense_reserved_savings() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER transactions_guard_reserved_savings BEFORE INSERT OR UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION private.guard_expense_reserved_savings();
