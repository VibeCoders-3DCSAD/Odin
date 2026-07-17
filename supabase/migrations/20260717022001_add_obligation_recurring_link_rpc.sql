CREATE OR REPLACE FUNCTION odin.create_recurring_template_from_obligation(
    p_obligation_id uuid,
    p_user_id uuid
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = odin, public
AS $$
DECLARE
    v_obligation record;
    v_account_id uuid;
    v_template_id uuid;
    v_next_date date;
BEGIN
    SELECT * INTO v_obligation
    FROM financial_obligations
    WHERE id = p_obligation_id
      AND user_id = p_user_id
      AND deleted = false;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Obligation not found' USING ERRCODE = 'P0002';
    END IF;

    SELECT id INTO v_account_id
    FROM financial_accounts
    WHERE user_id = p_user_id
      AND status = 'active'
      AND kind IN ('cash', 'bank', 'e_wallet', 'savings')
    ORDER BY sort_order
    LIMIT 1;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No active debit account found for user' USING ERRCODE = 'P0002';
    END IF;

    v_template_id := gen_random_uuid();
    v_next_date := odin.next_occurrence_date(
        CURRENT_DATE, NULL,
        v_obligation.frequency::text, 1,
        v_obligation.due_day_of_month, v_obligation.due_second_day_of_month,
        v_obligation.due_day_of_week, v_obligation.ends_on,
        CURRENT_DATE
    );

    INSERT INTO recurring_transaction_templates (
        id, user_id, transaction_type, status, name, amount_centavos,
        subcategory_id, source_account_id, destination_account_id,
        frequency, interval_count, day_of_month, second_day_of_month,
        day_of_week, custom_rule, starts_on, ends_on, next_occurrence_date,
        last_generated_date, reminder_enabled, reminder_days_before, notes,
        created_at, updated_at
    ) VALUES (
        v_template_id, v_obligation.user_id, 'expense', 'active',
        v_obligation.name, v_obligation.amount_centavos,
        v_obligation.subcategory_id, v_account_id, NULL,
        v_obligation.frequency, 1,
        v_obligation.due_day_of_month, v_obligation.due_second_day_of_month,
        v_obligation.due_day_of_week, '{}', CURRENT_DATE, v_obligation.ends_on,
        v_next_date,
        NULL, false, 0, v_obligation.notes,
        now(), now()
    );

    UPDATE financial_obligations
    SET recurring_template_id = v_template_id,
        updated_at = now(),
        version = version + 1
    WHERE id = p_obligation_id;

    RETURN v_template_id;
END;
$$;

DO $$
DECLARE
    v_user_id uuid;
    v_subcategory_id uuid;
    v_account_id uuid;
    v_template_id uuid;
    v_profile_exists boolean;
BEGIN
    SELECT id INTO v_user_id FROM auth.users LIMIT 1;
    IF NOT FOUND THEN
        RAISE NOTICE 'Skipping inline tests: no auth.users row exists';
        RETURN;
    END IF;

    SELECT id INTO v_subcategory_id FROM subcategories WHERE kind = 'expense' LIMIT 1;
    IF NOT FOUND THEN
        RAISE NOTICE 'Skipping inline tests: no expense subcategory exists';
        RETURN;
    END IF;

    SELECT true INTO v_profile_exists FROM profiles WHERE user_id = v_user_id LIMIT 1;
    IF NOT FOUND THEN
        INSERT INTO profiles (user_id, display_name)
        VALUES (v_user_id, 'Test Profile')
        ON CONFLICT DO NOTHING;
    END IF;

    INSERT INTO financial_accounts (user_id, name, kind, opening_balance_centavos, current_balance_centavos)
    VALUES (v_user_id, 'Test Wallet', 'e_wallet', 0, 0)
    RETURNING id INTO v_account_id;

    INSERT INTO financial_obligations (
        id, user_id, subcategory_id, name, status, amount_centavos,
        frequency, due_day_of_month, starts_on,
        metadata, version, deleted, created_at, updated_at
    ) VALUES (
        'f1000000-0000-0000-0000-000000000001', v_user_id,
        v_subcategory_id,
        'Test Obligation', 'active', 50000,
        'monthly'::odin_recurring_frequency, 15, CURRENT_DATE,
        '{}', 1, false, now(), now()
    );

    v_template_id := odin.create_recurring_template_from_obligation(
        'f1000000-0000-0000-0000-000000000001',
        v_user_id
    );

    ASSERT v_template_id IS NOT NULL, 'template id should be returned';

    ASSERT EXISTS (
        SELECT 1 FROM recurring_transaction_templates
        WHERE id = v_template_id
          AND transaction_type = 'expense'
          AND name = 'Test Obligation'
          AND amount_centavos = 50000
          AND frequency = 'monthly'
          AND day_of_month = 15
    ), 'template should match obligation fields';

    ASSERT EXISTS (
        SELECT 1 FROM financial_obligations
        WHERE id = 'f1000000-0000-0000-0000-000000000001'
          AND recurring_template_id = v_template_id
    ), 'obligation should reference template';

    DELETE FROM recurring_transaction_templates WHERE id = v_template_id;
    DELETE FROM financial_obligations WHERE id = 'f1000000-0000-0000-0000-000000000001';
    DELETE FROM financial_accounts WHERE id = v_account_id;

    RAISE NOTICE 'All odin.create_recurring_template_from_obligation tests passed';
END $$;
