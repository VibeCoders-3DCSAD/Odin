CREATE OR REPLACE FUNCTION apply_budget_sync_operation_v2(
  p_operation_id uuid, p_device_id text, p_entity text, p_record_id uuid,
  p_operation_type text, p_base_version integer, p_changed_fields text[], p_payload jsonb
)
RETURNS TABLE (status text, reason text, current_version integer, conflicted_fields text[])
LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE v_result record; v_total numeric;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF p_device_id IS NULL OR length(p_device_id) = 0 OR length(p_device_id) > 128 OR p_device_id !~ '^[A-Za-z0-9._:-]+$' THEN RAISE EXCEPTION 'invalid device id'; END IF;
  IF octet_length(p_payload::text) > 256000 THEN RAISE EXCEPTION 'budget payload is too large'; END IF;
  IF jsonb_array_length(COALESCE(p_payload->'allocations', '[]'::jsonb)) > 100 THEN RAISE EXCEPTION 'budget allocations are limited to 100 items'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(p_payload->'allocations', '[]'::jsonb)) item WHERE jsonb_typeof(item) <> 'object' OR (item->>'amountMinor') !~ '^[1-9][0-9]*$' OR ((item->>'categoryId') IS NULL AND (item->>'subcategoryId') IS NULL) OR ((item->>'categoryId') IS NOT NULL AND (item->>'subcategoryId') IS NOT NULL)) THEN RAISE EXCEPTION 'budget allocations are invalid'; END IF;
  IF p_payload ? 'debt_budget_amount_minor' AND (p_payload->>'debt_budget_amount_minor') !~ '^[0-9]+$' THEN RAISE EXCEPTION 'debt budget must be a non-negative integer'; END IF;
  IF p_payload ? 'debt_budget_amount_minor' AND (p_payload->>'debt_budget_amount_minor')::numeric > 9223372036854775807 THEN RAISE EXCEPTION 'debt budget is too large'; END IF;
  IF p_payload ? 'periodKind' AND p_payload->>'periodKind' <> 'MONTHLY' AND COALESCE(p_payload->>'debt_budget_amount_minor', '0') <> '0' THEN RAISE EXCEPTION 'debt budget requires a monthly budget'; END IF;
  IF p_payload ? 'totalAmountMinor' AND p_payload->>'totalAmountMinor' !~ '^[1-9][0-9]*$' THEN RAISE EXCEPTION 'budget total must be a positive integer'; END IF;
  IF p_payload ? 'debt_budget_amount_minor' AND p_payload ? 'totalAmountMinor' AND (p_payload->>'debt_budget_amount_minor')::numeric > (p_payload->>'totalAmountMinor')::numeric THEN RAISE EXCEPTION 'debt budget cannot exceed total'; END IF;
  IF p_payload ? 'periodKind' AND p_payload->>'periodKind' NOT IN ('WEEKLY', 'MONTHLY', 'CUSTOM', 'INCOME_CYCLE') THEN RAISE EXCEPTION 'budget period kind is invalid'; END IF;
  IF p_payload ? 'periodStart' AND p_payload->>'periodStart' !~ '^\d{4}-\d{2}-\d{2}$' THEN RAISE EXCEPTION 'period start must be a date'; END IF;
  IF p_payload ? 'periodEnd' AND p_payload->>'periodEnd' !~ '^\d{4}-\d{2}-\d{2}$' THEN RAISE EXCEPTION 'period end must be a date'; END IF;
  IF p_payload ? 'periodStart' AND p_payload ? 'periodEnd' AND (p_payload->>'periodStart')::date > (p_payload->>'periodEnd')::date THEN RAISE EXCEPTION 'period end must be on or after period start'; END IF;
  IF p_payload ? 'budget_period_days' AND (p_payload->>'budget_period_days') !~ '^[1-9][0-9]*$' THEN RAISE EXCEPTION 'budget period days must be positive'; END IF;
  SELECT COALESCE(SUM((item->>'amountMinor')::numeric), 0) INTO v_total FROM jsonb_array_elements(COALESCE(p_payload->'allocations', '[]'::jsonb)) item;
  IF p_payload ? 'totalAmountMinor' AND v_total + COALESCE((p_payload->>'debt_budget_amount_minor')::numeric, 0) > (p_payload->>'totalAmountMinor')::numeric THEN RAISE EXCEPTION 'allocations and debt budget cannot exceed total'; END IF;
  SELECT * INTO v_result FROM apply_budget_sync_operation(
    p_operation_id, p_device_id, p_entity, p_record_id, p_operation_type,
    p_base_version, p_changed_fields, p_payload
  );
  IF v_result.status = 'applied' AND p_operation_type IN ('create', 'update') THEN
    UPDATE budgets
    SET debt_budget_amount_centavos = CASE
          WHEN p_payload ? 'debt_budget_amount_minor' THEN (p_payload->>'debt_budget_amount_minor')::bigint
          ELSE debt_budget_amount_centavos
        END,
        updated_at = now()
    WHERE id = p_record_id AND user_id = auth.uid();
  END IF;
  RETURN QUERY SELECT v_result.status, v_result.reason, v_result.current_version, v_result.conflicted_fields;
END;
$$;

CREATE OR REPLACE FUNCTION apply_debt_sync_operation(
  p_operation_id uuid, p_device_id text, p_entity text, p_record_id uuid,
  p_operation_type text, p_base_version integer, p_changed_fields text[], p_payload jsonb
)
RETURNS TABLE (status text, reason text, current_version integer, conflicted_fields text[])
LANGUAGE plpgsql SECURITY INVOKER AS $$
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
$$;

GRANT EXECUTE ON FUNCTION apply_budget_sync_operation_v2(uuid, text, text, uuid, text, integer, text[], jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION apply_debt_sync_operation(uuid, text, text, uuid, text, integer, text[], jsonb) TO authenticated;
