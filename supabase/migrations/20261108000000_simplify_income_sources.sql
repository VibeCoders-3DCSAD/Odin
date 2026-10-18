-- Income is paid monthly, twice a month, every week or every day, at one expected amount.
-- Variable income, the biweekly/irregular/custom frequencies and the columns only they used are removed.
ALTER TYPE public.odin_recurring_frequency ADD VALUE IF NOT EXISTS 'daily';

-- Sources that do not fit the new shape are deleted; their recurring templates stop posting.
CREATE TEMP TABLE retired_income_sources ON COMMIT DROP AS
SELECT id, recurring_template_id FROM public.income_sources
 WHERE deleted
    OR income_type <> 'stable'
    OR frequency::text NOT IN ('weekly', 'semi_monthly', 'monthly')
    OR expected_amount_centavos IS NULL OR expected_amount_centavos <= 0
    OR (frequency = 'weekly' AND payday_day_of_week IS NULL)
    OR (frequency = 'monthly' AND payday_day_of_month IS NULL)
    OR (frequency = 'semi_monthly' AND (payday_day_of_month IS NULL OR payday_second_day_of_month IS NULL
        OR payday_day_of_month >= LEAST(payday_second_day_of_month, 28)));

UPDATE public.recurring_transaction_occurrences o
   SET deleted = true, updated_at = now(), version = o.version + 1
  FROM retired_income_sources r
 WHERE o.recurring_template_id = r.recurring_template_id AND o.deleted = false;

UPDATE public.recurring_transaction_templates t
   SET deleted = true, status = 'deleted', updated_at = now(), version = t.version + 1
  FROM retired_income_sources r
 WHERE t.id = r.recurring_template_id AND t.deleted = false;

DELETE FROM public.income_sources s USING retired_income_sources r WHERE s.id = r.id;

ALTER TABLE public.income_sources
  DROP COLUMN income_type,
  DROP COLUMN min_amount_centavos,
  DROP COLUMN max_amount_centavos,
  DROP COLUMN estimated_interval_days,
  DROP COLUMN payday_second_day_of_week;

CREATE TYPE public.odin_income_frequency_v2 AS ENUM ('daily', 'weekly', 'semi_monthly', 'monthly');
ALTER TABLE public.income_sources
  ALTER COLUMN frequency TYPE public.odin_income_frequency_v2 USING frequency::text::public.odin_income_frequency_v2;
DROP TYPE public.odin_income_frequency;
ALTER TYPE public.odin_income_frequency_v2 RENAME TO odin_income_frequency;

-- Twice a month needs Date 1 before Date 2, and the two must still differ in February,
-- when every day past the 28th falls back to the 28th.
ALTER TABLE public.income_sources
  ALTER COLUMN expected_amount_centavos SET NOT NULL,
  ADD CONSTRAINT income_sources_amount_chk CHECK (expected_amount_centavos > 0),
  ADD CONSTRAINT income_sources_schedule_chk CHECK (
    frequency = 'daily'
    OR (frequency = 'weekly' AND payday_day_of_week IS NOT NULL)
    OR (frequency = 'monthly' AND payday_day_of_month IS NOT NULL)
    OR (frequency = 'semi_monthly' AND payday_day_of_month IS NOT NULL AND payday_second_day_of_month IS NOT NULL
        AND payday_day_of_month < LEAST(payday_second_day_of_month, 28))
  );

