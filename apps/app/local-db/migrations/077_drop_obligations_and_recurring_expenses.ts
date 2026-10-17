import type { Migration } from "../client";

// Billers and Remittances replace financial obligations and standalone recurring expenses.
// Recurring templates stay only as the automation behind income sources.
const migration: Migration = {
  version: 77,
  up: async (db) => {
    await db.execAsync(`
      UPDATE sync_queue
         SET status = 'discarded',
             discarded_at = CURRENT_TIMESTAMP,
             last_error = 'Discarded because financial obligations were removed.'
       WHERE entity = 'financial_obligations'
         AND status IN ('pending', 'failed');
      DROP TABLE IF EXISTS financial_obligations;
      UPDATE sync_queue
         SET status = 'discarded',
             discarded_at = CURRENT_TIMESTAMP,
             last_error = 'Discarded because recurring expenses were removed.'
       WHERE status IN ('pending', 'failed')
         AND ((entity = 'recurring_transaction_templates' AND record_id NOT IN (SELECT recurring_template_id FROM income_sources WHERE recurring_template_id IS NOT NULL))
           OR (entity = 'recurring_transaction_occurrences' AND record_id IN (
             SELECT o.id FROM recurring_transaction_occurrences o
              WHERE o.recurring_template_id NOT IN (SELECT recurring_template_id FROM income_sources WHERE recurring_template_id IS NOT NULL))));
      DELETE FROM recurring_transaction_occurrences
       WHERE recurring_template_id NOT IN (SELECT recurring_template_id FROM income_sources WHERE recurring_template_id IS NOT NULL);
      DELETE FROM recurring_transaction_templates
       WHERE id NOT IN (SELECT recurring_template_id FROM income_sources WHERE recurring_template_id IS NOT NULL);
    `);
  },
};

export default migration;
