CREATE OR REPLACE FUNCTION preserve_credit_card_statement_authority()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.authoritative = false THEN
    RAISE EXCEPTION 'recorded credit-card statements must remain authoritative';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS credit_card_statement_authority_guard ON credit_card_statements;
CREATE TRIGGER credit_card_statement_authority_guard
BEFORE INSERT OR UPDATE OF authoritative ON credit_card_statements
FOR EACH ROW EXECUTE FUNCTION preserve_credit_card_statement_authority();

CREATE OR REPLACE FUNCTION prevent_early_credit_card_statement()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM credit_card_cycles
    WHERE id = NEW.cycle_id AND user_id = NEW.user_id AND deleted = false
      AND statement_date <= CURRENT_DATE
  ) THEN
    RAISE EXCEPTION 'statement is not expected yet';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS credit_card_statement_date_guard ON credit_card_statements;
CREATE TRIGGER credit_card_statement_date_guard
BEFORE INSERT OR UPDATE OF cycle_id ON credit_card_statements
FOR EACH ROW EXECUTE FUNCTION prevent_early_credit_card_statement();

CREATE OR REPLACE FUNCTION set_debt_paid_off_timestamp()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'paid_off' AND OLD.status IS DISTINCT FROM 'paid_off' THEN
    NEW.paid_off_at := COALESCE(NEW.paid_off_at, now());
  ELSIF NEW.status <> 'paid_off' THEN
    NEW.paid_off_at := NULL;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS debt_paid_off_timestamp_guard ON debt_accounts;
CREATE TRIGGER debt_paid_off_timestamp_guard
BEFORE UPDATE OF status ON debt_accounts
FOR EACH ROW EXECUTE FUNCTION set_debt_paid_off_timestamp();
