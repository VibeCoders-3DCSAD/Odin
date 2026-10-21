import type { Migration } from "../client";

const migration: Migration = {
  version: 84,
  up: async (db) => {
    // Existing goals keep a null link until the user chooses an account.
    await db.execAsync(`
      ALTER TABLE savings_goals ADD COLUMN linked_account_id text REFERENCES financial_accounts(id);
      CREATE INDEX idx_savings_goals_user_account ON savings_goals(user_id, linked_account_id) WHERE deleted = 0;
    `);
  },
};

export default migration;
