-- Income joins billers on the server auto-post engine. A pg_cron job posts every payday of an active income
-- source, due by today (Asia/Manila), that has not been posted. Devices post offline with the same ids
-- (recurringIncomePostIds in apps/app/local-db/repositories/recurringIncome.ts), so whichever posts first wins.

-- One schedule engine for billers and income: a port of dueDatesBetween in apps/app/features/billers/schedule.ts.
CREATE OR REPLACE FUNCTION private.recurrence_due_dates(
  p_frequency text, p_day_of_month integer, p_second_day_of_month integer, p_day_of_week integer, p_month integer,
  p_starts_on date, p_ends_on date, p_from date, p_to date
) RETURNS SETOF date
LANGUAGE plpgsql IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  v_start date := GREATEST(p_from, p_starts_on);
  v_end date := LEAST(p_to, COALESCE(p_ends_on, p_to));
  v_first date;
BEGIN
  IF v_start > v_end THEN RETURN; END IF;

  IF p_frequency = 'once' THEN
    IF p_starts_on BETWEEN v_start AND v_end THEN RETURN NEXT p_starts_on; END IF;
    RETURN;
  END IF;

  IF p_frequency = 'daily' THEN
    RETURN QUERY SELECT day::date FROM generate_series(v_start, v_end, interval '1 day') AS day;
    RETURN;
  END IF;

  IF p_frequency IN ('weekly', 'biweekly') THEN
    IF p_day_of_week IS NULL THEN RETURN; END IF;
    v_first := p_starts_on + ((p_day_of_week - extract(dow FROM p_starts_on)::int + 7) % 7);
    RETURN QUERY
      SELECT day::date FROM generate_series(v_first, v_end, CASE WHEN p_frequency = 'weekly' THEN interval '7 days' ELSE interval '14 days' END) AS day
       WHERE day::date >= v_start;
    RETURN;
  END IF;

  IF p_day_of_month IS NULL THEN RETURN; END IF;
  RETURN QUERY
    WITH months AS (
      SELECT month::date AS month_start, (month + interval '1 month - 1 day')::date AS month_end
        FROM generate_series(date_trunc('month', v_start), v_end, interval '1 month') AS month
    ), days AS (
      SELECT month_start, month_end, day_of_month
        FROM months
        CROSS JOIN LATERAL unnest(CASE
          WHEN p_frequency = 'semi_monthly' THEN ARRAY[p_day_of_month, p_second_day_of_month]
          WHEN p_frequency = 'monthly' THEN ARRAY[p_day_of_month]
          WHEN p_frequency = 'quarterly'
            AND ((extract(month FROM month_start)::int - extract(month FROM p_starts_on)::int) % 3 + 3) % 3 = 0 THEN ARRAY[p_day_of_month]
          WHEN p_frequency = 'yearly' AND extract(month FROM month_start)::int = p_month THEN ARRAY[p_day_of_month]
          ELSE ARRAY[]::integer[]
        END) AS day_of_month
       WHERE day_of_month IS NOT NULL
    )
    SELECT DISTINCT LEAST(month_start + day_of_month - 1, month_end) AS due_date
      FROM days
     WHERE LEAST(month_start + day_of_month - 1, month_end) BETWEEN v_start AND v_end
     ORDER BY due_date;
END;
$$;

CREATE OR REPLACE FUNCTION private.scheduled_payment_due_dates(p_payment public.scheduled_payments, p_from date, p_to date)
RETURNS SETOF date
LANGUAGE sql STABLE
SET search_path = ''
AS $$
  SELECT private.recurrence_due_dates(p_payment.frequency, p_payment.due_day_of_month, p_payment.due_second_day_of_month,
    p_payment.due_day_of_week, p_payment.due_month, p_payment.starts_on, p_payment.ends_on, p_from, p_to);
$$;

-- Must match RECURRING_INCOME_POST_NAMESPACE and the key format on the device.
CREATE OR REPLACE FUNCTION private.recurring_income_post_id(p_template_id uuid, p_payday date, p_kind text)
RETURNS uuid
LANGUAGE sql IMMUTABLE
SET search_path = ''
AS $$
  SELECT extensions.uuid_generate_v5(
    '50eb90f0-dbc0-47d9-bddc-eb981388b0a3'::uuid,
    'recurring-income:' || p_template_id::text || ':' || to_char(p_payday, 'YYYY-MM-DD') || ':' || p_kind
  );
