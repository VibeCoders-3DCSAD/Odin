ALTER TABLE public.credit_card_details
  ADD COLUMN IF NOT EXISTS repayment_strategy text,
  ADD COLUMN IF NOT EXISTS repayment_custom_amount_centavos bigint,
  ADD COLUMN IF NOT EXISTS repayment_percentage_bps integer;

ALTER TABLE public.credit_card_details
  ADD CONSTRAINT credit_card_details_repayment_strategy_check
  CHECK (repayment_strategy IS NULL OR repayment_strategy IN ('pay_in_full', 'pay_minimum', 'percentage_of_statement', 'custom_payment'));

UPDATE public.credit_card_details details
   SET repayment_strategy = strategy.strategy,
       repayment_custom_amount_centavos = strategy.custom_amount_centavos,
       repayment_percentage_bps = strategy.percentage_bps
  FROM (
    SELECT DISTINCT ON (cycle.account_id, preference.user_id)
      cycle.account_id,
      preference.user_id,
      preference.strategy,
      preference.custom_amount_centavos,
      preference.percentage_bps
    FROM public.credit_card_statement_strategies preference
    JOIN public.credit_card_statements statement ON statement.id = preference.statement_id
    JOIN public.credit_card_cycles cycle ON cycle.id = statement.cycle_id
    WHERE preference.deleted = false
      AND statement.deleted = false
      AND cycle.deleted = false
    ORDER BY cycle.account_id, preference.user_id, statement.due_date DESC
  ) strategy
 WHERE details.account_id = strategy.account_id
   AND details.user_id = strategy.user_id
   AND details.deleted = false
   AND details.repayment_strategy IS NULL;

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
      '''cutoff_day'',''statement_day'',''billing_cycle_days'',''alert_threshold_percent'',''cycle_start_date''',
      '''cutoff_day'',''statement_day'',''billing_cycle_days'',''alert_threshold_percent'',''repayment_strategy'',''repayment_custom_amount_centavos'',''repayment_percentage_bps'',''cycle_start_date'''
    );
    EXECUTE function_definition;
  END IF;
END $$;
