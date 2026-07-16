ALTER TABLE financial_obligations ADD COLUMN IF NOT EXISTS due_second_day_of_month integer;
ALTER TABLE financial_obligations ADD COLUMN IF NOT EXISTS due_day_of_week integer;
ALTER TABLE financial_obligations ADD COLUMN IF NOT EXISTS due_second_day_of_week integer;
