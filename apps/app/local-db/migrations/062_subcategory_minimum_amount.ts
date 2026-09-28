import type { Migration } from "../client";

const migration: Migration = {
  version: 62,
  up: async (db) => {
    await db.execAsync(
      "ALTER TABLE subcategories ADD COLUMN minimum_amount_centavos integer",
    );
  },
};

export default migration;
