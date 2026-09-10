import type { Migration } from "../client";

const migration: Migration = {
  version: 47,
  up: async (db) => {
    await db.execAsync(`
      UPDATE credit_card_details AS details
         SET available_credit_centavos = MIN(
               details.credit_limit_centavos,
               COALESCE(details.available_credit_centavos, details.credit_limit_centavos) + COALESCE((
                 SELECT SUM(payment.amount_centavos)
                   FROM credit_card_payments AS payment
                   JOIN credit_card_cycles AS cycle
                     ON cycle.id = payment.cycle_id AND cycle.user_id = payment.user_id
                  WHERE payment.user_id = details.user_id AND cycle.account_id = details.account_id
                    AND payment.deleted = 0 AND payment.issuer_recognized = 0
               ), 0)
             ),
             version = version + 1,
             updated_at = datetime('now')
       WHERE details.deleted = 0
         AND EXISTS (
           SELECT 1 FROM financial_accounts AS account
            WHERE account.id = details.account_id AND account.user_id = details.user_id
              AND account.kind = 'credit_card' AND account.deleted = 0
         );
    `);
  },
};

export default migration;
