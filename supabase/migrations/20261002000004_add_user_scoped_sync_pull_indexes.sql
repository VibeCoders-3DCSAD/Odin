-- Match the per-user timestamp/identity cursor used by the sync pull endpoint.
CREATE INDEX IF NOT EXISTS credit_card_details_user_pull_idx
  ON public.credit_card_details (user_id, updated_at, account_id);
CREATE INDEX IF NOT EXISTS credit_card_cycles_user_pull_idx
  ON public.credit_card_cycles (user_id, updated_at, id);
CREATE INDEX IF NOT EXISTS credit_card_installments_user_pull_idx
  ON public.credit_card_installments (user_id, updated_at, id);
CREATE INDEX IF NOT EXISTS credit_card_transactions_user_pull_idx
  ON public.credit_card_transactions (user_id, updated_at, transaction_id);
CREATE INDEX IF NOT EXISTS credit_card_statements_user_pull_idx
  ON public.credit_card_statements (user_id, updated_at, id);
CREATE INDEX IF NOT EXISTS credit_card_payments_user_pull_idx
  ON public.credit_card_payments (user_id, updated_at, id);
CREATE INDEX IF NOT EXISTS credit_card_settlements_user_pull_idx
  ON public.credit_card_settlements (user_id, updated_at, id);
CREATE INDEX IF NOT EXISTS credit_card_statement_strategies_user_pull_idx
  ON public.credit_card_statement_strategies (user_id, updated_at, statement_id);
CREATE INDEX IF NOT EXISTS debt_accounts_user_pull_idx
  ON public.debt_accounts (user_id, updated_at, id);
CREATE INDEX IF NOT EXISTS debt_payments_user_pull_idx
  ON public.debt_payments (user_id, updated_at, id);
CREATE INDEX IF NOT EXISTS debt_strategy_preferences_user_pull_idx
  ON public.debt_strategy_preferences (user_id, updated_at);
CREATE INDEX IF NOT EXISTS user_debt_priorities_user_pull_idx
  ON public.user_debt_priorities (user_id, updated_at, id);
