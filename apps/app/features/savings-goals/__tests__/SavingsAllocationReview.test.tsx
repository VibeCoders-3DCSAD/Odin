import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import SavingsAllocationReview from "../SavingsAllocationReview";

const mockGetCurrentSavingsEnvelopeAllocation = jest.fn();

jest.mock("../../../local-db/repositories/savingsAllocationPreferences", () => ({
  getSavingsAllocationStrategy: jest.fn().mockResolvedValue("avalanche"),
  saveSavingsAllocationStrategy: jest.fn(),
}));
jest.mock("../savingsEnvelopeAllocationQueries", () => ({
  getCurrentSavingsEnvelopeAllocation: (...args: unknown[]) => mockGetCurrentSavingsEnvelopeAllocation(...args),
}));

describe("SavingsAllocationReview", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCurrentSavingsEnvelopeAllocation.mockResolvedValue(null);
  });

  it("identifies Financial Plan reservations and refreshes after sync", async () => {
    const view = render(<SavingsAllocationReview userId="user-1" deviceId="device-1" syncVersion={0} />);

    await waitFor(() => expect(view.getByText("Financial Plan for savings")).toBeTruthy());
    view.rerender(<SavingsAllocationReview userId="user-1" deviceId="device-1" syncVersion={1} />);

    await waitFor(() => expect(mockGetCurrentSavingsEnvelopeAllocation).toHaveBeenCalledTimes(2));
  });

  it("shows this month's whole savings budget and the savings left to contribute", async () => {
    mockGetCurrentSavingsEnvelopeAllocation.mockResolvedValue({ envelopeCentavos: 1_000_000, requiredCentavos: 600_000, accountRequiredCentavos: 0, shortfallCentavos: 0, unallocatedCentavos: 400_000, proposals: [] });
    const view = render(<SavingsAllocationReview userId="user-1" deviceId="device-1" />);

    await waitFor(() => expect(view.getByText("Savings budget this month")).toBeTruthy());
    expect(view.getByText("₱10,000.00")).toBeTruthy();
    expect(view.queryByText("Budget remaining this month")).toBeNull();
    expect(view.getByText("Savings left to contribute")).toBeTruthy();
    expect(view.getByText("₱6,000.00")).toBeTruthy();
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
