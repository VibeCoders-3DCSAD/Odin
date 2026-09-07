ALTER TABLE public.credit_card_details
  ALTER COLUMN statement_day DROP NOT NULL;

ALTER TABLE public.credit_card_cycles
  ALTER COLUMN statement_date DROP NOT NULL;

ALTER TABLE public.credit_card_cycles
  DROP CONSTRAINT IF EXISTS credit_card_cycles_check;

ALTER TABLE public.credit_card_cycles
  ADD CONSTRAINT credit_card_cycles_dates_check
  CHECK (cycle_start_date <= cutoff_date AND (statement_date IS NULL OR cutoff_date <= statement_date));

-- Replace the deployed sync function body without duplicating the long
-- relationship and versioning implementation from the preceding migration.
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
