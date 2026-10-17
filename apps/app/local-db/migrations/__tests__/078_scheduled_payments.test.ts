import { DatabaseSync } from "node:sqlite";
import migration from "../078_scheduled_payments";

describe("scheduled payments migration", () => {
  it("creates the scheduled payment and payment record tables", async () => {
    const sqlite = new DatabaseSync(":memory:");
    await migration.up({ execAsync: async (sql: string) => sqlite.exec(sql) } as never);

    sqlite.exec(`
      INSERT INTO scheduled_payments (id, user_id, name, subcategory_id, source_account_id, amount_centavos, frequency, starts_on, created_at, updated_at)
      VALUES ('payment-1', 'user-1', 'Meralco', 'sub-1', 'account-1', 234000, 'monthly', '2026-09-01', 'now', 'now');
      INSERT INTO scheduled_payment_records (id, user_id, scheduled_payment_id, transaction_id, occurrence_date, payment_date, amount_centavos, created_at, updated_at)
      VALUES ('record-1', 'user-1', 'payment-1', 'tx-1', '2026-09-05', '2026-09-05', 234000, 'now', 'now');
    `);

    expect(sqlite.prepare("SELECT status, auto_post, protected_by_default, version FROM scheduled_payments").get()).toEqual({ status: "active", auto_post: 0, protected_by_default: 1, version: 1 });
    expect(sqlite.prepare("SELECT source, deleted FROM scheduled_payment_records").get()).toEqual({ source: "manual", deleted: 0 });
  });
});
