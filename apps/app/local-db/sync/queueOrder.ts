export const syncQueueOrderByClause =
  "CASE WHEN entity = 'credit_card_transactions' AND operation_type = 'delete' THEN 0 WHEN entity = 'transactions' THEN 1 ELSE 2 END, created_at, operation_id";
