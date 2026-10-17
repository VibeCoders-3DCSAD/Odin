import type { Migration } from "../client";

// Billers and Remittances: scheduled payments and the payments recorded against each occurrence.
const migration: Migration = {
  version: 78,
  up: async (db) => {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS scheduled_payments (
        id text primary key,
        user_id text not null,
        name text not null,
        subcategory_id text not null,
        source_account_id text not null,
        amount_centavos integer not null,
        frequency text not null,
        due_day_of_month integer,
        due_second_day_of_month integer,
        due_day_of_week integer,
        due_month integer,
        starts_on text not null,
        ends_on text,
        auto_post integer not null default 0,
        auto_post_from text,
        is_family_support integer not null default 0,
        is_dependent_support integer not null default 0,
        protected_by_default integer not null default 1,
        notes text,
        status text not null default 'active',
        version integer not null default 1,
        deleted integer not null default 0,
        created_at text not null,
        updated_at text not null,
        last_synced_at text
      );
      CREATE INDEX IF NOT EXISTS idx_scheduled_payments_user ON scheduled_payments (user_id, deleted, status);
      CREATE TABLE IF NOT EXISTS scheduled_payment_records (
        id text primary key,
        user_id text not null,
        scheduled_payment_id text not null,
        transaction_id text not null,
        occurrence_date text not null,
        payment_date text not null,
        amount_centavos integer not null,
        source text not null default 'manual',
        notes text,
        version integer not null default 1,
        deleted integer not null default 0,
        created_at text not null,
        updated_at text not null,
        last_synced_at text
      );
      CREATE INDEX IF NOT EXISTS idx_scheduled_payment_records_occurrence
        ON scheduled_payment_records (user_id, scheduled_payment_id, occurrence_date) WHERE deleted = 0;
      CREATE INDEX IF NOT EXISTS idx_scheduled_payment_records_transaction
        ON scheduled_payment_records (user_id, transaction_id) WHERE deleted = 0;
    `);
  },
};

export default migration;
