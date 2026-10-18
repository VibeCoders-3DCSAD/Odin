import type { Migration } from "../client";

const migration: Migration = {
  version: 71,
  up: async (db) => {
    const legacyCategoryGroups = await db.getFirstAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'category_groups'",
    );
    const legacyCategoryGroupId = await db.getFirstAsync<{ name: string }>(
      "SELECT name FROM pragma_table_info('categories') WHERE name = 'category_group_id'",
    );

    if (!legacyCategoryGroups || !legacyCategoryGroupId) return;

    await db.execAsync(`
      PRAGMA foreign_keys = OFF;

      CREATE TABLE categories_without_groups (
        id text primary key,
        user_id text not null,
        slug text not null,
        label text not null,
        short_label text,
        description text not null,
        is_system integer not null default 1,
        is_filipino_context integer not null default 0,
        sort_order integer not null default 0,
        is_active integer not null default 1,
        metadata text not null default '{}',
        version integer not null default 1,
        deleted integer not null default 0,
        created_at text not null,
        updated_at text not null,
        last_synced_at text,
        minimum_amount_centavos integer,
        always_in_budget integer not null default 0,
        fixed_amount_centavos integer
      );

      INSERT INTO categories_without_groups (
        id, user_id, slug, label, short_label, description, is_system,
        is_filipino_context, sort_order, is_active, metadata, version,
        deleted, created_at, updated_at, last_synced_at,
        minimum_amount_centavos, always_in_budget, fixed_amount_centavos
      )
      SELECT
        id, user_id, slug, label, short_label, description, is_system,
        is_filipino_context, sort_order, is_active, metadata, version,
        deleted, created_at, updated_at, last_synced_at,
        minimum_amount_centavos, always_in_budget, fixed_amount_centavos
      FROM categories;

      DROP TABLE categories;
      ALTER TABLE categories_without_groups RENAME TO categories;
      DROP TABLE category_groups;
      CREATE INDEX idx_categories_active_sort ON categories (user_id, is_active, sort_order);

      PRAGMA foreign_keys = ON;
    `);
  },
};

export default migration;
