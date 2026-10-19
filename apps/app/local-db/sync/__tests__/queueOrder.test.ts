import { DatabaseSync } from "node:sqlite";
import { syncQueueOrderByClause } from "../queueOrder";

function ordered(operations: [string, string][]) {
  const sqlite = new DatabaseSync(":memory:");
  try {
    sqlite.exec("CREATE TABLE sync_queue (entity TEXT, operation_type TEXT, created_at TEXT)");
    const insert = sqlite.prepare("INSERT INTO sync_queue VALUES (?, ?, '2026-11-02T00:00:00Z')");
    operations.forEach(([entity, operation]) => insert.run(entity, operation));
    return sqlite.prepare(`SELECT entity, operation_type FROM sync_queue ORDER BY ${syncQueueOrderByClause}`).all()
      .map((row) => [row.entity, row.operation_type]);
  } finally {
    sqlite.close();
  }
}

describe("sync queue ordering", () => {
  it("uses insertion order to break same-timestamp queue ties", () => {
    expect(ordered([["categories", "create"], ["subcategories", "create"], ["financial_accounts", "create"]]))
      .toEqual([["categories", "create"], ["subcategories", "create"], ["financial_accounts", "create"]]);
  });

  it.each(["financial_accounts", "categories", "subcategories", "scheduled_payments"])("creates %s before transactions that reference them", (entity) => {
    expect(ordered([["transactions", "create"], [entity, "create"]]))
      .toEqual([[entity, "create"], ["transactions", "create"]]);
  });

  it("creates the biller, expense, and payment record in dependency order", () => {
    expect(ordered([["scheduled_payment_records", "create"], ["transactions", "create"], ["scheduled_payments", "create"]]))
      .toEqual([["scheduled_payments", "create"], ["transactions", "create"], ["scheduled_payment_records", "create"]]);
  });

  it("deletes payment records before expenses and their billers", () => {
    expect(ordered([["scheduled_payments", "delete"], ["transactions", "delete"], ["scheduled_payment_records", "delete"]]))
      .toEqual([["scheduled_payment_records", "delete"], ["transactions", "delete"], ["scheduled_payments", "delete"]]);
  });

  it("preserves credit-card creation and deletion dependencies", () => {
    expect(ordered([["credit_card_payments", "create"], ["credit_card_transactions", "create"], ["credit_card_installments", "create"], ["transactions", "create"]]))
      .toEqual([["transactions", "create"], ["credit_card_installments", "create"], ["credit_card_transactions", "create"], ["credit_card_payments", "create"]]);
    expect(ordered([["transactions", "delete"], ["credit_card_payments", "delete"], ["credit_card_transactions", "delete"]]))
      .toEqual([["credit_card_transactions", "delete"], ["credit_card_payments", "delete"], ["transactions", "delete"]]);
  });
});
