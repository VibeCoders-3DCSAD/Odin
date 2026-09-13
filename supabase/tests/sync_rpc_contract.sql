BEGIN;

DO $$
BEGIN
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
END;
$$;

ROLLBACK;
