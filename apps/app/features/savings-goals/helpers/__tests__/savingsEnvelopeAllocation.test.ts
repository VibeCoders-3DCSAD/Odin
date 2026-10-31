import { allocateSavingsEnvelope } from "../savingsEnvelopeAllocation";

const goals = [
  { id: "fund", name: "Emergency fund", goalCategory: "emergency_fund", targetDate: "2026-12-01", remainingAmountCentavos: 10_000, requiredCentavos: 3_000, recordedContributionCentavos: 0 },
  { id: "holiday", name: "Holiday", goalCategory: "custom", targetDate: "2026-11-01", remainingAmountCentavos: 2_000, requiredCentavos: 1_000, recordedContributionCentavos: 0 },
  { id: "car", name: "Car", goalCategory: "custom", targetDate: "2026-10-01", remainingAmountCentavos: 8_000, requiredCentavos: 4_000, recordedContributionCentavos: 0 },
];

describe("allocateSavingsEnvelope", () => {
  it("funds the Emergency Fund requirement before other goals", () => {
    const result = allocateSavingsEnvelope(4_000, "avalanche", goals);
    expect(result.proposals[0]).toMatchObject({ id: "fund", proposedTotalCentavos: 3_000, state: "funded", reason: "emergency_fund_required" });
    expect(result.proposals.find((goal) => goal.id === "car")).toMatchObject({ proposedTotalCentavos: 1_000, state: "partially_funded" });
  });

  it("keeps Emergency Fund first for surplus after required contributions", () => {
    const result = allocateSavingsEnvelope(10_000, "snowball", goals);
    expect(result.proposals.find((goal) => goal.id === "fund")?.proposedSurplusCentavos).toBe(2_000);
  });

  it("reports unfunded goals and does not allocate a negative envelope", () => {
    const result = allocateSavingsEnvelope(-1, "avalanche", goals);
    expect(result.envelopeCentavos).toBe(0);
    expect(result.shortfallCentavos).toBe(8_000);
    expect(result.proposals.every((goal) => goal.state === "unfunded")).toBe(true);
  });

  it("reserves scheduled savings-account deposits before allocating goal contributions", () => {
    const result = allocateSavingsEnvelope(6_000, "avalanche", [{ ...goals[0]!, requiredCentavos: 3_000 }], 5_000);

    expect(result).toMatchObject({ requiredCentavos: 8_000, accountRequiredCentavos: 5_000, shortfallCentavos: 2_000 });
    expect(result.proposals[0]).toMatchObject({ proposedTotalCentavos: 1_000, state: "partially_funded" });
  });
});
