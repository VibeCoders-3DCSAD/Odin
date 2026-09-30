drop trigger if exists "credit_card_statement_date_guard" on "public"."credit_card_statements";

alter table "public"."credit_card_details" drop constraint "credit_card_details_statement_day_check";

drop function if exists "public"."prevent_early_credit_card_statement"();

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION odin.create_recurring_template_from_obligation(p_obligation_id uuid, p_user_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'odin', 'public'
AS $function$
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
$function$
;

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
$function$
;

CREATE OR REPLACE FUNCTION private.apply_debt_sync_operation_v1(p_operation_id uuid, p_device_id text, p_entity text, p_record_id uuid, p_operation_type text, p_base_version integer, p_changed_fields text[], p_payload jsonb)
 RETURNS TABLE(status text, reason text, current_version integer, conflicted_fields text[])
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_version integer;
  v_deleted boolean;
  v_item jsonb;
  v_rank integer := 0;
  v_existing_priority_id uuid;
  v_debt_id uuid;
  v_current_balance bigint;
  v_transaction_id uuid;
  v_transaction_type text;
  v_transaction_amount bigint;
  v_transaction_deleted boolean;
  v_transaction_status text;
  v_transaction_metadata jsonb;
  v_transaction_exists boolean := false;
  v_source_account_id uuid;
  v_balance_debited boolean := false;
  v_existing_user_id uuid;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF p_device_id IS NULL OR length(p_device_id) = 0 OR length(p_device_id) > 128 OR p_device_id !~ '^[A-Za-z0-9._:-]+$' THEN RAISE EXCEPTION 'invalid device id'; END IF;
  IF octet_length(p_payload::text) > 256000 THEN RAISE EXCEPTION 'debt payload is too large'; END IF;
  IF cardinality(COALESCE(p_changed_fields, ARRAY[]::text[])) > 50 THEN RAISE EXCEPTION 'too many changed fields'; END IF;
  IF p_entity NOT IN ('debt_accounts', 'debt_payments', 'user_debt_priorities', 'debt_strategy_preferences') THEN
    RAISE EXCEPTION 'entity % is not a debt entity', p_entity;
  END IF;
  IF (SELECT count(*) FROM jsonb_object_keys(p_payload)) > 100 THEN RAISE EXCEPTION 'too many debt payload fields'; END IF;
  IF p_entity = 'user_debt_priorities' AND jsonb_array_length(COALESCE(p_payload->'priorities', '[]'::jsonb)) > 100 THEN RAISE EXCEPTION 'too many debt priorities'; END IF;
  IF p_operation_type NOT IN ('create', 'update', 'delete') THEN RAISE EXCEPTION 'unsupported operation'; END IF;
  IF p_entity = 'debt_payments' THEN
    IF p_operation_type <> 'create' THEN RAISE EXCEPTION 'debt payments can only be created through Debt Manager'; END IF;
    IF NULLIF(p_payload->>'debt_account_id', '') IS NULL OR NULLIF(p_payload->>'transaction_id', '') IS NULL
      OR NULLIF(p_payload->>'linked_source_account_id', '') IS NULL OR NULLIF(p_payload->>'linked_subcategory_id', '') IS NULL
    THEN RAISE EXCEPTION 'linked debt payment fields are required'; END IF;
    IF COALESCE(p_payload->>'source', '') <> 'transaction' THEN RAISE EXCEPTION 'debt payment source must be transaction'; END IF;
    IF COALESCE(p_payload->>'amount_centavos', '') !~ '^[1-9][0-9]*$' THEN RAISE EXCEPTION 'payment amount must be a positive integer'; END IF;
    IF p_payload ? 'principal_centavos' AND (p_payload->>'principal_centavos') !~ '^[0-9]+$' THEN RAISE EXCEPTION 'principal amount must be a non-negative integer'; END IF;
    IF p_payload ? 'interest_centavos' AND (p_payload->>'interest_centavos') !~ '^[0-9]+$' THEN RAISE EXCEPTION 'interest amount must be a non-negative integer'; END IF;
    IF (p_payload->>'principal_centavos')::bigint > (p_payload->>'amount_centavos')::bigint
      OR (p_payload->>'interest_centavos')::bigint > (p_payload->>'amount_centavos')::bigint
    THEN RAISE EXCEPTION 'payment components cannot exceed amount'; END IF;
    IF NULLIF(p_payload->>'payment_date', '') IS NULL THEN RAISE EXCEPTION 'payment_date is required'; END IF;
    IF COALESCE(p_payload->>'linked_transaction_type', '') <> 'expense' THEN RAISE EXCEPTION 'linked transaction type must be expense'; END IF;
  END IF;
  IF p_entity = 'debt_accounts' THEN
    IF p_operation_type = 'create' AND NULLIF(p_payload->>'name', '') IS NULL THEN RAISE EXCEPTION 'name is required'; END IF;
    IF p_operation_type = 'create' AND NULLIF(p_payload->>'preset_key', '') IS NULL THEN RAISE EXCEPTION 'preset_key is required'; END IF;
    IF p_payload ? 'preset_key' AND (p_payload->>'preset_key') !~ '^[a-z0-9]+([_-][a-z0-9]+)*$' THEN RAISE EXCEPTION 'preset_key must be a safe slug'; END IF;
    IF p_payload ? 'preset_data' AND jsonb_typeof(p_payload->'preset_data') <> 'object' THEN RAISE EXCEPTION 'preset_data must be an object'; END IF;
    IF p_payload ? 'payment_schedule' AND jsonb_typeof(p_payload->'payment_schedule') <> 'object' THEN RAISE EXCEPTION 'payment_schedule must be an object'; END IF;
    IF p_payload ? 'payment_frequency' AND (p_payload->>'payment_frequency') NOT IN ('daily', 'weekly', 'biweekly', 'semi_monthly', 'monthly', 'quarterly', 'yearly') THEN RAISE EXCEPTION 'payment_frequency is invalid'; END IF;
    IF p_payload ? 'interest_period' AND (p_payload->>'interest_period') NOT IN ('daily', 'monthly', 'annual') THEN RAISE EXCEPTION 'interest_period is invalid'; END IF;
    IF p_payload ? 'interest_method' AND (p_payload->>'interest_method') NOT IN ('simple', 'amortized', 'compound') THEN RAISE EXCEPTION 'interest_method is invalid'; END IF;
    IF p_payload ? 'status' AND (p_payload->>'status') NOT IN ('active', 'archived', 'paid_off') THEN RAISE EXCEPTION 'debt status is invalid'; END IF;
    IF p_payload ? 'original_balance_centavos' AND (p_payload->>'original_balance_centavos') !~ '^[0-9]+$' THEN RAISE EXCEPTION 'original balance must be a non-negative integer'; END IF;
    IF p_payload ? 'current_balance_centavos' AND (p_payload->>'current_balance_centavos') !~ '^[0-9]+$' THEN RAISE EXCEPTION 'current balance must be a non-negative integer'; END IF;
    IF p_payload ? 'annual_interest_rate_bps' AND (p_payload->>'annual_interest_rate_bps') !~ '^[0-9]+$' THEN RAISE EXCEPTION 'interest rate must be a non-negative integer'; END IF;
    IF p_payload ? 'minimum_payment_centavos' AND (p_payload->>'minimum_payment_centavos') !~ '^[0-9]+$' THEN RAISE EXCEPTION 'minimum payment must be a non-negative integer'; END IF;
    IF p_payload ? 'next_due_date' AND (p_payload->>'next_due_date') !~ '^\d{4}-\d{2}-\d{2}$' THEN RAISE EXCEPTION 'next_due_date must be a date'; END IF;
    IF p_payload ? 'maturity_date' AND (p_payload->>'maturity_date') !~ '^\d{4}-\d{2}-\d{2}$' THEN RAISE EXCEPTION 'maturity_date must be a date'; END IF;
    IF p_payload ? 'target_payoff_date' AND (p_payload->>'target_payoff_date') !~ '^\d{4}-\d{2}-\d{2}$' THEN RAISE EXCEPTION 'target_payoff_date must be a date'; END IF;
    IF p_payload ? 'preset_data' AND p_payload ? 'preset_key' AND p_payload->>'preset_key' = 'credit_card' AND (p_payload->'preset_data' ? 'statementDay') AND (p_payload->'preset_data'->>'statementDay') !~ '^[0-9]+$' THEN RAISE EXCEPTION 'statementDay must be a non-negative integer'; END IF;
    IF p_payload ? 'preset_data' AND p_payload ? 'preset_key' AND p_payload->>'preset_key' IN ('personal_salary_loan', 'auto_loan', 'housing_loan', 'informal_loan', 'bnpl', 'online_lending_app', 'product_installment', 'government_member_loan', 'microfinance_loan') AND (p_payload->'preset_data' ? 'termMonths') AND (p_payload->'preset_data'->>'termMonths') !~ '^[0-9]+$' THEN RAISE EXCEPTION 'termMonths must be a non-negative integer'; END IF;
  END IF;

  INSERT INTO applied_operations (operation_id, user_id, device_id, entity, record_id, operation_type, result)
  VALUES (p_operation_id, v_user_id, p_device_id, p_entity, p_record_id, p_operation_type, jsonb_build_object('status', 'pending'))
  ON CONFLICT (operation_id) DO NOTHING;
  IF NOT FOUND THEN
    SELECT user_id INTO v_existing_user_id FROM applied_operations WHERE operation_id = p_operation_id;
    IF v_existing_user_id IS DISTINCT FROM v_user_id THEN
      RETURN QUERY SELECT 'rejected'::text, 'operation belongs to another user'::text, NULL::integer, NULL::text[];
      RETURN;
    END IF;
    RETURN QUERY SELECT 'duplicate'::text, NULL::text, NULL::integer, NULL::text[];
    RETURN;
  END IF;

  IF p_entity = 'debt_accounts' THEN
    IF p_operation_type = 'create' THEN
      INSERT INTO debt_accounts (
        id, user_id, name, lender_name, preset_key, original_balance_centavos,
        current_balance_centavos, annual_interest_rate_bps, minimum_payment_centavos,
        payment_frequency, next_due_date, maturity_date, target_payoff_date,
        interest_period, interest_method, preset_data, payment_schedule, notes, version, deleted, updated_at
      ) VALUES (
        p_record_id, v_user_id, p_payload->>'name', p_payload->>'lender_name',
        COALESCE(p_payload->>'preset_key', 'unknown'),
        COALESCE((p_payload->>'original_balance_centavos')::bigint, 0),
        COALESCE((p_payload->>'current_balance_centavos')::bigint, 0),
        COALESCE((p_payload->>'annual_interest_rate_bps')::integer, 0),
        COALESCE((p_payload->>'minimum_payment_centavos')::bigint, 0),
        COALESCE(p_payload->>'payment_frequency', 'monthly'),
        NULLIF(p_payload->>'next_due_date', '')::date,
        NULLIF(p_payload->>'maturity_date', '')::date,
        NULLIF(p_payload->>'target_payoff_date', '')::date,
        p_payload->>'interest_period', p_payload->>'interest_method',
        COALESCE(p_payload->'preset_data', '{}'::jsonb), COALESCE(p_payload->'payment_schedule', '{}'::jsonb), p_payload->>'notes', 1, false, now()
      );
    ELSE
      SELECT version, deleted INTO v_version, v_deleted FROM debt_accounts
      WHERE id = p_record_id AND user_id = v_user_id FOR UPDATE;
      IF v_version IS NULL OR v_deleted THEN RAISE EXCEPTION 'debt not found or inaccessible'; END IF;
      IF p_base_version IS NOT NULL AND p_base_version <> v_version THEN
        DELETE FROM applied_operations WHERE operation_id = p_operation_id;
        RETURN QUERY SELECT 'rejected'::text, 'debt version changed'::text, v_version, p_changed_fields;
        RETURN;
      END IF;
      IF p_operation_type = 'delete' THEN
        UPDATE debt_accounts SET status = 'deleted', deleted = true, deleted_at = now(), version = v_version + 1, updated_at = now()
        WHERE id = p_record_id AND user_id = v_user_id;
      ELSE
        UPDATE debt_accounts AS da SET
          name = CASE WHEN p_payload ? 'name' THEN p_payload->>'name' ELSE name END,
          lender_name = CASE WHEN p_payload ? 'lender_name' THEN p_payload->>'lender_name' ELSE lender_name END,
          preset_key = CASE WHEN p_payload ? 'preset_key' THEN p_payload->>'preset_key' ELSE preset_key END,
          status = CASE WHEN p_payload ? 'status' THEN (p_payload->>'status')::odin_debt_account_status ELSE da.status END,
          paid_off_at = CASE WHEN p_payload->>'status' = 'paid_off' AND da.status <> 'paid_off' THEN now() ELSE da.paid_off_at END,
          original_balance_centavos = CASE WHEN p_payload ? 'original_balance_centavos' THEN (p_payload->>'original_balance_centavos')::bigint ELSE original_balance_centavos END,
          current_balance_centavos = CASE WHEN p_payload ? 'current_balance_centavos' THEN (p_payload->>'current_balance_centavos')::bigint ELSE current_balance_centavos END,
          annual_interest_rate_bps = CASE WHEN p_payload ? 'annual_interest_rate_bps' THEN (p_payload->>'annual_interest_rate_bps')::integer ELSE annual_interest_rate_bps END,
          minimum_payment_centavos = CASE WHEN p_payload ? 'minimum_payment_centavos' THEN (p_payload->>'minimum_payment_centavos')::bigint ELSE minimum_payment_centavos END,
          payment_frequency = CASE WHEN p_payload ? 'payment_frequency' THEN p_payload->>'payment_frequency' ELSE payment_frequency END,
          next_due_date = CASE WHEN p_payload ? 'next_due_date' THEN NULLIF(p_payload->>'next_due_date', '')::date ELSE next_due_date END,
          maturity_date = CASE WHEN p_payload ? 'maturity_date' THEN NULLIF(p_payload->>'maturity_date', '')::date ELSE maturity_date END,
          target_payoff_date = CASE WHEN p_payload ? 'target_payoff_date' THEN NULLIF(p_payload->>'target_payoff_date', '')::date ELSE target_payoff_date END,
          interest_period = CASE WHEN p_payload ? 'interest_period' THEN p_payload->>'interest_period' ELSE interest_period END,
          interest_method = CASE WHEN p_payload ? 'interest_method' THEN p_payload->>'interest_method' ELSE interest_method END,
          preset_data = CASE WHEN p_payload ? 'preset_data' THEN p_payload->'preset_data' ELSE preset_data END,
          payment_schedule = CASE WHEN p_payload ? 'payment_schedule' THEN p_payload->'payment_schedule' ELSE payment_schedule END,
          notes = CASE WHEN p_payload ? 'notes' THEN p_payload->>'notes' ELSE notes END,
          version = v_version + 1, updated_at = now()
        WHERE id = p_record_id AND user_id = v_user_id;
      END IF;
    END IF;
  ELSIF p_entity = 'debt_payments' AND p_operation_type = 'create' THEN
    v_debt_id := (p_payload->>'debt_account_id')::uuid;
    IF NOT EXISTS (SELECT 1 FROM debt_accounts AS da WHERE da.id = v_debt_id AND da.user_id = v_user_id AND da.deleted = false AND da.status = 'active') THEN
      RAISE EXCEPTION 'debt_account_id does not reference an active debt';
    END IF;
    SELECT current_balance_centavos INTO v_current_balance FROM debt_accounts WHERE id = v_debt_id AND user_id = v_user_id FOR UPDATE;
    v_transaction_id := NULLIF(p_payload->>'transaction_id', '')::uuid;
    IF v_transaction_id IS NULL THEN RAISE EXCEPTION 'transaction_id is required for debt payments'; END IF;
    SELECT t.transaction_type::text, t.amount_centavos, t.deleted, t.status::text, t.metadata
      INTO v_transaction_type, v_transaction_amount, v_transaction_deleted, v_transaction_status, v_transaction_metadata
    FROM transactions t WHERE t.id = v_transaction_id AND t.user_id = v_user_id;
    IF FOUND THEN
      v_transaction_exists := true;
      IF (SELECT client_mutation_id FROM transactions WHERE id = v_transaction_id AND user_id = v_user_id) IS DISTINCT FROM 'debt-payment:' || p_record_id::text THEN RAISE EXCEPTION 'transaction was not created by Debt Manager'; END IF;
      IF EXISTS (SELECT 1 FROM debt_payments WHERE transaction_id = v_transaction_id AND user_id = v_user_id AND deleted = false) THEN RAISE EXCEPTION 'transaction is already linked to a debt payment'; END IF;
      IF v_transaction_deleted OR v_transaction_status <> 'posted' THEN RAISE EXCEPTION 'debt payments require an active posted transaction'; END IF;
      IF v_transaction_type <> 'expense' THEN RAISE EXCEPTION 'debt payments require an expense transaction'; END IF;
      IF v_transaction_amount <> (p_payload->>'amount_centavos')::bigint THEN RAISE EXCEPTION 'transaction amount must match payment amount'; END IF;
    ELSE
      IF COALESCE(p_payload->>'linked_transaction_type', '') <> 'expense' THEN RAISE EXCEPTION 'debt payments require an expense transaction'; END IF;
      IF NOT EXISTS (SELECT 1 FROM financial_accounts WHERE id = (p_payload->>'linked_source_account_id')::uuid AND user_id = v_user_id AND deleted = false) THEN
        RAISE EXCEPTION 'source account does not belong to user';
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM subcategories
        WHERE id = NULLIF(p_payload->>'linked_subcategory_id', '')::uuid
          AND (user_id IS NULL OR user_id = v_user_id)
          AND kind = 'expense' AND deleted = false AND is_active = true
      ) THEN
        RAISE EXCEPTION 'subcategory does not reference an accessible active expense subcategory';
      END IF;
      INSERT INTO transactions (id, user_id, transaction_type, status, entry_source, transaction_date, posted_at, amount_centavos, subcategory_id, source_account_id, destination_account_id, merchant_name, counterparty_name, notes, client_mutation_id, metadata, updated_at, version, deleted)
      VALUES (v_transaction_id, v_user_id, 'expense', 'posted', 'offline_sync', (p_payload->>'payment_date')::date, now(), (p_payload->>'amount_centavos')::bigint, NULLIF(p_payload->>'linked_subcategory_id', '')::uuid, (p_payload->>'linked_source_account_id')::uuid, NULL, NULL, NULL, p_payload->>'notes', 'debt-payment:' || p_record_id::text, '{}'::jsonb, now(), 1, false);
    END IF;
    SELECT source_account_id INTO v_source_account_id
    FROM transactions WHERE id = v_transaction_id AND user_id = v_user_id;
    IF (p_payload->>'amount_centavos')::bigint <= 0 THEN RAISE EXCEPTION 'payment amount must be positive'; END IF;
    IF (p_payload->>'amount_centavos')::bigint > v_current_balance THEN
      RAISE EXCEPTION 'payment exceeds current debt balance';
    END IF;
    v_balance_debited := COALESCE(v_transaction_metadata->>'debt_payment_balance_debited', 'false') = 'true';
    IF v_transaction_exists AND NOT v_balance_debited THEN
      RAISE EXCEPTION 'linked transaction balance was not debited';
    END IF;
    IF NOT v_balance_debited THEN
      UPDATE financial_accounts
      SET current_balance_centavos = current_balance_centavos - (p_payload->>'amount_centavos')::bigint,
          version = version + 1,
          updated_at = now()
      WHERE id = v_source_account_id AND user_id = v_user_id AND deleted = false
        AND current_balance_centavos >= (p_payload->>'amount_centavos')::bigint;
      IF NOT FOUND THEN RAISE EXCEPTION 'source account has insufficient balance'; END IF;
      UPDATE transactions
      SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{debt_payment_balance_debited}', 'true'::jsonb),
          updated_at = now(), version = version + 1
      WHERE id = v_transaction_id AND user_id = v_user_id;
    END IF;
    INSERT INTO debt_payments (id, debt_account_id, user_id, transaction_id, source, payment_date, amount_centavos, principal_centavos, interest_centavos, notes, version, deleted, updated_at)
    VALUES (p_record_id, v_debt_id, v_user_id, v_transaction_id, 'transaction', (p_payload->>'payment_date')::date, (p_payload->>'amount_centavos')::bigint, NULLIF(p_payload->>'principal_centavos', '')::bigint, NULLIF(p_payload->>'interest_centavos', '')::bigint, p_payload->>'notes', 1, false, now());
    UPDATE debt_accounts AS da
    SET current_balance_centavos = current_balance_centavos - (p_payload->>'amount_centavos')::bigint,
        status = CASE WHEN da.current_balance_centavos - (p_payload->>'amount_centavos')::bigint = 0 THEN 'paid_off' ELSE da.status END,
        version = version + 1,
        updated_at = now()
    WHERE id = v_debt_id AND user_id = v_user_id;
  ELSIF p_entity = 'debt_payments' THEN
    RAISE EXCEPTION 'debt payments can only be created through Debt Manager';
  ELSIF p_entity = 'user_debt_priorities' THEN
    IF jsonb_array_length(COALESCE(p_payload->'priorities', '[]'::jsonb)) <> (
      SELECT count(DISTINCT value) FROM jsonb_array_elements_text(COALESCE(p_payload->'priorities', '[]'::jsonb)) AS items(value)
    ) THEN
      RAISE EXCEPTION 'priority list contains duplicate debts';
    END IF;
    FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'priorities', '[]'::jsonb)) LOOP
      v_debt_id := (v_item #>> '{}')::uuid;
      IF NOT EXISTS (SELECT 1 FROM debt_accounts WHERE id = v_debt_id AND user_id = v_user_id AND deleted = false) THEN
        RAISE EXCEPTION 'priority references an inaccessible debt';
      END IF;
    END LOOP;
    UPDATE user_debt_priorities
    SET priority_rank = priority_rank + 1000000, deleted = true, version = version + 1, updated_at = now()
    WHERE user_id = v_user_id;
    FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'priorities', '[]'::jsonb)) LOOP
      v_rank := v_rank + 1;
      SELECT id INTO v_existing_priority_id
      FROM user_debt_priorities
      WHERE user_id = v_user_id AND debt_account_id = (v_item #>> '{}')::uuid
      ORDER BY deleted, updated_at DESC
      LIMIT 1;
      IF v_existing_priority_id IS NULL THEN
        INSERT INTO user_debt_priorities (id, user_id, debt_account_id, priority_rank, version, deleted, updated_at)
        VALUES (gen_random_uuid(), v_user_id, (v_item #>> '{}')::uuid, v_rank, 1, false, now());
      ELSE
        UPDATE user_debt_priorities
        SET priority_rank = v_rank, deleted = false, version = version + 1, updated_at = now()
        WHERE id = v_existing_priority_id;
      END IF;
      v_existing_priority_id := NULL;
    END LOOP;
  ELSIF p_entity = 'debt_strategy_preferences' THEN
    INSERT INTO debt_strategy_preferences (user_id, strategy, version, deleted, updated_at)
    VALUES (v_user_id, (p_payload->>'strategy')::odin_debt_strategy, 1, false, now())
    ON CONFLICT (user_id) DO UPDATE SET strategy = excluded.strategy, version = debt_strategy_preferences.version + 1, deleted = false, updated_at = now();
  END IF;

  UPDATE applied_operations SET result = jsonb_build_object('status', 'applied', 'current_version', COALESCE(v_version + 1, 1)) WHERE operation_id = p_operation_id;
  RETURN QUERY SELECT 'applied'::text, NULL::text, COALESCE(v_version + 1, 1), NULL::text[];
END;
$function$
;

CREATE OR REPLACE FUNCTION private.apply_savings_account_contribution_schedule_sync_operation(p_operation_id uuid, p_device_id text, p_record_id uuid, p_operation_type text, p_base_version integer, p_changed_fields text[], p_payload jsonb)
 RETURNS TABLE(status text, reason text, current_version integer, conflicted_fields text[])
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'auth'
AS $function$
DECLARE
  v_schedule_fields text[] := ARRAY['planned_contribution_amount_centavos', 'contribution_frequency', 'contribution_interval_count', 'contribution_day_of_month', 'contribution_second_day_of_month', 'contribution_day_of_week', 'custom_interval_days', 'next_contribution_date'];
  v_base_fields text[];
  v_previous boolean;
  v_result record;
BEGIN
  IF p_operation_type = 'create' AND p_payload->>'account_type' <> 'time_deposit' AND NOT (p_payload ?& ARRAY['planned_contribution_amount_centavos', 'contribution_frequency', 'next_contribution_date']) THEN
    RAISE EXCEPTION 'savings contribution schedule is required';
  END IF;
  IF p_payload ? 'contribution_frequency' AND p_payload->>'contribution_frequency' NOT IN ('weekly', 'biweekly', 'semi_monthly', 'monthly', 'quarterly', 'yearly', 'custom') THEN
    RAISE EXCEPTION 'invalid savings contribution frequency';
  END IF;
  SELECT EXISTS(SELECT 1 FROM applied_operations WHERE operation_id = p_operation_id AND user_id = auth.uid()) INTO v_previous;
  SELECT COALESCE(array_agg(field), ARRAY[]::text[]) INTO v_base_fields
  FROM unnest(COALESCE(p_changed_fields, ARRAY[]::text[])) AS field
  WHERE NOT (field = ANY(v_schedule_fields));
  SELECT * INTO v_result FROM private.apply_savings_account_detail_sync_operation(
    p_operation_id, p_device_id, p_record_id, p_operation_type, p_base_version,
    CASE WHEN p_operation_type = 'create' THEN p_changed_fields ELSE v_base_fields END,
    p_payload
  );
  IF v_previous OR v_result.status <> 'applied' OR p_operation_type = 'delete' THEN
    RETURN QUERY SELECT v_result.status, v_result.reason, v_result.current_version, v_result.conflicted_fields;
    RETURN;
  END IF;
  UPDATE savings_account_details SET
    planned_contribution_amount_centavos = CASE WHEN p_operation_type = 'create' OR 'planned_contribution_amount_centavos' = ANY(p_changed_fields) THEN NULLIF(p_payload->>'planned_contribution_amount_centavos', '')::bigint ELSE planned_contribution_amount_centavos END,
    contribution_frequency = CASE WHEN p_operation_type = 'create' OR 'contribution_frequency' = ANY(p_changed_fields) THEN p_payload->>'contribution_frequency' ELSE contribution_frequency END,
    contribution_interval_count = CASE WHEN p_operation_type = 'create' OR 'contribution_interval_count' = ANY(p_changed_fields) THEN NULLIF(p_payload->>'contribution_interval_count', '')::integer ELSE contribution_interval_count END,
    contribution_day_of_month = CASE WHEN p_operation_type = 'create' OR 'contribution_day_of_month' = ANY(p_changed_fields) THEN NULLIF(p_payload->>'contribution_day_of_month', '')::integer ELSE contribution_day_of_month END,
    contribution_second_day_of_month = CASE WHEN p_operation_type = 'create' OR 'contribution_second_day_of_month' = ANY(p_changed_fields) THEN NULLIF(p_payload->>'contribution_second_day_of_month', '')::integer ELSE contribution_second_day_of_month END,
    contribution_day_of_week = CASE WHEN p_operation_type = 'create' OR 'contribution_day_of_week' = ANY(p_changed_fields) THEN NULLIF(p_payload->>'contribution_day_of_week', '')::integer ELSE contribution_day_of_week END,
    custom_interval_days = CASE WHEN p_operation_type = 'create' OR 'custom_interval_days' = ANY(p_changed_fields) THEN NULLIF(p_payload->>'custom_interval_days', '')::integer ELSE custom_interval_days END,
    next_contribution_date = CASE WHEN p_operation_type = 'create' OR 'next_contribution_date' = ANY(p_changed_fields) THEN NULLIF(p_payload->>'next_contribution_date', '')::date ELSE next_contribution_date END
  WHERE account_id = p_record_id AND user_id = auth.uid();
  RETURN QUERY SELECT v_result.status, v_result.reason, v_result.current_version, v_result.conflicted_fields;
END;
$function$
;

CREATE TRIGGER protect_bucket_control_insert BEFORE INSERT ON storage.buckets FOR EACH ROW EXECUTE FUNCTION storage.protect_bucket_control_columns('service_role');

CREATE TRIGGER protect_bucket_control_update BEFORE UPDATE OF lifecycle_configuration, lifecycle_configuration_generation ON storage.buckets FOR EACH ROW EXECUTE FUNCTION storage.protect_bucket_control_columns();

CREATE TRIGGER protect_bucket_control_update_role AFTER UPDATE OF lifecycle_configuration, lifecycle_configuration_generation ON storage.buckets FOR EACH ROW EXECUTE FUNCTION storage.enforce_bucket_lifecycle_service_role('service_role');

