import { syncQueueOrderByClause } from "../queueOrder";

describe("sync queue ordering", () => {
  it("deletes credit-card relationships before transactions while preserving transaction precedence otherwise", () => {
    expect(syncQueueOrderByClause).toBe(
      "CASE WHEN entity = 'credit_card_transactions' AND operation_type = 'delete' THEN 0 WHEN entity = 'transactions' THEN 1 ELSE 2 END, created_at, operation_id",
    );
  });
});
