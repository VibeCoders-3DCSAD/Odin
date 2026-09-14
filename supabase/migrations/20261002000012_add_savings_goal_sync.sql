CREATE TABLE IF NOT EXISTS public.savings_goals (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(btrim(name)) > 0),
  goal_type text NOT NULL CHECK (goal_type IN ('emergency_fund', 'custom')),
  target_amount_centavos bigint NOT NULL CHECK (target_amount_centavos > 0),
  starting_amount_centavos bigint NOT NULL DEFAULT 0 CHECK (starting_amount_centavos >= 0),
  target_date date,
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  emergency_fund_baseline_centavos bigint CHECK (emergency_fund_baseline_centavos >= 0),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deleted')),
  version integer NOT NULL DEFAULT 1,
  deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_synced_at timestamptz
);

-- The priority-modules migration already created a future-state table in
-- linked environments. Keep its identity and dependent foreign keys, while
-- relaxing fields this intentionally minimal sync slice cannot populate.
ALTER TABLE public.savings_goals
  ALTER COLUMN target_date DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS goal_type text NOT NULL DEFAULT 'custom'
    CHECK (goal_type IN ('emergency_fund', 'custom')),
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high')),
  ADD COLUMN IF NOT EXISTS starting_amount_centavos bigint NOT NULL DEFAULT 0
    CHECK (starting_amount_centavos >= 0),
  ADD COLUMN IF NOT EXISTS emergency_fund_baseline_centavos bigint
    CHECK (emergency_fund_baseline_centavos >= 0),
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS deleted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'savings_goals'
      AND column_name = 'linked_subcategory_id'
  ) THEN
    ALTER TABLE public.savings_goals ALTER COLUMN linked_subcategory_id DROP NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'savings_goals'
      AND column_name = 'current_amount_centavos'
  ) THEN
    EXECUTE 'UPDATE public.savings_goals
      SET starting_amount_centavos = current_amount_centavos
      WHERE starting_amount_centavos = 0 AND current_amount_centavos <> 0';
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_savings_goals_user_active
  ON public.savings_goals(user_id, deleted, status, updated_at DESC);

