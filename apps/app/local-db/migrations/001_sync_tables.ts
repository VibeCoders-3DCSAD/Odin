import type { Migration } from "../client";

const migration: Migration = {
  version: 1,
  up: async (db) => {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS sync_state (
        user_id text primary key,
        device_id text not null,
        pull_cursor text,
        last_sync_at text
      );
    `);

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS sync_queue (
        operation_id text primary key,
        user_id text not null,
        device_id text not null,
        entity text not null,
        record_id text not null,
        operation_type text not null,
        base_version integer,
        changed_fields text not null default '[]',
        payload text not null default '{}',
        failure_message text not null default 'This change could not be synced.',
        status text not null default 'pending',
        attempts integer not null default 0,
        last_error text,
        created_at text not null
      );
    `);

    await db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_sync_queue_status
        ON sync_queue (status, created_at);
    `);

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS sync_errors (
        id text primary key,
        operation_id text,
        message text not null,
        created_at text not null
      );
    `);
  },
};

export default migration;
