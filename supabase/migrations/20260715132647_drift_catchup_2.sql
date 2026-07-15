set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.apply_sync_operation(p_operation_id uuid, p_device_id text, p_entity text, p_record_id uuid, p_operation_type text, p_base_version integer, p_changed_fields text[], p_payload jsonb)
 RETURNS TABLE(status text, reason text, current_version integer, conflicted_fields text[])
 LANGUAGE plpgsql
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.submit_onboarding_session(p_session_id uuid, p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_session_id uuid;
  v_eligibility_id uuid;
  v_eligibility_confirmed_at timestamptz;
  v_raw_answers jsonb;
  v_income_type text;
  v_income_type_label text;
  v_monthly_income numeric;
  v_monthly_obligations numeric;
  v_has_dependents boolean;
  v_obligation_load_bps integer;
  v_confidence_score numeric;
  v_profile_label text;
  v_explanation_summary text;
  v_input_snapshot jsonb;
  v_output_snapshot jsonb;
  v_drivers jsonb;
  v_review_snapshot jsonb;
  v_assessment_id uuid;
  v_assignment_id uuid;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT id INTO v_session_id
  FROM onboarding_sessions
  WHERE id = p_session_id AND user_id = p_user_id AND status = 'in_progress'
  FOR UPDATE;

  IF v_session_id IS NULL THEN
    RAISE EXCEPTION 'Session not found or not in progress';
  END IF;

  SELECT id, eligibility_confirmed_at INTO v_eligibility_id, v_eligibility_confirmed_at
  FROM user_eligibility_profiles
  WHERE user_id = p_user_id;

  IF v_eligibility_id IS NULL OR v_eligibility_confirmed_at IS NULL THEN
    RAISE EXCEPTION 'Eligibility profile incomplete';
  END IF;

  SELECT raw_answers INTO v_raw_answers
  FROM onboarding_sessions
  WHERE id = p_session_id;

  v_income_type := v_raw_answers ->> 'income_type';
  v_monthly_income := COALESCE(NULLIF(v_raw_answers ->> 'monthly_income', '')::numeric, 0);
  v_monthly_obligations := COALESCE(NULLIF(v_raw_answers ->> 'monthly_obligations', '')::numeric, 0);
  v_has_dependents := COALESCE((v_raw_answers ->> 'has_dependents')::boolean, false);

  IF v_income_type = 'stable' THEN
    v_income_type_label := 'stable';
    v_input_snapshot := jsonb_build_object('income_type', 'stable');
    v_drivers := jsonb_build_array(jsonb_build_object(
      'driver_key', 'income_type',
      'driver_label', 'Income Type',
      'value_text', 'Stable',
      'impact_label', 'primary',
      'explanation', 'Your income source is stable — regular salary with predictable monthly earnings.',
      'sort_order', 1
    ));
  ELSE
    v_income_type_label := 'variable';
    v_input_snapshot := jsonb_build_object('income_type', CASE WHEN v_income_type = 'variable' THEN 'variable' ELSE 'unknown_fallback' END);
    v_drivers := jsonb_build_array(jsonb_build_object(
      'driver_key', 'income_type',
      'driver_label', 'Income Type',
      'value_text', CASE WHEN v_income_type = 'variable' THEN 'Variable' ELSE 'Unknown' END,
      'impact_label', 'primary',
      'explanation', CASE WHEN v_income_type = 'variable'
        THEN 'Your income source is variable — freelance, commission, or irregular earnings.'
        ELSE 'Income type was not explicitly provided; defaulted to variable.' END,
      'sort_order', 1
    ));
  END IF;

  IF v_monthly_income > 0 AND v_monthly_obligations >= 0 THEN
    v_obligation_load_bps := round((v_monthly_obligations / v_monthly_income) * 10000)::integer;
    v_input_snapshot := v_input_snapshot || jsonb_build_object(
      'monthly_income', v_monthly_income,
      'monthly_obligations', v_monthly_obligations,
      'obligation_load_bps', v_obligation_load_bps
    );

    IF v_obligation_load_bps >= 3000 THEN
      v_drivers := v_drivers || jsonb_build_array(jsonb_build_object(
        'driver_key', 'obligation_load',
        'driver_label', 'Obligation Load',
        'value_text', round(v_obligation_load_bps / 100)::text || '%',
        'impact_label', 'primary',
        'explanation', 'Your fixed obligations are ' || round(v_obligation_load_bps / 100)::text || '% of income, at or above the 30% threshold.',
        'sort_order', 2
      ));
    ELSE
      v_drivers := v_drivers || jsonb_build_array(jsonb_build_object(
        'driver_key', 'obligation_load',
        'driver_label', 'Obligation Load',
        'value_text', round(v_obligation_load_bps / 100)::text || '%',
        'impact_label', 'primary',
        'explanation', 'Your fixed obligations are ' || round(v_obligation_load_bps / 100)::text || '% of income, below the 30% threshold.',
        'sort_order', 2
      ));
    END IF;
    v_confidence_score := 0.85;
  ELSE
    v_obligation_load_bps := NULL;
    v_confidence_score := 0.6;
    IF v_has_dependents THEN
      v_drivers := v_drivers || jsonb_build_array(jsonb_build_object(
        'driver_key', 'dependents',
        'driver_label', 'Dependents',
        'value_text', 'Has dependents',
        'impact_label', 'secondary',
        'explanation', 'Having dependents suggests higher financial obligations.',
        'sort_order', 2
      ));
    END IF;
  END IF;

  IF v_income_type_label = 'stable' AND (v_obligation_load_bps IS NULL OR v_obligation_load_bps < 3000) THEN
    v_profile_label := 'stable_flexible';
  ELSIF v_income_type_label = 'stable' THEN
    v_profile_label := 'stable_obligated';
  ELSIF v_obligation_load_bps IS NULL OR v_obligation_load_bps < 3000 THEN
    v_profile_label := 'variable_flexible';
  ELSE
    v_profile_label := 'variable_obligated';
  END IF;

  v_output_snapshot := jsonb_build_object(
    'profile_label', v_profile_label,
    'confidence_score', v_confidence_score,
    'obligation_threshold_bps', 3000,
    'rule', 'deterministic_heuristic_v1'
  );

  v_explanation_summary := 'Profile assessed as ' || v_profile_label
    || ' based on income type (' || v_income_type_label || ')' ||
    CASE WHEN v_obligation_load_bps IS NOT NULL
      THEN ' and obligation load (' || round(v_obligation_load_bps / 100)::text || '% of income).'
      ELSE '.' END;

  v_review_snapshot := v_input_snapshot || jsonb_build_object('submitted_at', now());

  UPDATE onboarding_sessions
  SET status = 'submitted',
      submitted_at = now(),
      review_snapshot = v_review_snapshot
  WHERE id = p_session_id;

  INSERT INTO financial_profile_assessments (
    user_id, onboarding_session_id, status, assessment_method,
    assessed_at, model_kind, proposed_profile_label, confidence_score,
    income_type, obligation_load_bps, explanation_summary,
    input_snapshot, output_snapshot
  ) VALUES (
    p_user_id, p_session_id, 'suggested', 'questionnaire',
    now(), 'heuristic_v1', v_profile_label, v_confidence_score,
    v_income_type_label, v_obligation_load_bps, v_explanation_summary,
    v_input_snapshot, v_output_snapshot
  )
  RETURNING id INTO v_assessment_id;

  INSERT INTO financial_profile_explanation_drivers
    (assessment_id, driver_key, driver_label, value_text, impact_label, explanation, sort_order)
  SELECT
    v_assessment_id,
    d ->> 'driver_key',
    d ->> 'driver_label',
    d ->> 'value_text',
    d ->> 'impact_label',
    d ->> 'explanation',
    COALESCE((d ->> 'sort_order')::integer, 0)
  FROM jsonb_array_elements(v_drivers) AS d;

  UPDATE financial_profile_assignments
  SET is_active = false, effective_to = now()
  WHERE user_id = p_user_id AND is_active = true;

  INSERT INTO financial_profile_assignments (
    user_id, assessment_id, profile_label, is_active,
    confirmation_required, explanation
  ) VALUES (
    p_user_id, v_assessment_id, v_profile_label, true, true, v_explanation_summary
  )
  RETURNING id INTO v_assignment_id;

  INSERT INTO financial_profile_events (user_id, assessment_id, assignment_id, action, notes)
  VALUES
    (p_user_id, v_assessment_id, v_assignment_id, 'assessment_generated', 'Assessment generated from onboarding questionnaire'),
    (p_user_id, v_assessment_id, v_assignment_id, 'change_suggested', 'Profile change suggested based on assessment');

  RETURN jsonb_build_object(
    'assessment_id', v_assessment_id,
    'assignment_id', v_assignment_id,
    'profile_label', v_profile_label
  );
END;
$function$
;


