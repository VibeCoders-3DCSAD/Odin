import { syncQueueOrderByClause } from "../queueOrder";

describe("sync queue ordering", () => {
  it("orders dependent credit-card installment creates between transactions and card relationships", () => {
    expect(syncQueueOrderByClause).toBe(
      "CASE WHEN entity = 'credit_card_transactions' AND operation_type = 'delete' THEN 0 WHEN entity = 'credit_card_payments' AND operation_type = 'delete' THEN 1 WHEN entity = 'transactions' THEN 2 WHEN entity = 'credit_card_installments' THEN 3 WHEN entity = 'credit_card_transactions' THEN 4 WHEN entity = 'credit_card_payments' THEN 5 ELSE 6 END, created_at, operation_id",
    );
  });
});
