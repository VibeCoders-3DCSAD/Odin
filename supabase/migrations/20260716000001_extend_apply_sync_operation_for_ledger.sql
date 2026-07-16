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
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  IF p_entity NOT IN ('categories', 'subcategories', 'financial_accounts', 'transactions') THEN
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

        INSERT INTO transactions (
          id, user_id, transaction_type, status, entry_source, transaction_date,
          posted_at, amount_centavos, subcategory_id, source_account_id,
          destination_account_id, merchant_name, counterparty_name, notes,
          metadata, updated_at, version, deleted
        ) VALUES (
          p_record_id, v_user_id,
          (p_payload->>'transaction_type')::odin_transaction_type,
          'posted'::odin_transaction_status, 'offline_sync'::odin_transaction_entry_source,
          (p_payload->>'transaction_date')::date, v_now,
          (p_payload->>'amount_centavos')::bigint,
          (p_payload->>'subcategory_id')::uuid,
          (p_payload->>'source_account_id')::uuid,
          (p_payload->>'destination_account_id')::uuid,
          p_payload->>'merchant_name', p_payload->>'counterparty_name',
          p_payload->>'notes', '{}'::jsonb, v_now, 1, false
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
      SELECT version, deleted INTO v_current_version, v_deleted_check
      FROM transactions WHERE id = p_record_id AND user_id = v_user_id FOR UPDATE;
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
  END CASE;

  -- last-write-wins conflict logging
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
