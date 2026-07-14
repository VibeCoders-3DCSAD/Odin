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
  v_score integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  IF p_entity NOT IN ('categories', 'subcategories') THEN
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
      )
      ON CONFLICT (user_id, label) DO UPDATE SET
        category_group_id = (p_payload->>'category_group_id')::uuid,
        slug = p_payload->>'slug',
        short_label = p_payload->>'short_label',
        description = p_payload->>'description',
        is_filipino_context = COALESCE((p_payload->>'is_filipino_context')::boolean, false),
        sort_order = COALESCE((p_payload->>'sort_order')::integer, 0),
        updated_at = v_now,
        version = categories.version + 1;
    ELSE
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
      )
      ON CONFLICT (user_id, label) DO UPDATE SET
        category_id = CASE WHEN (p_payload->>'kind') = 'expense' THEN (p_payload->>'category_id')::uuid ELSE NULL END,
        slug = p_payload->>'slug',
        kind = (p_payload->>'kind')::odin_subcategory_kind,
        short_label = p_payload->>'short_label',
        description = p_payload->>'description',
        is_filipino_context = COALESCE((p_payload->>'is_filipino_context')::boolean, false),
        is_protected = COALESCE((p_payload->>'is_protected')::boolean, false),
        sort_order = COALESCE((p_payload->>'sort_order')::integer, 0),
        updated_at = v_now,
        version = subcategories.version + 1;
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

  IF p_entity = 'categories' THEN
    SELECT version
      INTO v_current_version
      FROM categories
      WHERE id = p_record_id
        AND user_id = v_user_id
      FOR UPDATE;
  ELSE
    SELECT version
      INTO v_current_version
      FROM subcategories
      WHERE id = p_record_id
        AND user_id = v_user_id
      FOR UPDATE;
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
      SET deleted = true,
          is_active = false
      WHERE id = p_record_id
        AND user_id = v_user_id;
    ELSE
      UPDATE subcategories
      SET deleted = true,
          is_active = false
      WHERE id = p_record_id
        AND user_id = v_user_id;
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

  IF (SELECT count(*) FROM jsonb_object_keys(p_payload)) = 0 THEN
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
  ELSE
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
  END IF;

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
