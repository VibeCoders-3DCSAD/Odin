import React from "react";
import { render, waitFor } from "@testing-library/react-native";
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
});
