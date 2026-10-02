import { getCurrentSavingsEnvelopeAllocation } from "../savingsEnvelopeAllocationQueries";

const mockGetAcceptedFinancialPlanForPeriod = jest.fn();
const mockGetSavingsAllocationStrategy = jest.fn();
const mockListSavingsGoals = jest.fn();

jest.mock("../../../local-db/repositories/financialPlans", () => ({
  getAcceptedFinancialPlanForPeriod: (...args: unknown[]) => mockGetAcceptedFinancialPlanForPeriod(...args),
  getNextFinancialPlanPeriod: () => ({ start: "2026-11-01", end: "2026-11-30" }),
}));
jest.mock("../../../local-db/repositories/savingsAllocationPreferences", () => ({
  getSavingsAllocationStrategy: (...args: unknown[]) => mockGetSavingsAllocationStrategy(...args),
}));
jest.mock("../../../local-db/repositories/savingsGoals", () => ({
  listSavingsGoals: (...args: unknown[]) => mockListSavingsGoals(...args),
}));
jest.mock("../requiredSavingsContributionQueries", () => ({
  getRequiredSavingsContributionsForPeriod: jest.fn().mockResolvedValue({
    contributions: [{ source: "goal", savingsId: "goal-1", configuredMinimumCentavos: 800_000, recordedContributionCentavos: 0 }],
  }),
}));

describe("getCurrentSavingsEnvelopeAllocation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSavingsAllocationStrategy.mockResolvedValue("avalanche");
    mockListSavingsGoals.mockResolvedValue([{
      id: "goal-1",
      name: "Emergency fund",
      goalCategory: "emergency_fund",
      status: "active",
      isAchieved: false,
      targetDate: "2026-12-01",
      remainingAmountCentavos: 100_000_00,
      contributionFrequency: "monthly",
      nextContributionDate: "2026-11-15",
    }]);
    mockGetAcceptedFinancialPlanForPeriod.mockResolvedValue({
      periodStart: "2026-11-01",
      periodEnd: "2026-11-30",
      recommendation: {
        savingsReservations: [{ savingsGoalId: "goal-1", amountCentavos: 800_000 }],
        savingsSurplusCentavos: 4_000_000,
      },
    });
  });

  it("includes Financial Plan savings surplus with goal reservations", async () => {
    const allocation = await getCurrentSavingsEnvelopeAllocation("user-1", "2026-10-01");

    expect(allocation).toMatchObject({ envelopeCentavos: 4_800_000, proposals: [expect.objectContaining({ id: "goal-1", proposedTotalCentavos: 4_800_000 })] });
  });

  it("uses the selected strategy for surplus after reservations", async () => {
    mockGetSavingsAllocationStrategy.mockResolvedValue("snowball");
    mockListSavingsGoals.mockResolvedValue([
      { id: "goal-1", name: "Long-term", goalCategory: "custom", status: "active", isAchieved: false, targetDate: null, remainingAmountCentavos: 10_000_000, contributionFrequency: "monthly", nextContributionDate: "2026-11-15" },
      { id: "goal-2", name: "Short-term", goalCategory: "custom", status: "active", isAchieved: false, targetDate: null, remainingAmountCentavos: 5_000_000, contributionFrequency: "monthly", nextContributionDate: "2026-11-15" },
    ]);
    mockGetAcceptedFinancialPlanForPeriod.mockResolvedValue({
      periodStart: "2026-11-01",
      periodEnd: "2026-11-30",
      recommendation: { savingsReservations: [], savingsSurplusCentavos: 4_000_000 },
    });

    const allocation = await getCurrentSavingsEnvelopeAllocation("user-1", "2026-10-01");

    expect(allocation?.proposals.find((proposal) => proposal.id === "goal-2")).toMatchObject({ proposedTotalCentavos: 3_200_000 });
    expect(allocation?.proposals.find((proposal) => proposal.id === "goal-1")).toMatchObject({ proposedTotalCentavos: 800_000 });
  });
});
