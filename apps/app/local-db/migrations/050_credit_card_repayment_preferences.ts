import type { Migration } from "../client";

const migration: Migration = {
  version: 50,
  up: async (db) => {
    await db.execAsync(`
      CREATE TABLE credit_card_repayment_preferences (
        account_id text primary key,
        user_id text not null,
        strategy text not null check (strategy in ('pay_in_full', 'pay_minimum', 'percentage_of_statement', 'custom_payment')),
        custom_amount_centavos integer,
        percentage_bps integer,
        version integer not null default 1,
        deleted integer not null default 0,
        created_at text not null,
        updated_at text not null,
        last_synced_at text
      );

      INSERT INTO credit_card_repayment_preferences (
        account_id, user_id, strategy, custom_amount_centavos, percentage_bps,
        version, deleted, created_at, updated_at, last_synced_at
      )
      SELECT account_id, user_id, repayment_strategy,
        repayment_custom_amount_centavos, repayment_percentage_bps,
        1, 0, created_at, updated_at, last_synced_at
      FROM credit_card_details
      WHERE repayment_strategy IS NOT NULL;

      ALTER TABLE credit_card_details DROP COLUMN repayment_strategy;
      ALTER TABLE credit_card_details DROP COLUMN repayment_custom_amount_centavos;
      ALTER TABLE credit_card_details DROP COLUMN repayment_percentage_bps;
    `);
  },
};

export default migration;
