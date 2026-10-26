-- Credit cards opt in to surplus suggestions the same way non-credit debts do (debt_accounts.allows_extra_payments).
ALTER TABLE public.credit_card_details
  ADD COLUMN IF NOT EXISTS allows_extra_payments boolean NOT NULL DEFAULT false;

-- Creates already copy every column through jsonb_populate_record; updates need the field in the syncable list.
-- The core lives in the private schema since 20261002000007_move_sync_implementations_to_private_schema.
DO $$
DECLARE
  function_definition text;
BEGIN
  SELECT pg_get_functiondef(p.oid)
    INTO function_definition
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'private'
     AND p.proname = 'apply_credit_card_sync_operation_core'
     AND p.pronargs = 8;

  IF function_definition IS NULL OR position('''alert_threshold_percent'',' IN function_definition) = 0 THEN
    RAISE EXCEPTION 'private.apply_credit_card_sync_operation_core syncable field list not found';
  END IF;
  -- Re-running after a partial apply must not add the field twice.
  IF position('''allows_extra_payments''' IN function_definition) > 0 THEN RETURN; END IF;

  EXECUTE replace(
    function_definition,
    '''alert_threshold_percent'',',
    '''alert_threshold_percent'',''allows_extra_payments'','
  );
END $$;
