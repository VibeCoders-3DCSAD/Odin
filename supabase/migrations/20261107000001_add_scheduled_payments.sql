-- Billers and Remittances: one scheduled payment per bill or remittance, and one record per payment made.
-- Auto-post runs on the device, so these tables carry no server-side engine.
CREATE TABLE public.scheduled_payments (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  subcategory_id uuid NOT NULL REFERENCES public.subcategories(id),
  source_account_id uuid NOT NULL REFERENCES public.financial_accounts(id),
  amount_centavos bigint NOT NULL CHECK (amount_centavos > 0),
  frequency text NOT NULL CHECK (frequency IN ('weekly', 'biweekly', 'semi_monthly', 'monthly', 'quarterly', 'yearly', 'once')),
  due_day_of_month smallint CHECK (due_day_of_month BETWEEN 1 AND 31),
  due_second_day_of_month smallint CHECK (due_second_day_of_month BETWEEN 1 AND 31),
  due_day_of_week smallint CHECK (due_day_of_week BETWEEN 0 AND 6),
  due_month smallint CHECK (due_month BETWEEN 1 AND 12),
  starts_on date NOT NULL,
  ends_on date,
  auto_post boolean NOT NULL DEFAULT false,
  auto_post_from date,
  is_family_support boolean NOT NULL DEFAULT false,
  is_dependent_support boolean NOT NULL DEFAULT false,
  protected_by_default boolean NOT NULL DEFAULT true,
  notes text CHECK (notes IS NULL OR length(notes) <= 1000),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  version integer NOT NULL DEFAULT 1,
  deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_synced_at timestamptz,
  CONSTRAINT scheduled_payments_period_chk CHECK (ends_on IS NULL OR ends_on >= starts_on),
  CONSTRAINT scheduled_payments_schedule_chk CHECK (
    (frequency IN ('weekly', 'biweekly') AND due_day_of_week IS NOT NULL)
    OR (frequency = 'semi_monthly' AND due_day_of_month IS NOT NULL AND due_second_day_of_month IS NOT NULL AND due_day_of_month <> due_second_day_of_month)
    OR (frequency IN ('monthly', 'quarterly') AND due_day_of_month IS NOT NULL)
    OR (frequency = 'yearly' AND due_day_of_month IS NOT NULL AND due_month IS NOT NULL)
    OR frequency = 'once'
  ),
  CONSTRAINT scheduled_payments_auto_post_chk CHECK (NOT auto_post OR (frequency <> 'once' AND auto_post_from IS NOT NULL))
);
CREATE INDEX idx_scheduled_payments_user ON public.scheduled_payments (user_id, deleted, status);

CREATE TABLE public.scheduled_payment_records (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scheduled_payment_id uuid NOT NULL REFERENCES public.scheduled_payments(id),
  transaction_id uuid NOT NULL REFERENCES public.transactions(id),
  occurrence_date date NOT NULL,
  payment_date date NOT NULL,
  amount_centavos bigint NOT NULL CHECK (amount_centavos > 0),
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'auto')),
  notes text CHECK (notes IS NULL OR length(notes) <= 1000),
  version integer NOT NULL DEFAULT 1,
  deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_synced_at timestamptz
);
CREATE UNIQUE INDEX scheduled_payment_records_live_transaction_idx ON public.scheduled_payment_records (user_id, transaction_id) WHERE deleted = false;
CREATE INDEX idx_scheduled_payment_records_occurrence ON public.scheduled_payment_records (user_id, scheduled_payment_id, occurrence_date) WHERE deleted = false;

