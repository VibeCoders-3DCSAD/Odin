import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import m054 from "../../../migrations/054_savings_account_details";
import m055 from "../../../migrations/055_add_hysa_eligibility";
import m057 from "../../../migrations/057_savings_account_contribution_schedule";
import m058 from "../../../migrations/058_hysa_yield_inputs";
import m085 from "../../../migrations/085_savings_interest_reference";
import { editableInterestReference } from "../../../../features/financial-accounts/helpers/savingsInterestConfiguration";
import { buildSavingsInterestDetails } from "../../../../features/financial-accounts/helpers/savingsAccountInterest";
import { getSavingsAccountDetails, upsertSavingsAccountDetails } from "../savingsAccountDetails";

let mockSqlite: DatabaseSync;
const mockDb = {
  execAsync: async (sql: string) => { mockSqlite.exec(sql); },
  runAsync: async (sql: string, ...args: SQLInputValue[]) => mockSqlite.prepare(sql).run(...args),
  getFirstAsync: async (sql: string, ...args: SQLInputValue[]) => mockSqlite.prepare(sql).get(...args) ?? null,
  withTransactionAsync: async (callback: () => Promise<void>) => {
    mockSqlite.exec("BEGIN");
    try { await callback(); mockSqlite.exec("COMMIT"); } catch (error) { mockSqlite.exec("ROLLBACK"); throw error; }
  },
};
jest.mock("../../../client", () => ({ initDatabase: async () => mockDb }));

beforeEach(async () => {
  mockSqlite = new DatabaseSync(":memory:");
  mockSqlite.exec(`
    CREATE TABLE financial_accounts (id text PRIMARY KEY, user_id text, kind text, deleted integer DEFAULT 0, opened_on text, created_at text, updated_at text);
    CREATE TABLE sync_queue (operation_id text, user_id text, device_id text, entity text, record_id text, operation_type text, base_version integer, changed_fields text, payload text, failure_message text, status text, attempts integer, last_error text, created_at text);
  `);
  for (const migration of [m054, m055, m057, m058, m085]) await migration.up(mockDb as never);
  mockSqlite.exec("INSERT INTO financial_accounts (id,user_id,kind) VALUES ('savings-1','user-1','savings')");
});
afterEach(() => mockSqlite.close());

it("round trips annual rate and advanced options through SQLite and the sync queue", async () => {
  const reference = { balanceBasis: "daily_balance" as const, method: "compound" as const, rateStructure: "tiered" as const, notes: "Bank rules" };
  const created = await upsertSavingsAccountDetails("user-1", "device-1", "savings-1", buildSavingsInterestDetails(null, "4.25", reference));
  expect(created.details).toMatchObject({ interestRateBps: 425, interestReference: reference, version: 1 });
  expect(created.operation.payload.interest_reference).toEqual(reference);
  expect(await getSavingsAccountDetails("user-2", "savings-1")).toBeNull();
  const updated = await upsertSavingsAccountDetails("user-1", "device-1", "savings-1", buildSavingsInterestDetails(created.details, "", null));
  expect(updated.details).toMatchObject({ interestRateBps: null, interestReference: null, version: 2 });
  expect(updated.operation.changed_fields).toContain("interest_reference");
  expect(updated.operation.payload.interest_reference).toBeNull();
});

it("preserves saved legacy rules and contribution dates when editing the simplified form", async () => {
  const original = buildSavingsInterestDetails(null, "3", null);
  const saved = { ...original, accountType: "high_yield_savings" as const, interestRateBps: null, baseInterestRateBps: 300, interestCalculationBasis: "daily_ending_balance" as const, interestCreditFrequency: "monthly" as const, minimumBalanceCentavos: 50000, boostedInterestRateBps: 500, interestConditions: "Bank conditions", plannedContributionAmountCentavos: 10000, contributionFrequency: "monthly" as const, contributionDayOfMonth: 15, nextContributionDate: "2027-01-15" };
  await upsertSavingsAccountDetails("user-1", "device-1", "savings-1", saved);
  const edited = buildSavingsInterestDetails((await getSavingsAccountDetails("user-1", "savings-1"))!, "4", { balanceBasis: "average_daily_balance", method: "simple", rateStructure: "fixed", notes: null });
  const result = await upsertSavingsAccountDetails("user-1", "device-1", "savings-1", edited);
  expect(result.details).toMatchObject({ ...saved, baseInterestRateBps: 400, interestReference: edited.interestReference });
  expect(result.details.interestReference?.balanceBasis).toBe("average_daily_balance");
});

it("round trips a scheduled credit configuration without changing its rates, tiers or tax", async () => {
  const interestReference = { balanceBasis: "average_daily_balance" as const, method: "compound" as const, rateStructure: "tiered" as const, notes: null,
    schedule: { startsOn: "2026-10-21", frequency: "quarterly" as const, withholdingTaxBps: 2000, tiers: [{ minimumBalanceCentavos: 0, interestRateBps: 300 }, { minimumBalanceCentavos: 1000000, interestRateBps: 425 }] } };
  const result = await upsertSavingsAccountDetails("user-1", "device-1", "savings-1", buildSavingsInterestDetails(null, "3", interestReference));
  expect(result.operation.payload.interest_reference).toEqual(interestReference);
  expect((await getSavingsAccountDetails("user-1", "savings-1"))?.interestReference).toEqual(interestReference);
});

it("round trips the fixed form configuration and keeps the legacy worker disabled", async () => {
  const reference = editableInterestReference(null);
  reference.configuration.creditFrequency = "custom";
  reference.configuration.creditIntervalDays = 14;
  const created = await upsertSavingsAccountDetails("user-1", "device-1", "savings-1", buildSavingsInterestDetails(null, "4", reference));
  const reloaded = await getSavingsAccountDetails("user-1", "savings-1");
  expect(reloaded?.interestReference).toEqual(created.details.interestReference);
  expect(reloaded?.interestReference?.configuration).toMatchObject({ withholdingTaxBps: 2000, creditFrequency: "custom", creditIntervalDays: 14 });
  expect(reloaded?.interestReference?.schedule).toBeUndefined();
  expect(created.operation.payload.interest_reference).toEqual(reloaded?.interestReference);
});