$$;

-- Posts every unposted payday due by p_today. The window starts at the template's starts_on, which saving an
-- income source resets to that day, so an edit never back-posts. No catch-up cap, unlike the device.
CREATE OR REPLACE FUNCTION private.post_due_recurring_income(
  p_today date DEFAULT (now() AT TIME ZONE 'Asia/Manila')::date, p_user_id uuid DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_template record;
  v_payday date;
  v_transaction_id uuid;
  v_occurrence_id uuid;
  v_posted integer := 0;
  v_template_posted integer;
BEGIN
  FOR v_template IN
    SELECT template.*, source.name AS source_name
      FROM public.recurring_transaction_templates AS template
      JOIN public.income_sources AS source
        ON source.recurring_template_id = template.id AND source.user_id = template.user_id AND NOT source.deleted AND source.is_active
      JOIN public.financial_accounts AS account
        ON account.id = template.destination_account_id AND account.user_id = template.user_id AND account.status = 'active' AND NOT account.deleted
     WHERE template.status = 'active' AND NOT template.deleted AND template.transaction_type = 'income'
       AND (p_user_id IS NULL OR template.user_id = p_user_id)
     ORDER BY template.id
  LOOP
    v_template_posted := 0;
    BEGIN
      FOR v_payday IN
        SELECT payday FROM private.recurrence_due_dates(v_template.frequency::text, v_template.day_of_month, v_template.second_day_of_month,
          v_template.day_of_week, NULL, v_template.starts_on, v_template.ends_on, v_template.starts_on, p_today) AS payday
      LOOP
        v_transaction_id := private.recurring_income_post_id(v_template.id, v_payday, 'transaction');
        v_occurrence_id := private.recurring_income_post_id(v_template.id, v_payday, 'occurrence');
        -- Any occurrence for the payday (including the retired engine's), or either derived id, means it was posted.
        CONTINUE WHEN EXISTS (SELECT 1 FROM public.recurring_transaction_occurrences
                               WHERE id = v_occurrence_id OR (recurring_template_id = v_template.id AND scheduled_date = v_payday))
                   OR EXISTS (SELECT 1 FROM public.transactions WHERE id = v_transaction_id)
                   OR EXISTS (SELECT 1 FROM public.transactions WHERE user_id = v_template.user_id AND client_mutation_id = 'recurring:' || v_template.id || ':' || v_payday);

        INSERT INTO public.transactions (
          id, user_id, transaction_type, status, entry_source, transaction_date, posted_at, amount_centavos,
          subcategory_id, destination_account_id, merchant_name, version, deleted, created_at, updated_at
        ) VALUES (
          v_transaction_id, v_template.user_id, 'income', 'posted', 'recurring', v_payday, now(), v_template.amount_centavos,
          v_template.subcategory_id, v_template.destination_account_id, v_template.source_name, 1, false, now(), now()
        ) ON CONFLICT (id) DO NOTHING;
        INSERT INTO public.recurring_transaction_occurrences (
          id, recurring_template_id, user_id, scheduled_date, status, generated_transaction_id, posted_at
        ) VALUES (
          v_occurrence_id, v_template.id, v_template.user_id, v_payday, 'posted', v_transaction_id, now()
        ) ON CONFLICT DO NOTHING;
        v_template_posted := v_template_posted + 1;
      END LOOP;
      v_posted := v_posted + v_template_posted;
    EXCEPTION WHEN OTHERS THEN
      -- One income source that cannot post (for example an inactive category) must not block the others.
      RAISE WARNING 'income template % auto-post skipped: %', v_template.id, SQLERRM;
    END;
  END LOOP;
  RETURN v_posted;
END;
$$;

-- Preserve expense/transfer templates, standalone income, date/limit arguments and result rows.
-- Linked income sources share deterministic ids with cron and offline devices.
CREATE OR REPLACE FUNCTION odin.run_recurring_transaction_engine(p_as_of date DEFAULT CURRENT_DATE, p_limit integer DEFAULT 200, p_user_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(out_user_id uuid, out_template_id uuid, out_occurrence_id uuid, out_transaction_id uuid, out_occ_date date, out_status text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'odin', 'public'
AS $function$
DECLARE
    v_as_of date;
    v_limit int;
    v_template record;
    v_occurrence_id uuid;
    v_transaction_id uuid;
    v_scheduled_date date;
    v_next_occurrence date;
    v_error_message text;
    v_managed_income boolean;
    v_source_name text;
BEGIN
    v_as_of := COALESCE(p_as_of, CURRENT_DATE);
    v_limit := COALESCE(p_limit, 200);

    FOR v_template IN
        SELECT t.*
        FROM recurring_transaction_templates t
        WHERE t.status = 'active'
          AND t.deleted = false
          AND t.next_occurrence_date IS NOT NULL
          AND t.next_occurrence_date <= v_as_of
          AND (p_user_id IS NULL OR t.user_id = p_user_id)
          -- Linked income sources use the same eligibility rules as the automatic job.
          AND (NOT EXISTS (SELECT 1 FROM public.income_sources s WHERE s.recurring_template_id = t.id AND s.user_id = t.user_id)
            OR EXISTS (SELECT 1 FROM public.income_sources s
              JOIN public.financial_accounts a ON a.id = t.destination_account_id AND a.user_id = t.user_id
              WHERE s.recurring_template_id = t.id AND s.user_id = t.user_id AND NOT s.deleted AND s.is_active
                AND a.status = 'active' AND NOT a.deleted))
        ORDER BY t.next_occurrence_date
        LIMIT v_limit
        FOR UPDATE SKIP LOCKED
    LOOP
        SELECT s.name INTO v_source_name FROM public.income_sources s
        WHERE s.recurring_template_id = v_template.id AND s.user_id = v_template.user_id AND s.is_active AND NOT s.deleted
        LIMIT 1;
        v_managed_income := v_template.transaction_type = 'income' AND FOUND;
        v_scheduled_date := v_template.next_occurrence_date;

        WHILE v_scheduled_date <= v_as_of LOOP
            BEGIN
                -- Shared ids and tombstone checks prevent cron/device/API runs from posting a payday twice.
                IF NOT v_managed_income OR NOT (
                    EXISTS (SELECT 1 FROM public.recurring_transaction_occurrences o WHERE o.user_id = v_template.user_id
                      AND o.recurring_template_id = v_template.id AND o.scheduled_date = v_scheduled_date)
                    OR EXISTS (SELECT 1 FROM public.transactions t WHERE t.user_id = v_template.user_id
                      AND t.id = private.recurring_income_post_id(v_template.id, v_scheduled_date, 'transaction'))
                ) THEN
                INSERT INTO transactions (
                    id, user_id, transaction_type, status, entry_source,
                    transaction_date, posted_at, amount_centavos,
                    subcategory_id, source_account_id, destination_account_id,
                    recurring_template_id, client_mutation_id, merchant_name
                ) VALUES (
                    CASE WHEN v_managed_income THEN private.recurring_income_post_id(v_template.id, v_scheduled_date, 'transaction') ELSE gen_random_uuid() END,
                    v_template.user_id, v_template.transaction_type, 'posted', 'recurring',
                    v_scheduled_date, now(), v_template.amount_centavos,
                    v_template.subcategory_id, v_template.source_account_id, v_template.destination_account_id,
                    v_template.id,
                    'recurring:' || v_template.id || ':' || v_scheduled_date,
                    CASE WHEN v_managed_income THEN v_source_name ELSE NULL END
                )
                ON CONFLICT DO NOTHING
                RETURNING id INTO v_transaction_id;

                IF v_transaction_id IS NOT NULL THEN
                    INSERT INTO recurring_transaction_occurrences (
                        id, recurring_template_id, user_id, scheduled_date, status,
                        generated_transaction_id, posted_at
                    ) VALUES (
                        CASE WHEN v_managed_income THEN private.recurring_income_post_id(v_template.id, v_scheduled_date, 'occurrence') ELSE gen_random_uuid() END,
                        v_template.id, v_template.user_id, v_scheduled_date, 'posted',
                        v_transaction_id, now()
                    )
                    ON CONFLICT (recurring_template_id, scheduled_date)
                    DO NOTHING
                    RETURNING id INTO v_occurrence_id;

                    IF v_occurrence_id IS NOT NULL THEN
                        out_user_id := v_template.user_id;
                        out_template_id := v_template.id;
                        out_occurrence_id := v_occurrence_id;
                        out_transaction_id := v_transaction_id;
                        out_occ_date := v_scheduled_date;
                        out_status := 'posted';
                        RETURN NEXT;
                    END IF;
                END IF;

                END IF;

                v_next_occurrence := odin.next_occurrence_date(
                    v_template.starts_on,
                    v_scheduled_date,
                    v_template.frequency::text,
                    v_template.interval_count,
                    v_template.day_of_month,
                    v_template.second_day_of_month,
                    v_template.day_of_week,
                    v_template.ends_on,
                    v_scheduled_date
                );

                UPDATE recurring_transaction_templates
                SET
                    next_occurrence_date = v_next_occurrence,
                    last_generated_date = v_scheduled_date,
                    updated_at = now()
                WHERE id = v_template.id AND user_id = v_template.user_id;

                v_scheduled_date := v_next_occurrence;
                v_transaction_id := NULL;
                v_occurrence_id := NULL;

            EXCEPTION
                WHEN OTHERS THEN
                    GET STACKED DIAGNOSTICS v_error_message = MESSAGE_TEXT;

                    INSERT INTO recurring_transaction_occurrences (
                        id, recurring_template_id, user_id, scheduled_date, status, failure_reason
                    ) VALUES (
                        v_template.id, v_template.user_id, v_scheduled_date, 'failed', v_error_message
                    )
                    ON CONFLICT (recurring_template_id, scheduled_date)
                    DO UPDATE SET failure_reason = EXCLUDED.failure_reason;

                    out_user_id := v_template.user_id;
                    out_template_id := v_template.id;
                    out_occurrence_id := NULL;
                    out_transaction_id := NULL;
                    out_occ_date := v_scheduled_date;
                    out_status := 'failed';
                    RETURN NEXT;

                    v_scheduled_date := odin.next_occurrence_date(
                        v_template.starts_on,
                        v_scheduled_date,
                        v_template.frequency::text,
                        v_template.interval_count,
                        v_template.day_of_month,
                        v_template.second_day_of_month,
                        v_template.day_of_week,
                        v_template.ends_on,
                        v_scheduled_date
                    );

                    UPDATE recurring_transaction_templates
                    SET
                        next_occurrence_date = v_scheduled_date,
                        last_generated_date = v_scheduled_date,
                        updated_at = now()
                    WHERE id = v_template.id AND user_id = v_template.user_id;
            END;
        END LOOP;
    END LOOP;
END;
$function$
;

-- A device pushing a payday the server already posted gets a duplicate, not an error. A new occurrence that
-- carries its transaction is stored as posted.
CREATE OR REPLACE FUNCTION private.apply_recurring_occurrence_create_sync_operation(
  p_operation_id uuid, p_device_id text, p_entity text, p_record_id uuid,
  p_operation_type text, p_base_version integer, p_changed_fields text[], p_payload jsonb
) RETURNS TABLE(status text, reason text, current_version integer, conflicted_fields text[])
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private, auth AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_existing_user_id uuid;
  v_template_id uuid := (p_payload->>'recurring_template_id')::uuid;
  v_scheduled_date date := (p_payload->>'scheduled_date')::date;
  v_transaction_id uuid := (p_payload->>'generated_transaction_id')::uuid;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;

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

  IF EXISTS (
    SELECT 1 FROM public.recurring_transaction_occurrences AS occurrence
     WHERE occurrence.user_id = v_user_id
       AND (occurrence.id = p_record_id OR (occurrence.recurring_template_id = v_template_id AND occurrence.scheduled_date = v_scheduled_date))
  ) THEN
    UPDATE public.applied_operations AS operation SET result = jsonb_build_object('status', 'duplicate') WHERE operation.operation_id = p_operation_id;
    RETURN QUERY SELECT 'duplicate'::text, NULL::text, NULL::integer, NULL::text[];
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.recurring_transaction_templates AS template WHERE template.id = v_template_id AND template.user_id = v_user_id AND NOT template.deleted) THEN
    RAISE EXCEPTION 'recurring template not found or inaccessible';
  END IF;
  IF v_transaction_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.transactions AS tx WHERE tx.id = v_transaction_id AND tx.user_id = v_user_id) THEN
    RAISE EXCEPTION 'generated transaction not found or inaccessible';
  END IF;

  INSERT INTO public.recurring_transaction_occurrences (id, recurring_template_id, user_id, scheduled_date, status, generated_transaction_id, posted_at)
  VALUES (p_record_id, v_template_id, v_user_id, v_scheduled_date,
    CASE WHEN v_transaction_id IS NULL THEN 'scheduled' ELSE 'posted' END::public.odin_recurring_occurrence_status,
    v_transaction_id, CASE WHEN v_transaction_id IS NULL THEN NULL ELSE now() END);

  UPDATE public.applied_operations AS operation SET result = jsonb_build_object('status', 'applied', 'current_version', 1) WHERE operation.operation_id = p_operation_id;
  RETURN QUERY SELECT 'applied'::text, NULL::text, 1, NULL::text[];
END;
$$;

-- Same dispatcher as before, plus the occurrence-create route above.
CREATE OR REPLACE FUNCTION public.apply_sync_operation(p_operation_id uuid, p_device_id text, p_entity text, p_record_id uuid, p_operation_type text, p_base_version integer, p_changed_fields text[], p_payload jsonb)
 RETURNS TABLE(status text, reason text, current_version integer, conflicted_fields text[])
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'auth'
AS $function$
BEGIN
  IF p_entity IN ('categories', 'subcategories')
     AND (p_payload ? 'icon_key' OR p_payload ? 'color_hex') THEN
    RETURN QUERY SELECT * FROM private.apply_taxonomy_visual_sync_operation(
      p_operation_id, p_device_id, p_entity, p_record_id, p_operation_type,
      p_base_version, p_changed_fields, p_payload
    );
    RETURN;
  END IF;

  IF p_entity = 'categories' AND p_operation_type = 'create' THEN
    RETURN QUERY SELECT * FROM private.apply_category_create_sync_operation(p_operation_id, p_device_id, p_entity, p_record_id, p_operation_type, p_base_version, p_changed_fields, p_payload);
    RETURN;
  END IF;

  IF p_entity = 'subcategories'
     AND (p_payload ? 'minimum_amount_centavos' OR p_payload ? 'always_in_budget' OR p_payload ? 'fixed_amount_centavos') THEN
    RETURN QUERY SELECT * FROM private.apply_subcategory_budget_config_sync_operation(p_operation_id, p_device_id, p_entity, p_record_id, p_operation_type, p_base_version, p_changed_fields, p_payload);
    RETURN;
  END IF;

  IF p_entity = 'recurring_transaction_occurrences' AND p_operation_type = 'create' THEN
    RETURN QUERY SELECT * FROM private.apply_recurring_occurrence_create_sync_operation(p_operation_id, p_device_id, p_entity, p_record_id, p_operation_type, p_base_version, p_changed_fields, p_payload);
    RETURN;
  END IF;

  RETURN QUERY SELECT * FROM private.apply_sync_operation_ledger_core(p_operation_id, p_device_id, p_entity, p_record_id, p_operation_type, p_base_version, p_changed_fields, p_payload);
END;
$function$;

REVOKE ALL ON FUNCTION private.recurrence_due_dates(text, integer, integer, integer, integer, date, date, date, date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.recurring_income_post_id(uuid, date, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.post_due_recurring_income(date, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.apply_recurring_occurrence_create_sync_operation(uuid, text, text, uuid, text, integer, text[], jsonb) FROM PUBLIC, anon, authenticated;

SELECT cron.schedule('post-due-recurring-income', '*/5 * * * *', 'SELECT private.post_due_recurring_income()');
