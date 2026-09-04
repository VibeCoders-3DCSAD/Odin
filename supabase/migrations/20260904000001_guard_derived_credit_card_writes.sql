-- Generic sync writes must not be able to forge balances or settlement state.
CREATE OR REPLACE FUNCTION guard_credit_card_derived_writes() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('odin.credit_card_invariant_path', true) = 'true' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' AND TG_TABLE_NAME = 'credit_card_details' AND NEW.available_credit_centavos IS NOT NULL THEN
    RAISE EXCEPTION 'available credit can only be initialized by a credit-card invariant operation';
  ELSIF TG_OP = 'INSERT' AND TG_TABLE_NAME = 'credit_card_installments' AND (
    NEW.remaining_principal_centavos IS DISTINCT FROM NEW.original_principal_centavos OR
    NEW.remaining_months IS DISTINCT FROM NEW.term_months
  ) THEN
    RAISE EXCEPTION 'installment remaining fields require a dedicated operation';
  ELSIF TG_OP = 'UPDATE' AND TG_TABLE_NAME = 'credit_card_details' AND NEW.available_credit_centavos IS DISTINCT FROM OLD.available_credit_centavos THEN
    RAISE EXCEPTION 'available credit can only be changed by a credit-card invariant operation';
  ELSIF TG_TABLE_NAME = 'credit_card_installments' AND (
    NEW.remaining_principal_centavos IS DISTINCT FROM OLD.remaining_principal_centavos OR
    NEW.remaining_months IS DISTINCT FROM OLD.remaining_months OR
    NEW.settlement_status IS DISTINCT FROM OLD.settlement_status
  ) THEN
    RAISE EXCEPTION 'installment settlement fields require a dedicated operation';
  ELSIF TG_TABLE_NAME = 'credit_card_transactions' AND NEW.applied_credit_centavos IS DISTINCT FROM OLD.applied_credit_centavos THEN
    RAISE EXCEPTION 'applied credit requires a dedicated operation';
  ELSIF TG_TABLE_NAME = 'credit_card_payments' AND NEW.issuer_recognized IS DISTINCT FROM OLD.issuer_recognized THEN
    RAISE EXCEPTION 'issuer recognition requires a dedicated operation';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS credit_card_derived_write_guard ON credit_card_details;
CREATE TRIGGER credit_card_derived_write_guard BEFORE INSERT OR UPDATE ON credit_card_details FOR EACH ROW EXECUTE FUNCTION guard_credit_card_derived_writes();
DROP TRIGGER IF EXISTS credit_card_installment_derived_write_guard ON credit_card_installments;
CREATE TRIGGER credit_card_installment_derived_write_guard BEFORE INSERT OR UPDATE ON credit_card_installments FOR EACH ROW EXECUTE FUNCTION guard_credit_card_derived_writes();
DROP TRIGGER IF EXISTS credit_card_transaction_derived_write_guard ON credit_card_transactions;
CREATE TRIGGER credit_card_transaction_derived_write_guard BEFORE INSERT OR UPDATE ON credit_card_transactions FOR EACH ROW EXECUTE FUNCTION guard_credit_card_derived_writes();
DROP TRIGGER IF EXISTS credit_card_payment_derived_write_guard ON credit_card_payments;
CREATE TRIGGER credit_card_payment_derived_write_guard BEFORE INSERT OR UPDATE ON credit_card_payments FOR EACH ROW EXECUTE FUNCTION guard_credit_card_derived_writes();

CREATE OR REPLACE FUNCTION validate_credit_card_payment_insert() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.transaction_id IS NOT NULL AND NEW.source_account_id IS NULL THEN
    RAISE EXCEPTION 'linked card payments require a source account';
  END IF;
  IF NEW.transaction_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM transactions t
    WHERE t.id = NEW.transaction_id AND t.user_id = NEW.user_id AND t.deleted = false
      AND t.transaction_type = 'expense' AND t.amount_centavos = NEW.amount_centavos
      AND t.source_account_id IS NOT DISTINCT FROM NEW.source_account_id
  ) THEN
    RAISE EXCEPTION 'payment transaction must be an owned expense with the payment amount and source account';
  END IF;
  IF NEW.source_account_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM financial_accounts a
    WHERE a.id = NEW.source_account_id AND a.user_id = NEW.user_id AND a.deleted = false
      AND a.status = 'active' AND a.kind <> 'credit_card'
  ) THEN
    RAISE EXCEPTION 'payment source account is invalid';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS credit_card_payment_insert_guard ON credit_card_payments;
CREATE TRIGGER credit_card_payment_insert_guard BEFORE INSERT OR UPDATE ON credit_card_payments FOR EACH ROW EXECUTE FUNCTION validate_credit_card_payment_insert();

CREATE OR REPLACE FUNCTION guard_credit_card_detail_for_recognition() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.issuer_recognized = true AND OLD.issuer_recognized = false AND NOT EXISTS (
    SELECT 1 FROM credit_card_details d
    JOIN credit_card_cycles c ON c.account_id = d.account_id
    WHERE c.id = NEW.cycle_id AND d.user_id = NEW.user_id AND d.deleted = false
  ) THEN
    RAISE EXCEPTION 'credit-card details are required for issuer recognition';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS credit_card_recognition_detail_guard ON credit_card_payments;
CREATE TRIGGER credit_card_recognition_detail_guard BEFORE UPDATE ON credit_card_payments FOR EACH ROW EXECUTE FUNCTION guard_credit_card_detail_for_recognition();
