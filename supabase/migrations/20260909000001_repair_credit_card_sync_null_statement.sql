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
    function_definition := replace(function_definition, ' OR v_payload->>''statement_date'' IS NULL', '');
    function_definition := replace(function_definition, ' OR v_payload->>''statement_day'' IS NULL', '');
    EXECUTE function_definition;
  END IF;
END $$;
