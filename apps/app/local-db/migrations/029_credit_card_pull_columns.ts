import type { Migration } from "../client";

const migration: Migration = {
  version: 29,
  up: async (db) => {
    for (const [table, column, definition] of [
      ["credit_card_transactions", "client_mutation_id", "text"],
      ["credit_card_transactions", "applied_credit_centavos", "integer NOT NULL DEFAULT 0"],
      ["credit_card_payments", "client_mutation_id", "text"],
      ["credit_card_payments", "issuer_recognized", "integer NOT NULL DEFAULT 0"],
      ["credit_card_credit_applications", "client_mutation_id", "text"],
    ] as const) {
      const columns = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
      if (!columns.some(({ name }) => name === column)) {
        await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
      }
    }
  },
};

export default migration;
