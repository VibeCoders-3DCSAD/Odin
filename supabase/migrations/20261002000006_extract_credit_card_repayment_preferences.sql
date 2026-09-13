CREATE TABLE public.credit_card_repayment_preferences (
  account_id uuid PRIMARY KEY REFERENCES public.financial_accounts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  strategy text NOT NULL CHECK (strategy IN ('pay_in_full', 'pay_minimum', 'percentage_of_statement', 'custom_payment')),
  custom_amount_centavos bigint CHECK (custom_amount_centavos IS NULL OR custom_amount_centavos > 0),
  percentage_bps integer CHECK (percentage_bps IS NULL OR percentage_bps BETWEEN 1 AND 10000),
  CHECK (
    (strategy = 'custom_payment' AND custom_amount_centavos IS NOT NULL AND percentage_bps IS NULL)
    OR (strategy = 'percentage_of_statement' AND custom_amount_centavos IS NULL AND percentage_bps IS NOT NULL)
    OR (strategy IN ('pay_in_full', 'pay_minimum') AND custom_amount_centavos IS NULL AND percentage_bps IS NULL)
  ),
  version integer NOT NULL DEFAULT 1,
  deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_synced_at timestamptz,
  UNIQUE (account_id, user_id)
);

INSERT INTO public.credit_card_repayment_preferences (
  account_id, user_id, strategy, custom_amount_centavos, percentage_bps,
  version, deleted, created_at, updated_at, last_synced_at
)
SELECT account_id, user_id, repayment_strategy,
  repayment_custom_amount_centavos, repayment_percentage_bps,
  1, false, created_at, updated_at, last_synced_at
FROM public.credit_card_details
WHERE repayment_strategy IS NOT NULL;

ALTER TABLE public.credit_card_repayment_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY credit_card_repayment_preferences_user_policy
  ON public.credit_card_repayment_preferences
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE INDEX credit_card_repayment_preferences_pull_idx
  ON public.credit_card_repayment_preferences(updated_at, account_id);

CREATE TRIGGER credit_card_repayment_preferences_account_guard
  BEFORE INSERT OR UPDATE ON public.credit_card_repayment_preferences
  FOR EACH ROW EXECUTE FUNCTION public.assert_credit_card_account();

ALTER TABLE public.credit_card_details
  DROP COLUMN repayment_strategy,
  DROP COLUMN repayment_custom_amount_centavos,
  DROP COLUMN repayment_percentage_bps;

