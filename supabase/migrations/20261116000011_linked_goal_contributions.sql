-- Earmarking existing money is a narrowly marked same-account transfer.
-- Other transfers continue to require distinct financial accounts.
ALTER TABLE public.transactions DROP CONSTRAINT transactions_shape_chk;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_shape_chk CHECK (
  (transaction_type = 'income' AND destination_account_id IS NOT NULL AND source_account_id IS NULL AND subcategory_id IS NOT NULL)
  OR (transaction_type = 'expense' AND source_account_id IS NOT NULL AND destination_account_id IS NULL
    AND (subcategory_id IS NOT NULL OR COALESCE(client_mutation_id LIKE 'scheduled-payment:%', false)
      OR (category_id IS NULL AND COALESCE(client_mutation_id ~ '^(debt-payment|credit-card-payment):[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$', false))))
  OR (transaction_type = 'transfer' AND source_account_id IS NOT NULL AND destination_account_id IS NOT NULL AND subcategory_id IS NULL
    AND (source_account_id <> destination_account_id OR (destination_savings_goal_id IS NOT NULL AND source_savings_goal_id IS NULL)))
);

CREATE FUNCTION private.savings_unallocated_balance(p_user uuid, p_account uuid, p_exclude_transaction uuid DEFAULT NULL)
RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT GREATEST(0, account.opening_balance_centavos + COALESCE((
    SELECT SUM((CASE WHEN t.destination_account_id = p_account THEN t.amount_centavos ELSE 0 END)
      - (CASE WHEN t.source_account_id = p_account THEN t.amount_centavos ELSE 0 END))
    FROM public.transactions t WHERE t.user_id = p_user AND t.status = 'posted' AND NOT t.deleted
      AND (t.source_account_id = p_account OR t.destination_account_id = p_account)
      AND (p_exclude_transaction IS NULL OR t.id <> p_exclude_transaction)
  ), 0) - COALESCE((
    SELECT SUM(saved) FROM (
      SELECT GREATEST(0, g.starting_amount_centavos + COALESCE(SUM(
        CASE WHEN a.activity_kind = 'contribution' THEN a.amount_centavos ELSE -a.amount_centavos END), 0)) AS saved
      FROM public.savings_goals g LEFT JOIN public.savings_goal_activities a
        ON a.user_id = g.user_id AND a.savings_goal_id = g.id AND NOT a.deleted
        AND (p_exclude_transaction IS NULL OR a.transaction_id <> p_exclude_transaction)
      WHERE g.user_id = p_user AND g.linked_account_id = p_account AND NOT g.deleted GROUP BY g.id
    ) goals
  ), 0))::bigint
  FROM public.financial_accounts account WHERE account.id = p_account AND account.user_id = p_user AND NOT account.deleted;
