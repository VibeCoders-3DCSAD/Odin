import type { SQLiteDatabase } from "expo-sqlite";

const migration: { version: number; up: (db: SQLiteDatabase) => Promise<void> } = {
  version: 8,
  up: async (db: SQLiteDatabase) => {
    await db.execAsync(`
      ALTER TABLE income_sources ADD COLUMN payday_second_day_of_week integer;
    `);
  },
};

export default migration;
