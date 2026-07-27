import type { Migration } from "../client";

const migration: Migration = {
  version: 13,
  up: async (db) => {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS dashboard_snapshots (
        id text primary key,
        user_id text not null,
        source text not null,
        payload_json text not null default '{}',
        updated_at text not null
      );
    `);

    await db.execAsync(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_snapshots_user_source
        ON dashboard_snapshots (user_id, source);
    `);
  },
};

export default migration;
