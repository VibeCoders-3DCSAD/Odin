CREATE OR REPLACE FUNCTION recognize_credit_card_settlement() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'recognized' AND OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM set_config('odin.credit_card_invariant_path', 'true', true);
    UPDATE credit_card_installments
    SET settlement_status = 'completed', remaining_principal_centavos = 0,
        remaining_months = 0, version = version + 1, updated_at = now()
    WHERE id = NEW.installment_id AND user_id = NEW.user_id AND deleted = false;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS credit_card_settlement_recognition ON credit_card_settlements;
DROP TRIGGER IF EXISTS credit_card_settlement_completion ON credit_card_settlements;
CREATE TRIGGER credit_card_settlement_recognition
AFTER UPDATE ON credit_card_settlements
FOR EACH ROW EXECUTE FUNCTION recognize_credit_card_settlement();
