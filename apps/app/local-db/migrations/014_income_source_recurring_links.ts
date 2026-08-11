import type { SQLiteDatabase } from "expo-sqlite";

const INCOME_SOURCE_LINK_COLUMNS = [
  "recurring_template_id",
  "destination_account_id",
  "subcategory_id",
] as const;

const migration: { version: number; up: (db: SQLiteDatabase) => Promise<void> } = {
  version: 14,
  up: async (db) => {
    const columns = await db.getAllAsync<{ name: string }>("PRAGMA table_info(income_sources)");
    const existingColumns = new Set(columns.map(({ name }) => name));

    for (const column of INCOME_SOURCE_LINK_COLUMNS) {
      if (existingColumns.has(column)) continue;
      await db.execAsync(`ALTER TABLE income_sources ADD COLUMN ${column} text`);
    }
  },
};

export default migration;
