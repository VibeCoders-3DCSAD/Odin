BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM jsonb_array_elements(
        '[{"categoryId":null,"subcategoryId":"00000000-0000-0000-0000-000000000001"}]'::jsonb
      ) AS allocation(value)
     WHERE (NULLIF(allocation.value->>'categoryId', '') IS NULL)
         = (NULLIF(allocation.value->>'subcategoryId', '') IS NULL)
  ) THEN
    RAISE EXCEPTION 'a nullable inactive Financial Plan allocation target must be valid';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM jsonb_array_elements(
        '[{"debtAccountId":"00000000-0000-0000-0000-000000000001","creditCardStatementId":null}]'::jsonb
      ) AS reservation(value)
     WHERE (NULLIF(reservation.value->>'debtAccountId', '') IS NULL)
         = (NULLIF(reservation.value->>'creditCardStatementId', '') IS NULL)
  ) THEN
    RAISE EXCEPTION 'a nullable inactive Financial Plan debt reservation target must be valid';
  END IF;

  IF pg_get_functiondef('public.apply_financial_plan_sync_operation_base(uuid, text, text, uuid, text, integer, text[], jsonb)'::regprocedure)
     NOT LIKE '%NULLIF(a.value->>''categoryId'', '''') IS NULL%' THEN
    RAISE EXCEPTION 'Financial Plan sync must accept a null inactive allocation target';
  END IF;

  IF pg_get_functiondef('public.apply_financial_plan_sync_operation_base(uuid, text, text, uuid, text, integer, text[], jsonb)'::regprocedure)
     NOT LIKE '%NULLIF(r.value->>''debtAccountId'', '''') IS NULL%' THEN
    RAISE EXCEPTION 'Financial Plan sync must accept a null inactive debt reservation target';
  END IF;

  IF has_schema_privilege('authenticated', 'private', 'USAGE') THEN
    RAISE EXCEPTION 'authenticated has USAGE on the private schema';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM pg_proc AS procedure
      JOIN pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
     WHERE namespace.nspname = 'public'
       AND (
         procedure.proname = 'apply_sync_operation_ledger_core'
         OR procedure.proname = 'apply_debt_sync_operation_hardened'
         OR procedure.proname LIKE 'apply_debt_sync_operation_v%'
         OR procedure.proname = 'apply_credit_card_sync_operation_core'
         OR procedure.proname LIKE 'apply_credit_card_sync_operation_v%'
       )
       AND has_function_privilege('authenticated', procedure.oid, 'EXECUTE')
  ) THEN
    RAISE EXCEPTION 'an internal sync RPC is executable by authenticated';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM pg_proc AS procedure
      JOIN pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
     WHERE namespace.nspname = 'private'
       AND procedure.proname IN (
         'apply_sync_operation_ledger_core',
         'apply_debt_sync_operation_hardened',
         'apply_credit_card_sync_operation_core',
         'apply_credit_card_repayment_preference_sync_operation_core'
       )
       AND has_function_privilege('authenticated', procedure.oid, 'EXECUTE')
  ) THEN
    RAISE EXCEPTION 'a private sync implementation is executable by authenticated';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM (VALUES
        ('apply_sync_operation'),
        ('apply_debt_sync_operation'),
        ('apply_credit_card_sync_operation')
      ) AS expected(procedure_name)
     WHERE NOT EXISTS (
       SELECT 1
         FROM pg_proc AS procedure
         JOIN pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
        WHERE namespace.nspname = 'public'
          AND procedure.proname = expected.procedure_name
          AND procedure.pronargs = 8
          AND has_function_privilege('authenticated', procedure.oid, 'EXECUTE')
     )
  ) THEN
    RAISE EXCEPTION 'a canonical sync RPC is not executable by authenticated';
  END IF;

  IF pg_get_functiondef('public.apply_sync_operation(uuid, text, text, uuid, text, integer, text[], jsonb)'::regprocedure)
     LIKE '%transaction would overdraw a financial account%' THEN
    RAISE EXCEPTION 'transaction sync must allow recovery from a historical overdraft';
  END IF;
END;
$$;

ROLLBACK;
