-- Internal sync implementations are reached only through the canonical RPCs.
-- Canonical wrappers run as their owner so callers do not need EXECUTE on cores.
ALTER FUNCTION public.apply_sync_operation(uuid, text, text, uuid, text, integer, text[], jsonb)
  SECURITY DEFINER
  SET search_path = public, auth;

ALTER FUNCTION public.apply_debt_sync_operation(uuid, text, text, uuid, text, integer, text[], jsonb)
  SECURITY DEFINER
  SET search_path = public, auth;

ALTER FUNCTION public.apply_credit_card_sync_operation(uuid, text, text, uuid, text, integer, text[], jsonb)
  SECURITY DEFINER
  SET search_path = public, auth;

DO $$
DECLARE
  v_function regprocedure;
BEGIN
  FOR v_function IN
    SELECT p.oid::regprocedure
      FROM pg_proc AS p
      JOIN pg_namespace AS n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND (
         p.proname = 'apply_sync_operation_ledger_core'
         OR p.proname = 'apply_debt_sync_operation_hardened'
         OR p.proname LIKE 'apply_debt_sync_operation_v%'
         OR p.proname = 'apply_credit_card_sync_operation_core'
         OR p.proname LIKE 'apply_credit_card_sync_operation_v%'
       )
  LOOP
    EXECUTE format(
      'REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated',
      v_function
    );
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.apply_sync_operation(uuid, text, text, uuid, text, integer, text[], jsonb)
  FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.apply_debt_sync_operation(uuid, text, text, uuid, text, integer, text[], jsonb)
  FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.apply_credit_card_sync_operation(uuid, text, text, uuid, text, integer, text[], jsonb)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.apply_sync_operation(uuid, text, text, uuid, text, integer, text[], jsonb)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_debt_sync_operation(uuid, text, text, uuid, text, integer, text[], jsonb)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_credit_card_sync_operation(uuid, text, text, uuid, text, integer, text[], jsonb)
  TO authenticated;
