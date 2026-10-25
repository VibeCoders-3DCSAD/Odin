import type { Migration } from "../client";

// Every forecast run, kept so a month's forecast can later be compared with what was spent.
const migration: Migration = {
  version: 90,
  up: async (db) => {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS forecast_snapshots (
        id text primary key,
        user_id text not null,
        run_month text not null,
        generated_at text not null,
        payload_json text not null
      );
      CREATE INDEX IF NOT EXISTS idx_forecast_snapshots_user_month
        ON forecast_snapshots (user_id, run_month, generated_at);
    `);
  },
};

export default migration;