ALTER TABLE public.scheduled_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_payment_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read their scheduled payments" ON public.scheduled_payments FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "users read their scheduled payment records" ON public.scheduled_payment_records FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.apply_scheduled_payment_sync_operation(
  p_operation_id uuid, p_device_id text, p_entity text, p_record_id uuid,
  p_operation_type text, p_base_version integer, p_changed_fields text[], p_payload jsonb
) RETURNS TABLE(status text, reason text, current_version integer, conflicted_fields text[])
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private, auth AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_existing_user_id uuid;
  v_version integer;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF p_entity NOT IN ('scheduled_payments', 'scheduled_payment_records') THEN RAISE EXCEPTION 'entity % is not a scheduled payment entity', p_entity; END IF;
  IF p_operation_type NOT IN ('create', 'update', 'delete') THEN RAISE EXCEPTION 'unsupported operation'; END IF;
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN RAISE EXCEPTION 'payload must be an object'; END IF;

  INSERT INTO public.applied_operations (operation_id, user_id, device_id, entity, record_id, operation_type, result)
  VALUES (p_operation_id, v_user_id, p_device_id, p_entity, p_record_id, p_operation_type, jsonb_build_object('status', 'pending'))
  ON CONFLICT (operation_id) DO NOTHING;
  IF NOT FOUND THEN
    SELECT operation.user_id INTO v_existing_user_id FROM public.applied_operations AS operation WHERE operation.operation_id = p_operation_id;
    IF v_existing_user_id IS DISTINCT FROM v_user_id THEN
      RETURN QUERY SELECT 'rejected'::text, 'operation belongs to another user'::text, NULL::integer, NULL::text[];
    ELSE
      RETURN QUERY SELECT 'duplicate'::text, NULL::text, NULL::integer, NULL::text[];
    END IF;
    RETURN;
  END IF;

  IF p_payload ? 'subcategory_id' AND NOT EXISTS (
    SELECT 1 FROM public.subcategories AS sub
     WHERE sub.id = (p_payload->>'subcategory_id')::uuid AND sub.user_id = v_user_id AND sub.kind = 'expense' AND sub.is_active AND NOT sub.deleted
  ) THEN RAISE EXCEPTION 'subcategory is not an accessible expense subcategory'; END IF;
  IF p_payload ? 'source_account_id' AND NOT EXISTS (
    SELECT 1 FROM public.financial_accounts AS account
     WHERE account.id = (p_payload->>'source_account_id')::uuid AND account.user_id = v_user_id AND account.status = 'active' AND NOT account.deleted
  ) THEN RAISE EXCEPTION 'source account is not an accessible active account'; END IF;

  IF p_entity = 'scheduled_payments' THEN
    IF p_operation_type = 'create' THEN
      -- Ids are client-generated; replaying an id this user already owns is a no-op.
      IF EXISTS (SELECT 1 FROM public.scheduled_payments AS payment WHERE payment.id = p_record_id AND payment.user_id = v_user_id) THEN
        UPDATE public.applied_operations AS operation SET result = jsonb_build_object('status', 'duplicate') WHERE operation.operation_id = p_operation_id;
        RETURN QUERY SELECT 'duplicate'::text, NULL::text, NULL::integer, NULL::text[];
        RETURN;
      END IF;
      INSERT INTO public.scheduled_payments (
        id, user_id, name, subcategory_id, source_account_id, amount_centavos, frequency,
        due_day_of_month, due_second_day_of_month, due_day_of_week, due_month, starts_on, ends_on,
        auto_post, auto_post_from, is_family_support, is_dependent_support, protected_by_default, notes, status
      ) VALUES (
        p_record_id, v_user_id, btrim(p_payload->>'name'), (p_payload->>'subcategory_id')::uuid,
        (p_payload->>'source_account_id')::uuid, (p_payload->>'amount_centavos')::bigint, p_payload->>'frequency',
        (p_payload->>'due_day_of_month')::smallint, (p_payload->>'due_second_day_of_month')::smallint,
        (p_payload->>'due_day_of_week')::smallint, (p_payload->>'due_month')::smallint,
        (p_payload->>'starts_on')::date, (p_payload->>'ends_on')::date,
        COALESCE((p_payload->>'auto_post')::boolean, false), (p_payload->>'auto_post_from')::date,
        COALESCE((p_payload->>'is_family_support')::boolean, false), COALESCE((p_payload->>'is_dependent_support')::boolean, false),
        COALESCE((p_payload->>'protected_by_default')::boolean, true), p_payload->>'notes', 'active'
      );
      v_version := 1;
    ELSE
      SELECT payment.version INTO v_version FROM public.scheduled_payments AS payment
       WHERE payment.id = p_record_id AND payment.user_id = v_user_id AND NOT payment.deleted FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'scheduled payment not found or inaccessible'; END IF;
      IF p_base_version IS NOT NULL AND p_base_version <> v_version THEN
        DELETE FROM public.applied_operations AS operation WHERE operation.operation_id = p_operation_id;
        RETURN QUERY SELECT 'conflict'::text, 'scheduled payment version changed'::text, v_version, p_changed_fields;
        RETURN;
      END IF;
      IF p_operation_type = 'delete' THEN
        UPDATE public.scheduled_payments AS payment SET deleted = true, auto_post = false, version = v_version + 1, updated_at = now()
         WHERE payment.id = p_record_id AND payment.user_id = v_user_id;
      ELSE
        UPDATE public.scheduled_payments AS payment SET
          name = CASE WHEN p_payload ? 'name' THEN btrim(p_payload->>'name') ELSE payment.name END,
          subcategory_id = CASE WHEN p_payload ? 'subcategory_id' THEN (p_payload->>'subcategory_id')::uuid ELSE payment.subcategory_id END,
          source_account_id = CASE WHEN p_payload ? 'source_account_id' THEN (p_payload->>'source_account_id')::uuid ELSE payment.source_account_id END,
          amount_centavos = CASE WHEN p_payload ? 'amount_centavos' THEN (p_payload->>'amount_centavos')::bigint ELSE payment.amount_centavos END,
          frequency = CASE WHEN p_payload ? 'frequency' THEN p_payload->>'frequency' ELSE payment.frequency END,
          due_day_of_month = CASE WHEN p_payload ? 'due_day_of_month' THEN (p_payload->>'due_day_of_month')::smallint ELSE payment.due_day_of_month END,
          due_second_day_of_month = CASE WHEN p_payload ? 'due_second_day_of_month' THEN (p_payload->>'due_second_day_of_month')::smallint ELSE payment.due_second_day_of_month END,
          due_day_of_week = CASE WHEN p_payload ? 'due_day_of_week' THEN (p_payload->>'due_day_of_week')::smallint ELSE payment.due_day_of_week END,
          due_month = CASE WHEN p_payload ? 'due_month' THEN (p_payload->>'due_month')::smallint ELSE payment.due_month END,
          starts_on = CASE WHEN p_payload ? 'starts_on' THEN (p_payload->>'starts_on')::date ELSE payment.starts_on END,
          ends_on = CASE WHEN p_payload ? 'ends_on' THEN (p_payload->>'ends_on')::date ELSE payment.ends_on END,
          auto_post = CASE WHEN p_payload ? 'auto_post' THEN (p_payload->>'auto_post')::boolean ELSE payment.auto_post END,
          auto_post_from = CASE WHEN p_payload ? 'auto_post_from' THEN (p_payload->>'auto_post_from')::date ELSE payment.auto_post_from END,
          is_family_support = CASE WHEN p_payload ? 'is_family_support' THEN (p_payload->>'is_family_support')::boolean ELSE payment.is_family_support END,
          is_dependent_support = CASE WHEN p_payload ? 'is_dependent_support' THEN (p_payload->>'is_dependent_support')::boolean ELSE payment.is_dependent_support END,
          protected_by_default = CASE WHEN p_payload ? 'protected_by_default' THEN (p_payload->>'protected_by_default')::boolean ELSE payment.protected_by_default END,
          notes = CASE WHEN p_payload ? 'notes' THEN p_payload->>'notes' ELSE payment.notes END,
          status = CASE WHEN p_payload ? 'status' THEN p_payload->>'status' ELSE payment.status END,
          version = v_version + 1, updated_at = now()
         WHERE payment.id = p_record_id AND payment.user_id = v_user_id;
      END IF;
      v_version := v_version + 1;
    END IF;
  ELSE
    IF p_operation_type = 'create' THEN
      IF EXISTS (SELECT 1 FROM public.scheduled_payment_records AS record WHERE record.id = p_record_id AND record.user_id = v_user_id) THEN
        UPDATE public.applied_operations AS operation SET result = jsonb_build_object('status', 'duplicate') WHERE operation.operation_id = p_operation_id;
        RETURN QUERY SELECT 'duplicate'::text, NULL::text, NULL::integer, NULL::text[];
        RETURN;
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM public.scheduled_payments AS payment
         WHERE payment.id = (p_payload->>'scheduled_payment_id')::uuid AND payment.user_id = v_user_id AND payment.status = 'active' AND NOT payment.deleted
      ) THEN RAISE EXCEPTION 'payment requires an active scheduled payment'; END IF;
      IF NOT EXISTS (
        SELECT 1 FROM public.transactions AS tx
         WHERE tx.id = (p_payload->>'transaction_id')::uuid AND tx.user_id = v_user_id AND tx.transaction_type = 'expense' AND NOT tx.deleted
      ) THEN RAISE EXCEPTION 'payment requires an owned expense transaction'; END IF;
      INSERT INTO public.scheduled_payment_records (
        id, user_id, scheduled_payment_id, transaction_id, occurrence_date, payment_date, amount_centavos, source, notes
      ) VALUES (
        p_record_id, v_user_id, (p_payload->>'scheduled_payment_id')::uuid, (p_payload->>'transaction_id')::uuid,
        (p_payload->>'occurrence_date')::date, (p_payload->>'payment_date')::date, (p_payload->>'amount_centavos')::bigint,
        COALESCE(p_payload->>'source', 'manual'), p_payload->>'notes'
      );
      v_version := 1;
    ELSE
      SELECT record.version INTO v_version FROM public.scheduled_payment_records AS record
       WHERE record.id = p_record_id AND record.user_id = v_user_id AND NOT record.deleted FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'payment record not found or inaccessible'; END IF;
      IF p_base_version IS NOT NULL AND p_base_version <> v_version THEN
        DELETE FROM public.applied_operations AS operation WHERE operation.operation_id = p_operation_id;
        RETURN QUERY SELECT 'conflict'::text, 'payment record version changed'::text, v_version, p_changed_fields;
        RETURN;
      END IF;
      IF p_operation_type = 'update' THEN RAISE EXCEPTION 'payment records cannot be updated; delete and record again'; END IF;
      UPDATE public.scheduled_payment_records AS record SET deleted = true, version = v_version + 1, updated_at = now()
       WHERE record.id = p_record_id AND record.user_id = v_user_id;
      v_version := v_version + 1;
    END IF;
  END IF;

  UPDATE public.applied_operations AS operation SET result = jsonb_build_object('status', 'applied', 'current_version', v_version) WHERE operation.operation_id = p_operation_id;
  RETURN QUERY SELECT 'applied'::text, NULL::text, v_version, NULL::text[];
END;
$$;

REVOKE EXECUTE ON FUNCTION public.apply_scheduled_payment_sync_operation(uuid, text, text, uuid, text, integer, text[], jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_scheduled_payment_sync_operation(uuid, text, text, uuid, text, integer, text[], jsonb) TO authenticated;
