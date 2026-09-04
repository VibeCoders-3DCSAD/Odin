jest.mock("expo-sqlite", () => ({}));
import migration from "../026_credit_card_pull_convergence";
import { loadMigrations } from "../../client";

test("pull convergence migration removes the credit mutation trigger", async () => {
  const execAsync = jest.fn().mockResolvedValue(undefined);
  await migration.up({ execAsync } as never);
  expect(execAsync).toHaveBeenCalledWith(expect.stringContaining("DROP TRIGGER IF EXISTS credit_card_purchase_credit_guard"));
});

test("registers every local migration through 030 in order", async () => {
  const migrations = await loadMigrations();
  expect(migrations.map(({ version }) => version)).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
});
