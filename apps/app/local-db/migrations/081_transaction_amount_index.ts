import type { Migration } from "../client";

// Backs the transaction list's amount sort and its keyset cursor
// (amount_centavos, created_at, rowid) so pages seek instead of sorting every row.
const migration: Migration = {
  version: 81,
  up: async (db) => {
    await db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_transactions_user_amount
        ON transactions (user_id, amount_centavos, created_at);
    `);
  },
};

export default migration;
