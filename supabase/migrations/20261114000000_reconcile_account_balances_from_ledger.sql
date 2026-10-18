-- The posted transaction ledger is authoritative for non-credit-card balances.
--
-- Migrations 20261002000001, 08 and 14 reconciled balances inside the
-- public.apply_sync_operation wrapper. Later wrappers route straight to
-- private.apply_sync_operation_ledger_core, so ordinary transaction creates,
-- edits and deletes stopped updating financial_accounts.current_balance_centavos.
--
-- Reconcile from a trigger on public.transactions instead, so every writer
-- (any sync wrapper, the API, auto-post jobs) keeps balances correct.
-- The trigger is a deferred constraint trigger: it runs at commit, after
-- ledger_core's debt-payment debit. Reconciling sets the absolute ledger
-- balance, so that debit is overwritten with the same value, never doubled.
--
-- Overdraft semantics mirror migration 08/14: no overdraft rejection here.
-- ledger_core still rejects debt payments that exceed the source balance.

CREATE OR REPLACE FUNCTION private.reconcile_financial_account_balances(p_account_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_account_ids IS NULL OR cardinality(p_account_ids) = 0 THEN
    RETURN;
  END IF;

  -- Lock first, in id order, so the balance statement below takes a fresh
  -- snapshot that includes ledger rows committed by concurrent writers.
  PERFORM 1
    FROM public.financial_accounts AS account
   WHERE account.id = ANY (p_account_ids)
     AND account.kind <> 'credit_card'
     AND account.deleted = false
   ORDER BY account.id
     FOR UPDATE;

  -- financial_accounts_sync_bump sets version and updated_at on each update,
  -- so only accounts whose balance actually changes are bumped.
  WITH reconciled_balances AS (
    SELECT account.id, account.opening_balance_centavos + COALESCE((
      SELECT SUM(CASE
        WHEN transaction_row.transaction_type = 'income' AND transaction_row.destination_account_id = account.id THEN transaction_row.amount_centavos
        WHEN transaction_row.transaction_type = 'expense' AND transaction_row.source_account_id = account.id THEN -transaction_row.amount_centavos
        WHEN transaction_row.transaction_type = 'transfer' AND transaction_row.destination_account_id = account.id THEN transaction_row.amount_centavos
        WHEN transaction_row.transaction_type = 'transfer' AND transaction_row.source_account_id = account.id THEN -transaction_row.amount_centavos
        ELSE 0
      END)
      FROM public.transactions AS transaction_row
      WHERE transaction_row.user_id = account.user_id
        AND (transaction_row.source_account_id = account.id OR transaction_row.destination_account_id = account.id)
        AND transaction_row.deleted = false
        AND transaction_row.status = 'posted'
    ), 0) AS current_balance_centavos
    FROM public.financial_accounts AS account
    WHERE account.id = ANY (p_account_ids)
      AND account.kind <> 'credit_card'
      AND account.deleted = false
  )
  UPDATE public.financial_accounts AS account
     SET current_balance_centavos = reconciled_balances.current_balance_centavos
    FROM reconciled_balances
   WHERE account.id = reconciled_balances.id
     AND account.current_balance_centavos IS DISTINCT FROM reconciled_balances.current_balance_centavos;
END;
$$;

CREATE OR REPLACE FUNCTION private.reconcile_transaction_account_balances()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_account_ids uuid[] := ARRAY[]::uuid[];
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    v_account_ids := v_account_ids || OLD.source_account_id || OLD.destination_account_id;
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    v_account_ids := v_account_ids || NEW.source_account_id || NEW.destination_account_id;
  END IF;

  SELECT COALESCE(array_agg(DISTINCT account_id), ARRAY[]::uuid[])
    INTO v_account_ids
    FROM unnest(v_account_ids) AS account_id
   WHERE account_id IS NOT NULL;

  PERFORM private.reconcile_financial_account_balances(v_account_ids);
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION private.reconcile_financial_account_balances(uuid[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.reconcile_transaction_account_balances() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS transactions_reconcile_account_balances ON public.transactions;
CREATE CONSTRAINT TRIGGER transactions_reconcile_account_balances
  AFTER INSERT OR DELETE OR UPDATE OF
    amount_centavos, transaction_type, status, deleted,
    source_account_id, destination_account_id, user_id
  ON public.transactions
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION private.reconcile_transaction_account_balances();

-- One-time backfill: repair balances left stale since the wrapper lost its
-- reconciliation step. Only accounts whose balance differs are bumped.
SELECT private.reconcile_financial_account_balances(ARRAY(
  SELECT account.id
    FROM public.financial_accounts AS account
   WHERE account.kind <> 'credit_card'
     AND account.deleted = false
));
