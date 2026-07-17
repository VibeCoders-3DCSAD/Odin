CREATE OR REPLACE FUNCTION odin.run_recurring_transaction_engine(
    p_as_of date DEFAULT CURRENT_DATE,
    p_limit int DEFAULT 200,
    p_user_id uuid DEFAULT NULL
) RETURNS TABLE(
    out_user_id uuid,
    out_template_id uuid,
    out_occurrence_id uuid,
    out_transaction_id uuid,
    out_occ_date date,
    out_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = odin, public
AS $$
DECLARE
    v_as_of date;
    v_limit int;
    v_template record;
    v_occurrence_id uuid;
    v_transaction_id uuid;
    v_scheduled_date date;
    v_next_occurrence date;
    v_error_message text;
    v_bumped timestamptz;
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
        ORDER BY t.next_occurrence_date
        LIMIT v_limit
        FOR UPDATE SKIP LOCKED
    LOOP
        v_scheduled_date := v_template.next_occurrence_date;

        WHILE v_scheduled_date <= v_as_of LOOP
            BEGIN
                INSERT INTO transactions (
                    user_id, transaction_type, status, entry_source,
                    transaction_date, posted_at, amount_centavos,
                    subcategory_id, source_account_id, destination_account_id,
                    recurring_template_id, client_mutation_id
                ) VALUES (
                    v_template.user_id, v_template.transaction_type, 'posted', 'recurring',
                    v_scheduled_date, now(), v_template.amount_centavos,
                    v_template.subcategory_id, v_template.source_account_id, v_template.destination_account_id,
                    v_template.id,
                    'recurring:' || v_template.id || ':' || v_scheduled_date
                )
                ON CONFLICT (user_id, client_mutation_id)
                    WHERE client_mutation_id IS NOT NULL
                DO NOTHING
                RETURNING id INTO v_transaction_id;

                IF v_transaction_id IS NOT NULL THEN
                    INSERT INTO recurring_transaction_occurrences (
                        recurring_template_id, user_id, scheduled_date, status,
                        generated_transaction_id, posted_at
                    ) VALUES (
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
                WHERE id = v_template.id;

                v_scheduled_date := v_next_occurrence;
                v_transaction_id := NULL;
                v_occurrence_id := NULL;

            EXCEPTION
                WHEN OTHERS THEN
                    GET STACKED DIAGNOSTICS v_error_message = MESSAGE_TEXT;

                    INSERT INTO recurring_transaction_occurrences (
                        recurring_template_id, user_id, scheduled_date, status, failure_reason
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
                    WHERE id = v_template.id;
            END;
        END LOOP;
    END LOOP;
END;
$$;