CREATE OR REPLACE FUNCTION public.apply_credit_card_repayment_preference_sync_operation_core(
  p_operation_id uuid, p_device_id text, p_record_id uuid, p_operation_type text,
  p_base_version integer, p_changed_fields text[], p_payload jsonb
) RETURNS TABLE(status text, reason text, current_version integer, conflicted_fields text[])
LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE
  v_user uuid := auth.uid();
  v_existing_user uuid;
  v_version integer;
  v_payload jsonb := COALESCE(p_payload, '{}'::jsonb);
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF p_operation_type NOT IN ('create', 'update', 'delete') THEN RAISE EXCEPTION 'unsupported operation'; END IF;
  IF p_device_id IS NULL OR length(p_device_id) = 0 OR length(p_device_id) > 128 OR p_device_id !~ '^[A-Za-z0-9._:-]+$' THEN RAISE EXCEPTION 'invalid device id'; END IF;
  IF octet_length(v_payload::text) > 256000 THEN RAISE EXCEPTION 'credit-card repayment preference payload is too large'; END IF;

  INSERT INTO public.applied_operations(operation_id, user_id, device_id, entity, record_id, operation_type, result)
  VALUES (p_operation_id, v_user, p_device_id, 'credit_card_repayment_preferences', p_record_id, p_operation_type, jsonb_build_object('status', 'pending'))
  ON CONFLICT(operation_id) DO NOTHING;
  IF NOT FOUND THEN
    SELECT user_id INTO v_existing_user FROM public.applied_operations WHERE operation_id = p_operation_id;
    IF v_existing_user IS DISTINCT FROM v_user THEN
      RETURN QUERY SELECT 'rejected'::text, 'operation belongs to another user'::text, NULL::integer, NULL::text[];
    ELSE
      RETURN QUERY SELECT 'duplicate'::text, NULL::text, NULL::integer, NULL::text[];
    END IF;
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.financial_accounts
    WHERE id = p_record_id AND user_id = v_user AND kind = 'credit_card' AND deleted = false
  ) THEN RAISE EXCEPTION 'account_id does not reference an accessible credit card'; END IF;

  IF p_operation_type = 'create' THEN
    IF v_payload->>'strategy' NOT IN ('pay_in_full', 'pay_minimum', 'percentage_of_statement', 'custom_payment') THEN RAISE EXCEPTION 'repayment strategy is invalid'; END IF;
    IF v_payload->>'strategy' = 'custom_payment' AND (v_payload->>'custom_amount_centavos') !~ '^[1-9][0-9]*$' THEN RAISE EXCEPTION 'custom_amount_centavos must be positive'; END IF;
    IF v_payload->>'strategy' = 'percentage_of_statement' AND ((v_payload->>'percentage_bps') !~ '^[1-9][0-9]*$' OR (v_payload->>'percentage_bps')::integer > 10000) THEN RAISE EXCEPTION 'percentage_bps must be between 1 and 10000'; END IF;
    INSERT INTO public.credit_card_repayment_preferences (
      account_id, user_id, strategy, custom_amount_centavos, percentage_bps, version, deleted
    ) VALUES (
      p_record_id, v_user, v_payload->>'strategy',
      NULLIF(v_payload->>'custom_amount_centavos', '')::bigint,
      NULLIF(v_payload->>'percentage_bps', '')::integer, 1, false
    );
    UPDATE public.applied_operations SET result = jsonb_build_object('status', 'applied', 'current_version', 1) WHERE operation_id = p_operation_id;
    RETURN QUERY SELECT 'applied'::text, NULL::text, 1, NULL::text[];
    RETURN;
  END IF;

  SELECT version INTO v_version FROM public.credit_card_repayment_preferences
   WHERE account_id = p_record_id AND user_id = v_user AND deleted = false FOR UPDATE;
  IF v_version IS NULL THEN RAISE EXCEPTION 'credit-card repayment preference not found or inaccessible'; END IF;
  IF p_operation_type = 'update' THEN
    IF p_base_version IS NULL OR p_base_version <> v_version THEN
      UPDATE public.applied_operations SET result = jsonb_build_object('status', 'conflict', 'current_version', v_version, 'conflicted_fields', to_jsonb(p_changed_fields)) WHERE operation_id = p_operation_id;
      RETURN QUERY SELECT 'conflict'::text, 'credit-card repayment preference version changed'::text, v_version, p_changed_fields;
      RETURN;
    END IF;
    IF p_changed_fields IS NULL OR NOT p_changed_fields <@ ARRAY['account_id', 'strategy', 'custom_amount_centavos', 'percentage_bps'] THEN RAISE EXCEPTION 'credit-card repayment preference field is not syncable'; END IF;
    UPDATE public.credit_card_repayment_preferences
       SET strategy = COALESCE(v_payload->>'strategy', strategy),
           custom_amount_centavos = CASE WHEN v_payload ? 'custom_amount_centavos' THEN NULLIF(v_payload->>'custom_amount_centavos', '')::bigint ELSE custom_amount_centavos END,
           percentage_bps = CASE WHEN v_payload ? 'percentage_bps' THEN NULLIF(v_payload->>'percentage_bps', '')::integer ELSE percentage_bps END,
           version = version + 1, updated_at = now()
     WHERE account_id = p_record_id AND user_id = v_user;
    v_version := v_version + 1;
  ELSE
    UPDATE public.credit_card_repayment_preferences
       SET deleted = true, version = version + 1, updated_at = now()
     WHERE account_id = p_record_id AND user_id = v_user;
    v_version := v_version + 1;
  END IF;
  UPDATE public.applied_operations SET result = jsonb_build_object('status', 'applied', 'current_version', v_version) WHERE operation_id = p_operation_id;
  RETURN QUERY SELECT 'applied'::text, NULL::text, v_version, NULL::text[];
