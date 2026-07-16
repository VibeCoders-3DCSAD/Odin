import type { SQLiteDatabase } from "expo-sqlite";

const migration: { version: number; up: (db: SQLiteDatabase) => Promise<void> } = {
  version: 7,
  up: async (db: SQLiteDatabase) => {
    await db.execAsync(`
      ALTER TABLE income_sources ADD COLUMN estimated_interval_days integer;
    `);
  },
};

export default migration;