$$;
REVOKE ALL ON FUNCTION private.savings_unallocated_balance(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION private.validate_linked_goal_contribution()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.destination_savings_goal_id IS NULL OR NEW.deleted OR NEW.status <> 'posted' THEN RETURN NEW; END IF;
  IF NEW.transaction_type <> 'transfer' OR NEW.source_savings_goal_id IS NOT NULL THEN RAISE EXCEPTION 'invalid goal contribution'; END IF;
  PERFORM id FROM public.financial_accounts WHERE user_id = NEW.user_id
    AND id IN (NEW.source_account_id, NEW.destination_account_id) ORDER BY id FOR UPDATE;
  IF NOT EXISTS (SELECT 1 FROM public.savings_goals WHERE id = NEW.destination_savings_goal_id AND user_id = NEW.user_id
    AND linked_account_id = NEW.destination_account_id AND status = 'active' AND NOT deleted)
    OR EXISTS (SELECT 1 FROM public.financial_accounts WHERE user_id = NEW.user_id
      AND id IN (NEW.source_account_id, NEW.destination_account_id) AND (deleted OR status <> 'active' OR kind = 'credit_card'))
    OR (SELECT count(*) FROM public.financial_accounts WHERE user_id = NEW.user_id AND id IN (NEW.source_account_id, NEW.destination_account_id))
      <> (CASE WHEN NEW.source_account_id = NEW.destination_account_id THEN 1 ELSE 2 END)
  THEN RAISE EXCEPTION 'contribution requires owned active accounts and the fixed linked destination'; END IF;
  IF NEW.amount_centavos > private.savings_unallocated_balance(NEW.user_id, NEW.source_account_id, CASE WHEN TG_OP = 'UPDATE' THEN OLD.id ELSE NULL END)
  THEN RAISE EXCEPTION 'contribution exceeds unallocated balance'; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.validate_linked_goal_contribution() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER transactions_validate_goal_contribution BEFORE INSERT OR UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION private.validate_linked_goal_contribution();

CREATE FUNCTION private.apply_linked_goal_contribution(
  p_operation_id uuid, p_device_id text, p_record_id uuid, p_operation_type text,
  p_base_version integer, p_payload jsonb
) RETURNS TABLE(status text, reason text, current_version integer, conflicted_fields text[])
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private, auth AS $$
DECLARE
  v_user uuid := auth.uid();
  v_current public.transactions%ROWTYPE;
  v_goal uuid;
  v_linked uuid;
  v_source uuid;
  v_activity uuid;
  v_amount bigint;
  v_date date;
  v_notes text;
  v_existing public.applied_operations%ROWTYPE;
  v_version integer;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF p_operation_type NOT IN ('create', 'update', 'delete') THEN RAISE EXCEPTION 'invalid contribution operation'; END IF;
  INSERT INTO public.applied_operations(operation_id, user_id, device_id, entity, record_id, operation_type, result)
    VALUES (p_operation_id, v_user, p_device_id, 'transactions', p_record_id, p_operation_type, '{"status":"pending"}')
    ON CONFLICT (operation_id) DO NOTHING;
  IF NOT FOUND THEN
    SELECT * INTO v_existing FROM public.applied_operations WHERE operation_id = p_operation_id;
    IF v_existing.user_id <> v_user THEN
      RETURN QUERY SELECT 'rejected'::text, 'operation belongs to another user'::text, NULL::integer, NULL::text[];
    ELSE
      RETURN QUERY SELECT 'duplicate'::text, NULL::text, NULL::integer, NULL::text[];
    END IF;
    RETURN;
  END IF;
  SELECT * INTO v_current FROM public.transactions WHERE id = p_record_id AND user_id = v_user AND NOT deleted FOR UPDATE;
  IF p_operation_type = 'create' THEN
    IF v_current.id IS NOT NULL OR p_payload->>'transaction_type' IS DISTINCT FROM 'transfer' THEN RAISE EXCEPTION 'invalid contribution transaction'; END IF;
    v_goal := (p_payload->'savings_goal_contribution'->>'savings_goal_id')::uuid;
    v_activity := (p_payload->'savings_goal_contribution'->>'activity_id')::uuid;
    v_version := 1;
  ELSE
    IF v_current.id IS NULL OR v_current.destination_savings_goal_id IS NULL THEN RAISE EXCEPTION 'contribution not found'; END IF;
    IF p_base_version IS DISTINCT FROM v_current.version THEN
      UPDATE public.applied_operations SET result = '{"status":"conflict"}' WHERE operation_id = p_operation_id;
      RETURN QUERY SELECT 'conflict'::text, 'contribution version changed'::text, v_current.version, ARRAY['amount_centavos', 'source_account_id'];
      RETURN;
    END IF;
    v_goal := v_current.destination_savings_goal_id;
    SELECT id INTO v_activity FROM public.savings_goal_activities WHERE user_id = v_user AND transaction_id = p_record_id
      AND savings_goal_id = v_goal AND activity_kind = 'contribution' AND NOT deleted;
    IF v_activity IS NULL THEN RAISE EXCEPTION 'contribution activity not found'; END IF;
    v_version := v_current.version + 1;
  END IF;
  IF p_payload ? 'savings_goal_contribution' AND (
    jsonb_typeof(p_payload->'savings_goal_contribution') <> 'object'
    OR (SELECT count(*) FROM jsonb_object_keys(p_payload->'savings_goal_contribution')) <> 2
    OR (p_payload->'savings_goal_contribution'->>'savings_goal_id')::uuid IS DISTINCT FROM v_goal
    OR (p_payload->'savings_goal_contribution'->>'activity_id')::uuid IS DISTINCT FROM v_activity
  ) THEN RAISE EXCEPTION 'invalid contribution identity'; END IF;
  IF v_goal IS NULL OR v_activity IS NULL THEN RAISE EXCEPTION 'contribution identity is required'; END IF;

  IF p_operation_type = 'delete' THEN
    UPDATE public.transactions SET deleted = true, status = 'deleted', deleted_at = now(), version = v_version, updated_at = now() WHERE id = p_record_id AND user_id = v_user;
    UPDATE public.savings_goal_activities SET deleted = true, version = version + 1, updated_at = now()
      WHERE id = v_activity AND user_id = v_user;
  ELSE
    SELECT g.linked_account_id INTO v_linked FROM public.savings_goals g WHERE g.id = v_goal AND g.user_id = v_user AND g.status = 'active' AND NOT g.deleted;
    IF v_linked IS NULL THEN RAISE EXCEPTION 'contribution requires an active linked goal'; END IF;
    v_source := COALESCE((p_payload->>'source_account_id')::uuid, v_current.source_account_id);
    IF (p_payload ? 'destination_account_id' AND (p_payload->>'destination_account_id')::uuid IS DISTINCT FROM v_linked)
      OR (p_operation_type = 'update' AND v_current.destination_account_id <> v_linked)
    THEN RAISE EXCEPTION 'destination must be the goal linked account'; END IF;
    IF (p_payload ? 'amount_centavos' AND (jsonb_typeof(p_payload->'amount_centavos') <> 'number' OR p_payload->>'amount_centavos' !~ '^[1-9][0-9]*$'))
    THEN RAISE EXCEPTION 'invalid contribution amount'; END IF;
    v_amount := COALESCE((p_payload->>'amount_centavos')::bigint, v_current.amount_centavos);
    IF v_amount IS NULL OR v_amount NOT BETWEEN 1 AND 9007199254740991 THEN RAISE EXCEPTION 'invalid contribution amount'; END IF;
    v_date := COALESCE((p_payload->>'transaction_date')::date, v_current.transaction_date);
    v_notes := CASE WHEN p_payload ? 'notes' THEN p_payload->>'notes' ELSE v_current.notes END;
    PERFORM id FROM public.financial_accounts WHERE user_id = v_user AND id IN (v_source, v_linked, v_current.source_account_id) ORDER BY id FOR UPDATE;
    PERFORM id FROM public.savings_goals WHERE user_id = v_user AND linked_account_id IN (v_source, v_linked) AND NOT deleted ORDER BY id FOR UPDATE;
    IF p_operation_type = 'create' THEN
      INSERT INTO public.transactions(id, user_id, transaction_type, status, entry_source, transaction_date, posted_at,
        amount_centavos, source_account_id, destination_account_id, destination_savings_goal_id, notes, version)
      VALUES (p_record_id, v_user, 'transfer', 'posted', 'offline_sync', v_date, now(), v_amount, v_source, v_linked, v_goal, v_notes, 1);
      INSERT INTO public.savings_goal_activities(id, user_id, savings_goal_id, transaction_id, activity_kind, amount_centavos, activity_date, notes)
      VALUES (v_activity, v_user, v_goal, p_record_id, 'contribution', v_amount, v_date, v_notes);
    ELSE
      UPDATE public.transactions SET source_account_id = v_source, amount_centavos = v_amount, transaction_date = v_date,
        notes = v_notes, version = v_version, updated_at = now() WHERE id = p_record_id AND user_id = v_user;
      UPDATE public.savings_goal_activities SET amount_centavos = v_amount, activity_date = v_date, notes = v_notes,
        version = version + 1, updated_at = now() WHERE id = v_activity AND user_id = v_user;
    END IF;
  END IF;
  UPDATE public.applied_operations SET result = jsonb_build_object('status', 'applied', 'current_version', v_version) WHERE operation_id = p_operation_id;
  RETURN QUERY SELECT 'applied'::text, NULL::text, v_version, NULL::text[];
END;
$$;
REVOKE ALL ON FUNCTION private.apply_linked_goal_contribution(uuid, text, uuid, text, integer, jsonb) FROM PUBLIC, anon, authenticated;

ALTER FUNCTION public.apply_sync_operation(uuid, text, text, uuid, text, integer, text[], jsonb)
  RENAME TO apply_sync_operation_before_linked_goal_contributions;
CREATE FUNCTION public.apply_sync_operation(
  p_operation_id uuid, p_device_id text, p_entity text, p_record_id uuid,
  p_operation_type text, p_base_version integer, p_changed_fields text[], p_payload jsonb
) RETURNS TABLE(status text, reason text, current_version integer, conflicted_fields text[])
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private, auth AS $$
BEGIN
  IF p_entity = 'transactions' AND (p_payload ? 'savings_goal_contribution' OR EXISTS (
    SELECT 1 FROM public.transactions WHERE id = p_record_id AND user_id = auth.uid() AND destination_savings_goal_id IS NOT NULL
  )) THEN
    RETURN QUERY SELECT * FROM private.apply_linked_goal_contribution(p_operation_id, p_device_id, p_record_id, p_operation_type, p_base_version, p_payload);
    RETURN;
  END IF;
  RETURN QUERY SELECT * FROM public.apply_sync_operation_before_linked_goal_contributions(
    p_operation_id, p_device_id, p_entity, p_record_id, p_operation_type, p_base_version, p_changed_fields, p_payload);
END;
$$;
REVOKE ALL ON FUNCTION public.apply_sync_operation(uuid, text, text, uuid, text, integer, text[], jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_sync_operation(uuid, text, text, uuid, text, integer, text[], jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.apply_sync_operation_before_linked_goal_contributions(uuid, text, text, uuid, text, integer, text[], jsonb) FROM PUBLIC, anon, authenticated;

-- Same-account allocations have zero cash effect in every balance calculation.

CREATE OR REPLACE FUNCTION private.reconcile_financial_account_balances(p_account_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_account_ids IS NULL OR cardinality(p_account_ids) = 0 THEN
    RETURN;
  END IF;

  -- Lock first, in id order, so the balance statement below takes a fresh
  -- snapshot that includes ledger rows committed by concurrent writers.
  PERFORM 1
    FROM public.financial_accounts AS account
   WHERE account.id = ANY (p_account_ids)
     AND account.kind <> 'credit_card'
     AND account.deleted = false
   ORDER BY account.id
     FOR UPDATE;

  -- financial_accounts_sync_bump sets version and updated_at on each update,
  -- so only accounts whose balance actually changes are bumped.
  WITH reconciled_balances AS (
    SELECT account.id, account.opening_balance_centavos + COALESCE((
      SELECT SUM(CASE
        WHEN transaction_row.source_account_id = transaction_row.destination_account_id THEN 0
        WHEN transaction_row.transaction_type = 'income' AND transaction_row.destination_account_id = account.id THEN transaction_row.amount_centavos
        WHEN transaction_row.transaction_type = 'expense' AND transaction_row.source_account_id = account.id THEN -transaction_row.amount_centavos
        WHEN transaction_row.transaction_type = 'transfer' AND transaction_row.destination_account_id = account.id THEN transaction_row.amount_centavos
        WHEN transaction_row.transaction_type = 'transfer' AND transaction_row.source_account_id = account.id THEN -transaction_row.amount_centavos
        ELSE 0
      END)
      FROM public.transactions AS transaction_row
      WHERE transaction_row.user_id = account.user_id
        AND (transaction_row.source_account_id = account.id OR transaction_row.destination_account_id = account.id)
        AND transaction_row.deleted = false
        AND transaction_row.status = 'posted'
    ), 0) AS current_balance_centavos
    FROM public.financial_accounts AS account
    WHERE account.id = ANY (p_account_ids)
      AND account.kind <> 'credit_card'
      AND account.deleted = false
  )
  UPDATE public.financial_accounts AS account
     SET current_balance_centavos = reconciled_balances.current_balance_centavos
    FROM reconciled_balances
   WHERE account.id = reconciled_balances.id
     AND account.current_balance_centavos IS DISTINCT FROM reconciled_balances.current_balance_centavos;
END;
$$;

CREATE OR REPLACE FUNCTION private.guard_expense_reserved_savings()
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
    WHEN t.source_account_id = t.destination_account_id THEN 0
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

CREATE OR REPLACE FUNCTION private.savings_interest_amount(p_account uuid, p_user uuid, p_first date, p_last date, p_reference jsonb, p_rate integer)
RETURNS numeric LANGUAGE sql STABLE SET search_path = '' AS $$
  WITH flows AS (
    SELECT t.transaction_date AS day,
      sum(CASE WHEN t.source_account_id = t.destination_account_id THEN 0
          WHEN p_reference->>'method' = 'simple' AND t.client_mutation_id LIKE 'savings-interest:%' THEN 0
          WHEN t.destination_account_id = p_account THEN t.amount_centavos ELSE -t.amount_centavos END) AS delta
    FROM public.transactions t WHERE t.user_id = p_user AND NOT t.deleted AND t.status = 'posted'
      AND (t.source_account_id = p_account OR t.destination_account_id = p_account) AND t.transaction_date <= p_last
    GROUP BY t.transaction_date
  ), days AS (
    SELECT day::date AS day FROM generate_series(p_first::timestamp, p_last::timestamp, interval '1 day') day
  ), balances AS (
    SELECT d.day, (a.opening_balance_centavos + COALESCE((SELECT sum(delta) FROM flows WHERE day < p_first), 0)
      + sum(COALESCE(f.delta,0)) OVER (ORDER BY d.day)) AS balance
    FROM days d JOIN public.financial_accounts a ON a.id = p_account AND a.user_id = p_user
      LEFT JOIN flows f ON f.day = d.day
  ), bases AS (
    SELECT greatest(0, CASE WHEN p_reference->>'balanceBasis' = 'average_daily_balance' THEN avg(balance) OVER () ELSE balance END) AS balance
    FROM balances
  )
  SELECT COALESCE(sum(balance * CASE WHEN p_reference->>'rateStructure' = 'tiered' THEN
    COALESCE((SELECT (tier->>'interestRateBps')::numeric FROM jsonb_array_elements(p_reference->'schedule'->'tiers') tier
      WHERE (tier->>'minimumBalanceCentavos')::numeric <= balance ORDER BY (tier->>'minimumBalanceCentavos')::numeric DESC LIMIT 1),0)
    ELSE p_rate END / 10000 / 365),0)
    * (1 - COALESCE((p_reference->'schedule'->>'withholdingTaxBps')::numeric,0) / 10000)
  FROM bases;
$$;
