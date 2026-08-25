import type { Migration } from "../client";
import singleBudgetMigration from "./017_single_budget";

const migration: Migration = {
  version: 20,
  up: async (db) => {
    const columns = await db.getAllAsync<{ name: string }>("PRAGMA table_info(budgets)");
    if (!columns.some((column) => column.name === "debt_budget_amount_minor")) {
      await db.execAsync("ALTER TABLE budgets ADD COLUMN debt_budget_amount_minor integer NOT NULL DEFAULT 0;");
    }
    await singleBudgetMigration.up(db);
  },
};

export default migration;
