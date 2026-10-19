// Failed rows remain eligible for later sync attempts so transient server
// failures cannot permanently strand a create before its dependent updates.
export const syncQueueEligibleStatusesClause = "status IN ('pending', 'failed')";

// Create owned references before expenses; uncategorized biller payments must
// resolve their scheduled payment on the server before the expense can sync.
export const syncQueueOrderByClause =
  "CASE WHEN entity = 'credit_card_transactions' AND operation_type = 'delete' THEN 0 WHEN entity IN ('credit_card_payments', 'debt_payments', 'credit_card_settlements', 'scheduled_payment_records') AND operation_type = 'delete' THEN 1 WHEN entity IN ('financial_accounts', 'categories', 'subcategories', 'scheduled_payments') AND operation_type = 'create' THEN 2 WHEN entity = 'transactions' THEN 3 WHEN entity = 'credit_card_installments' THEN 4 WHEN entity = 'credit_card_transactions' THEN 5 WHEN entity IN ('credit_card_payments', 'debt_payments', 'credit_card_settlements', 'credit_card_statement_strategies') THEN 6 ELSE 7 END, created_at, rowid";
