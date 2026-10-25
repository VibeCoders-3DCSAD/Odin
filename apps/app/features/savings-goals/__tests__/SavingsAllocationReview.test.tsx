import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import SavingsAllocationReview from "../SavingsAllocationReview";

const mockGetCurrentSavingsEnvelopeAllocation = jest.fn();
const mockGetCurrentPlanBudgetRemaining = jest.fn();

jest.mock("../../../local-db/repositories/savingsAllocationPreferences", () => ({
  getSavingsAllocationStrategy: jest.fn().mockResolvedValue("avalanche"),
  saveSavingsAllocationStrategy: jest.fn(),
}));
jest.mock("../savingsEnvelopeAllocationQueries", () => ({
  getCurrentSavingsEnvelopeAllocation: (...args: unknown[]) => mockGetCurrentSavingsEnvelopeAllocation(...args),
  getCurrentPlanBudgetRemaining: (...args: unknown[]) => mockGetCurrentPlanBudgetRemaining(...args),
}));

describe("SavingsAllocationReview", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCurrentSavingsEnvelopeAllocation.mockResolvedValue(null);
    mockGetCurrentPlanBudgetRemaining.mockResolvedValue(null);
  });

  it("identifies Financial Plan reservations and refreshes after sync", async () => {
    const view = render(<SavingsAllocationReview userId="user-1" deviceId="device-1" syncVersion={0} />);

    await waitFor(() => expect(view.getByText("Financial Plan for savings")).toBeTruthy());
    view.rerender(<SavingsAllocationReview userId="user-1" deviceId="device-1" syncVersion={1} />);

    await waitFor(() => expect(mockGetCurrentSavingsEnvelopeAllocation).toHaveBeenCalledTimes(2));
  });

  it("shows this month's budget remaining and the savings left to contribute", async () => {
    mockGetCurrentSavingsEnvelopeAllocation.mockResolvedValue({ envelopeCentavos: 1_000_000, requiredCentavos: 600_000, accountRequiredCentavos: 0, shortfallCentavos: 0, unallocatedCentavos: 400_000, proposals: [] });
    mockGetCurrentPlanBudgetRemaining.mockResolvedValue(2_500_000);
    const view = render(<SavingsAllocationReview userId="user-1" deviceId="device-1" />);

    await waitFor(() => expect(view.getByText("Budget remaining this month")).toBeTruthy());
    expect(view.getByText("₱25,000.00")).toBeTruthy();
    expect(view.getByText("Savings left to contribute")).toBeTruthy();
    expect(view.getByText("₱6,000.00")).toBeTruthy();
  });

  it("keeps the review when the budget remaining lookup fails", async () => {
    mockGetCurrentSavingsEnvelopeAllocation.mockResolvedValue({ envelopeCentavos: 0, requiredCentavos: 0, accountRequiredCentavos: 0, shortfallCentavos: 0, unallocatedCentavos: 0, proposals: [] });
    mockGetCurrentPlanBudgetRemaining.mockRejectedValue(new Error("spending unavailable"));
    const view = render(<SavingsAllocationReview userId="user-1" deviceId="device-1" />);

    await waitFor(() => expect(view.getByText("Unavailable")).toBeTruthy());
  });

  it("keeps the surplus strategy collapsed until the user asks to change it", async () => {
    mockGetCurrentSavingsEnvelopeAllocation.mockResolvedValue({ envelopeCentavos: 0, requiredCentavos: 0, accountRequiredCentavos: 0, shortfallCentavos: 0, unallocatedCentavos: 0, proposals: [] });
    const view = render(<SavingsAllocationReview userId="user-1" deviceId="device-1" />);

    await waitFor(() => expect(view.getByText("Biggest need first")).toBeTruthy());
    expect(view.queryByLabelText("Use snowball savings allocation")).toBeNull();
    fireEvent.press(view.getByLabelText("Change surplus strategy"));
    expect(view.getByLabelText("Use snowball savings allocation")).toBeTruthy();
  });
});
