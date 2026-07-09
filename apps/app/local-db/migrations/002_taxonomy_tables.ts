import type { Migration } from "../client";

const migration: Migration = {
  version: 2,
  up: async (db) => {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS category_groups (
        id text primary key,
        user_id text not null,
        slug text not null,
        label text not null,
        short_label text,
        description text not null,
        sort_order integer not null default 0,
        is_active integer not null default 1,
        metadata text not null default '{}',
        version integer not null default 1,
        deleted integer not null default 0,
        created_at text not null,
        updated_at text not null,
        last_synced_at text
      );
    `);

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS categories (
        id text primary key,
        user_id text not null,
        category_group_id text not null references category_groups(id),
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
        last_synced_at text
      );
    `);

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS subcategories (
        id text primary key,
        user_id text not null,
        category_id text references categories(id),
        slug text not null,
        kind text not null default 'expense',
        label text not null,
        short_label text,
        description text not null,
        is_system integer not null default 1,
        is_filipino_context integer not null default 0,
        is_protected integer not null default 0,
        sort_order integer not null default 0,
        is_active integer not null default 1,
        metadata text not null default '{}',
        version integer not null default 1,
        deleted integer not null default 0,
        created_at text not null,
        updated_at text not null,
        last_synced_at text
      );
    `);

    await db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_categories_group
        ON categories (category_group_id, is_active, sort_order);
    `);

    await db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_subcategories_category
        ON subcategories (category_id, kind, sort_order);
    `);
  },
};

export default migration;
