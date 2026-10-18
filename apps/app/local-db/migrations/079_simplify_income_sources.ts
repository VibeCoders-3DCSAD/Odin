import type { Migration } from "../client";

// Income is paid monthly, twice a month, every week or every day, at one expected amount.
// Sources that do not fit are deleted with their templates, and variable-income columns are dropped.
const migration: Migration = {
  version: 79,
  up: async (db) => {
    await db.execAsync(`
      CREATE TEMP TABLE retired_income_sources AS
      SELECT id, recurring_template_id FROM income_sources
       WHERE deleted = 1
          OR income_type <> 'stable'
          OR frequency NOT IN ('weekly', 'semi_monthly', 'monthly')
          OR expected_amount_centavos IS NULL OR expected_amount_centavos <= 0
          OR (frequency = 'weekly' AND payday_day_of_week IS NULL)
          OR (frequency = 'monthly' AND payday_day_of_month IS NULL)
          OR (frequency = 'semi_monthly' AND (payday_day_of_month IS NULL OR payday_second_day_of_month IS NULL
              OR payday_day_of_month >= MIN(payday_second_day_of_month, 28)));
      UPDATE sync_queue
         SET status = 'discarded',
             discarded_at = CURRENT_TIMESTAMP,
             last_error = 'Discarded because this income schedule was removed.'
       WHERE status IN ('pending', 'failed')
         AND ((entity = 'income_sources' AND (record_id IN (SELECT id FROM retired_income_sources)
               OR json_type(payload, '$.income_type') IS NOT NULL
               OR json_type(payload, '$.min_amount_centavos') IS NOT NULL
               OR json_type(payload, '$.max_amount_centavos') IS NOT NULL
               OR json_type(payload, '$.estimated_interval_days') IS NOT NULL
               OR json_type(payload, '$.payday_second_day_of_week') IS NOT NULL))
           OR (entity = 'recurring_transaction_templates' AND record_id IN (SELECT recurring_template_id FROM retired_income_sources))
           OR (entity = 'recurring_transaction_occurrences' AND record_id IN (
             SELECT o.id FROM recurring_transaction_occurrences o
              WHERE o.recurring_template_id IN (SELECT recurring_template_id FROM retired_income_sources))));
      DELETE FROM recurring_transaction_occurrences
       WHERE recurring_template_id IN (SELECT recurring_template_id FROM retired_income_sources);
      DELETE FROM recurring_transaction_templates
       WHERE id IN (SELECT recurring_template_id FROM retired_income_sources);
      DELETE FROM income_sources WHERE id IN (SELECT id FROM retired_income_sources);
      DROP TABLE retired_income_sources;
      ALTER TABLE income_sources DROP COLUMN income_type;
      ALTER TABLE income_sources DROP COLUMN min_amount_centavos;
      ALTER TABLE income_sources DROP COLUMN max_amount_centavos;
      ALTER TABLE income_sources DROP COLUMN estimated_interval_days;
      ALTER TABLE income_sources DROP COLUMN payday_second_day_of_week;
    `);
  },
};

export default migration;
