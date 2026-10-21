import { normalizeSavingsInterestReference, validateScheduledInterest } from "@odin/savings-interest";
import { buildSavingsInterestDetails } from "../helpers/savingsAccountInterest";

const reference = {
  balanceBasis: "daily_balance" as const, method: "compound" as const, rateStructure: "fixed" as const, notes: null,
  schedule: { startsOn: "2026-10-21", frequency: "monthly" as const, withholdingTaxBps: 2000, tiers: [] },
};
it("keeps legacy reference-only shapes unchanged and distinguishes none", () => {
  expect(normalizeSavingsInterestReference({ method: "none" })).toEqual({ balanceBasis: null, method: "none", rateStructure: null, notes: null });
  expect(normalizeSavingsInterestReference(null)).toBeNull();
});
it("validates and preserves a configured schedule", () => {
  expect(buildSavingsInterestDetails(null, "4.25", reference)).toMatchObject({ interestRateBps: 425, interestReference: reference });
  expect(() => buildSavingsInterestDetails(null, "", reference)).toThrow("annual rate");
  expect(() => buildSavingsInterestDetails(null, "1001", reference)).toThrow("annual rate");
});
it.each(["2026-02-30", "2025-02-29", "21-10-2026", "1999-12-31"])("rejects invalid start date %s", (startsOn) => {
  expect(() => normalizeSavingsInterestReference({ ...reference, schedule: { ...reference.schedule, startsOn } })).toThrow("start date");
});
it.each([null, "none"])("does not enable credits with method %s", (method) => {
  expect(() => normalizeSavingsInterestReference({ ...reference, method })).toThrow("Choose a balance basis");
});
it("rejects tiers without a zero threshold, duplicate thresholds and missing rates", () => {
  const tiered = { ...reference, rateStructure: "tiered" as const };
  expect(() => normalizeSavingsInterestReference(tiered)).toThrow("thresholds");
  for (const tiers of [[{ minimumBalanceCentavos: 1, interestRateBps: 300 }], [{ minimumBalanceCentavos: 0, interestRateBps: 300 }, { minimumBalanceCentavos: 0, interestRateBps: 400 }]]) {
    expect(() => normalizeSavingsInterestReference({ ...tiered, schedule: { ...reference.schedule, tiers } })).toThrow("tiers");
  }
  expect(() => validateScheduledInterest({ ...tiered, schedule: { ...reference.schedule, tiers: [{ minimumBalanceCentavos: 0, interestRateBps: 300 }] } }, 300)).not.toThrow();
});
it.each([-1, 10001, NaN, 20.5])("rejects invalid tax %s", (withholdingTaxBps) => {
  expect(() => normalizeSavingsInterestReference({ ...reference, schedule: { ...reference.schedule, withholdingTaxBps } })).toThrow("Withholding");
});
