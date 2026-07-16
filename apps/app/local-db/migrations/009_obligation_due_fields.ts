import type { SQLiteDatabase } from "expo-sqlite";

const migration: { version: number; up: (db: SQLiteDatabase) => Promise<void> } = {
  version: 9,
  up: async (db: SQLiteDatabase) => {
    await db.execAsync(`
      ALTER TABLE financial_obligations ADD COLUMN due_second_day_of_month integer;
      ALTER TABLE financial_obligations ADD COLUMN due_day_of_week integer;
      ALTER TABLE financial_obligations ADD COLUMN due_second_day_of_week integer;
    `);
  },
};

export default migration;
