CREATE OR REPLACE FUNCTION reconcile_credit_card_purchase_amount()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_account_id uuid;
  v_updated integer;
BEGIN
  IF OLD.amount_centavos IS NOT DISTINCT FROM NEW.amount_centavos THEN
    RETURN NEW;
  END IF;

  SELECT account_id
    INTO v_account_id
    FROM credit_card_transactions
   WHERE transaction_id = NEW.id
     AND user_id = NEW.user_id
     AND deleted = false;

  IF v_account_id IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM set_config('odin.credit_card_invariant_path', 'true', true);
  UPDATE credit_card_details
     SET available_credit_centavos = LEAST(
           credit_limit_centavos,
           COALESCE(available_credit_centavos, credit_limit_centavos)
             + OLD.amount_centavos - NEW.amount_centavos
         ),
         version = version + 1,
         updated_at = now()
   WHERE account_id = v_account_id
     AND user_id = NEW.user_id
     AND deleted = false
         AND COALESCE(available_credit_centavos, credit_limit_centavos) + OLD.amount_centavos
         >= NEW.amount_centavos;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  PERFORM set_config('odin.credit_card_invariant_path', 'false', true);

  IF v_updated = 0 THEN
    RAISE EXCEPTION 'purchase exceeds available credit';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS credit_card_purchase_amount_reconciliation ON transactions;
CREATE TRIGGER credit_card_purchase_amount_reconciliation
AFTER UPDATE OF amount_centavos ON transactions
FOR EACH ROW
WHEN (OLD.amount_centavos IS DISTINCT FROM NEW.amount_centavos)
EXECUTE FUNCTION reconcile_credit_card_purchase_amount();
