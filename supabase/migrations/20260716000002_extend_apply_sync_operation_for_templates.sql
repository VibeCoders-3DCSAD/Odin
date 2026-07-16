CREATE OR REPLACE FUNCTION apply_sync_operation(
  p_operation_id uuid,
  p_device_id text,
  p_entity text,
  p_record_id uuid,
  p_operation_type text,
  p_base_version integer,
  p_changed_fields text[],
  p_payload jsonb
)
RETURNS TABLE (
  status text,
  reason text,
  current_version integer,
  conflicted_fields text[]
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_existing_user_id uuid;
  v_existing_result jsonb;
  v_current_version integer;
  v_now timestamptz := now();
  v_overwritten_values jsonb := '{}'::jsonb;
  v_deleted_check boolean;
  v_tx_type odin_transaction_type;
  v_cur_src uuid;
  v_cur_dst uuid;
  v_cur_sub uuid;
  v_new_src uuid;
  v_new_dst uuid;
  v_new_sub uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  IF p_entity NOT IN ('categories', 'subcategories', 'financial_accounts', 'transactions',
                       'transaction_templates', 'transaction_drafts',
                       'recurring_transaction_templates', 'recurring_transaction_occurrences') THEN
    RAISE EXCEPTION 'entity % is not syncable', p_entity;
  END IF;

  IF p_operation_type NOT IN ('create', 'update', 'delete') THEN
    RAISE EXCEPTION 'operation_type % is invalid', p_operation_type;
  END IF;

  INSERT INTO applied_operations (
    operation_id, user_id, device_id, entity, record_id, operation_type, result
  ) VALUES (
    p_operation_id, v_user_id, p_device_id, p_entity, p_record_id, p_operation_type,
    jsonb_build_object('status', 'pending')
  ) ON CONFLICT (operation_id) DO NOTHING;

  IF NOT FOUND THEN
    SELECT user_id, result
      INTO v_existing_user_id, v_existing_result
      FROM applied_operations
      WHERE operation_id = p_operation_id;

    IF v_existing_user_id IS DISTINCT FROM v_user_id THEN
      RETURN QUERY SELECT 'rejected'::text, 'operation belongs to another user'::text, NULL::integer, NULL::text[];
      RETURN;
    END IF;

    RETURN QUERY SELECT
      CASE
        WHEN COALESCE(v_existing_result->>'status', 'duplicate') = 'pending'
        THEN 'duplicate'
        ELSE COALESCE(v_existing_result->>'status', 'duplicate')
      END::text,
      NULLIF(v_existing_result->>'reason', '')::text,
      CASE
        WHEN v_existing_result ? 'current_version'
        THEN (v_existing_result->>'current_version')::integer
        ELSE NULL::integer
      END,
      CASE
        WHEN v_existing_result ? 'conflicted_fields'
        THEN ARRAY(SELECT jsonb_array_elements_text(v_existing_result->'conflicted_fields'))
        ELSE NULL::text[]
      END;
    RETURN;
  END IF;

  -- CREATE
  IF p_operation_type = 'create' THEN
    CASE p_entity
      WHEN 'categories' THEN
        INSERT INTO categories (
          id, category_group_id, user_id, slug, label, short_label, description,
          is_system, is_filipino_context, sort_order, is_active, metadata, updated_at, version, deleted
        ) VALUES (
          p_record_id, (p_payload->>'category_group_id')::uuid, v_user_id,
          p_payload->>'slug', p_payload->>'label', p_payload->>'short_label',
          p_payload->>'description', false,
          COALESCE((p_payload->>'is_filipino_context')::boolean, false),
          COALESCE((p_payload->>'sort_order')::integer, 0), true, '{}'::jsonb, v_now, 1, false
        );

      WHEN 'subcategories' THEN
        INSERT INTO subcategories (
          id, category_id, user_id, slug, kind, label, short_label, description,
          is_system, is_filipino_context, is_protected_default, is_protected,
          sort_order, is_active, metadata, updated_at, version, deleted
        ) VALUES (
          p_record_id,
          CASE WHEN (p_payload->>'kind') = 'expense' THEN (p_payload->>'category_id')::uuid ELSE NULL END,
          v_user_id, p_payload->>'slug', (p_payload->>'kind')::odin_subcategory_kind,
          p_payload->>'label', p_payload->>'short_label', p_payload->>'description',
          false, COALESCE((p_payload->>'is_filipino_context')::boolean, false),
          false, COALESCE((p_payload->>'is_protected')::boolean, false),
          COALESCE((p_payload->>'sort_order')::integer, 0), true, '{}'::jsonb, v_now, 1, false
        );

      WHEN 'financial_accounts' THEN
        INSERT INTO financial_accounts (
          id, user_id, name, kind, status, opening_balance_centavos, current_balance_centavos,
          credit_limit_centavos, include_in_dashboard_balance, institution_name, opened_on,
          sort_order, metadata, updated_at, version, deleted
        ) VALUES (
          p_record_id, v_user_id,
          p_payload->>'name', (p_payload->>'kind')::odin_account_kind,
          'active'::odin_account_status,
          COALESCE((p_payload->>'opening_balance_centavos')::bigint, 0),
          COALESCE((p_payload->>'opening_balance_centavos')::bigint, 0),
          (p_payload->>'credit_limit_centavos')::bigint,
          COALESCE((p_payload->>'include_in_dashboard_balance')::boolean, true),
          p_payload->>'institution_name', (p_payload->>'opened_on')::date,
          COALESCE((p_payload->>'sort_order')::integer, 0), '{}'::jsonb, v_now, 1, false
        );

      WHEN 'transactions' THEN
        IF (p_payload->>'subcategory_id') IS NOT NULL THEN
          PERFORM 1
          FROM subcategories
          WHERE id = (p_payload->>'subcategory_id')::uuid
            AND (user_id = v_user_id OR user_id IS NULL)
            AND deleted = false AND is_active = true
            AND kind = CASE
              WHEN (p_payload->>'transaction_type') = 'income' THEN 'income'::odin_subcategory_kind
              WHEN (p_payload->>'transaction_type') = 'expense' THEN 'expense'::odin_subcategory_kind
              ELSE NULL
            END;
          IF (p_payload->>'transaction_type') <> 'transfer' AND NOT FOUND THEN
            UPDATE applied_operations
            SET result = jsonb_build_object('status', 'rejected', 'reason', 'subcategory not found or wrong kind')
            WHERE operation_id = p_operation_id;
            RETURN QUERY SELECT 'rejected'::text, 'subcategory not found or wrong kind'::text, NULL::integer, NULL::text[];
            RETURN;
          END IF;
        END IF;

        IF (p_payload->>'source_account_id') IS NOT NULL THEN
          PERFORM 1 FROM financial_accounts
          WHERE id = (p_payload->>'source_account_id')::uuid
            AND user_id = v_user_id AND deleted = false;
          IF NOT FOUND THEN
            UPDATE applied_operations
            SET result = jsonb_build_object('status', 'rejected', 'reason', 'source account not found or inaccessible')
            WHERE operation_id = p_operation_id;
            RETURN QUERY SELECT 'rejected'::text, 'source account not found or inaccessible'::text, NULL::integer, NULL::text[];
            RETURN;
          END IF;
        END IF;

        IF (p_payload->>'destination_account_id') IS NOT NULL THEN
          PERFORM 1 FROM financial_accounts
          WHERE id = (p_payload->>'destination_account_id')::uuid
            AND user_id = v_user_id AND deleted = false;
          IF NOT FOUND THEN
            UPDATE applied_operations
            SET result = jsonb_build_object('status', 'rejected', 'reason', 'destination account not found or inaccessible')
            WHERE operation_id = p_operation_id;
            RETURN QUERY SELECT 'rejected'::text, 'destination account not found or inaccessible'::text, NULL::integer, NULL::text[];
            RETURN;
          END IF;
        END IF;

        INSERT INTO transactions (
          id, user_id, transaction_type, status, entry_source, transaction_date,
          posted_at, amount_centavos, subcategory_id, source_account_id,
          destination_account_id, recurring_template_id, merchant_name, counterparty_name, notes,
          metadata, updated_at, version, deleted
        ) VALUES (
          p_record_id, v_user_id,
          (p_payload->>'transaction_type')::odin_transaction_type,
          'posted'::odin_transaction_status,
          COALESCE((p_payload->>'entry_source')::odin_transaction_entry_source, 'offline_sync'::odin_transaction_entry_source),
          (p_payload->>'transaction_date')::date, v_now,
          (p_payload->>'amount_centavos')::bigint,
          (p_payload->>'subcategory_id')::uuid,
          (p_payload->>'source_account_id')::uuid,
          (p_payload->>'destination_account_id')::uuid,
          (p_payload->>'recurring_template_id')::uuid,
          p_payload->>'merchant_name', p_payload->>'counterparty_name',
          p_payload->>'notes', '{}'::jsonb, v_now, 1, false
        );

      WHEN 'transaction_templates' THEN
        INSERT INTO transaction_templates (
          id, user_id, transaction_type, status, name, amount_centavos,
          subcategory_id, source_account_id, destination_account_id,
          merchant_name, counterparty_name, notes,
          use_count, metadata, updated_at, version, deleted
        ) VALUES (
          p_record_id, v_user_id,
          (p_payload->>'transaction_type')::odin_transaction_type,
          'active'::odin_template_status,
          p_payload->>'name',
          (p_payload->>'amount_centavos')::bigint,
          (p_payload->>'subcategory_id')::uuid,
          (p_payload->>'source_account_id')::uuid,
          (p_payload->>'destination_account_id')::uuid,
          p_payload->>'merchant_name', p_payload->>'counterparty_name',
          p_payload->>'notes',
          0, '{}'::jsonb, v_now, 1, false
        );

      WHEN 'transaction_drafts' THEN
        INSERT INTO transaction_drafts (
          id, user_id, client_draft_id, status, payload,
          captured_offline_at, metadata, updated_at, version, deleted
        ) VALUES (
          p_record_id, v_user_id,
          p_payload->>'client_draft_id',
          'pending', (p_payload->>'payload')::jsonb,
          (p_payload->>'captured_offline_at')::timestamptz,
          '{}'::jsonb, v_now, 1, false
        );

      WHEN 'recurring_transaction_templates' THEN
        INSERT INTO recurring_transaction_templates (
          id, user_id, transaction_type, status, name, amount_centavos,
          frequency, interval_count,
          day_of_month, second_day_of_month, day_of_week,
          custom_rule, starts_on, ends_on,
          next_occurrence_date, subcategory_id, source_account_id, destination_account_id,
          reminder_enabled, reminder_days_before, notes, metadata, updated_at, version, deleted
        ) VALUES (
          p_record_id, v_user_id,
          (p_payload->>'transaction_type')::odin_transaction_type,
          'active',
          p_payload->>'name',
          (p_payload->>'amount_centavos')::bigint,
          p_payload->>'frequency',
          COALESCE((p_payload->>'interval_count')::integer, 1),
          (p_payload->>'day_of_month')::integer,
          (p_payload->>'second_day_of_month')::integer,
          (p_payload->>'day_of_week')::integer,
          COALESCE(p_payload->>'custom_rule', '{}'),
          (p_payload->>'starts_on')::date,
          (p_payload->>'ends_on')::date,
          (p_payload->>'starts_on')::date,
          (p_payload->>'subcategory_id')::uuid,
          (p_payload->>'source_account_id')::uuid,
          (p_payload->>'destination_account_id')::uuid,
          0, 0, p_payload->>'notes', '{}'::jsonb, v_now, 1, false
        );

      WHEN 'recurring_transaction_occurrences' THEN
        INSERT INTO recurring_transaction_occurrences (
          id, user_id, recurring_template_id, scheduled_date,
          status, generated_transaction_id, posted_at,
          metadata, updated_at, version, deleted
        ) VALUES (
          p_record_id, v_user_id,
          (p_payload->>'recurring_template_id')::uuid,
          (p_payload->>'scheduled_date')::date,
          'posted',
          (p_payload->>'generated_transaction_id')::uuid,
          v_now, '{}'::jsonb, v_now, 1, false
        );

    END CASE;

    UPDATE applied_operations
    SET result = jsonb_build_object('status', 'applied', 'current_version', 1)
    WHERE operation_id = p_operation_id;

    RETURN QUERY SELECT 'applied'::text, NULL::text, 1, NULL::text[];
    RETURN;
  END IF;

  -- Lock existing row for UPDATE/DELETE
  CASE p_entity
    WHEN 'categories' THEN
      SELECT version, deleted INTO v_current_version, v_deleted_check
      FROM categories WHERE id = p_record_id AND user_id = v_user_id FOR UPDATE;
    WHEN 'subcategories' THEN
      SELECT version, deleted INTO v_current_version, v_deleted_check
      FROM subcategories WHERE id = p_record_id AND user_id = v_user_id FOR UPDATE;
    WHEN 'financial_accounts' THEN
      SELECT version, deleted INTO v_current_version, v_deleted_check
      FROM financial_accounts WHERE id = p_record_id AND user_id = v_user_id FOR UPDATE;
    WHEN 'transactions' THEN
      SELECT version, deleted, transaction_type,
             source_account_id, destination_account_id, subcategory_id
      INTO v_current_version, v_deleted_check, v_tx_type, v_cur_src, v_cur_dst, v_cur_sub
      FROM transactions WHERE id = p_record_id AND user_id = v_user_id FOR UPDATE;
    WHEN 'transaction_templates' THEN
      SELECT version, deleted INTO v_current_version, v_deleted_check
      FROM transaction_templates WHERE id = p_record_id AND user_id = v_user_id FOR UPDATE;
    WHEN 'transaction_drafts' THEN
      SELECT version, deleted INTO v_current_version, v_deleted_check
      FROM transaction_drafts WHERE id = p_record_id AND user_id = v_user_id FOR UPDATE;
    WHEN 'recurring_transaction_templates' THEN
      SELECT version, deleted INTO v_current_version, v_deleted_check
      FROM recurring_transaction_templates WHERE id = p_record_id AND user_id = v_user_id FOR UPDATE;
    WHEN 'recurring_transaction_occurrences' THEN
      SELECT version, deleted INTO v_current_version, v_deleted_check
      FROM recurring_transaction_occurrences WHERE id = p_record_id AND user_id = v_user_id FOR UPDATE;
  END CASE;

  IF v_current_version IS NULL THEN
    UPDATE applied_operations
    SET result = jsonb_build_object('status', 'rejected', 'reason', 'record not found')
    WHERE operation_id = p_operation_id;

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
      WHEN 'categories' THEN
        UPDATE categories SET deleted = true, is_active = false WHERE id = p_record_id AND user_id = v_user_id;
      WHEN 'subcategories' THEN
        UPDATE subcategories SET deleted = true, is_active = false WHERE id = p_record_id AND user_id = v_user_id;
      WHEN 'financial_accounts' THEN
        UPDATE financial_accounts SET deleted = true, status = 'deleted', deleted_at = v_now
        WHERE id = p_record_id AND user_id = v_user_id;
      WHEN 'transactions' THEN
        UPDATE transactions SET deleted = true, status = 'deleted', deleted_at = v_now
        WHERE id = p_record_id AND user_id = v_user_id;
      WHEN 'transaction_templates' THEN
        UPDATE transaction_templates SET deleted = true, status = 'deleted'
        WHERE id = p_record_id AND user_id = v_user_id;
      WHEN 'transaction_drafts' THEN
        UPDATE transaction_drafts SET deleted = true, status = 'discarded'
        WHERE id = p_record_id AND user_id = v_user_id;
      WHEN 'recurring_transaction_templates' THEN
        UPDATE recurring_transaction_templates SET deleted = true, status = 'deleted'
        WHERE id = p_record_id AND user_id = v_user_id;
      WHEN 'recurring_transaction_occurrences' THEN
        UPDATE recurring_transaction_occurrences SET deleted = true, status = 'skipped'
        WHERE id = p_record_id AND user_id = v_user_id;
    END CASE;

    UPDATE applied_operations
    SET result = jsonb_build_object('status', 'applied', 'current_version', v_current_version + 1)
    WHERE operation_id = p_operation_id;

    RETURN QUERY SELECT 'applied'::text, NULL::text, v_current_version + 1, NULL::text[];
    RETURN;
  END IF;

  -- UPDATE
  IF COALESCE(jsonb_object_length(p_payload), 0) = 0 THEN
    UPDATE applied_operations
    SET result = jsonb_build_object('status', 'rejected', 'reason', 'no fields to apply', 'current_version', v_current_version)
    WHERE operation_id = p_operation_id;

    RETURN QUERY SELECT 'rejected'::text, 'no fields to apply'::text, v_current_version, NULL::text[];
    RETURN;
  END IF;

  IF v_deleted_check THEN
    INSERT INTO edit_history (user_id, operation_id, entity, record_id, reason, payload)
    VALUES (v_user_id, p_operation_id, p_entity, p_record_id, 'delete_wins', p_payload);

    UPDATE applied_operations
    SET result = jsonb_build_object('status', 'rejected', 'reason', 'record is deleted', 'current_version', v_current_version)
    WHERE operation_id = p_operation_id;

    RETURN QUERY SELECT 'rejected'::text, 'record is deleted'::text, v_current_version, NULL::text[];
    RETURN;
  END IF;

  -- Per-entity update
  CASE p_entity
    WHEN 'categories' THEN
      UPDATE categories
      SET label = CASE WHEN p_payload ? 'label' THEN p_payload->>'label' ELSE label END,
          short_label = CASE WHEN p_payload ? 'short_label' THEN p_payload->>'short_label' ELSE short_label END,
          description = CASE WHEN p_payload ? 'description' THEN p_payload->>'description' ELSE description END,
          is_filipino_context = CASE WHEN p_payload ? 'is_filipino_context' THEN (p_payload->>'is_filipino_context')::boolean ELSE is_filipino_context END,
          sort_order = CASE WHEN p_payload ? 'sort_order' THEN (p_payload->>'sort_order')::integer ELSE sort_order END,
          is_active = CASE WHEN p_payload ? 'is_active' THEN (p_payload->>'is_active')::boolean ELSE is_active END
      WHERE id = p_record_id AND user_id = v_user_id;

    WHEN 'subcategories' THEN
      UPDATE subcategories
      SET label = CASE WHEN p_payload ? 'label' THEN p_payload->>'label' ELSE label END,
          short_label = CASE WHEN p_payload ? 'short_label' THEN p_payload->>'short_label' ELSE short_label END,
          description = CASE WHEN p_payload ? 'description' THEN p_payload->>'description' ELSE description END,
          is_filipino_context = CASE WHEN p_payload ? 'is_filipino_context' THEN (p_payload->>'is_filipino_context')::boolean ELSE is_filipino_context END,
          is_protected = CASE WHEN p_payload ? 'is_protected' THEN (p_payload->>'is_protected')::boolean ELSE is_protected END,
          is_active = CASE WHEN p_payload ? 'is_active' THEN (p_payload->>'is_active')::boolean ELSE is_active END
      WHERE id = p_record_id AND user_id = v_user_id;

    WHEN 'financial_accounts' THEN
      UPDATE financial_accounts
      SET name = CASE WHEN p_payload ? 'name' THEN p_payload->>'name' ELSE name END,
          opening_balance_centavos = CASE WHEN p_payload ? 'opening_balance_centavos' THEN (p_payload->>'opening_balance_centavos')::bigint ELSE opening_balance_centavos END,
          credit_limit_centavos = CASE WHEN p_payload ? 'credit_limit_centavos' THEN (p_payload->>'credit_limit_centavos')::bigint ELSE credit_limit_centavos END,
          include_in_dashboard_balance = CASE WHEN p_payload ? 'include_in_dashboard_balance' THEN (p_payload->>'include_in_dashboard_balance')::boolean ELSE include_in_dashboard_balance END,
          institution_name = CASE WHEN p_payload ? 'institution_name' THEN p_payload->>'institution_name' ELSE institution_name END,
          opened_on = CASE WHEN p_payload ? 'opened_on' THEN (p_payload->>'opened_on')::date ELSE opened_on END,
          sort_order = CASE WHEN p_payload ? 'sort_order' THEN (p_payload->>'sort_order')::integer ELSE sort_order END
      WHERE id = p_record_id AND user_id = v_user_id;

    WHEN 'transactions' THEN
      v_new_src := v_cur_src;
      v_new_dst := v_cur_dst;
      v_new_sub := v_cur_sub;
      IF p_payload ? 'source_account_id' THEN
        v_new_src := (p_payload->>'source_account_id')::uuid;
      END IF;
      IF p_payload ? 'destination_account_id' THEN
        v_new_dst := (p_payload->>'destination_account_id')::uuid;
      END IF;
      IF p_payload ? 'subcategory_id' THEN
        v_new_sub := (p_payload->>'subcategory_id')::uuid;
      END IF;

      IF v_tx_type = 'income' THEN
        IF v_new_dst IS NULL THEN RAISE EXCEPTION 'destination_account_id is required for income'; END IF;
        IF v_new_src IS NOT NULL THEN RAISE EXCEPTION 'source_account_id must be null for income'; END IF;
      ELSIF v_tx_type = 'expense' THEN
        IF v_new_src IS NULL THEN RAISE EXCEPTION 'source_account_id is required for expense'; END IF;
        IF v_new_dst IS NOT NULL THEN RAISE EXCEPTION 'destination_account_id must be null for expense'; END IF;
      ELSIF v_tx_type = 'transfer' THEN
        IF v_new_src IS NULL OR v_new_dst IS NULL THEN RAISE EXCEPTION 'both accounts are required for transfer'; END IF;
        IF v_new_src = v_new_dst THEN RAISE EXCEPTION 'source and destination accounts must differ'; END IF;
      END IF;

      IF v_new_src IS NOT NULL THEN
        PERFORM 1 FROM financial_accounts
        WHERE id = v_new_src
          AND user_id = v_user_id AND deleted = false;
        IF NOT FOUND THEN
          UPDATE applied_operations
          SET result = jsonb_build_object('status', 'rejected', 'reason', 'source account not found or inaccessible')
          WHERE operation_id = p_operation_id;
          RETURN QUERY SELECT 'rejected'::text, 'source account not found or inaccessible'::text, NULL::integer, NULL::text[];
          RETURN;
        END IF;
      END IF;

      IF v_new_dst IS NOT NULL THEN
        PERFORM 1 FROM financial_accounts
        WHERE id = v_new_dst
          AND user_id = v_user_id AND deleted = false;
        IF NOT FOUND THEN
          UPDATE applied_operations
          SET result = jsonb_build_object('status', 'rejected', 'reason', 'destination account not found or inaccessible')
          WHERE operation_id = p_operation_id;
          RETURN QUERY SELECT 'rejected'::text, 'destination account not found or inaccessible'::text, NULL::integer, NULL::text[];
          RETURN;
        END IF;
      END IF;

      UPDATE transactions
      SET amount_centavos = CASE WHEN p_payload ? 'amount_centavos' THEN (p_payload->>'amount_centavos')::bigint ELSE amount_centavos END,
          subcategory_id = CASE WHEN p_payload ? 'subcategory_id' THEN (p_payload->>'subcategory_id')::uuid ELSE subcategory_id END,
          source_account_id = CASE WHEN p_payload ? 'source_account_id' THEN (p_payload->>'source_account_id')::uuid ELSE source_account_id END,
          destination_account_id = CASE WHEN p_payload ? 'destination_account_id' THEN (p_payload->>'destination_account_id')::uuid ELSE destination_account_id END,
          transaction_date = CASE WHEN p_payload ? 'transaction_date' THEN (p_payload->>'transaction_date')::date ELSE transaction_date END,
          merchant_name = CASE WHEN p_payload ? 'merchant_name' THEN p_payload->>'merchant_name' ELSE merchant_name END,
          counterparty_name = CASE WHEN p_payload ? 'counterparty_name' THEN p_payload->>'counterparty_name' ELSE counterparty_name END,
          notes = CASE WHEN p_payload ? 'notes' THEN p_payload->>'notes' ELSE notes END
      WHERE id = p_record_id AND user_id = v_user_id;

    WHEN 'transaction_templates' THEN
      UPDATE transaction_templates
      SET name = CASE WHEN p_payload ? 'name' THEN p_payload->>'name' ELSE name END,
          amount_centavos = CASE WHEN p_payload ? 'amount_centavos' THEN (p_payload->>'amount_centavos')::bigint ELSE amount_centavos END,
          subcategory_id = CASE WHEN p_payload ? 'subcategory_id' THEN (p_payload->>'subcategory_id')::uuid ELSE subcategory_id END,
          source_account_id = CASE WHEN p_payload ? 'source_account_id' THEN (p_payload->>'source_account_id')::uuid ELSE source_account_id END,
          destination_account_id = CASE WHEN p_payload ? 'destination_account_id' THEN (p_payload->>'destination_account_id')::uuid ELSE destination_account_id END,
          merchant_name = CASE WHEN p_payload ? 'merchant_name' THEN p_payload->>'merchant_name' ELSE merchant_name END,
          counterparty_name = CASE WHEN p_payload ? 'counterparty_name' THEN p_payload->>'counterparty_name' ELSE counterparty_name END,
          notes = CASE WHEN p_payload ? 'notes' THEN p_payload->>'notes' ELSE notes END
      WHERE id = p_record_id AND user_id = v_user_id;

    WHEN 'transaction_drafts' THEN
      UPDATE transaction_drafts
      SET payload = CASE WHEN p_payload ? 'payload' THEN (p_payload->>'payload')::jsonb ELSE payload END,
          status = CASE WHEN p_payload ? 'status' THEN p_payload->>'status' ELSE status END
      WHERE id = p_record_id AND user_id = v_user_id;

    WHEN 'recurring_transaction_templates' THEN
      UPDATE recurring_transaction_templates
      SET name = CASE WHEN p_payload ? 'name' THEN p_payload->>'name' ELSE name END,
          amount_centavos = CASE WHEN p_payload ? 'amount_centavos' THEN (p_payload->>'amount_centavos')::bigint ELSE amount_centavos END,
          frequency = CASE WHEN p_payload ? 'frequency' THEN p_payload->>'frequency' ELSE frequency END,
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

    WHEN 'recurring_transaction_occurrences' THEN
      UPDATE recurring_transaction_occurrences
      SET status = CASE WHEN p_payload ? 'status' THEN p_payload->>'status' ELSE status END,
          scheduled_date = CASE WHEN p_payload ? 'scheduled_date' THEN (p_payload->>'scheduled_date')::date ELSE scheduled_date END,
          generated_transaction_id = CASE WHEN p_payload ? 'generated_transaction_id' THEN (p_payload->>'generated_transaction_id')::uuid ELSE generated_transaction_id END,
          skipped_at = CASE WHEN p_payload ? 'skipped_at' THEN (p_payload->>'skipped_at')::timestamptz ELSE skipped_at END,
          failure_reason = CASE WHEN p_payload ? 'failure_reason' THEN p_payload->>'failure_reason' ELSE failure_reason END
      WHERE id = p_record_id AND user_id = v_user_id;

  END CASE;

  IF p_base_version IS NOT NULL AND p_base_version <> v_current_version THEN
    INSERT INTO edit_history (user_id, operation_id, entity, record_id, reason, payload)
    VALUES (v_user_id, p_operation_id, p_entity, p_record_id, 'last_write_wins',
      jsonb_build_object(
        'base_version', p_base_version,
        'new_version', v_current_version + 1,
        'fields', to_jsonb(p_changed_fields),
        'overwritten_values', v_overwritten_values
      ));

    UPDATE applied_operations
    SET result = jsonb_build_object(
      'status', 'applied', 'current_version', v_current_version + 1,
      'conflicted_fields', to_jsonb(p_changed_fields))
    WHERE operation_id = p_operation_id;

    RETURN QUERY SELECT 'applied'::text, NULL::text, v_current_version + 1, p_changed_fields;
    RETURN;
  END IF;

  INSERT INTO edit_history (user_id, operation_id, entity, record_id, reason, payload)
  VALUES (v_user_id, p_operation_id, p_entity, p_record_id, 'applied',
    jsonb_build_object('base_version', p_base_version, 'new_version', v_current_version + 1,
      'fields', to_jsonb(p_changed_fields)));

  UPDATE applied_operations
  SET result = jsonb_build_object('status', 'applied', 'current_version', v_current_version + 1)
  WHERE operation_id = p_operation_id;

  RETURN QUERY SELECT 'applied'::text, NULL::text, v_current_version + 1, NULL::text[];
END;
$$;

GRANT EXECUTE ON FUNCTION apply_sync_operation(uuid, text, text, uuid, text, integer, text[], jsonb)
  TO authenticated;
