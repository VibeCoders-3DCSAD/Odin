import type { SQLiteDatabase } from "expo-sqlite";

const migration: { version: number; up: (db: SQLiteDatabase) => Promise<void> } = {
  version: 10,
  up: async (db: SQLiteDatabase) => {
    await db.execAsync(`
      ALTER TABLE financial_obligations ADD COLUMN due_month integer;
    `);
  },
};

export default migration;
