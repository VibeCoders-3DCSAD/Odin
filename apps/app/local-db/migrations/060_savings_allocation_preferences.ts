import type { Migration } from "../client";

const migration: Migration = {
  version: 60,
  up: async (db) => {
    await db.execAsync(`CREATE TABLE savings_allocation_preferences (
      user_id text primary key,
      strategy text not null check (strategy in ('avalanche', 'snowball')),
      version integer not null,
      deleted integer not null default 0,
      created_at text not null,
      updated_at text not null
    );`);
  },
};

export default migration;