CREATE OR REPLACE FUNCTION private.apply_sync_operation_ledger_core(p_operation_id uuid, p_device_id text, p_entity text, p_record_id uuid, p_operation_type text, p_base_version integer, p_changed_fields text[], p_payload jsonb)
 RETURNS TABLE(status text, reason text, current_version integer, conflicted_fields text[])
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'odin', 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_existing_user_id uuid;
  v_existing_result jsonb;
  v_current_version integer;
  v_now timestamptz := now();
  v_overwritten_values jsonb := '{}'::jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  IF p_device_id IS NULL OR length(p_device_id) = 0 OR length(p_device_id) > 128 OR p_device_id !~ '^[A-Za-z0-9._:-]+$' THEN
    RAISE EXCEPTION 'invalid device id';
  END IF;

  IF p_entity NOT IN (
    'categories',
    'subcategories',
    'financial_accounts',
    'income_sources',
    'financial_obligations',
    'transactions',
    'transaction_templates',
    'recurring_transaction_templates',
    'recurring_transaction_occurrences'
  ) THEN
    RAISE EXCEPTION 'entity % is not syncable', p_entity;
  END IF;

  IF p_operation_type NOT IN ('create', 'update', 'delete') THEN
    RAISE EXCEPTION 'operation_type % is invalid', p_operation_type;
  END IF;

  INSERT INTO applied_operations (
    operation_id, user_id, device_id, entity, record_id, operation_type, result
  ) VALUES (
    p_operation_id, v_user_id, p_device_id, p_entity, p_record_id,
    p_operation_type, jsonb_build_object('status', 'pending')
  ) ON CONFLICT (operation_id) DO NOTHING;

  IF NOT FOUND THEN
    SELECT user_id, result INTO v_existing_user_id, v_existing_result
    FROM applied_operations WHERE operation_id = p_operation_id;

    IF v_existing_user_id IS DISTINCT FROM v_user_id THEN
      RETURN QUERY SELECT 'rejected'::text, 'operation belongs to another user'::text, NULL::integer, NULL::text[];
      RETURN;
    END IF;

    RETURN QUERY SELECT
      CASE WHEN COALESCE(v_existing_result->>'status', 'duplicate') = 'pending'
        THEN 'duplicate' ELSE COALESCE(v_existing_result->>'status', 'duplicate') END::text,
      NULLIF(v_existing_result->>'reason', '')::text,
      CASE WHEN v_existing_result ? 'current_version'
        THEN (v_existing_result->>'current_version')::integer ELSE NULL::integer END,
      CASE WHEN v_existing_result ? 'conflicted_fields'
        THEN ARRAY(SELECT jsonb_array_elements_text(v_existing_result->'conflicted_fields'))
        ELSE NULL::text[] END;
    RETURN;
  END IF;

  -- CREATE
  IF p_operation_type = 'create' THEN
    IF p_entity = 'categories' THEN
      PERFORM 1 FROM category_groups WHERE id = (p_payload->>'category_group_id')::uuid AND is_active = true;
      IF NOT FOUND THEN
        UPDATE applied_operations SET result = jsonb_build_object('status', 'rejected', 'reason', 'category_group_id does not reference an active category group')
        WHERE operation_id = p_operation_id;
        RETURN QUERY SELECT 'rejected'::text, 'category_group_id does not reference an active category group'::text, NULL::integer, NULL::text[];
        RETURN;
      END IF;
      INSERT INTO categories (id, category_group_id, user_id, slug, label, short_label, description, is_system, is_filipino_context, sort_order, is_active, metadata, updated_at, version, deleted)
      VALUES (p_record_id, (p_payload->>'category_group_id')::uuid, v_user_id, p_payload->>'slug', p_payload->>'label', p_payload->>'short_label', p_payload->>'description',
        false, COALESCE((p_payload->>'is_filipino_context')::boolean, false), COALESCE((p_payload->>'sort_order')::integer, 0), true, '{}'::jsonb, v_now, 1, false);

    ELSIF p_entity = 'subcategories' THEN
      IF (p_payload->>'kind') = 'expense' THEN
        PERFORM 1 FROM categories WHERE id = (p_payload->>'category_id')::uuid AND deleted = false AND is_active = true AND (user_id = v_user_id OR user_id IS NULL);
        IF NOT FOUND THEN
          UPDATE applied_operations SET result = jsonb_build_object('status', 'rejected', 'reason', 'category_id does not reference an accessible active category')
          WHERE operation_id = p_operation_id;
          RETURN QUERY SELECT 'rejected'::text, 'category_id does not reference an accessible active category'::text, NULL::integer, NULL::text[];
          RETURN;
        END IF;
      END IF;
      INSERT INTO subcategories (id, category_id, user_id, slug, kind, label, short_label, description, is_system, is_filipino_context, is_protected_default, is_protected, sort_order, is_active, metadata, updated_at, version, deleted)
      VALUES (p_record_id, CASE WHEN (p_payload->>'kind') = 'expense' THEN (p_payload->>'category_id')::uuid ELSE NULL END, v_user_id, p_payload->>'slug',
        (p_payload->>'kind')::odin_subcategory_kind, p_payload->>'label', p_payload->>'short_label', p_payload->>'description',
        false, COALESCE((p_payload->>'is_filipino_context')::boolean, false), false, COALESCE((p_payload->>'is_protected')::boolean, false),
        COALESCE((p_payload->>'sort_order')::integer, 0), true, '{}'::jsonb, v_now, 1, false);

    ELSIF p_entity = 'financial_accounts' THEN
      INSERT INTO financial_accounts (id, user_id, name, kind, status, opening_balance_centavos, current_balance_centavos, include_in_dashboard_balance, institution_name, opened_on, sort_order, metadata, updated_at, version, deleted)
      VALUES (p_record_id, v_user_id, p_payload->>'name', (p_payload->>'kind')::odin_account_kind, 'active',
        COALESCE((p_payload->>'opening_balance_centavos')::bigint, 0), COALESCE((p_payload->>'opening_balance_centavos')::bigint, 0),
        COALESCE((p_payload->>'include_in_dashboard_balance')::boolean, true),
        p_payload->>'institution_name', (p_payload->>'opened_on')::date, COALESCE((p_payload->>'sort_order')::integer, 0), '{}'::jsonb, v_now, 1, false);

    ELSIF p_entity = 'income_sources' THEN
      INSERT INTO income_sources (id, user_id, recurring_template_id, destination_account_id, subcategory_id, name, frequency, expected_amount_centavos,
        payday_day_of_month, payday_second_day_of_month, payday_day_of_week, next_expected_date, is_active, notes, metadata, updated_at, version, deleted)
      VALUES (p_record_id, v_user_id, (p_payload->>'recurring_template_id')::uuid, (p_payload->>'destination_account_id')::uuid, (p_payload->>'subcategory_id')::uuid,
        p_payload->>'name', (p_payload->>'frequency')::odin_income_frequency, (p_payload->>'expected_amount_centavos')::bigint,
        (p_payload->>'payday_day_of_month')::integer, (p_payload->>'payday_second_day_of_month')::integer, (p_payload->>'payday_day_of_week')::integer,
        (p_payload->>'next_expected_date')::date,
        COALESCE((p_payload->>'is_active')::boolean, true), p_payload->>'notes', '{}'::jsonb, v_now, 1, false);

    ELSIF p_entity = 'financial_obligations' THEN
      PERFORM 1 FROM subcategories WHERE id = (p_payload->>'subcategory_id')::uuid AND kind = 'expense' AND deleted = false AND is_active = true AND (user_id = v_user_id OR user_id IS NULL);
      IF NOT FOUND THEN
        UPDATE applied_operations SET result = jsonb_build_object('status', 'rejected', 'reason', 'subcategory_id does not reference an accessible active expense subcategory')
        WHERE operation_id = p_operation_id;
        RETURN QUERY SELECT 'rejected'::text, 'subcategory_id does not reference an accessible active expense subcategory'::text, NULL::integer, NULL::text[];
        RETURN;
      END IF;
      IF (p_payload->>'recurring_template_id') IS NOT NULL THEN
        PERFORM 1 FROM recurring_transaction_templates WHERE id = (p_payload->>'recurring_template_id')::uuid AND user_id = v_user_id;
        IF NOT FOUND THEN
          UPDATE applied_operations SET result = jsonb_build_object('status', 'rejected', 'reason', 'recurring_template_id does not reference an accessible recurring template')
          WHERE operation_id = p_operation_id;
          RETURN QUERY SELECT 'rejected'::text, 'recurring_template_id does not reference an accessible recurring template'::text, NULL::integer, NULL::text[];
          RETURN;
        END IF;
      END IF;
      INSERT INTO financial_obligations (id, user_id, subcategory_id, recurring_template_id, name, status, amount_centavos, frequency,
        due_day_of_month, due_second_day_of_month, due_day_of_week, due_second_day_of_week, due_month,
        is_family_support, is_dependent_support, protected_by_default, starts_on, ends_on, notes, metadata, updated_at, version, deleted)
      VALUES (p_record_id, v_user_id, (p_payload->>'subcategory_id')::uuid, (p_payload->>'recurring_template_id')::uuid, p_payload->>'name', 'active',
        (p_payload->>'amount_centavos')::bigint, (p_payload->>'frequency')::odin_recurring_frequency, (p_payload->>'due_day_of_month')::integer,
        (p_payload->>'due_second_day_of_month')::integer, (p_payload->>'due_day_of_week')::integer, (p_payload->>'due_second_day_of_week')::integer,
        (p_payload->>'due_month')::integer,
        COALESCE((p_payload->>'is_family_support')::boolean, false), COALESCE((p_payload->>'is_dependent_support')::boolean, false),
        COALESCE((p_payload->>'protected_by_default')::boolean, true), (p_payload->>'starts_on')::date, (p_payload->>'ends_on')::date,
        p_payload->>'notes', '{}'::jsonb, v_now, 1, false);

    ELSIF p_entity = 'transactions' THEN
      IF EXISTS (SELECT 1 FROM transactions WHERE id = p_record_id AND user_id = v_user_id) THEN
        IF (SELECT client_mutation_id FROM transactions WHERE id = p_record_id AND user_id = v_user_id)
          IS DISTINCT FROM p_payload->>'client_mutation_id' THEN
          RAISE EXCEPTION 'transaction already exists with a different mutation';
        END IF;
      ELSE
        INSERT INTO transactions (id, user_id, transaction_type, status, entry_source, transaction_date, posted_at, amount_centavos,
          subcategory_id, source_account_id, destination_account_id, merchant_name, counterparty_name, notes, client_mutation_id,
          metadata, updated_at, version, deleted, created_at)
        VALUES (p_record_id, v_user_id, (p_payload->>'transaction_type')::odin_transaction_type, 'posted',
          COALESCE((p_payload->>'entry_source')::odin_transaction_entry_source, 'offline_sync'),
          (p_payload->>'transaction_date')::date, v_now, (p_payload->>'amount_centavos')::bigint,
          (p_payload->>'subcategory_id')::uuid, (p_payload->>'source_account_id')::uuid, (p_payload->>'destination_account_id')::uuid,
          p_payload->>'merchant_name', p_payload->>'counterparty_name', p_payload->>'notes', p_payload->>'client_mutation_id',
          CASE WHEN p_payload->>'client_mutation_id' LIKE 'debt-payment:%' THEN jsonb_build_object('debt_payment_balance_debited', false) ELSE '{}'::jsonb END,
          v_now, 1, false, v_now);
        IF (p_payload->>'transaction_type') = 'expense' AND p_payload->>'client_mutation_id' LIKE 'debt-payment:%' THEN
          UPDATE financial_accounts
          SET current_balance_centavos = current_balance_centavos - (p_payload->>'amount_centavos')::bigint,
              version = version + 1,
              updated_at = v_now
          WHERE id = (p_payload->>'source_account_id')::uuid AND user_id = v_user_id AND deleted = false
            AND current_balance_centavos >= (p_payload->>'amount_centavos')::bigint;
          IF NOT FOUND THEN RAISE EXCEPTION 'source account has insufficient balance'; END IF;
          UPDATE transactions
          SET metadata = jsonb_set(metadata, '{debt_payment_balance_debited}', 'true'::jsonb), updated_at = v_now, version = version + 1
          WHERE id = p_record_id AND user_id = v_user_id;
        END IF;
      END IF;

    ELSIF p_entity = 'transaction_templates' THEN
      INSERT INTO transaction_templates (id, user_id, transaction_type, status, name, amount_centavos, subcategory_id,
        source_account_id, destination_account_id, merchant_name, counterparty_name, notes,
        metadata, updated_at, version, deleted, created_at)
      VALUES (p_record_id, v_user_id, (p_payload->>'transaction_type')::odin_transaction_type, 'active', p_payload->>'name',
        (p_payload->>'amount_centavos')::bigint, (p_payload->>'subcategory_id')::uuid, (p_payload->>'source_account_id')::uuid,
        (p_payload->>'destination_account_id')::uuid, p_payload->>'merchant_name', p_payload->>'counterparty_name',
        p_payload->>'notes', '{}'::jsonb, v_now, 1, false);

    ELSIF p_entity = 'recurring_transaction_templates' THEN
      INSERT INTO recurring_transaction_templates (id, user_id, transaction_type, status, name, amount_centavos, subcategory_id,
        source_account_id, destination_account_id, frequency, interval_count, day_of_month, second_day_of_month,
        day_of_week, custom_rule, starts_on, ends_on, next_occurrence_date, last_generated_date,
        reminder_enabled, reminder_days_before, notes, metadata, updated_at, created_at)
      VALUES (p_record_id, v_user_id, (p_payload->>'transaction_type')::odin_transaction_type, 'active', p_payload->>'name',
        (p_payload->>'amount_centavos')::bigint, (p_payload->>'subcategory_id')::uuid, (p_payload->>'source_account_id')::uuid,
        (p_payload->>'destination_account_id')::uuid, (p_payload->>'frequency')::odin_recurring_frequency,
        COALESCE((p_payload->>'interval_count')::integer, 1), (p_payload->>'day_of_month')::integer,
        (p_payload->>'second_day_of_month')::integer, (p_payload->>'day_of_week')::integer, '{}'::jsonb,
        (p_payload->>'starts_on')::date, (p_payload->>'ends_on')::date,
        (p_payload->>'next_occurrence_date')::date, (p_payload->>'last_generated_date')::date,
        COALESCE((p_payload->>'reminder_enabled')::boolean, false), COALESCE((p_payload->>'reminder_days_before')::integer, 0),
        p_payload->>'notes', '{}'::jsonb, v_now, v_now);

    ELSIF p_entity = 'recurring_transaction_occurrences' THEN
      INSERT INTO recurring_transaction_occurrences (id, recurring_template_id, user_id, scheduled_date, status,
        generated_transaction_id, reminder_sent_at, posted_at, skipped_at, failure_reason,
        metadata, updated_at, created_at)
      VALUES (p_record_id, (p_payload->>'recurring_template_id')::uuid, v_user_id,
        (p_payload->>'scheduled_date')::date, COALESCE(p_payload->>'status', 'scheduled'),
        (p_payload->>'generated_transaction_id')::uuid, (p_payload->>'reminder_sent_at')::timestamptz,
        (p_payload->>'posted_at')::timestamptz, (p_payload->>'skipped_at')::timestamptz,
        p_payload->>'failure_reason', '{}'::jsonb, v_now, v_now);
    END IF;

    UPDATE applied_operations
    SET result = jsonb_build_object('status', 'applied', 'current_version', 1)
    WHERE operation_id = p_operation_id;
    RETURN QUERY SELECT 'applied'::text, NULL::text, 1, NULL::text[];
    RETURN;
  END IF;

  -- VERSION CHECK
  IF p_entity = 'categories' THEN SELECT version INTO v_current_version FROM categories WHERE id = p_record_id AND user_id = v_user_id FOR UPDATE;
  ELSIF p_entity = 'subcategories' THEN SELECT version INTO v_current_version FROM subcategories WHERE id = p_record_id AND user_id = v_user_id FOR UPDATE;
  ELSIF p_entity = 'financial_accounts' THEN SELECT version INTO v_current_version FROM financial_accounts WHERE id = p_record_id AND user_id = v_user_id FOR UPDATE;
  ELSIF p_entity = 'income_sources' THEN SELECT version INTO v_current_version FROM income_sources WHERE id = p_record_id AND user_id = v_user_id FOR UPDATE;
  ELSIF p_entity = 'financial_obligations' THEN SELECT version INTO v_current_version FROM financial_obligations WHERE id = p_record_id AND user_id = v_user_id FOR UPDATE;
  ELSIF p_entity = 'transactions' THEN SELECT version INTO v_current_version FROM transactions WHERE id = p_record_id AND user_id = v_user_id FOR UPDATE;
  ELSIF p_entity = 'transaction_templates' THEN SELECT version INTO v_current_version FROM transaction_templates WHERE id = p_record_id AND user_id = v_user_id FOR UPDATE;
  ELSIF p_entity = 'recurring_transaction_templates' THEN SELECT version INTO v_current_version FROM recurring_transaction_templates WHERE id = p_record_id AND user_id = v_user_id FOR UPDATE;
  ELSIF p_entity = 'recurring_transaction_occurrences' THEN SELECT version INTO v_current_version FROM recurring_transaction_occurrences WHERE id = p_record_id AND user_id = v_user_id FOR UPDATE;
  ELSE
    UPDATE applied_operations SET result = jsonb_build_object('status', 'rejected', 'reason', 'entity ' || p_entity || ' not supported') WHERE operation_id = p_operation_id;
    RETURN QUERY SELECT 'rejected'::text, ('entity ' || p_entity || ' not supported')::text, NULL::integer, NULL::text[];
    RETURN;
  END IF;

  IF v_current_version IS NULL THEN
    UPDATE applied_operations SET result = jsonb_build_object('status', 'rejected', 'reason', 'record not found') WHERE operation_id = p_operation_id;
    RETURN QUERY SELECT 'rejected'::text, 'record not found'::text, NULL::integer, NULL::text[];
    RETURN;
  END IF;

  -- DELETE
  IF p_operation_type = 'delete' THEN
    IF p_base_version IS NOT NULL AND p_base_version <> v_current_version THEN
      INSERT INTO edit_history (user_id, operation_id, entity, record_id, reason, payload)
      VALUES (v_user_id, p_operation_id, p_entity, p_record_id, 'delete_wins',
        jsonb_build_object('base_version', p_base_version, 'overwritten_version', v_current_version));
    END IF;
    CASE p_entity
      WHEN 'categories' THEN UPDATE categories SET deleted = true, is_active = false WHERE id = p_record_id AND user_id = v_user_id;
      WHEN 'subcategories' THEN UPDATE subcategories SET deleted = true, is_active = false WHERE id = p_record_id AND user_id = v_user_id;
      WHEN 'financial_accounts' THEN UPDATE financial_accounts SET deleted = true, status = 'deleted', deleted_at = v_now WHERE id = p_record_id AND user_id = v_user_id;
      WHEN 'income_sources' THEN UPDATE income_sources SET deleted = true, is_active = false WHERE id = p_record_id AND user_id = v_user_id;
      WHEN 'financial_obligations' THEN UPDATE financial_obligations SET deleted = true, status = 'deleted' WHERE id = p_record_id AND user_id = v_user_id;
      WHEN 'transactions' THEN UPDATE transactions SET deleted = true, status = 'deleted', deleted_at = v_now WHERE id = p_record_id AND user_id = v_user_id;
      WHEN 'transaction_templates' THEN UPDATE transaction_templates SET deleted = true, status = 'deleted' WHERE id = p_record_id AND user_id = v_user_id;
      WHEN 'recurring_transaction_templates' THEN UPDATE recurring_transaction_templates SET deleted = true, status = 'deleted' WHERE id = p_record_id AND user_id = v_user_id;
      WHEN 'recurring_transaction_occurrences' THEN UPDATE recurring_transaction_occurrences SET deleted = true, status = 'skipped' WHERE id = p_record_id AND user_id = v_user_id;
    END CASE;
    UPDATE applied_operations SET result = jsonb_build_object('status', 'applied', 'current_version', v_current_version + 1) WHERE operation_id = p_operation_id;
    RETURN QUERY SELECT 'applied'::text, NULL::text, v_current_version + 1, NULL::text[];
    RETURN;
  END IF;

  -- PAYLOAD CHECK
  IF p_payload IS NULL OR p_payload = '{}'::jsonb THEN
    UPDATE applied_operations SET result = jsonb_build_object('status', 'rejected', 'reason', 'no fields to apply', 'current_version', v_current_version)
    WHERE operation_id = p_operation_id;
    RETURN QUERY SELECT 'rejected'::text, 'no fields to apply'::text, v_current_version, NULL::text[];
    RETURN;
  END IF;

  IF p_entity = 'categories' THEN
    IF EXISTS (SELECT 1 FROM categories WHERE id = p_record_id AND user_id = v_user_id AND deleted = true) THEN
      INSERT INTO edit_history (user_id, operation_id, entity, record_id, reason, payload) VALUES (v_user_id, p_operation_id, p_entity, p_record_id, 'delete_wins', p_payload);
      UPDATE applied_operations SET result = jsonb_build_object('status', 'rejected', 'reason', 'record is deleted', 'current_version', v_current_version) WHERE operation_id = p_operation_id;
      RETURN QUERY SELECT 'rejected'::text, 'record is deleted'::text, v_current_version, NULL::text[];
      RETURN;
    END IF;
    UPDATE categories SET
      label = CASE WHEN p_payload ? 'label' THEN p_payload->>'label' ELSE label END,
      short_label = CASE WHEN p_payload ? 'short_label' THEN p_payload->>'short_label' ELSE short_label END,
      description = CASE WHEN p_payload ? 'description' THEN p_payload->>'description' ELSE description END,
      is_filipino_context = CASE WHEN p_payload ? 'is_filipino_context' THEN (p_payload->>'is_filipino_context')::boolean ELSE is_filipino_context END,
      sort_order = CASE WHEN p_payload ? 'sort_order' THEN (p_payload->>'sort_order')::integer ELSE sort_order END,
      is_active = CASE WHEN p_payload ? 'is_active' THEN (p_payload->>'is_active')::boolean ELSE is_active END
    WHERE id = p_record_id AND user_id = v_user_id;

  ELSIF p_entity = 'subcategories' THEN
    IF EXISTS (SELECT 1 FROM subcategories WHERE id = p_record_id AND user_id = v_user_id AND deleted = true) THEN
      INSERT INTO edit_history (user_id, operation_id, entity, record_id, reason, payload) VALUES (v_user_id, p_operation_id, p_entity, p_record_id, 'delete_wins', p_payload);
      UPDATE applied_operations SET result = jsonb_build_object('status', 'rejected', 'reason', 'record is deleted', 'current_version', v_current_version) WHERE operation_id = p_operation_id;
      RETURN QUERY SELECT 'rejected'::text, 'record is deleted'::text, v_current_version, NULL::text[];
      RETURN;
    END IF;
    UPDATE subcategories SET
      label = CASE WHEN p_payload ? 'label' THEN p_payload->>'label' ELSE label END,
      short_label = CASE WHEN p_payload ? 'short_label' THEN p_payload->>'short_label' ELSE short_label END,
      description = CASE WHEN p_payload ? 'description' THEN p_payload->>'description' ELSE description END,
      is_filipino_context = CASE WHEN p_payload ? 'is_filipino_context' THEN (p_payload->>'is_filipino_context')::boolean ELSE is_filipino_context END,
      is_protected = CASE WHEN p_payload ? 'is_protected' THEN (p_payload->>'is_protected')::boolean ELSE is_protected END,
      is_active = CASE WHEN p_payload ? 'is_active' THEN (p_payload->>'is_active')::boolean ELSE is_active END
    WHERE id = p_record_id AND user_id = v_user_id;

  ELSIF p_entity = 'financial_accounts' THEN
    IF EXISTS (SELECT 1 FROM financial_accounts WHERE id = p_record_id AND user_id = v_user_id AND deleted = true) THEN
      INSERT INTO edit_history (user_id, operation_id, entity, record_id, reason, payload) VALUES (v_user_id, p_operation_id, p_entity, p_record_id, 'delete_wins', p_payload);
      UPDATE applied_operations SET result = jsonb_build_object('status', 'rejected', 'reason', 'record is deleted', 'current_version', v_current_version) WHERE operation_id = p_operation_id;
      RETURN QUERY SELECT 'rejected'::text, 'record is deleted'::text, v_current_version, NULL::text[];
      RETURN;
    END IF;
    IF p_payload ? 'status' AND (p_payload->>'status') = 'deleted' THEN
      UPDATE applied_operations SET result = jsonb_build_object('status', 'rejected', 'reason', 'status deleted must use the delete operation', 'current_version', v_current_version) WHERE operation_id = p_operation_id;
      RETURN QUERY SELECT 'rejected'::text, 'status deleted must use the delete operation'::text, v_current_version, NULL::text[];
      RETURN;
    END IF;
    UPDATE financial_accounts SET
      name = CASE WHEN p_payload ? 'name' THEN p_payload->>'name' ELSE name END,
      status = CASE WHEN p_payload ? 'status' THEN (p_payload->>'status')::odin_account_status ELSE financial_accounts.status END,
      opening_balance_centavos = CASE WHEN p_payload ? 'opening_balance_centavos' THEN (p_payload->>'opening_balance_centavos')::bigint ELSE opening_balance_centavos END,
      current_balance_centavos = CASE WHEN p_payload ? 'current_balance_centavos' THEN (p_payload->>'current_balance_centavos')::bigint ELSE current_balance_centavos END,
      include_in_dashboard_balance = CASE WHEN p_payload ? 'include_in_dashboard_balance' THEN (p_payload->>'include_in_dashboard_balance')::boolean ELSE include_in_dashboard_balance END,
      institution_name = CASE WHEN p_payload ? 'institution_name' THEN p_payload->>'institution_name' ELSE institution_name END,
      opened_on = CASE WHEN p_payload ? 'opened_on' THEN (p_payload->>'opened_on')::date ELSE opened_on END,
      archived_at = CASE WHEN p_payload ? 'archived_at' THEN (p_payload->>'archived_at')::timestamptz ELSE archived_at END,
      sort_order = CASE WHEN p_payload ? 'sort_order' THEN (p_payload->>'sort_order')::integer ELSE sort_order END
    WHERE id = p_record_id AND user_id = v_user_id;

  ELSIF p_entity = 'income_sources' THEN
    IF EXISTS (SELECT 1 FROM income_sources WHERE id = p_record_id AND user_id = v_user_id AND deleted = true) THEN
      INSERT INTO edit_history (user_id, operation_id, entity, record_id, reason, payload) VALUES (v_user_id, p_operation_id, p_entity, p_record_id, 'delete_wins', p_payload);
      UPDATE applied_operations SET result = jsonb_build_object('status', 'rejected', 'reason', 'record is deleted', 'current_version', v_current_version) WHERE operation_id = p_operation_id;
      RETURN QUERY SELECT 'rejected'::text, 'record is deleted'::text, v_current_version, NULL::text[];
      RETURN;
    END IF;
    UPDATE income_sources SET
      recurring_template_id = CASE WHEN p_payload ? 'recurring_template_id' THEN (p_payload->>'recurring_template_id')::uuid ELSE recurring_template_id END,
      destination_account_id = CASE WHEN p_payload ? 'destination_account_id' THEN (p_payload->>'destination_account_id')::uuid ELSE destination_account_id END,
      subcategory_id = CASE WHEN p_payload ? 'subcategory_id' THEN (p_payload->>'subcategory_id')::uuid ELSE subcategory_id END,
      name = CASE WHEN p_payload ? 'name' THEN p_payload->>'name' ELSE name END,
      frequency = CASE WHEN p_payload ? 'frequency' THEN (p_payload->>'frequency')::odin_income_frequency ELSE frequency END,
      expected_amount_centavos = CASE WHEN p_payload ? 'expected_amount_centavos' THEN (p_payload->>'expected_amount_centavos')::bigint ELSE expected_amount_centavos END,
      payday_day_of_month = CASE WHEN p_payload ? 'payday_day_of_month' THEN (p_payload->>'payday_day_of_month')::integer ELSE payday_day_of_month END,
      payday_second_day_of_month = CASE WHEN p_payload ? 'payday_second_day_of_month' THEN (p_payload->>'payday_second_day_of_month')::integer ELSE payday_second_day_of_month END,
      payday_day_of_week = CASE WHEN p_payload ? 'payday_day_of_week' THEN (p_payload->>'payday_day_of_week')::integer ELSE payday_day_of_week END,
      next_expected_date = CASE WHEN p_payload ? 'next_expected_date' THEN (p_payload->>'next_expected_date')::date ELSE next_expected_date END,
      is_active = CASE WHEN p_payload ? 'is_active' THEN (p_payload->>'is_active')::boolean ELSE is_active END,
      notes = CASE WHEN p_payload ? 'notes' THEN p_payload->>'notes' ELSE notes END
    WHERE id = p_record_id AND user_id = v_user_id;

  ELSIF p_entity = 'financial_obligations' THEN
    IF EXISTS (SELECT 1 FROM financial_obligations WHERE id = p_record_id AND user_id = v_user_id AND deleted = true) THEN
      INSERT INTO edit_history (user_id, operation_id, entity, record_id, reason, payload) VALUES (v_user_id, p_operation_id, p_entity, p_record_id, 'delete_wins', p_payload);
      UPDATE applied_operations SET result = jsonb_build_object('status', 'rejected', 'reason', 'record is deleted', 'current_version', v_current_version) WHERE operation_id = p_operation_id;
      RETURN QUERY SELECT 'rejected'::text, 'record is deleted'::text, v_current_version, NULL::text[];
      RETURN;
    END IF;
    IF p_payload ? 'subcategory_id' THEN
      PERFORM 1 FROM subcategories WHERE id = (p_payload->>'subcategory_id')::uuid AND kind = 'expense' AND deleted = false AND is_active = true AND (user_id = v_user_id OR user_id IS NULL);
      IF NOT FOUND THEN
        UPDATE applied_operations SET result = jsonb_build_object('status', 'rejected', 'reason', 'subcategory_id does not reference an accessible active expense subcategory') WHERE operation_id = p_operation_id;
        RETURN QUERY SELECT 'rejected'::text, 'subcategory_id does not reference an accessible active expense subcategory'::text, NULL::integer, NULL::text[];
        RETURN;
      END IF;
    END IF;
    IF p_payload ? 'recurring_template_id' AND (p_payload->>'recurring_template_id') IS NOT NULL THEN
      PERFORM 1 FROM recurring_transaction_templates WHERE id = (p_payload->>'recurring_template_id')::uuid AND user_id = v_user_id;
      IF NOT FOUND THEN
        UPDATE applied_operations SET result = jsonb_build_object('status', 'rejected', 'reason', 'recurring_template_id does not reference an accessible recurring template') WHERE operation_id = p_operation_id;
        RETURN QUERY SELECT 'rejected'::text, 'recurring_template_id does not reference an accessible recurring template'::text, NULL::integer, NULL::text[];
        RETURN;
      END IF;
    END IF;
    UPDATE financial_obligations SET
      subcategory_id = CASE WHEN p_payload ? 'subcategory_id' THEN (p_payload->>'subcategory_id')::uuid ELSE subcategory_id END,
      recurring_template_id = CASE WHEN p_payload ? 'recurring_template_id' THEN (p_payload->>'recurring_template_id')::uuid ELSE recurring_template_id END,
      name = CASE WHEN p_payload ? 'name' THEN p_payload->>'name' ELSE name END,
      amount_centavos = CASE WHEN p_payload ? 'amount_centavos' THEN (p_payload->>'amount_centavos')::bigint ELSE amount_centavos END,
      frequency = CASE WHEN p_payload ? 'frequency' THEN (p_payload->>'frequency')::odin_recurring_frequency ELSE frequency END,
      due_day_of_month = CASE WHEN p_payload ? 'due_day_of_month' THEN (p_payload->>'due_day_of_month')::integer ELSE due_day_of_month END,
      due_second_day_of_month = CASE WHEN p_payload ? 'due_second_day_of_month' THEN (p_payload->>'due_second_day_of_month')::integer ELSE due_second_day_of_month END,
      due_day_of_week = CASE WHEN p_payload ? 'due_day_of_week' THEN (p_payload->>'due_day_of_week')::integer ELSE due_day_of_week END,
      due_second_day_of_week = CASE WHEN p_payload ? 'due_second_day_of_week' THEN (p_payload->>'due_second_day_of_week')::integer ELSE due_second_day_of_week END,
      due_month = CASE WHEN p_payload ? 'due_month' THEN (p_payload->>'due_month')::integer ELSE due_month END,
      is_family_support = CASE WHEN p_payload ? 'is_family_support' THEN (p_payload->>'is_family_support')::boolean ELSE is_family_support END,
      is_dependent_support = CASE WHEN p_payload ? 'is_dependent_support' THEN (p_payload->>'is_dependent_support')::boolean ELSE is_dependent_support END,
      protected_by_default = CASE WHEN p_payload ? 'protected_by_default' THEN (p_payload->>'protected_by_default')::boolean ELSE protected_by_default END,
      starts_on = CASE WHEN p_payload ? 'starts_on' THEN (p_payload->>'starts_on')::date ELSE starts_on END,
      ends_on = CASE WHEN p_payload ? 'ends_on' THEN (p_payload->>'ends_on')::date ELSE ends_on END,
      notes = CASE WHEN p_payload ? 'notes' THEN p_payload->>'notes' ELSE notes END
    WHERE id = p_record_id AND user_id = v_user_id;

  ELSIF p_entity = 'transactions' THEN
    UPDATE transactions SET
      amount_centavos = CASE WHEN p_payload ? 'amount_centavos' THEN (p_payload->>'amount_centavos')::bigint ELSE amount_centavos END,
      subcategory_id = CASE WHEN p_payload ? 'subcategory_id' THEN (p_payload->>'subcategory_id')::uuid ELSE subcategory_id END,
      source_account_id = CASE WHEN p_payload ? 'source_account_id' THEN (p_payload->>'source_account_id')::uuid ELSE source_account_id END,
      destination_account_id = CASE WHEN p_payload ? 'destination_account_id' THEN (p_payload->>'destination_account_id')::uuid ELSE destination_account_id END,
      transaction_date = CASE WHEN p_payload ? 'transaction_date' THEN (p_payload->>'transaction_date')::date ELSE transaction_date END,
      merchant_name = CASE WHEN p_payload ? 'merchant_name' THEN p_payload->>'merchant_name' ELSE merchant_name END,
      counterparty_name = CASE WHEN p_payload ? 'counterparty_name' THEN p_payload->>'counterparty_name' ELSE counterparty_name END,
      notes = CASE WHEN p_payload ? 'notes' THEN p_payload->>'notes' ELSE notes END
    WHERE id = p_record_id AND user_id = v_user_id;

  ELSIF p_entity = 'transaction_templates' THEN
    UPDATE transaction_templates SET
      name = CASE WHEN p_payload ? 'name' THEN p_payload->>'name' ELSE name END,
      amount_centavos = CASE WHEN p_payload ? 'amount_centavos' THEN (p_payload->>'amount_centavos')::bigint ELSE amount_centavos END,
      subcategory_id = CASE WHEN p_payload ? 'subcategory_id' THEN (p_payload->>'subcategory_id')::uuid ELSE subcategory_id END,
      source_account_id = CASE WHEN p_payload ? 'source_account_id' THEN (p_payload->>'source_account_id')::uuid ELSE source_account_id END,
      destination_account_id = CASE WHEN p_payload ? 'destination_account_id' THEN (p_payload->>'destination_account_id')::uuid ELSE destination_account_id END,
      merchant_name = CASE WHEN p_payload ? 'merchant_name' THEN p_payload->>'merchant_name' ELSE merchant_name END,
      counterparty_name = CASE WHEN p_payload ? 'counterparty_name' THEN p_payload->>'counterparty_name' ELSE counterparty_name END,
      notes = CASE WHEN p_payload ? 'notes' THEN p_payload->>'notes' ELSE notes END
    WHERE id = p_record_id AND user_id = v_user_id;

  ELSIF p_entity = 'recurring_transaction_templates' THEN
    UPDATE recurring_transaction_templates SET
      name = CASE WHEN p_payload ? 'name' THEN p_payload->>'name' ELSE name END,
      amount_centavos = CASE WHEN p_payload ? 'amount_centavos' THEN (p_payload->>'amount_centavos')::bigint ELSE amount_centavos END,
      frequency = CASE WHEN p_payload ? 'frequency' THEN (p_payload->>'frequency')::odin_recurring_frequency ELSE frequency END,
      interval_count = CASE WHEN p_payload ? 'interval_count' THEN (p_payload->>'interval_count')::integer ELSE interval_count END,
      day_of_month = CASE WHEN p_payload ? 'day_of_month' THEN (p_payload->>'day_of_month')::integer ELSE day_of_month END,
      second_day_of_month = CASE WHEN p_payload ? 'second_day_of_month' THEN (p_payload->>'second_day_of_month')::integer ELSE second_day_of_month END,
      day_of_week = CASE WHEN p_payload ? 'day_of_week' THEN (p_payload->>'day_of_week')::integer ELSE day_of_week END,
      starts_on = CASE WHEN p_payload ? 'starts_on' THEN (p_payload->>'starts_on')::date ELSE starts_on END,
      ends_on = CASE WHEN p_payload ? 'ends_on' THEN (p_payload->>'ends_on')::date ELSE ends_on END,
      subcategory_id = CASE WHEN p_payload ? 'subcategory_id' THEN (p_payload->>'subcategory_id')::uuid ELSE subcategory_id END,
      source_account_id = CASE WHEN p_payload ? 'source_account_id' THEN (p_payload->>'source_account_id')::uuid ELSE source_account_id END,
      destination_account_id = CASE WHEN p_payload ? 'destination_account_id' THEN (p_payload->>'destination_account_id')::uuid ELSE destination_account_id END,
      notes = CASE WHEN p_payload ? 'notes' THEN p_payload->>'notes' ELSE notes END
    WHERE id = p_record_id AND user_id = v_user_id;

  ELSIF p_entity = 'recurring_transaction_occurrences' THEN
    UPDATE recurring_transaction_occurrences SET
      status = CASE WHEN p_payload ? 'status' THEN p_payload->>'status' ELSE status END,
      scheduled_date = CASE WHEN p_payload ? 'scheduled_date' THEN (p_payload->>'scheduled_date')::date ELSE scheduled_date END,
      generated_transaction_id = CASE WHEN p_payload ? 'generated_transaction_id' THEN (p_payload->>'generated_transaction_id')::uuid ELSE generated_transaction_id END,
      skipped_at = CASE WHEN p_payload ? 'skipped_at' THEN (p_payload->>'skipped_at')::timestamptz ELSE skipped_at END,
      failure_reason = CASE WHEN p_payload ? 'failure_reason' THEN p_payload->>'failure_reason' ELSE failure_reason END
    WHERE id = p_record_id AND user_id = v_user_id;
  END IF;

  -- LAST-WRITE-WINS EDIT HISTORY
  IF p_base_version IS NOT NULL AND p_base_version <> v_current_version THEN
    INSERT INTO edit_history (user_id, operation_id, entity, record_id, reason, payload)
    VALUES (v_user_id, p_operation_id, p_entity, p_record_id, 'last_write_wins',
      jsonb_build_object('base_version', p_base_version, 'new_version', v_current_version + 1, 'fields', to_jsonb(p_changed_fields), 'overwritten_values', v_overwritten_values));
    UPDATE applied_operations SET result = jsonb_build_object('status', 'applied', 'current_version', v_current_version + 1, 'conflicted_fields', to_jsonb(p_changed_fields))
    WHERE operation_id = p_operation_id;
    RETURN QUERY SELECT 'applied'::text, NULL::text, v_current_version + 1, p_changed_fields;
    RETURN;
  END IF;

  INSERT INTO edit_history (user_id, operation_id, entity, record_id, reason, payload)
  VALUES (v_user_id, p_operation_id, p_entity, p_record_id, 'applied',
    jsonb_build_object('base_version', p_base_version, 'new_version', v_current_version + 1, 'fields', to_jsonb(p_changed_fields)));
  UPDATE applied_operations SET result = jsonb_build_object('status', 'applied', 'current_version', v_current_version + 1)
  WHERE operation_id = p_operation_id;
  RETURN QUERY SELECT 'applied'::text, NULL::text, v_current_version + 1, NULL::text[];
