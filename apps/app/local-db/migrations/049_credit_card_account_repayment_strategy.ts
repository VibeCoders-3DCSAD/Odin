import type { Migration } from "../client";

const migration: Migration = {
  version: 49,
  up: async (db) => {
    await db.execAsync(`
      ALTER TABLE credit_card_details ADD COLUMN repayment_strategy text;
      ALTER TABLE credit_card_details ADD COLUMN repayment_custom_amount_centavos integer;
      ALTER TABLE credit_card_details ADD COLUMN repayment_percentage_bps integer;

      UPDATE credit_card_details
         SET repayment_strategy = (
               SELECT strategy.strategy
                 FROM credit_card_statement_strategies strategy
                 JOIN credit_card_statements statement ON statement.id = strategy.statement_id
                 JOIN credit_card_cycles cycle ON cycle.id = statement.cycle_id
                WHERE strategy.user_id = credit_card_details.user_id
                  AND cycle.account_id = credit_card_details.account_id
                  AND strategy.deleted = 0
                  AND statement.deleted = 0
                  AND cycle.deleted = 0
                ORDER BY statement.due_date DESC
                LIMIT 1
             ),
             repayment_custom_amount_centavos = (
               SELECT strategy.custom_amount_centavos
                 FROM credit_card_statement_strategies strategy
                 JOIN credit_card_statements statement ON statement.id = strategy.statement_id
                 JOIN credit_card_cycles cycle ON cycle.id = statement.cycle_id
                WHERE strategy.user_id = credit_card_details.user_id
                  AND cycle.account_id = credit_card_details.account_id
                  AND strategy.deleted = 0
                  AND statement.deleted = 0
                  AND cycle.deleted = 0
                ORDER BY statement.due_date DESC
                LIMIT 1
             ),
             repayment_percentage_bps = (
               SELECT strategy.percentage_bps
                 FROM credit_card_statement_strategies strategy
                 JOIN credit_card_statements statement ON statement.id = strategy.statement_id
                 JOIN credit_card_cycles cycle ON cycle.id = statement.cycle_id
                WHERE strategy.user_id = credit_card_details.user_id
                  AND cycle.account_id = credit_card_details.account_id
                  AND strategy.deleted = 0
                  AND statement.deleted = 0
                  AND cycle.deleted = 0
                ORDER BY statement.due_date DESC
                LIMIT 1
             )
       WHERE EXISTS (
               SELECT 1
                 FROM credit_card_statement_strategies strategy
                 JOIN credit_card_statements statement ON statement.id = strategy.statement_id
                 JOIN credit_card_cycles cycle ON cycle.id = statement.cycle_id
                WHERE strategy.user_id = credit_card_details.user_id
                  AND cycle.account_id = credit_card_details.account_id
                  AND strategy.deleted = 0
                  AND statement.deleted = 0
                  AND cycle.deleted = 0
             );
    `);
  },
};

export default migration;
