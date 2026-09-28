import type { Migration } from "../client";

const migration: Migration = {
  version: 61,
  up: async (db) => {
    await db.execAsync(`
      DELETE FROM transaction_line_items
      WHERE subcategory_id IN (
        SELECT subcategories.id
        FROM subcategories
        JOIN categories ON categories.id = subcategories.category_id
        JOIN category_groups ON category_groups.id = categories.category_group_id
        WHERE category_groups.slug IN ('essentials', 'obligatory', 'discretionary', 'financial_allocation')
      );

      DELETE FROM transactions
      WHERE subcategory_id IN (
        SELECT subcategories.id
        FROM subcategories
        JOIN categories ON categories.id = subcategories.category_id
        JOIN category_groups ON category_groups.id = categories.category_group_id
        WHERE category_groups.slug IN ('essentials', 'obligatory', 'discretionary', 'financial_allocation')
      );

      DELETE FROM transaction_templates
      WHERE subcategory_id IN (
        SELECT subcategories.id
        FROM subcategories
        JOIN categories ON categories.id = subcategories.category_id
        JOIN category_groups ON category_groups.id = categories.category_group_id
        WHERE category_groups.slug IN ('essentials', 'obligatory', 'discretionary', 'financial_allocation')
      );

      DELETE FROM recurring_transaction_occurrences
      WHERE recurring_template_id IN (
        SELECT recurring_transaction_templates.id
        FROM recurring_transaction_templates
        JOIN subcategories ON subcategories.id = recurring_transaction_templates.subcategory_id
        JOIN categories ON categories.id = subcategories.category_id
        JOIN category_groups ON category_groups.id = categories.category_group_id
        WHERE category_groups.slug IN ('essentials', 'obligatory', 'discretionary', 'financial_allocation')
      );

      DELETE FROM recurring_transaction_templates
      WHERE subcategory_id IN (
        SELECT subcategories.id
        FROM subcategories
        JOIN categories ON categories.id = subcategories.category_id
        JOIN category_groups ON category_groups.id = categories.category_group_id
        WHERE category_groups.slug IN ('essentials', 'obligatory', 'discretionary', 'financial_allocation')
      );

      DELETE FROM financial_obligations
      WHERE subcategory_id IN (
        SELECT subcategories.id
        FROM subcategories
        JOIN categories ON categories.id = subcategories.category_id
        JOIN category_groups ON category_groups.id = categories.category_group_id
        WHERE category_groups.slug IN ('essentials', 'obligatory', 'discretionary', 'financial_allocation')
      );

      DELETE FROM income_sources
      WHERE subcategory_id IN (
        SELECT subcategories.id
        FROM subcategories
        JOIN categories ON categories.id = subcategories.category_id
        JOIN category_groups ON category_groups.id = categories.category_group_id
        WHERE category_groups.slug IN ('essentials', 'obligatory', 'discretionary', 'financial_allocation')
      );

      DELETE FROM budget_allocations
      WHERE category_id IN (
        SELECT categories.id
        FROM categories
        JOIN category_groups ON category_groups.id = categories.category_group_id
        WHERE category_groups.slug IN ('essentials', 'obligatory', 'discretionary', 'financial_allocation')
      ) OR subcategory_id IN (
        SELECT subcategories.id
        FROM subcategories
        JOIN categories ON categories.id = subcategories.category_id
        JOIN category_groups ON category_groups.id = categories.category_group_id
        WHERE category_groups.slug IN ('essentials', 'obligatory', 'discretionary', 'financial_allocation')
      );

      DELETE FROM anomaly_whitelist_rules
      WHERE subcategory_id IN (
        SELECT subcategories.id
        FROM subcategories
        JOIN categories ON categories.id = subcategories.category_id
        JOIN category_groups ON category_groups.id = categories.category_group_id
        WHERE category_groups.slug IN ('essentials', 'obligatory', 'discretionary', 'financial_allocation')
      );

      DELETE FROM alert_suppression_rules
      WHERE category_id IN (
        SELECT categories.id
        FROM categories
        JOIN category_groups ON category_groups.id = categories.category_group_id
        WHERE category_groups.slug IN ('essentials', 'obligatory', 'discretionary', 'financial_allocation')
      ) OR subcategory_id IN (
        SELECT subcategories.id
        FROM subcategories
        JOIN categories ON categories.id = subcategories.category_id
        JOIN category_groups ON category_groups.id = categories.category_group_id
        WHERE category_groups.slug IN ('essentials', 'obligatory', 'discretionary', 'financial_allocation')
      );

      DELETE FROM subcategories
      WHERE category_id IN (
        SELECT categories.id
        FROM categories
        JOIN category_groups ON category_groups.id = categories.category_group_id
        WHERE category_groups.slug IN ('essentials', 'obligatory', 'discretionary', 'financial_allocation')
      );

      DELETE FROM categories
      WHERE category_group_id IN (
        SELECT id FROM category_groups
        WHERE slug IN ('essentials', 'obligatory', 'discretionary', 'financial_allocation')
      );

      DELETE FROM category_groups
      WHERE slug IN ('essentials', 'obligatory', 'discretionary', 'financial_allocation');
    `);
  },
};

export default migration;