END;
$function$;


-- Daily income counts toward monthly disposable income.
CREATE OR REPLACE FUNCTION public.get_financial_classification_v2_input(p_user_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  WITH income AS (
    SELECT COALESCE(sum(CASE frequency
      WHEN 'daily' THEN expected_amount_centavos * 365.0 / 12
      WHEN 'weekly' THEN expected_amount_centavos * 52.0 / 12
      WHEN 'semi_monthly' THEN expected_amount_centavos * 2
      WHEN 'monthly' THEN expected_amount_centavos
      END), 0) AS amount_centavos,
      max(updated_at) AS updated_at
    FROM income_sources
    WHERE user_id = p_user_id AND is_active = true AND deleted = false
  ), essential_costs AS (
    SELECT NULLIF(raw_answers->>'monthly_essential_living_costs', '')::numeric * 100 AS amount_centavos,
      submitted_at AS updated_at
    FROM onboarding_sessions
    WHERE user_id = p_user_id AND status = 'submitted'
      AND COALESCE(raw_answers->>'monthly_essential_living_costs', '') ~ '^[0-9]+$'
    ORDER BY submitted_at DESC
    LIMIT 1
  ), emergency_fund AS (
    SELECT current_amount_centavos, updated_at
    FROM savings_goals
    WHERE user_id = p_user_id AND goal_type = 'emergency_fund'
      AND status = 'active' AND deleted = false
    ORDER BY updated_at DESC
    LIMIT 1
  ), debt AS (
    SELECT COALESCE(sum(minimum_payment_centavos), 0) AS amount_centavos,
      max(updated_at) AS updated_at
    FROM debt_accounts
    WHERE user_id = p_user_id AND status = 'active' AND deleted = false
  ), card_cycles AS (
    SELECT c.account_id, s.statement_date AS completed_on,
      s.statement_balance_centavos AS revolving_balance_centavos,
      greatest(c.updated_at, s.updated_at) AS updated_at
    FROM credit_card_cycles c
    JOIN credit_card_statements s ON s.cycle_id = c.id
      AND s.user_id = p_user_id AND s.authoritative = true AND s.deleted = false
    WHERE c.user_id = p_user_id AND c.deleted = false AND s.statement_date IS NOT NULL
  ), cards AS (
    SELECT account_id,
      jsonb_agg(jsonb_build_object('completed_on', completed_on, 'revolving_balance', revolving_balance_centavos / 100.0) ORDER BY completed_on DESC) AS cycles,
      max(updated_at) AS updated_at
    FROM (
      SELECT *, row_number() OVER (PARTITION BY account_id ORDER BY completed_on DESC) AS row_number
      FROM card_cycles
    ) ranked
    WHERE row_number <= 12
    GROUP BY account_id
  ), latest_card_statements AS (
    SELECT id, account_id, minimum_due_centavos, statement_balance_centavos, statement_updated_at, cycle_updated_at
    FROM (
      SELECT s.id, c.account_id, s.minimum_due_centavos, s.statement_balance_centavos,
        s.updated_at AS statement_updated_at, c.updated_at AS cycle_updated_at,
        row_number() OVER (PARTITION BY c.account_id ORDER BY s.statement_date DESC, s.updated_at DESC) AS row_number
      FROM credit_card_statements s
      JOIN credit_card_cycles c ON c.id = s.cycle_id
        AND c.user_id = p_user_id AND c.deleted = false
      WHERE s.user_id = p_user_id AND s.authoritative = true AND s.deleted = false
    ) ranked
    WHERE row_number = 1
  ), card_payments AS (
    SELECT statement_id, COALESCE(sum(amount_centavos), 0) AS paid_centavos,
      max(updated_at) AS updated_at
    FROM credit_card_payments
    WHERE user_id = p_user_id AND deleted = false AND statement_id IS NOT NULL
    GROUP BY statement_id
  ), card_debt AS (
    SELECT COALESCE(sum(greatest(statement.minimum_due_centavos - COALESCE(payment.paid_centavos, 0), 0)), 0) AS amount_centavos,
      max(greatest(statement.statement_updated_at, statement.cycle_updated_at, COALESCE(payment.updated_at, statement.statement_updated_at))) AS updated_at
    FROM latest_card_statements statement
    LEFT JOIN card_payments payment ON payment.statement_id = statement.id
  ), source_updates AS (
    SELECT updated_at FROM income
    UNION ALL SELECT updated_at FROM essential_costs
    UNION ALL SELECT updated_at FROM emergency_fund
    UNION ALL SELECT updated_at FROM debt
    UNION ALL SELECT updated_at FROM cards
    UNION ALL SELECT updated_at FROM card_debt
  )
  SELECT jsonb_build_object(
    'liquid_emergency_savings', (SELECT current_amount_centavos FROM emergency_fund)::numeric / 100,
    'average_monthly_recurring_essential_expenses', (SELECT amount_centavos FROM essential_costs)::numeric / 100,
    'monthly_disposable_income', (SELECT amount_centavos FROM income)::numeric / 100,
    'required_monthly_debt_payments', ((SELECT amount_centavos FROM debt) + (SELECT amount_centavos FROM card_debt))::numeric / 100,
    'monthly_basic_living_costs', (SELECT amount_centavos FROM essential_costs)::numeric / 100,
    'credit_card_accounts', COALESCE((SELECT jsonb_agg(jsonb_build_object('account_id', account_id, 'cycles', cycles)) FROM cards), '[]'::jsonb),
    'classification_as_of', current_date,
    'source_updated_at', (SELECT max(updated_at) FROM source_updates)
  );
$$;