END;
$$;

REVOKE EXECUTE ON FUNCTION public.apply_credit_card_repayment_preference_sync_operation_core(uuid, text, uuid, text, integer, text[], jsonb)
  FROM PUBLIC, anon, authenticated;

-- The public RPC remains stable; repayment preferences use the consolidated
-- core instead of adding another versioned credit-card RPC.
CREATE OR REPLACE FUNCTION public.apply_credit_card_sync_operation(
  p_operation_id uuid, p_device_id text, p_entity text, p_record_id uuid,
  p_operation_type text, p_base_version integer, p_changed_fields text[], p_payload jsonb
) RETURNS TABLE(status text, reason text, current_version integer, conflicted_fields text[])
LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_previous_amount bigint;
  v_current_amount bigint;
  v_account_id uuid;
  v_delta bigint;
  v_result record;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;

  IF p_entity = 'credit_card_payments' AND p_operation_type IN ('update', 'delete') THEN
    SELECT payment.amount_centavos, cycle.account_id
      INTO v_previous_amount, v_account_id
      FROM public.credit_card_payments AS payment
      JOIN public.credit_card_cycles AS cycle
        ON cycle.id = payment.cycle_id AND cycle.user_id = payment.user_id
     WHERE payment.id = p_record_id AND payment.user_id = v_user_id AND payment.deleted = false
     FOR UPDATE;
  END IF;

  IF p_entity = 'credit_card_repayment_preferences' THEN
    RETURN QUERY SELECT * FROM public.apply_credit_card_repayment_preference_sync_operation_core(
      p_operation_id, p_device_id, p_record_id, p_operation_type,
      p_base_version, p_changed_fields, p_payload
    );
    RETURN;
  END IF;

  SELECT * INTO v_result FROM public.apply_credit_card_sync_operation_core(
    p_operation_id, p_device_id, p_entity, p_record_id, p_operation_type,
    p_base_version, p_changed_fields, p_payload
  );

  IF v_result.status <> 'applied' OR p_entity <> 'credit_card_payments' THEN
    RETURN QUERY SELECT v_result.status, v_result.reason, v_result.current_version, v_result.conflicted_fields;
    RETURN;
  END IF;

  IF p_operation_type = 'delete' THEN
    v_delta := -v_previous_amount;
  ELSE
    SELECT payment.amount_centavos, cycle.account_id
      INTO v_current_amount, v_account_id
      FROM public.credit_card_payments AS payment
      JOIN public.credit_card_cycles AS cycle
        ON cycle.id = payment.cycle_id AND cycle.user_id = payment.user_id
     WHERE payment.id = p_record_id AND payment.user_id = v_user_id AND payment.deleted = false;
    v_delta := v_current_amount - COALESCE(v_previous_amount, 0);
  END IF;

  IF v_account_id IS NULL OR v_delta IS NULL THEN
    RAISE EXCEPTION 'credit-card payment card is invalid';
  END IF;

  IF v_delta <> 0 THEN
    PERFORM set_config('odin.credit_card_invariant_path', 'true', true);
    UPDATE public.credit_card_details
       SET available_credit_centavos = LEAST(
             credit_limit_centavos,
             COALESCE(available_credit_centavos, credit_limit_centavos) + v_delta
           ),
           version = version + 1,
           updated_at = now()
     WHERE account_id = v_account_id AND user_id = v_user_id AND deleted = false;
    IF NOT FOUND THEN RAISE EXCEPTION 'credit-card details not found'; END IF;
  END IF;

  RETURN QUERY SELECT v_result.status, v_result.reason, v_result.current_version, v_result.conflicted_fields;
END;
$$;

ALTER FUNCTION public.apply_credit_card_sync_operation(uuid, text, text, uuid, text, integer, text[], jsonb)
  SECURITY DEFINER
  SET search_path = public, auth;

GRANT EXECUTE ON FUNCTION public.apply_credit_card_sync_operation(uuid, text, text, uuid, text, integer, text[], jsonb)
  TO authenticated;
