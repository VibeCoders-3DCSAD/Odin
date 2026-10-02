import type { Migration } from "../client";

const migration: Migration = {
  version: 73,
  up: async (db) => {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS anomaly_evaluations (
        id text primary key, user_id text not null, transaction_id text not null,
        subcategory_id text not null, amount_centavos integer not null,
        usable_history_count integer not null, usual_spending_centavos integer not null,
        lower_bound_centavos integer not null, upper_bound_centavos integer not null,
        severity real not null, model_version text not null, evaluated_at text not null,
        version integer not null, deleted integer not null default 0,
        created_at text not null, updated_at text not null, last_synced_at text
      );
      CREATE UNIQUE INDEX IF NOT EXISTS anomaly_evaluations_transaction_unique_idx
        ON anomaly_evaluations(user_id, transaction_id) WHERE deleted = 0;
    `);
  },
};

export default migration;
