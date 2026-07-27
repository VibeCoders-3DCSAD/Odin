ALTER TABLE income_sources
  ADD COLUMN IF NOT EXISTS recurring_template_id uuid REFERENCES recurring_transaction_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS destination_account_id uuid REFERENCES financial_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS subcategory_id uuid REFERENCES subcategories(id) ON DELETE RESTRICT;
