import type { Migration } from "../client";

const migration: Migration = {
  version: 30,
  up: async (db) => {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS sync_pull_failures (
        user_id text not null,
        table_name text not null,
        record_id text not null,
        payload text not null,
        last_error text not null,
        attempts integer not null default 1,
        updated_at text not null,
        primary key (user_id, table_name, record_id)
      );
    `);
  },
};

export default migration;
