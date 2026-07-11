import type * as SQLite from "expo-sqlite";

const migration = {
  version: 3,
  async up(db: SQLite.SQLiteDatabase): Promise<void> {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS privacy_settings (
        id text primary key,
        user_id text not null,
        personalization_enabled integer not null default 1,
        model_training_opt_in integer not null default 0,
        research_evaluation_opt_in integer not null default 0,
        notifications_opt_in integer not null default 0,
        data_retention_days integer,
        version integer not null default 1,
        deleted integer not null default 0,
        created_at text not null,
        updated_at text not null,
        last_synced_at text
      );
    `);
  },
};

export default migration;
