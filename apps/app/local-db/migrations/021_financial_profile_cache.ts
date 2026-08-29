import type { Migration } from "../client";

const migration: Migration = {
  version: 21,
  up: async (db) => {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS financial_profile_cache (
        user_id text primary key,
        assignment_json text not null,
        updated_at text not null
      );
    `);
  },
};

export default migration;
