import type { Migration } from "../client";

const migration: Migration = {
  version: 35,
  up: async (db) => {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS alert_cache (
        id text primary key,
        user_id text not null,
        category text not null,
        severity text not null,
        status text not null,
        title text not null,
        body text not null,
        explanation text,
        action_label text,
        route_name text,
        route_params_json text not null default '{}',
        related_entities_json text not null default '[]',
        metadata_json text not null default '{}',
        allowed_actions_json text not null default '[]',
        remote_revision text,
        triggered_at text not null,
        read_at text,
        acknowledged_at text,
        dismissed_at text,
        remind_at text,
        expires_at text,
        cached_at text not null
      );

      CREATE INDEX IF NOT EXISTS idx_alert_cache_user_active
        ON alert_cache (user_id, status, triggered_at DESC);
      CREATE INDEX IF NOT EXISTS idx_alert_cache_user_triggered
        ON alert_cache (user_id, triggered_at DESC);
    `);
  },
};

export default migration;
