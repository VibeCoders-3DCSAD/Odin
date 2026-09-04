import type { Migration } from "../client";

const migration: Migration = {
  version: 28,
  up: async (db) => {
    await db.execAsync(`
      ALTER TABLE credit_card_transactions ADD COLUMN client_mutation_id text;
      ALTER TABLE credit_card_payments ADD COLUMN client_mutation_id text;
      ALTER TABLE credit_card_credit_applications ADD COLUMN client_mutation_id text;
      ALTER TABLE credit_card_transactions ADD COLUMN applied_credit_centavos integer NOT NULL DEFAULT 0;
      CREATE UNIQUE INDEX credit_card_transactions_mutation_idx ON credit_card_transactions(user_id, client_mutation_id) WHERE client_mutation_id IS NOT NULL;
      CREATE UNIQUE INDEX credit_card_payments_mutation_idx ON credit_card_payments(user_id, client_mutation_id) WHERE client_mutation_id IS NOT NULL;
      CREATE UNIQUE INDEX credit_card_applications_mutation_idx ON credit_card_credit_applications(user_id, client_mutation_id) WHERE client_mutation_id IS NOT NULL;
    `);
  },
};

export default migration;
