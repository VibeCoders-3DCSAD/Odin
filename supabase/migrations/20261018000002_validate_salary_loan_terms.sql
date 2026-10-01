-- Salary-loan terms are stored inside preset_data, so validate them alongside
-- the existing ownership guard before a synced debt can be persisted.
CREATE OR REPLACE FUNCTION validate_debt_preset_references()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_income_source_id uuid;
  v_provider text;
  v_repayment_method text;
BEGIN
  IF NEW.preset_key = 'salary_loan' THEN
    v_income_source_id := NULLIF(NEW.preset_data #>> '{salaryLoan,linkedIncomeSourceId}', '')::uuid;
    v_provider := NEW.preset_data #>> '{salaryLoan,provider}';
    v_repayment_method := NEW.preset_data #>> '{salaryLoan,repaymentMethod}';
    IF v_income_source_id IS NULL THEN RAISE EXCEPTION 'salary loan requires a linked income source'; END IF;
    IF v_provider NOT IN ('sss', 'gsis', 'pag_ibig', 'other') THEN RAISE EXCEPTION 'salary loan provider is invalid'; END IF;
    IF v_repayment_method NOT IN ('payroll_deduction', 'automatic_debit', 'manual_payment', 'other') THEN RAISE EXCEPTION 'salary loan repayment method is invalid'; END IF;
    IF v_repayment_method = 'payroll_deduction' AND (
      COALESCE(NEW.preset_data #>> '{salaryLoan,deductionAmountCentavos}', '') !~ '^[1-9][0-9]*$'
      OR NEW.preset_data #>> '{salaryLoan,deductionSchedule}' NOT IN ('weekly', 'biweekly', 'semi_monthly', 'monthly', 'quarterly', 'custom')
    ) THEN RAISE EXCEPTION 'salary loan payroll deduction is invalid'; END IF;
  ELSIF NEW.preset_key = 'business_loan' THEN
    v_income_source_id := NULLIF(NEW.preset_data #>> '{businessLoan,linkedBusinessOrIncomeSourceId}', '')::uuid;
  ELSE
    RETURN NEW;
  END IF;

  IF v_income_source_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM income_sources WHERE id = v_income_source_id AND user_id = NEW.user_id AND deleted = false
  ) THEN RAISE EXCEPTION 'linked income source is not accessible'; END IF;
  RETURN NEW;
END;
$$;
