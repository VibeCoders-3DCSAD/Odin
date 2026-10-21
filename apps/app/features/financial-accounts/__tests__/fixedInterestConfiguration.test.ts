import { normalizeSavingsInterestReference } from "@odin/savings-interest";
import { editableInterestReference, interestToday } from "../helpers/savingsInterestConfiguration";
import { buildSavingsInterestDetails } from "../helpers/savingsAccountInterest";

const draft = () => editableInterestReference(null);
it("saves the fixed configuration with default 20% tax and no legacy direct-credit schedule", () => {
  const saved = buildSavingsInterestDetails(null, "4", draft());
  expect(saved.interestReference).toMatchObject({ rateStructure: "fixed", configuration: { withholdingTaxBps: 2000, taxEnabled: true, startsOn: interestToday(), rateHistory: [{ effectiveOn: interestToday(), rateBps: 400 }] } });
  expect(saved.interestReference?.schedule).toBeUndefined();
  expect(() => normalizeSavingsInterestReference({ ...draft(), schedule: { startsOn: interestToday(), frequency: "daily", withholdingTaxBps: 0, tiers: [] } })).toThrow("legacy");
});
it("None stores zero and disables projections without discarding saved rate history", () => {
  const reference = draft();
  reference.method = "none";
  reference.configuration.autoProject = false;
  expect(buildSavingsInterestDetails(null, "4", reference).interestRateBps).toBe(0);
  expect(normalizeSavingsInterestReference({ ...reference, configuration: { ...reference.configuration, autoProject: true } })?.configuration?.autoProject).toBe(false);
});
it("requires a starting balance when backdating and validates custom intervals", () => {
  const reference = draft();
  reference.configuration.startsOn = "2020-01-01";
  expect(() => buildSavingsInterestDetails(null, "4", reference)).toThrow("starting balance");
  reference.configuration.startingBalanceCentavos = 100000;
  expect(buildSavingsInterestDetails(null, "4", reference).interestRateBps).toBe(400);
  reference.configuration.creditFrequency = "custom";
  expect(() => buildSavingsInterestDetails(null, "4", reference)).toThrow("custom credit interval");
  reference.configuration.creditIntervalDays = 14;
  expect(() => buildSavingsInterestDetails(null, "4", reference)).not.toThrow();
});
it.each([
  { withholdingTaxBps: 10001 }, { creditIntervalDays: 0 }, { startsOn: "2026-02-30" },
  { minimumQualifyingBalanceCentavos: 10000, maximumInterestBearingBalanceCentavos: 9999 },
  { postingMode: "specific_date", postingDate: null }, { arbitrary: true },
])("rejects invalid fixed configuration %j", (changes) => {
  const reference = draft();
  expect(() => normalizeSavingsInterestReference({ ...reference, configuration: { ...reference.configuration, ...changes } })).toThrow();
});
it("preserves saved rate history and rejects overwriting an earlier rate", () => {
  const saved = buildSavingsInterestDetails(null, "4", draft());
  const reference = editableInterestReference(saved.interestReference ?? null);
  reference.configuration = { ...reference.configuration, rateHistory: [{ effectiveOn: interestToday(), rateBps: 500 }] };
  expect(() => buildSavingsInterestDetails(saved, "4", reference)).toThrow("Preserve saved rate history");
});

it("disables automatic projections from older saved configuration and incoming payloads", () => {
  const legacy = draft();
  legacy.configuration.autoProject = true;
  expect(editableInterestReference(legacy).configuration.autoProject).toBe(false);
  expect(buildSavingsInterestDetails(null, "4", legacy).interestReference?.configuration?.autoProject).toBe(false);
});
