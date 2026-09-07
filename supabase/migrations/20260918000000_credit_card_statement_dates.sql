ALTER TABLE public.credit_card_statements
  ADD COLUMN IF NOT EXISTS statement_date date;

-- Legacy statement rows have no bank statement date. Preserve their existing
-- due date rather than inventing one from card defaults.
UPDATE public.credit_card_statements
   SET statement_date = due_date
 WHERE statement_date IS NULL;

ALTER TABLE public.credit_card_statements
  ALTER COLUMN statement_date SET NOT NULL;

-- Historical cycle rows can refer to a card that has since been removed.
-- A soft delete must always be allowed; otherwise a queued transaction delete
-- becomes permanently unsyncable. Active credit-card relationships remain
-- guarded for all non-delete writes.
CREATE OR REPLACE FUNCTION public.assert_credit_card_account()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.deleted = true THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.financial_accounts
     WHERE id = NEW.account_id AND user_id = NEW.user_id
       AND kind = 'credit_card' AND deleted = false
  ) THEN
    RAISE EXCEPTION 'account is not an accessible credit card';
  END IF;
  RETURN NEW;
END;
$$;

UPDATE public.credit_card_cycles c
   SET statement_date = NULL
 WHERE statement_date IS NOT NULL
   AND EXISTS (
     SELECT 1 FROM public.financial_accounts a
      WHERE a.id = c.account_id AND a.user_id = c.user_id
        AND a.kind = 'credit_card' AND a.deleted = false
   )
   AND NOT EXISTS (
     SELECT 1 FROM public.credit_card_statements s
      WHERE s.user_id = c.user_id AND s.cycle_id = c.id AND s.deleted = false
   );

ALTER TABLE public.credit_card_statements
  DROP CONSTRAINT IF EXISTS credit_card_statements_amounts_check;

ALTER TABLE public.credit_card_statements
  ADD CONSTRAINT credit_card_statements_amounts_check
  CHECK (
    statement_balance_centavos >= 0
    AND minimum_due_centavos >= 0
    AND finance_charge_centavos >= 0
    AND minimum_due_centavos <= statement_balance_centavos
  );

CREATE UNIQUE INDEX IF NOT EXISTS credit_card_statements_one_live_cycle
  ON public.credit_card_statements (user_id, cycle_id)
  WHERE deleted = false;

CREATE OR REPLACE FUNCTION public.guard_credit_card_statement()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_cutoff date;
  v_recorded date;
BEGIN
  SELECT c.cutoff_date, c.statement_date
    INTO v_cutoff, v_recorded
    FROM public.credit_card_cycles c
    JOIN public.financial_accounts a ON a.id = c.account_id AND a.user_id = c.user_id
   WHERE c.id = NEW.cycle_id AND c.user_id = NEW.user_id AND c.deleted = false
     AND a.kind = 'credit_card' AND a.deleted = false;
  IF v_cutoff IS NULL OR NEW.statement_date < v_cutoff THEN
    RAISE EXCEPTION 'credit-card statement date is invalid';
  END IF;
  IF TG_OP = 'INSERT' AND v_recorded IS NOT NULL THEN
    RAISE EXCEPTION 'a statement is already recorded for this cycle';
  END IF;
  IF TG_OP = 'UPDATE' AND (
    NEW.statement_date IS DISTINCT FROM OLD.statement_date
    OR NEW.statement_balance_centavos IS DISTINCT FROM OLD.statement_balance_centavos
    OR NEW.minimum_due_centavos IS DISTINCT FROM OLD.minimum_due_centavos
    OR NEW.finance_charge_centavos IS DISTINCT FROM OLD.finance_charge_centavos
    OR NEW.due_date IS DISTINCT FROM OLD.due_date
    OR NEW.authoritative IS DISTINCT FROM OLD.authoritative
    OR NEW.deleted IS DISTINCT FROM OLD.deleted
  ) THEN
    RAISE EXCEPTION 'recorded credit-card statements are immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS credit_card_statement_guard ON public.credit_card_statements;
