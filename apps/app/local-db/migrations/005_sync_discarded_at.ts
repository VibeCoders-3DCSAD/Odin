import type { Migration } from "../client";

const migration: Migration = {
  version: 5,
  up: async (db) => {
    const columns = await db.getAllAsync<{ name: string }>("PRAGMA table_info(sync_queue)");
    if (columns.some((column) => column.name === "discarded_at")) return;

    await db.execAsync(`
      ALTER TABLE sync_queue
        ADD COLUMN discarded_at text;
    `);
  },
};

export default migration;
