-- Debt preset relationships live in JSONB, so enforce their ownership here
-- rather than trusting the client payload or a sync wrapper's field allowlist.
CREATE OR REPLACE FUNCTION validate_debt_preset_references()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_income_source_id uuid;
BEGIN
  IF NEW.preset_key = 'salary_loan' THEN
    v_income_source_id := NULLIF(NEW.preset_data #>> '{salaryLoan,linkedIncomeSourceId}', '')::uuid;
    IF v_income_source_id IS NULL THEN
      RAISE EXCEPTION 'salary loan requires a linked income source';
    END IF;
  ELSIF NEW.preset_key = 'business_loan' THEN
    v_income_source_id := NULLIF(NEW.preset_data #>> '{businessLoan,linkedBusinessOrIncomeSourceId}', '')::uuid;
  ELSE
    RETURN NEW;
  END IF;

  IF v_income_source_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM income_sources
    WHERE id = v_income_source_id
      AND user_id = NEW.user_id
      AND deleted = false
  ) THEN
    RAISE EXCEPTION 'linked income source is not accessible';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS debt_preset_references_guard ON debt_accounts;
CREATE TRIGGER debt_preset_references_guard
BEFORE INSERT OR UPDATE OF preset_key, preset_data ON debt_accounts
FOR EACH ROW EXECUTE FUNCTION validate_debt_preset_references();
