import type { Migration } from "../client";

const migration: Migration = {
  version: 4,
  up: async (db) => {
    const columns = await db.getAllAsync<{ name: string }>("PRAGMA table_info(sync_queue)");
    if (columns.some((column) => column.name === "failure_message")) return;

    await db.execAsync(`
      ALTER TABLE sync_queue
        ADD COLUMN failure_message text not null default 'This change could not be synced.';
    `);
  },
};

export default migration;
