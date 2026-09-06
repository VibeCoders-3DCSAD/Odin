import type { Migration } from "../client";

const migration: Migration = {
  version: 33,
  up: async (db) => {
    // 024 originally created default_cutoff_date / default_statement_date as
    // full dates; they were corrected to recurring cutoff_day / statement_day.
    // Rename in place on databases that already applied the old 024 and convert
    // any stored dates to the day-of-month they represent. Fresh installs
    // (edited 024) already have the new columns and skip this branch.
    const cols = await db.getAllAsync<{ name: string }>(
      "PRAGMA table_info(credit_card_details)",
    );
    const names = new Set(cols.map((c) => c.name));
    const renames: Array<[string, string]> = [
      ["default_cutoff_date", "cutoff_day"],
      ["default_statement_date", "statement_day"],
    ];
    const active = renames.filter(([from]) => names.has(from));
    if (active.length === 0) return;
    await db.execAsync(
      active
        .map(([from, to]) => `ALTER TABLE credit_card_details RENAME COLUMN ${from} TO ${to}`)
        .join("; "),
    );
    await db.execAsync(`
      UPDATE credit_card_details SET cutoff_day = CAST(substr(cutoff_day, 9, 2) AS INTEGER)
        WHERE cutoff_day GLOB '????-??-??';
      UPDATE credit_card_details SET statement_day = CAST(substr(statement_day, 9, 2) AS INTEGER)
        WHERE statement_day GLOB '????-??-??';
    `);
  },
};

export default migration;