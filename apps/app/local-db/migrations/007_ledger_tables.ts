import type { Migration } from "../client";

const migration: Migration = {
  version: 7,
  up: async (db) => {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS transactions (
        id text primary key,
        user_id text not null,
        transaction_type text not null,
        status text not null default 'posted',
        entry_source text not null default 'manual',
        transaction_date text not null,
        posted_at text,
        amount_centavos integer not null,
        subcategory_id text,
        source_account_id text,
        destination_account_id text,
        recurring_template_id text,
        merchant_name text,
        counterparty_name text,
        notes text,
        client_mutation_id text,
        metadata text not null default '{}',
        version integer not null default 1,
        deleted integer not null default 0,
        created_at text not null,
        updated_at text not null,
        last_synced_at text
      );
    `);

    await db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_transactions_user_date
        ON transactions (user_id, transaction_date desc, created_at desc);
    `);

    await db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_transactions_user_type_status
        ON transactions (user_id, transaction_type, status, transaction_date desc);
    `);

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS transaction_line_items (
        id text primary key,
        transaction_id text not null,
        user_id text not null,
        subcategory_id text not null,
        item_label text not null,
        quantity text,
        amount_centavos integer not null,
        notes text,
        sort_order integer not null default 0,
        metadata text not null default '{}',
        version integer not null default 1,
        deleted integer not null default 0,
        created_at text not null,
        updated_at text not null,
        last_synced_at text
      );
    `);

    await db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_line_items_transaction
        ON transaction_line_items (transaction_id, sort_order);
    `);

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS transaction_templates (
        id text primary key,
        user_id text not null,
        transaction_type text not null,
        status text not null default 'active',
        name text not null,
        amount_centavos integer,
        subcategory_id text,
        source_account_id text,
        destination_account_id text,
        merchant_name text,
        counterparty_name text,
        notes text,
        use_count integer not null default 0,
        last_used_at text,
        metadata text not null default '{}',
        version integer not null default 1,
        deleted integer not null default 0,
        created_at text not null,
        updated_at text not null,
        last_synced_at text
      );
    `);

    await db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_templates_user_status
        ON transaction_templates (user_id, status, last_used_at desc);
    `);

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS transaction_drafts (
        id text primary key,
        user_id text not null,
        client_draft_id text not null,
        status text not null default 'pending',
        payload text not null default '{}',
        captured_offline_at text,
        synced_transaction_id text,
        last_error text,
        metadata text not null default '{}',
        version integer not null default 1,
        deleted integer not null default 0,
        created_at text not null,
        updated_at text not null,
        last_synced_at text
      );
    `);

    await db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_drafts_user_status
        ON transaction_drafts (user_id, status, created_at desc);
    `);

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS recurring_transaction_templates (
        id text primary key,
        user_id text not null,
        transaction_type text not null,
        status text not null default 'active',
        name text not null,
        amount_centavos integer not null,
        subcategory_id text,
        source_account_id text,
        destination_account_id text,
        frequency text not null,
        interval_count integer not null default 1,
        day_of_month integer,
        second_day_of_month integer,
        day_of_week integer,
        custom_rule text not null default '{}',
        starts_on text not null,
        ends_on text,
        next_occurrence_date text,
        last_generated_date text,
        reminder_enabled integer not null default 0,
        reminder_days_before integer not null default 0,
        notes text,
        metadata text not null default '{}',
        version integer not null default 1,
        deleted integer not null default 0,
        created_at text not null,
        updated_at text not null,
        last_synced_at text
      );
    `);

    await db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_recurring_templates_user_status
        ON recurring_transaction_templates (user_id, status, next_occurrence_date);
    `);

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS recurring_transaction_occurrences (
        id text primary key,
        recurring_template_id text not null,
        user_id text not null,
        scheduled_date text not null,
        status text not null default 'scheduled',
        generated_transaction_id text,
        reminder_sent_at text,
        posted_at text,
        skipped_at text,
        failure_reason text,
        metadata text not null default '{}',
        version integer not null default 1,
        deleted integer not null default 0,
        created_at text not null,
        updated_at text not null,
        last_synced_at text
      );
    `);

    await db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_recurring_occurrences_user_status
        ON recurring_transaction_occurrences (user_id, status, scheduled_date);
    `);
  },
};

export default migration;
