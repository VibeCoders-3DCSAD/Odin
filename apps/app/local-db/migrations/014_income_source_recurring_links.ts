import type { SQLiteDatabase } from "expo-sqlite";

const migration: { version: number; up: (db: SQLiteDatabase) => Promise<void> } = {
  version: 14,
  up: async (db) => {
    await db.execAsync(`
      ALTER TABLE income_sources ADD COLUMN recurring_template_id text;
    `).catch(() => {});

    await db.execAsync(`
      ALTER TABLE income_sources ADD COLUMN destination_account_id text;
    `).catch(() => {});

    await db.execAsync(`
      ALTER TABLE income_sources ADD COLUMN subcategory_id text;
    `).catch(() => {});
  },
};

export default migration;
