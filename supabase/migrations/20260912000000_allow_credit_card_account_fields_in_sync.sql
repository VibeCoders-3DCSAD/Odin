-- Keep the deployed credit-card sync function aligned with the detail columns
-- added for credit-card account editing.
DO $$
DECLARE
  function_definition text;
BEGIN
  SELECT pg_get_functiondef(p.oid)
    INTO function_definition
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname = 'apply_credit_card_sync_operation_core'
     AND p.pronargs = 8;

  IF function_definition IS NOT NULL THEN
    function_definition := replace(
      function_definition,
      '''cutoff_day'',''statement_day'',''cycle_start_date''',
      '''cutoff_day'',''statement_day'',''billing_cycle_days'',''alert_threshold_percent'',''cycle_start_date'''
    );
    EXECUTE function_definition;
  END IF;
END $$;
