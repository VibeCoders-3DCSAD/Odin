CREATE OR REPLACE FUNCTION set_credit_card_transaction_derived_defaults()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.applied_credit_centavos := COALESCE(NEW.applied_credit_centavos, 0);
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS credit_card_transaction_derived_defaults ON credit_card_transactions;
CREATE TRIGGER credit_card_transaction_derived_defaults
BEFORE INSERT OR UPDATE ON credit_card_transactions
FOR EACH ROW EXECUTE FUNCTION set_credit_card_transaction_derived_defaults();
