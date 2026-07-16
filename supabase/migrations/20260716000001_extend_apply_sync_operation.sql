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
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  IF p_entity NOT IN (
    'categories',
    'subcategories',
    'financial_accounts',
    'income_sources',
    'financial_obligations'
  ) THEN
    RAISE EXCEPTION 'entity % is not syncable', p_entity;
  END IF;

  IF p_operation_type NOT IN ('create', 'update', 'delete') THEN
    RAISE EXCEPTION 'operation_type % is invalid', p_operation_type;
  END IF;

  INSERT INTO applied_operations (
    operation_id,
    user_id,
    device_id,
    entity,
    record_id,
    operation_type,
    result
  ) VALUES (
    p_operation_id,
    v_user_id,
    p_device_id,
    p_entity,
    p_record_id,
    p_operation_type,
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

  ---------------------------------------------------------------------------
  -- CREATE
  ---------------------------------------------------------------------------
  IF p_operation_type = 'create' THEN
    IF p_entity = 'categories' THEN
      PERFORM 1
      FROM category_groups
      WHERE id = (p_payload->>'category_group_id')::uuid
        AND is_active = true;

      IF NOT FOUND THEN
        UPDATE applied_operations
        SET result = jsonb_build_object(
          'status', 'rejected',
          'reason', 'category_group_id does not reference an active category group'
        )
        WHERE operation_id = p_operation_id;

        RETURN QUERY SELECT 'rejected'::text, 'category_group_id does not reference an active category group'::text, NULL::integer, NULL::text[];
        RETURN;
      END IF;

      INSERT INTO categories (
        id,
        category_group_id,
        user_id,
        slug,
        label,
        short_label,
        description,
        is_system,
        is_filipino_context,
        sort_order,
        is_active,
        metadata,
        updated_at,
        version,
        deleted
      ) VALUES (
        p_record_id,
        (p_payload->>'category_group_id')::uuid,
        v_user_id,
        p_payload->>'slug',
        p_payload->>'label',
        p_payload->>'short_label',
        p_payload->>'description',
        false,
        COALESCE((p_payload->>'is_filipino_context')::boolean, false),
        COALESCE((p_payload->>'sort_order')::integer, 0),
        true,
        '{}'::jsonb,
        v_now,
        1,
        false
      );

    ELSIF p_entity = 'subcategories' THEN
      IF (p_payload->>'kind') = 'expense' THEN
        PERFORM 1
        FROM categories
        WHERE id = (p_payload->>'category_id')::uuid
          AND deleted = false
          AND is_active = true
          AND (user_id = v_user_id OR user_id IS NULL);

        IF NOT FOUND THEN
          UPDATE applied_operations
          SET result = jsonb_build_object(
            'status', 'rejected',
            'reason', 'category_id does not reference an accessible active category'
          )
          WHERE operation_id = p_operation_id;

          RETURN QUERY SELECT 'rejected'::text, 'category_id does not reference an accessible active category'::text, NULL::integer, NULL::text[];
          RETURN;
        END IF;
      END IF;

      INSERT INTO subcategories (
        id,
        category_id,
        user_id,
        slug,
        kind,
        label,
        short_label,
        description,
        is_system,
        is_filipino_context,
        is_protected_default,
        is_protected,
        sort_order,
        is_active,
        metadata,
        updated_at,
        version,
        deleted
      ) VALUES (
        p_record_id,
        CASE WHEN (p_payload->>'kind') = 'expense' THEN (p_payload->>'category_id')::uuid ELSE NULL END,
        v_user_id,
        p_payload->>'slug',
        (p_payload->>'kind')::odin_subcategory_kind,
        p_payload->>'label',
        p_payload->>'short_label',
        p_payload->>'description',
        false,
        COALESCE((p_payload->>'is_filipino_context')::boolean, false),
        false,
        COALESCE((p_payload->>'is_protected')::boolean, false),
        COALESCE((p_payload->>'sort_order')::integer, 0),
        true,
        '{}'::jsonb,
        v_now,
        1,
        false
      );

    ELSIF p_entity = 'financial_accounts' THEN
      INSERT INTO financial_accounts (
        id,
        user_id,
        name,
        kind,
        status,
        opening_balance_centavos,
        current_balance_centavos,
        credit_limit_centavos,
        include_in_dashboard_balance,
        institution_name,
        opened_on,
        sort_order,
        metadata,
        updated_at,
        version,
        deleted
      ) VALUES (
        p_record_id,
        v_user_id,
        p_payload->>'name',
        (p_payload->>'kind')::odin_account_kind,
        'active',
        COALESCE((p_payload->>'opening_balance_centavos')::bigint, 0),
        COALESCE((p_payload->>'opening_balance_centavos')::bigint, 0),
        (p_payload->>'credit_limit_centavos')::bigint,
        COALESCE((p_payload->>'include_in_dashboard_balance')::boolean, true),
        p_payload->>'institution_name',
        (p_payload->>'opened_on')::date,
        COALESCE((p_payload->>'sort_order')::integer, 0),
        '{}'::jsonb,
        v_now,
        1,
        false
      );

    ELSIF p_entity = 'income_sources' THEN
      INSERT INTO income_sources (
        id,
        user_id,
        name,
        income_type,
        frequency,
        expected_amount_centavos,
        min_amount_centavos,
        max_amount_centavos,
        payday_day_of_month,
        payday_second_day_of_month,
        payday_day_of_week,
        next_expected_date,
        is_active,
        notes,
        metadata,
        updated_at,
        version,
        deleted
      ) VALUES (
        p_record_id,
        v_user_id,
        p_payload->>'name',
        (p_payload->>'income_type')::odin_income_type,
        (p_payload->>'frequency')::odin_income_frequency,
        (p_payload->>'expected_amount_centavos')::bigint,
        (p_payload->>'min_amount_centavos')::bigint,
        (p_payload->>'max_amount_centavos')::bigint,
        (p_payload->>'payday_day_of_month')::integer,
        (p_payload->>'payday_second_day_of_month')::integer,
        (p_payload->>'payday_day_of_week')::integer,
        (p_payload->>'next_expected_date')::date,
        COALESCE((p_payload->>'is_active')::boolean, true),
        p_payload->>'notes',
        '{}'::jsonb,
        v_now,
        1,
        false
      );

    ELSIF p_entity = 'financial_obligations' THEN
      PERFORM 1
      FROM subcategories
      WHERE id = (p_payload->>'subcategory_id')::uuid
        AND kind = 'expense'
        AND deleted = false
        AND is_active = true
        AND (user_id = v_user_id OR user_id IS NULL);

      IF NOT FOUND THEN
        UPDATE applied_operations
        SET result = jsonb_build_object(
          'status', 'rejected',
          'reason', 'subcategory_id does not reference an accessible active expense subcategory'
        )
        WHERE operation_id = p_operation_id;

        RETURN QUERY SELECT 'rejected'::text, 'subcategory_id does not reference an accessible active expense subcategory'::text, NULL::integer, NULL::text[];
        RETURN;
      END IF;

      IF (p_payload->>'recurring_template_id') IS NOT NULL THEN
        PERFORM 1
        FROM recurring_transaction_templates
        WHERE id = (p_payload->>'recurring_template_id')::uuid
          AND user_id = v_user_id;

        IF NOT FOUND THEN
          UPDATE applied_operations
          SET result = jsonb_build_object(
            'status', 'rejected',
            'reason', 'recurring_template_id does not reference an accessible recurring template'
          )
          WHERE operation_id = p_operation_id;

          RETURN QUERY SELECT 'rejected'::text, 'recurring_template_id does not reference an accessible recurring template'::text, NULL::integer, NULL::text[];
          RETURN;
        END IF;
      END IF;

      INSERT INTO financial_obligations (
        id,
        user_id,
        subcategory_id,
        recurring_template_id,
        name,
        status,
        amount_centavos,
        frequency,
        due_day_of_month,
        is_family_support,
        is_dependent_support,
        protected_by_default,
        starts_on,
        ends_on,
        notes,
        metadata,
        updated_at,
        version,
        deleted
      ) VALUES (
        p_record_id,
        v_user_id,
        (p_payload->>'subcategory_id')::uuid,
        (p_payload->>'recurring_template_id')::uuid,
        p_payload->>'name',
        'active',
        (p_payload->>'amount_centavos')::bigint,
        (p_payload->>'frequency')::odin_recurring_frequency,
        (p_payload->>'due_day_of_month')::integer,
        COALESCE((p_payload->>'is_family_support')::boolean, false),
        COALESCE((p_payload->>'is_dependent_support')::boolean, false),
        COALESCE((p_payload->>'protected_by_default')::boolean, true),
        (p_payload->>'starts_on')::date,
        (p_payload->>'ends_on')::date,
        p_payload->>'notes',
        '{}'::jsonb,
        v_now,
        1,
        false
      );
    END IF;

    UPDATE applied_operations
    SET result = jsonb_build_object(
      'status', 'applied',
      'current_version', 1
    )
    WHERE operation_id = p_operation_id;

    RETURN QUERY SELECT 'applied'::text, NULL::text, 1, NULL::text[];
    RETURN;
  END IF;

  ---------------------------------------------------------------------------
  -- VERSION CHECK (update / delete)
  ---------------------------------------------------------------------------
  IF p_entity = 'categories' THEN
    SELECT version
      INTO v_current_version
      FROM categories
      WHERE id = p_record_id
        AND user_id = v_user_id
      FOR UPDATE;
  ELSIF p_entity = 'subcategories' THEN
    SELECT version
      INTO v_current_version
      FROM subcategories
      WHERE id = p_record_id
        AND user_id = v_user_id
      FOR UPDATE;
  ELSIF p_entity = 'financial_accounts' THEN
    SELECT version
      INTO v_current_version
      FROM financial_accounts
      WHERE id = p_record_id
        AND user_id = v_user_id
      FOR UPDATE;
  ELSIF p_entity = 'income_sources' THEN
    SELECT version
      INTO v_current_version
      FROM income_sources
      WHERE id = p_record_id
        AND user_id = v_user_id
      FOR UPDATE;
  ELSIF p_entity = 'financial_obligations' THEN
    SELECT version
      INTO v_current_version
      FROM financial_obligations
      WHERE id = p_record_id
        AND user_id = v_user_id
      FOR UPDATE;
  ELSE
    UPDATE applied_operations
    SET result = jsonb_build_object(
      'status', 'rejected',
      'reason', 'entity ' || p_entity || ' not supported'
    )
    WHERE operation_id = p_operation_id;

    RETURN QUERY SELECT 'rejected'::text, ('entity ' || p_entity || ' not supported')::text, NULL::integer, NULL::text[];
    RETURN;
  END IF;

  IF v_current_version IS NULL THEN
    UPDATE applied_operations
    SET result = jsonb_build_object(
      'status', 'rejected',
      'reason', 'record not found'
    )
    WHERE operation_id = p_operation_id;

    RETURN QUERY SELECT 'rejected'::text, 'record not found'::text, NULL::integer, NULL::text[];
    RETURN;
  END IF;

  ---------------------------------------------------------------------------
  -- DELETE
  ---------------------------------------------------------------------------
  IF p_operation_type = 'delete' THEN
    IF p_base_version IS NOT NULL AND p_base_version <> v_current_version THEN
      INSERT INTO edit_history (user_id, operation_id, entity, record_id, reason, payload)
      VALUES (
        v_user_id,
        p_operation_id,
        p_entity,
        p_record_id,
        'delete_wins',
        jsonb_build_object(
          'base_version', p_base_version,
          'overwritten_version', v_current_version
        )
      );
    END IF;

    IF p_entity = 'categories' THEN
      UPDATE categories
      SET deleted = true, is_active = false
      WHERE id = p_record_id AND user_id = v_user_id;
    ELSIF p_entity = 'subcategories' THEN
      UPDATE subcategories
      SET deleted = true, is_active = false
      WHERE id = p_record_id AND user_id = v_user_id;
    ELSIF p_entity = 'financial_accounts' THEN
      UPDATE financial_accounts
      SET deleted = true, status = 'deleted', deleted_at = v_now
      WHERE id = p_record_id AND user_id = v_user_id;
    ELSIF p_entity = 'income_sources' THEN
      UPDATE income_sources
      SET deleted = true, is_active = false
      WHERE id = p_record_id AND user_id = v_user_id;
    ELSIF p_entity = 'financial_obligations' THEN
      UPDATE financial_obligations
      SET deleted = true, status = 'deleted'
      WHERE id = p_record_id AND user_id = v_user_id;
    END IF;

    UPDATE applied_operations
    SET result = jsonb_build_object(
      'status', 'applied',
      'current_version', v_current_version + 1
    )
    WHERE operation_id = p_operation_id;

    RETURN QUERY SELECT 'applied'::text, NULL::text, v_current_version + 1, NULL::text[];
    RETURN;
  END IF;

  ---------------------------------------------------------------------------
  -- PA YLOAD CHECK
  ---------------------------------------------------------------------------
  IF COALESCE(jsonb_object_length(p_payload), 0) = 0 THEN
    UPDATE applied_operations
    SET result = jsonb_build_object(
      'status', 'rejected',
      'reason', 'no fields to apply',
      'current_version', v_current_version
    )
    WHERE operation_id = p_operation_id;

    RETURN QUERY SELECT 'rejected'::text, 'no fields to apply'::text, v_current_version, NULL::text[];
    RETURN;
  END IF;

  ---------------------------------------------------------------------------
  -- UPDATE — categories
  ---------------------------------------------------------------------------
  IF p_entity = 'categories' THEN
    IF EXISTS (
      SELECT 1 FROM categories WHERE id = p_record_id AND user_id = v_user_id AND deleted = true
    ) THEN
      INSERT INTO edit_history (user_id, operation_id, entity, record_id, reason, payload)
      VALUES (v_user_id, p_operation_id, p_entity, p_record_id, 'delete_wins', p_payload);

      UPDATE applied_operations
      SET result = jsonb_build_object(
        'status', 'rejected',
        'reason', 'record is deleted',
        'current_version', v_current_version
      )
      WHERE operation_id = p_operation_id;

      RETURN QUERY SELECT 'rejected'::text, 'record is deleted'::text, v_current_version, NULL::text[];
      RETURN;
    END IF;

    v_overwritten_values :=
      CASE WHEN p_payload ? 'label' THEN jsonb_build_object('label', (SELECT to_jsonb(label) FROM categories WHERE id = p_record_id AND user_id = v_user_id)) ELSE '{}'::jsonb END ||
      CASE WHEN p_payload ? 'short_label' THEN jsonb_build_object('short_label', (SELECT to_jsonb(short_label) FROM categories WHERE id = p_record_id AND user_id = v_user_id)) ELSE '{}'::jsonb END ||
      CASE WHEN p_payload ? 'description' THEN jsonb_build_object('description', (SELECT to_jsonb(description) FROM categories WHERE id = p_record_id AND user_id = v_user_id)) ELSE '{}'::jsonb END ||
      CASE WHEN p_payload ? 'is_filipino_context' THEN jsonb_build_object('is_filipino_context', (SELECT to_jsonb(is_filipino_context) FROM categories WHERE id = p_record_id AND user_id = v_user_id)) ELSE '{}'::jsonb END ||
      CASE WHEN p_payload ? 'sort_order' THEN jsonb_build_object('sort_order', (SELECT to_jsonb(sort_order) FROM categories WHERE id = p_record_id AND user_id = v_user_id)) ELSE '{}'::jsonb END ||
      CASE WHEN p_payload ? 'is_active' THEN jsonb_build_object('is_active', (SELECT to_jsonb(is_active) FROM categories WHERE id = p_record_id AND user_id = v_user_id)) ELSE '{}'::jsonb END;

    UPDATE categories
    SET label = CASE WHEN p_payload ? 'label' THEN p_payload->>'label' ELSE label END,
        short_label = CASE WHEN p_payload ? 'short_label' THEN p_payload->>'short_label' ELSE short_label END,
        description = CASE WHEN p_payload ? 'description' THEN p_payload->>'description' ELSE description END,
        is_filipino_context = CASE WHEN p_payload ? 'is_filipino_context' THEN (p_payload->>'is_filipino_context')::boolean ELSE is_filipino_context END,
        sort_order = CASE WHEN p_payload ? 'sort_order' THEN (p_payload->>'sort_order')::integer ELSE sort_order END,
        is_active = CASE WHEN p_payload ? 'is_active' THEN (p_payload->>'is_active')::boolean ELSE is_active END
    WHERE id = p_record_id
      AND user_id = v_user_id;

  ---------------------------------------------------------------------------
  -- UPDATE — subcategories
  ---------------------------------------------------------------------------
  ELSIF p_entity = 'subcategories' THEN
    IF EXISTS (
      SELECT 1 FROM subcategories WHERE id = p_record_id AND user_id = v_user_id AND deleted = true
    ) THEN
      INSERT INTO edit_history (user_id, operation_id, entity, record_id, reason, payload)
      VALUES (v_user_id, p_operation_id, p_entity, p_record_id, 'delete_wins', p_payload);

      UPDATE applied_operations
      SET result = jsonb_build_object(
        'status', 'rejected',
        'reason', 'record is deleted',
        'current_version', v_current_version
      )
      WHERE operation_id = p_operation_id;

      RETURN QUERY SELECT 'rejected'::text, 'record is deleted'::text, v_current_version, NULL::text[];
      RETURN;
    END IF;

    v_overwritten_values :=
      CASE WHEN p_payload ? 'label' THEN jsonb_build_object('label', (SELECT to_jsonb(label) FROM subcategories WHERE id = p_record_id AND user_id = v_user_id)) ELSE '{}'::jsonb END ||
      CASE WHEN p_payload ? 'short_label' THEN jsonb_build_object('short_label', (SELECT to_jsonb(short_label) FROM subcategories WHERE id = p_record_id AND user_id = v_user_id)) ELSE '{}'::jsonb END ||
      CASE WHEN p_payload ? 'description' THEN jsonb_build_object('description', (SELECT to_jsonb(description) FROM subcategories WHERE id = p_record_id AND user_id = v_user_id)) ELSE '{}'::jsonb END ||
      CASE WHEN p_payload ? 'is_filipino_context' THEN jsonb_build_object('is_filipino_context', (SELECT to_jsonb(is_filipino_context) FROM subcategories WHERE id = p_record_id AND user_id = v_user_id)) ELSE '{}'::jsonb END ||
      CASE WHEN p_payload ? 'is_protected' THEN jsonb_build_object('is_protected', (SELECT to_jsonb(is_protected) FROM subcategories WHERE id = p_record_id AND user_id = v_user_id)) ELSE '{}'::jsonb END ||
      CASE WHEN p_payload ? 'is_active' THEN jsonb_build_object('is_active', (SELECT to_jsonb(is_active) FROM subcategories WHERE id = p_record_id AND user_id = v_user_id)) ELSE '{}'::jsonb END;

    UPDATE subcategories
    SET label = CASE WHEN p_payload ? 'label' THEN p_payload->>'label' ELSE label END,
        short_label = CASE WHEN p_payload ? 'short_label' THEN p_payload->>'short_label' ELSE short_label END,
        description = CASE WHEN p_payload ? 'description' THEN p_payload->>'description' ELSE description END,
        is_filipino_context = CASE WHEN p_payload ? 'is_filipino_context' THEN (p_payload->>'is_filipino_context')::boolean ELSE is_filipino_context END,
        is_protected = CASE WHEN p_payload ? 'is_protected' THEN (p_payload->>'is_protected')::boolean ELSE is_protected END,
        is_active = CASE WHEN p_payload ? 'is_active' THEN (p_payload->>'is_active')::boolean ELSE is_active END
    WHERE id = p_record_id
      AND user_id = v_user_id;

  ---------------------------------------------------------------------------
  -- UPDATE — financial_accounts
  ---------------------------------------------------------------------------
  ELSIF p_entity = 'financial_accounts' THEN
    IF EXISTS (
      SELECT 1 FROM financial_accounts WHERE id = p_record_id AND user_id = v_user_id AND deleted = true
    ) THEN
      INSERT INTO edit_history (user_id, operation_id, entity, record_id, reason, payload)
      VALUES (v_user_id, p_operation_id, p_entity, p_record_id, 'delete_wins', p_payload);

      UPDATE applied_operations
      SET result = jsonb_build_object(
        'status', 'rejected',
        'reason', 'record is deleted',
        'current_version', v_current_version
      )
      WHERE operation_id = p_operation_id;

      RETURN QUERY SELECT 'rejected'::text, 'record is deleted'::text, v_current_version, NULL::text[];
      RETURN;
    END IF;

    v_overwritten_values :=
      CASE WHEN p_payload ? 'name' THEN jsonb_build_object('name', (SELECT to_jsonb(name) FROM financial_accounts WHERE id = p_record_id AND user_id = v_user_id)) ELSE '{}'::jsonb END ||
      CASE WHEN p_payload ? 'status' THEN jsonb_build_object('status', (SELECT to_jsonb(status) FROM financial_accounts WHERE id = p_record_id AND user_id = v_user_id)) ELSE '{}'::jsonb END ||
      CASE WHEN p_payload ? 'opening_balance_centavos' THEN jsonb_build_object('opening_balance_centavos', (SELECT to_jsonb(opening_balance_centavos) FROM financial_accounts WHERE id = p_record_id AND user_id = v_user_id)) ELSE '{}'::jsonb END ||
      CASE WHEN p_payload ? 'current_balance_centavos' THEN jsonb_build_object('current_balance_centavos', (SELECT to_jsonb(current_balance_centavos) FROM financial_accounts WHERE id = p_record_id AND user_id = v_user_id)) ELSE '{}'::jsonb END ||
      CASE WHEN p_payload ? 'credit_limit_centavos' THEN jsonb_build_object('credit_limit_centavos', (SELECT to_jsonb(credit_limit_centavos) FROM financial_accounts WHERE id = p_record_id AND user_id = v_user_id)) ELSE '{}'::jsonb END ||
      CASE WHEN p_payload ? 'include_in_dashboard_balance' THEN jsonb_build_object('include_in_dashboard_balance', (SELECT to_jsonb(include_in_dashboard_balance) FROM financial_accounts WHERE id = p_record_id AND user_id = v_user_id)) ELSE '{}'::jsonb END ||
      CASE WHEN p_payload ? 'institution_name' THEN jsonb_build_object('institution_name', (SELECT to_jsonb(institution_name) FROM financial_accounts WHERE id = p_record_id AND user_id = v_user_id)) ELSE '{}'::jsonb END ||
      CASE WHEN p_payload ? 'opened_on' THEN jsonb_build_object('opened_on', (SELECT to_jsonb(opened_on) FROM financial_accounts WHERE id = p_record_id AND user_id = v_user_id)) ELSE '{}'::jsonb END ||
      CASE WHEN p_payload ? 'archived_at' THEN jsonb_build_object('archived_at', (SELECT to_jsonb(archived_at) FROM financial_accounts WHERE id = p_record_id AND user_id = v_user_id)) ELSE '{}'::jsonb END ||
      CASE WHEN p_payload ? 'sort_order' THEN jsonb_build_object('sort_order', (SELECT to_jsonb(sort_order) FROM financial_accounts WHERE id = p_record_id AND user_id = v_user_id)) ELSE '{}'::jsonb END;

    IF p_payload ? 'status' AND (p_payload->>'status') = 'deleted' THEN
      UPDATE applied_operations
      SET result = jsonb_build_object(
        'status', 'rejected',
        'reason', 'status deleted must use the delete operation',
        'current_version', v_current_version
      )
      WHERE operation_id = p_operation_id;

      RETURN QUERY SELECT 'rejected'::text, 'status deleted must use the delete operation'::text, v_current_version, NULL::text[];
      RETURN;
    END IF;

    UPDATE financial_accounts
    SET name = CASE WHEN p_payload ? 'name' THEN p_payload->>'name' ELSE name END,
        status = CASE WHEN p_payload ? 'status' THEN (p_payload->>'status')::odin_account_status ELSE status END,
        opening_balance_centavos = CASE WHEN p_payload ? 'opening_balance_centavos' THEN (p_payload->>'opening_balance_centavos')::bigint ELSE opening_balance_centavos END,
        current_balance_centavos = CASE WHEN p_payload ? 'current_balance_centavos' THEN (p_payload->>'current_balance_centavos')::bigint ELSE current_balance_centavos END,
        credit_limit_centavos = CASE WHEN p_payload ? 'credit_limit_centavos' THEN (p_payload->>'credit_limit_centavos')::bigint ELSE credit_limit_centavos END,
        include_in_dashboard_balance = CASE WHEN p_payload ? 'include_in_dashboard_balance' THEN (p_payload->>'include_in_dashboard_balance')::boolean ELSE include_in_dashboard_balance END,
        institution_name = CASE WHEN p_payload ? 'institution_name' THEN p_payload->>'institution_name' ELSE institution_name END,
        opened_on = CASE WHEN p_payload ? 'opened_on' THEN (p_payload->>'opened_on')::date ELSE opened_on END,
        archived_at = CASE WHEN p_payload ? 'archived_at' THEN (p_payload->>'archived_at')::timestamptz ELSE archived_at END,
        sort_order = CASE WHEN p_payload ? 'sort_order' THEN (p_payload->>'sort_order')::integer ELSE sort_order END
    WHERE id = p_record_id
      AND user_id = v_user_id;

  ---------------------------------------------------------------------------
  -- UPDATE — income_sources
  ---------------------------------------------------------------------------
  ELSIF p_entity = 'income_sources' THEN
    IF EXISTS (
      SELECT 1 FROM income_sources WHERE id = p_record_id AND user_id = v_user_id AND deleted = true
    ) THEN
      INSERT INTO edit_history (user_id, operation_id, entity, record_id, reason, payload)
      VALUES (v_user_id, p_operation_id, p_entity, p_record_id, 'delete_wins', p_payload);

      UPDATE applied_operations
      SET result = jsonb_build_object(
        'status', 'rejected',
        'reason', 'record is deleted',
        'current_version', v_current_version
      )
      WHERE operation_id = p_operation_id;

      RETURN QUERY SELECT 'rejected'::text, 'record is deleted'::text, v_current_version, NULL::text[];
      RETURN;
    END IF;

    v_overwritten_values :=
      CASE WHEN p_payload ? 'name' THEN jsonb_build_object('name', (SELECT to_jsonb(name) FROM income_sources WHERE id = p_record_id AND user_id = v_user_id)) ELSE '{}'::jsonb END ||
      CASE WHEN p_payload ? 'income_type' THEN jsonb_build_object('income_type', (SELECT to_jsonb(income_type) FROM income_sources WHERE id = p_record_id AND user_id = v_user_id)) ELSE '{}'::jsonb END ||
      CASE WHEN p_payload ? 'frequency' THEN jsonb_build_object('frequency', (SELECT to_jsonb(frequency) FROM income_sources WHERE id = p_record_id AND user_id = v_user_id)) ELSE '{}'::jsonb END ||
      CASE WHEN p_payload ? 'expected_amount_centavos' THEN jsonb_build_object('expected_amount_centavos', (SELECT to_jsonb(expected_amount_centavos) FROM income_sources WHERE id = p_record_id AND user_id = v_user_id)) ELSE '{}'::jsonb END ||
      CASE WHEN p_payload ? 'min_amount_centavos' THEN jsonb_build_object('min_amount_centavos', (SELECT to_jsonb(min_amount_centavos) FROM income_sources WHERE id = p_record_id AND user_id = v_user_id)) ELSE '{}'::jsonb END ||
      CASE WHEN p_payload ? 'max_amount_centavos' THEN jsonb_build_object('max_amount_centavos', (SELECT to_jsonb(max_amount_centavos) FROM income_sources WHERE id = p_record_id AND user_id = v_user_id)) ELSE '{}'::jsonb END ||
      CASE WHEN p_payload ? 'payday_day_of_month' THEN jsonb_build_object('payday_day_of_month', (SELECT to_jsonb(payday_day_of_month) FROM income_sources WHERE id = p_record_id AND user_id = v_user_id)) ELSE '{}'::jsonb END ||
      CASE WHEN p_payload ? 'payday_second_day_of_month' THEN jsonb_build_object('payday_second_day_of_month', (SELECT to_jsonb(payday_second_day_of_month) FROM income_sources WHERE id = p_record_id AND user_id = v_user_id)) ELSE '{}'::jsonb END ||
      CASE WHEN p_payload ? 'payday_day_of_week' THEN jsonb_build_object('payday_day_of_week', (SELECT to_jsonb(payday_day_of_week) FROM income_sources WHERE id = p_record_id AND user_id = v_user_id)) ELSE '{}'::jsonb END ||
      CASE WHEN p_payload ? 'next_expected_date' THEN jsonb_build_object('next_expected_date', (SELECT to_jsonb(next_expected_date) FROM income_sources WHERE id = p_record_id AND user_id = v_user_id)) ELSE '{}'::jsonb END ||
      CASE WHEN p_payload ? 'is_active' THEN jsonb_build_object('is_active', (SELECT to_jsonb(is_active) FROM income_sources WHERE id = p_record_id AND user_id = v_user_id)) ELSE '{}'::jsonb END ||
      CASE WHEN p_payload ? 'notes' THEN jsonb_build_object('notes', (SELECT to_jsonb(notes) FROM income_sources WHERE id = p_record_id AND user_id = v_user_id)) ELSE '{}'::jsonb END;

    UPDATE income_sources
    SET name = CASE WHEN p_payload ? 'name' THEN p_payload->>'name' ELSE name END,
        income_type = CASE WHEN p_payload ? 'income_type' THEN (p_payload->>'income_type')::odin_income_type ELSE income_type END,
        frequency = CASE WHEN p_payload ? 'frequency' THEN (p_payload->>'frequency')::odin_income_frequency ELSE frequency END,
        expected_amount_centavos = CASE WHEN p_payload ? 'expected_amount_centavos' THEN (p_payload->>'expected_amount_centavos')::bigint ELSE expected_amount_centavos END,
        min_amount_centavos = CASE WHEN p_payload ? 'min_amount_centavos' THEN (p_payload->>'min_amount_centavos')::bigint ELSE min_amount_centavos END,
        max_amount_centavos = CASE WHEN p_payload ? 'max_amount_centavos' THEN (p_payload->>'max_amount_centavos')::bigint ELSE max_amount_centavos END,
        payday_day_of_month = CASE WHEN p_payload ? 'payday_day_of_month' THEN (p_payload->>'payday_day_of_month')::integer ELSE payday_day_of_month END,
        payday_second_day_of_month = CASE WHEN p_payload ? 'payday_second_day_of_month' THEN (p_payload->>'payday_second_day_of_month')::integer ELSE payday_second_day_of_month END,
        payday_day_of_week = CASE WHEN p_payload ? 'payday_day_of_week' THEN (p_payload->>'payday_day_of_week')::integer ELSE payday_day_of_week END,
        next_expected_date = CASE WHEN p_payload ? 'next_expected_date' THEN (p_payload->>'next_expected_date')::date ELSE next_expected_date END,
        is_active = CASE WHEN p_payload ? 'is_active' THEN (p_payload->>'is_active')::boolean ELSE is_active END,
        notes = CASE WHEN p_payload ? 'notes' THEN p_payload->>'notes' ELSE notes END
    WHERE id = p_record_id
      AND user_id = v_user_id;

  ---------------------------------------------------------------------------
  -- UPDATE — financial_obligations
  ---------------------------------------------------------------------------
  ELSIF p_entity = 'financial_obligations' THEN
    IF EXISTS (
      SELECT 1 FROM financial_obligations WHERE id = p_record_id AND user_id = v_user_id AND deleted = true
    ) THEN
      INSERT INTO edit_history (user_id, operation_id, entity, record_id, reason, payload)
      VALUES (v_user_id, p_operation_id, p_entity, p_record_id, 'delete_wins', p_payload);

      UPDATE applied_operations
      SET result = jsonb_build_object(
        'status', 'rejected',
        'reason', 'record is deleted',
        'current_version', v_current_version
      )
      WHERE operation_id = p_operation_id;

      RETURN QUERY SELECT 'rejected'::text, 'record is deleted'::text, v_current_version, NULL::text[];
      RETURN;
    END IF;

    IF p_payload ? 'subcategory_id' THEN
      PERFORM 1
      FROM subcategories
      WHERE id = (p_payload->>'subcategory_id')::uuid
        AND kind = 'expense'
        AND deleted = false
        AND is_active = true
        AND (user_id = v_user_id OR user_id IS NULL);

      IF NOT FOUND THEN
        UPDATE applied_operations
        SET result = jsonb_build_object(
          'status', 'rejected',
          'reason', 'subcategory_id does not reference an accessible active expense subcategory'
        )
        WHERE operation_id = p_operation_id;

        RETURN QUERY SELECT 'rejected'::text, 'subcategory_id does not reference an accessible active expense subcategory'::text, NULL::integer, NULL::text[];
        RETURN;
      END IF;
    END IF;

    IF p_payload ? 'recurring_template_id' AND (p_payload->>'recurring_template_id') IS NOT NULL THEN
      PERFORM 1
      FROM recurring_transaction_templates
      WHERE id = (p_payload->>'recurring_template_id')::uuid
        AND user_id = v_user_id;

      IF NOT FOUND THEN
        UPDATE applied_operations
        SET result = jsonb_build_object(
          'status', 'rejected',
          'reason', 'recurring_template_id does not reference an accessible recurring template'
        )
        WHERE operation_id = p_operation_id;

        RETURN QUERY SELECT 'rejected'::text, 'recurring_template_id does not reference an accessible recurring template'::text, NULL::integer, NULL::text[];
        RETURN;
      END IF;
    END IF;

    v_overwritten_values :=
      CASE WHEN p_payload ? 'subcategory_id' THEN jsonb_build_object('subcategory_id', (SELECT to_jsonb(subcategory_id) FROM financial_obligations WHERE id = p_record_id AND user_id = v_user_id)) ELSE '{}'::jsonb END ||
      CASE WHEN p_payload ? 'recurring_template_id' THEN jsonb_build_object('recurring_template_id', (SELECT to_jsonb(recurring_template_id) FROM financial_obligations WHERE id = p_record_id AND user_id = v_user_id)) ELSE '{}'::jsonb END ||
      CASE WHEN p_payload ? 'name' THEN jsonb_build_object('name', (SELECT to_jsonb(name) FROM financial_obligations WHERE id = p_record_id AND user_id = v_user_id)) ELSE '{}'::jsonb END ||
      CASE WHEN p_payload ? 'amount_centavos' THEN jsonb_build_object('amount_centavos', (SELECT to_jsonb(amount_centavos) FROM financial_obligations WHERE id = p_record_id AND user_id = v_user_id)) ELSE '{}'::jsonb END ||
      CASE WHEN p_payload ? 'frequency' THEN jsonb_build_object('frequency', (SELECT to_jsonb(frequency) FROM financial_obligations WHERE id = p_record_id AND user_id = v_user_id)) ELSE '{}'::jsonb END ||
      CASE WHEN p_payload ? 'due_day_of_month' THEN jsonb_build_object('due_day_of_month', (SELECT to_jsonb(due_day_of_month) FROM financial_obligations WHERE id = p_record_id AND user_id = v_user_id)) ELSE '{}'::jsonb END ||
      CASE WHEN p_payload ? 'is_family_support' THEN jsonb_build_object('is_family_support', (SELECT to_jsonb(is_family_support) FROM financial_obligations WHERE id = p_record_id AND user_id = v_user_id)) ELSE '{}'::jsonb END ||
      CASE WHEN p_payload ? 'is_dependent_support' THEN jsonb_build_object('is_dependent_support', (SELECT to_jsonb(is_dependent_support) FROM financial_obligations WHERE id = p_record_id AND user_id = v_user_id)) ELSE '{}'::jsonb END ||
      CASE WHEN p_payload ? 'protected_by_default' THEN jsonb_build_object('protected_by_default', (SELECT to_jsonb(protected_by_default) FROM financial_obligations WHERE id = p_record_id AND user_id = v_user_id)) ELSE '{}'::jsonb END ||
      CASE WHEN p_payload ? 'starts_on' THEN jsonb_build_object('starts_on', (SELECT to_jsonb(starts_on) FROM financial_obligations WHERE id = p_record_id AND user_id = v_user_id)) ELSE '{}'::jsonb END ||
      CASE WHEN p_payload ? 'ends_on' THEN jsonb_build_object('ends_on', (SELECT to_jsonb(ends_on) FROM financial_obligations WHERE id = p_record_id AND user_id = v_user_id)) ELSE '{}'::jsonb END ||
      CASE WHEN p_payload ? 'notes' THEN jsonb_build_object('notes', (SELECT to_jsonb(notes) FROM financial_obligations WHERE id = p_record_id AND user_id = v_user_id)) ELSE '{}'::jsonb END;

    UPDATE financial_obligations
    SET subcategory_id = CASE WHEN p_payload ? 'subcategory_id' THEN (p_payload->>'subcategory_id')::uuid ELSE subcategory_id END,
        recurring_template_id = CASE WHEN p_payload ? 'recurring_template_id' THEN (p_payload->>'recurring_template_id')::uuid ELSE recurring_template_id END,
        name = CASE WHEN p_payload ? 'name' THEN p_payload->>'name' ELSE name END,
        amount_centavos = CASE WHEN p_payload ? 'amount_centavos' THEN (p_payload->>'amount_centavos')::bigint ELSE amount_centavos END,
        frequency = CASE WHEN p_payload ? 'frequency' THEN (p_payload->>'frequency')::odin_recurring_frequency ELSE frequency END,
        due_day_of_month = CASE WHEN p_payload ? 'due_day_of_month' THEN (p_payload->>'due_day_of_month')::integer ELSE due_day_of_month END,
        is_family_support = CASE WHEN p_payload ? 'is_family_support' THEN (p_payload->>'is_family_support')::boolean ELSE is_family_support END,
        is_dependent_support = CASE WHEN p_payload ? 'is_dependent_support' THEN (p_payload->>'is_dependent_support')::boolean ELSE is_dependent_support END,
        protected_by_default = CASE WHEN p_payload ? 'protected_by_default' THEN (p_payload->>'protected_by_default')::boolean ELSE protected_by_default END,
        starts_on = CASE WHEN p_payload ? 'starts_on' THEN (p_payload->>'starts_on')::date ELSE starts_on END,
        ends_on = CASE WHEN p_payload ? 'ends_on' THEN (p_payload->>'ends_on')::date ELSE ends_on END,
        notes = CASE WHEN p_payload ? 'notes' THEN p_payload->>'notes' ELSE notes END
    WHERE id = p_record_id
      AND user_id = v_user_id;
  END IF;

  ---------------------------------------------------------------------------
  -- LAST-WRITE-WINS EDIT HISTORY
  ---------------------------------------------------------------------------
  IF p_base_version IS NOT NULL AND p_base_version <> v_current_version THEN
    INSERT INTO edit_history (user_id, operation_id, entity, record_id, reason, payload)
    VALUES (
      v_user_id,
      p_operation_id,
      p_entity,
      p_record_id,
      'last_write_wins',
      jsonb_build_object(
        'base_version', p_base_version,
        'new_version', v_current_version + 1,
        'fields', to_jsonb(p_changed_fields),
        'overwritten_values', v_overwritten_values
      )
    );

    UPDATE applied_operations
    SET result = jsonb_build_object(
      'status', 'applied',
      'current_version', v_current_version + 1,
      'conflicted_fields', to_jsonb(p_changed_fields)
    )
    WHERE operation_id = p_operation_id;

    RETURN QUERY SELECT 'applied'::text, NULL::text, v_current_version + 1, p_changed_fields;
    RETURN;
  END IF;

  INSERT INTO edit_history (user_id, operation_id, entity, record_id, reason, payload)
  VALUES (
    v_user_id,
    p_operation_id,
    p_entity,
    p_record_id,
    'applied',
    jsonb_build_object(
      'base_version', p_base_version,
      'new_version', v_current_version + 1,
      'fields', to_jsonb(p_changed_fields)
    )
  );

  UPDATE applied_operations
  SET result = jsonb_build_object(
    'status', 'applied',
    'current_version', v_current_version + 1
  )
  WHERE operation_id = p_operation_id;

  RETURN QUERY SELECT 'applied'::text, NULL::text, v_current_version + 1, NULL::text[];
END;
$$;

GRANT EXECUTE ON FUNCTION apply_sync_operation(uuid, text, text, uuid, text, integer, text[], jsonb)
  TO authenticated;
