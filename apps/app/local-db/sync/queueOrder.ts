export const syncQueueOrderByClause =
  "CASE WHEN entity = 'credit_card_transactions' AND operation_type = 'delete' THEN 0 WHEN entity = 'transactions' THEN 1 WHEN entity = 'credit_card_installments' THEN 2 WHEN entity = 'credit_card_transactions' THEN 3 ELSE 4 END, created_at, operation_id";
