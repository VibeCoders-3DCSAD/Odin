import type { Migration } from "../client";

const migration: Migration = {
  version: 46,
  up: async (db) => {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS alert_notification_preferences (id text primary key, user_id text not null, category text not null, mode text not null, in_app_enabled integer not null, push_enabled integer not null, duplicate_cooldown_hours integer not null, snoozed_until text, version integer not null, deleted integer not null default 0, updated_at text not null);
      CREATE TABLE IF NOT EXISTS anomaly_whitelist_rules (id text primary key, user_id text not null, merchant_name text not null, subcategory_id text not null, base_amount_centavos integer, tolerance_bps integer, allow_any_amount integer not null, status text not null, notes text, version integer not null, deleted integer not null default 0, updated_at text not null);
      CREATE TABLE IF NOT EXISTS alert_suppression_rules (id text primary key, user_id text not null, category text not null, source_type text, status text not null, merchant_name text, subcategory_id text, category_id text, amount_center_centavos integer, amount_tolerance_bps integer, starts_at text not null, ends_at text, reason text not null, metadata text not null default '{}', version integer not null, deleted integer not null default 0, updated_at text not null);
    `);
  },
};
export default migration;