CREATE TRIGGER credit_card_statement_guard
  BEFORE INSERT OR UPDATE ON public.credit_card_statements
  FOR EACH ROW EXECUTE FUNCTION public.guard_credit_card_statement();

CREATE OR REPLACE FUNCTION public.guard_credit_card_cycle_dates()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.statement_date IS NOT NULL
     AND (NEW.cycle_start_date IS DISTINCT FROM OLD.cycle_start_date OR NEW.cutoff_date IS DISTINCT FROM OLD.cutoff_date) THEN
    RAISE EXCEPTION 'recorded credit-card billing cycles cannot be changed';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.credit_card_cycles c
     WHERE c.user_id = NEW.user_id AND c.account_id = NEW.account_id AND c.deleted = false
       AND c.id IS DISTINCT FROM NEW.id
       AND daterange(c.cycle_start_date, c.cutoff_date, '[]') && daterange(NEW.cycle_start_date, NEW.cutoff_date, '[]')
  ) THEN
    RAISE EXCEPTION 'credit-card billing cycles cannot overlap';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS credit_card_cycle_dates_guard ON public.credit_card_cycles;
CREATE TRIGGER credit_card_cycle_dates_guard
  BEFORE INSERT OR UPDATE OF cycle_start_date, cutoff_date ON public.credit_card_cycles
  FOR EACH ROW EXECUTE FUNCTION public.guard_credit_card_cycle_dates();

-- Statements use the existing credit-card sync core for versioning and audit,
-- then synchronize the display date onto the user-owned cycle in the same RPC.
CREATE OR REPLACE FUNCTION public.apply_credit_card_sync_operation(
  p_operation_id uuid, p_device_id text, p_entity text, p_record_id uuid,
  p_operation_type text, p_base_version integer, p_changed_fields text[], p_payload jsonb
) RETURNS TABLE(status text, reason text, current_version integer, conflicted_fields text[])
LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE
  v_user uuid := auth.uid();
  v_cycle uuid;
  v_statement_date date;
  v_result record;
BEGIN
  IF p_entity <> 'credit_card_statements' THEN
    RETURN QUERY SELECT * FROM public.apply_credit_card_sync_operation_v3(
      p_operation_id, p_device_id, p_entity, p_record_id, p_operation_type,
      p_base_version, p_changed_fields, p_payload
    );
    RETURN;
  END IF;
  IF v_user IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF p_operation_type <> 'create' THEN
    RETURN QUERY SELECT 'rejected'::text, 'recorded credit-card statements are immutable'::text, NULL::integer, NULL::text[];
    RETURN;
  END IF;
  v_cycle := NULLIF(p_payload->>'cycle_id', '')::uuid;
  v_statement_date := NULLIF(p_payload->>'statement_date', '')::date;
  IF v_cycle IS NULL OR v_statement_date IS NULL
     OR NOT EXISTS (
       SELECT 1 FROM public.credit_card_cycles c
       JOIN public.financial_accounts a ON a.id = c.account_id AND a.user_id = c.user_id
        WHERE c.id = v_cycle AND c.user_id = v_user AND c.deleted = false
          AND a.kind = 'credit_card' AND a.deleted = false
          AND c.statement_date IS NULL AND v_statement_date >= c.cutoff_date
     ) THEN
    RETURN QUERY SELECT 'rejected'::text, 'credit-card statement cycle is invalid'::text, NULL::integer, NULL::text[];
    RETURN;
  END IF;
  SELECT * INTO v_result FROM public.apply_credit_card_sync_operation_v3(
    p_operation_id, p_device_id, p_entity, p_record_id, p_operation_type,
    p_base_version, p_changed_fields, p_payload
  );
  IF v_result.status = 'applied' THEN
    UPDATE public.credit_card_cycles
       SET statement_date = v_statement_date, version = version + 1, updated_at = now()
     WHERE id = v_cycle AND user_id = v_user AND deleted = false;
  END IF;
  RETURN QUERY SELECT v_result.status, v_result.reason, v_result.current_version, v_result.conflicted_fields;
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_credit_card_sync_operation(uuid, text, text, uuid, text, integer, text[], jsonb) TO authenticated;