ALTER TABLE public.savings_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage their savings goals" ON public.savings_goals
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION private.apply_savings_goal_sync_operation_core(
  p_operation_id uuid, p_device_id text, p_record_id uuid, p_operation_type text,
  p_base_version integer, p_changed_fields text[], p_payload jsonb
) RETURNS TABLE(status text, reason text, current_version integer, conflicted_fields text[])
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, private, auth
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_existing_user_id uuid;
  v_existing_result jsonb;
  v_current_version integer;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF p_device_id IS NULL OR length(p_device_id) = 0 OR length(p_device_id) > 128 OR p_device_id !~ '^[A-Za-z0-9._:-]+$' THEN RAISE EXCEPTION 'invalid device id'; END IF;
  IF p_operation_type NOT IN ('create', 'update', 'delete') THEN RAISE EXCEPTION 'operation type is invalid'; END IF;

  INSERT INTO public.applied_operations(operation_id, user_id, device_id, entity, record_id, operation_type, result)
  VALUES (p_operation_id, v_user_id, p_device_id, 'savings_goals', p_record_id, p_operation_type, jsonb_build_object('status', 'pending'))
  ON CONFLICT (operation_id) DO NOTHING;
  IF NOT FOUND THEN
    SELECT user_id, result INTO v_existing_user_id, v_existing_result FROM public.applied_operations WHERE operation_id = p_operation_id;
    IF v_existing_user_id IS DISTINCT FROM v_user_id THEN
      RETURN QUERY SELECT 'rejected'::text, 'operation belongs to another user'::text, NULL::integer, NULL::text[];
    ELSE
      RETURN QUERY SELECT COALESCE(v_existing_result->>'status', 'duplicate')::text, NULLIF(v_existing_result->>'reason', '')::text,
        CASE WHEN v_existing_result ? 'current_version' THEN (v_existing_result->>'current_version')::integer END, NULL::text[];
    END IF;
    RETURN;
  END IF;

  IF p_operation_type = 'create' THEN
    IF p_base_version IS NOT NULL OR NOT (p_payload ?& ARRAY['name', 'goal_type', 'target_amount_centavos', 'starting_amount_centavos', 'priority'])
      OR p_payload->>'name' IS NULL OR length(btrim(p_payload->>'name')) = 0
      OR p_payload->>'goal_type' NOT IN ('emergency_fund', 'custom')
      OR p_payload->>'priority' NOT IN ('low', 'medium', 'high')
      OR p_payload->>'target_amount_centavos' !~ '^[1-9][0-9]*$'
      OR p_payload->>'starting_amount_centavos' !~ '^[0-9]+$'
      OR (p_payload ? 'emergency_fund_baseline_centavos' AND p_payload->>'emergency_fund_baseline_centavos' IS NOT NULL AND p_payload->>'emergency_fund_baseline_centavos' !~ '^[0-9]+$')
    THEN RAISE EXCEPTION 'invalid savings goal payload'; END IF;
    INSERT INTO public.savings_goals(id, user_id, name, goal_type, target_amount_centavos, starting_amount_centavos, target_date, priority, emergency_fund_baseline_centavos, status, version, deleted)
    VALUES (p_record_id, v_user_id, btrim(p_payload->>'name'), p_payload->>'goal_type', (p_payload->>'target_amount_centavos')::bigint,
      (p_payload->>'starting_amount_centavos')::bigint, (p_payload->>'target_date')::date, p_payload->>'priority',
      CASE WHEN p_payload->>'emergency_fund_baseline_centavos' IS NULL THEN NULL ELSE (p_payload->>'emergency_fund_baseline_centavos')::bigint END,
      'active', 1, false)
    ON CONFLICT (id) DO UPDATE SET updated_at = public.savings_goals.updated_at WHERE public.savings_goals.user_id = v_user_id;
    UPDATE public.applied_operations SET result = jsonb_build_object('status', 'applied', 'current_version', 1) WHERE operation_id = p_operation_id;
    RETURN QUERY SELECT 'applied'::text, NULL::text, 1, NULL::text[];
    RETURN;
  END IF;

  SELECT version INTO v_current_version FROM public.savings_goals WHERE id = p_record_id AND user_id = v_user_id FOR UPDATE;
  IF v_current_version IS NULL THEN
    UPDATE public.applied_operations SET result = jsonb_build_object('status', 'rejected', 'reason', 'record not found') WHERE operation_id = p_operation_id;
    RETURN QUERY SELECT 'rejected'::text, 'record not found'::text, NULL::integer, NULL::text[];
    RETURN;
  END IF;
  IF p_base_version IS NULL OR p_base_version <> v_current_version THEN
    UPDATE public.applied_operations SET result = jsonb_build_object('status', 'conflict', 'current_version', v_current_version, 'conflicted_fields', to_jsonb(p_changed_fields)) WHERE operation_id = p_operation_id;
    RETURN QUERY SELECT 'conflict'::text, 'savings goal version changed'::text, v_current_version, p_changed_fields;
    RETURN;
  END IF;

  IF p_operation_type = 'delete' THEN
    UPDATE public.savings_goals SET deleted = true, version = version + 1, updated_at = now() WHERE id = p_record_id AND user_id = v_user_id;
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'savings_goals' AND column_name = 'deleted_at'
    ) THEN
      EXECUTE 'UPDATE public.savings_goals SET status = ''deleted'', deleted_at = now() WHERE id = $1 AND user_id = $2'
        USING p_record_id, v_user_id;
    END IF;
  ELSE
    IF p_changed_fields IS NULL OR array_length(p_changed_fields, 1) IS NULL OR NOT (p_changed_fields <@ ARRAY['name', 'goal_type', 'target_amount_centavos', 'starting_amount_centavos', 'target_date', 'priority', 'emergency_fund_baseline_centavos']) THEN RAISE EXCEPTION 'invalid savings goal fields'; END IF;
    UPDATE public.savings_goals SET
      name = CASE WHEN 'name' = ANY(p_changed_fields) THEN btrim(p_payload->>'name') ELSE name END,
      goal_type = CASE WHEN 'goal_type' = ANY(p_changed_fields) THEN p_payload->>'goal_type' ELSE goal_type END,
      target_amount_centavos = CASE WHEN 'target_amount_centavos' = ANY(p_changed_fields) THEN (p_payload->>'target_amount_centavos')::bigint ELSE target_amount_centavos END,
      starting_amount_centavos = CASE WHEN 'starting_amount_centavos' = ANY(p_changed_fields) THEN (p_payload->>'starting_amount_centavos')::bigint ELSE starting_amount_centavos END,
      target_date = CASE WHEN 'target_date' = ANY(p_changed_fields) THEN (p_payload->>'target_date')::date ELSE target_date END,
      priority = CASE WHEN 'priority' = ANY(p_changed_fields) THEN p_payload->>'priority' ELSE priority END,
      emergency_fund_baseline_centavos = CASE WHEN 'emergency_fund_baseline_centavos' = ANY(p_changed_fields) THEN (p_payload->>'emergency_fund_baseline_centavos')::bigint ELSE emergency_fund_baseline_centavos END,
      version = version + 1, updated_at = now()
    WHERE id = p_record_id AND user_id = v_user_id AND deleted = false;
  END IF;
  UPDATE public.applied_operations SET result = jsonb_build_object('status', 'applied', 'current_version', v_current_version + 1) WHERE operation_id = p_operation_id;
  RETURN QUERY SELECT 'applied'::text, NULL::text, v_current_version + 1, NULL::text[];
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_sync_operation(
  p_operation_id uuid, p_device_id text, p_entity text, p_record_id uuid,
  p_operation_type text, p_base_version integer, p_changed_fields text[], p_payload jsonb
) RETURNS TABLE(status text, reason text, current_version integer, conflicted_fields text[])
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, private, auth
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_already_applied boolean;
  v_result record;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF p_entity = 'savings_goals' THEN
    RETURN QUERY SELECT * FROM private.apply_savings_goal_sync_operation_core(p_operation_id, p_device_id, p_record_id, p_operation_type, p_base_version, p_changed_fields, p_payload);
    RETURN;
  END IF;
  SELECT EXISTS (SELECT 1 FROM public.applied_operations WHERE operation_id = p_operation_id AND user_id = v_user_id) INTO v_already_applied;
  IF p_entity = 'transactions' THEN
    PERFORM 1 FROM public.financial_accounts WHERE user_id = v_user_id AND kind <> 'credit_card' AND deleted = false ORDER BY id FOR UPDATE;
  END IF;
  SELECT * INTO v_result FROM private.apply_sync_operation_ledger_core(p_operation_id, p_device_id, p_entity, p_record_id, p_operation_type, p_base_version, p_changed_fields, p_payload);
  IF v_already_applied OR v_result.status <> 'applied' OR p_entity <> 'transactions' THEN
    RETURN QUERY SELECT v_result.status, v_result.reason, v_result.current_version, v_result.conflicted_fields;
    RETURN;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.financial_accounts AS account WHERE account.user_id = v_user_id AND account.kind <> 'credit_card' AND account.deleted = false
      AND account.opening_balance_centavos + COALESCE((SELECT SUM(CASE
        WHEN transaction_row.transaction_type = 'income' AND transaction_row.destination_account_id = account.id THEN transaction_row.amount_centavos
        WHEN transaction_row.transaction_type = 'expense' AND transaction_row.source_account_id = account.id THEN -transaction_row.amount_centavos
        WHEN transaction_row.transaction_type = 'transfer' AND transaction_row.destination_account_id = account.id THEN transaction_row.amount_centavos
        WHEN transaction_row.transaction_type = 'transfer' AND transaction_row.source_account_id = account.id THEN -transaction_row.amount_centavos ELSE 0 END)
        FROM public.transactions AS transaction_row WHERE transaction_row.user_id = account.user_id AND transaction_row.deleted = false AND transaction_row.status = 'posted'), 0) < 0
  ) THEN RAISE EXCEPTION 'transaction would overdraw a financial account'; END IF;
  WITH reconciled_balances AS (
    SELECT account.id, account.opening_balance_centavos + COALESCE((SELECT SUM(CASE
      WHEN transaction_row.transaction_type = 'income' AND transaction_row.destination_account_id = account.id THEN transaction_row.amount_centavos
      WHEN transaction_row.transaction_type = 'expense' AND transaction_row.source_account_id = account.id THEN -transaction_row.amount_centavos
      WHEN transaction_row.transaction_type = 'transfer' AND transaction_row.destination_account_id = account.id THEN transaction_row.amount_centavos
      WHEN transaction_row.transaction_type = 'transfer' AND transaction_row.source_account_id = account.id THEN -transaction_row.amount_centavos ELSE 0 END)
      FROM public.transactions AS transaction_row WHERE transaction_row.user_id = account.user_id AND transaction_row.deleted = false AND transaction_row.status = 'posted'), 0) AS current_balance_centavos
    FROM public.financial_accounts AS account WHERE account.user_id = v_user_id AND account.kind <> 'credit_card' AND account.deleted = false
  ) UPDATE public.financial_accounts AS account SET current_balance_centavos = reconciled_balances.current_balance_centavos,
    version = account.version + 1, updated_at = now() FROM reconciled_balances WHERE account.id = reconciled_balances.id
    AND account.current_balance_centavos IS DISTINCT FROM reconciled_balances.current_balance_centavos;
  RETURN QUERY SELECT v_result.status, v_result.reason, v_result.current_version, v_result.conflicted_fields;
END;
$$;

REVOKE EXECUTE ON FUNCTION private.apply_savings_goal_sync_operation_core(uuid, text, uuid, text, integer, text[], jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_sync_operation(uuid, text, text, uuid, text, integer, text[], jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_sync_operation(uuid, text, text, uuid, text, integer, text[], jsonb) TO authenticated;
