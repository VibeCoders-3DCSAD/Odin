import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import SavingsGoalForm from "../SavingsGoalForm";
import { LocalDbError } from "../../../local-db/helpers";
import type { SavingsGoal } from "../../../local-db/repositories/savingsGoals";

const mockUpdate = jest.fn();
const mockCreate = jest.fn();
jest.mock("../../../local-db/repositories/savingsGoals", () => ({
  updateSavingsGoal: (...args: unknown[]) => mockUpdate(...args),
  createSavingsGoal: (...args: unknown[]) => mockCreate(...args),
  getEmergencyFundBaseline: jest.fn().mockResolvedValue(0),
}));
jest.mock("../../debt-manager/debtTrendRange", () => ({ getPhilippineToday: () => "2026-10-18" }));

const goal: SavingsGoal = {
  id: "goal-1", name: "Travel", goalType: "custom", goalCategory: "custom",
  targetAmountCentavos: 100_000, startingAmountCentavos: 0, currentAmountCentavos: 0,
  remainingAmountCentavos: 100_000, progressPercent: 0, isAchieved: false,
  contributionShortfallCentavos: 0, targetDate: "2026-12-31", priority: "medium",
  emergencyFundBaselineCentavos: null, autoSaveAmountCentavos: 5_000,
  plannedContributionAmountCentavos: 5_000, contributionFrequency: "monthly",
  contributionIntervalCount: 1, contributionDayOfMonth: 15,
  contributionSecondDayOfMonth: null, contributionDayOfWeek: null,
  customIntervalDays: null, nextContributionDate: "2026-11-15",
  interestRateBps: null, notes: null, emergencyFundTargetMethod: "fixed_amount",
  essentialExpenseCoverageMonths: null, status: "active", version: 1,
};

describe("SavingsGoalForm contribution frequency", () => {
  beforeEach(() => {
    mockCreate.mockReset();
    mockCreate.mockResolvedValue({ goal });
    mockUpdate.mockReset();
    mockUpdate.mockResolvedValue({ goal });
  });

  it("saves a newly filled goal and notifies the screen", async () => {
    const onSaved = jest.fn();
    const view = render(<SavingsGoalForm userId="user-1" deviceId="device-1" onCancel={jest.fn()} onSaved={onSaved} />);
    fireEvent.changeText(view.getByLabelText("Goal name"), "Travel");
    fireEvent.changeText(view.getByLabelText("Target amount"), "1000");
    fireEvent.changeText(view.getByLabelText("Target date"), "2026-12-31");
    fireEvent.press(view.getByLabelText("None"));
    fireEvent.press(view.getByLabelText("Save savings goal"));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(goal));
    expect(mockCreate).toHaveBeenCalledWith("user-1", "device-1", expect.objectContaining({ name: "Travel", targetAmountCentavos: 100_000, contributionFrequency: null }));
  });

  it("shows a duplicate-name error when creating a goal", async () => {
    mockCreate.mockRejectedValueOnce(new LocalDbError("DUPLICATE_NAME", "duplicate"));
    const onSaved = jest.fn();
    const view = render(<SavingsGoalForm userId="user-1" deviceId="device-1" onCancel={jest.fn()} onSaved={onSaved} />);
    fireEvent.changeText(view.getByLabelText("Goal name"), "Travel");
    fireEvent.changeText(view.getByLabelText("Target amount"), "1000");
    fireEvent.changeText(view.getByLabelText("Target date"), "2026-12-31");
    fireEvent.press(view.getByLabelText("None"));
    fireEvent.press(view.getByLabelText("Save savings goal"));
    await waitFor(() => expect(view.getByText("A savings goal with this name already exists. Choose a different name.")).toBeTruthy());
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("explains duplicate names and clears the error when the name changes", async () => {
    mockUpdate.mockRejectedValueOnce(new LocalDbError("DUPLICATE_NAME", "duplicate"));
    const onSaved = jest.fn();
    const view = render(<SavingsGoalForm userId="user-1" deviceId="device-1" goal={goal} onCancel={jest.fn()} onSaved={onSaved} />);
    fireEvent.press(view.getByLabelText("Save savings goal changes"));
    await waitFor(() => expect(view.getByText("A savings goal with this name already exists. Choose a different name.")).toBeTruthy());
    expect(onSaved).not.toHaveBeenCalled();
    fireEvent.changeText(view.getByLabelText("Goal name"), "Japan trip");
    expect(view.queryByText("A savings goal with this name already exists. Choose a different name.")).toBeNull();
    fireEvent.press(view.getByLabelText("Save savings goal changes"));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(goal));
  });

  it("offers the five frequencies and saves a daily schedule", async () => {
    const view = render(<SavingsGoalForm userId="user-1" deviceId="device-1" goal={goal} onCancel={jest.fn()} onSaved={jest.fn()} />);
    for (const label of ["Daily", "Weekly", "Twice a Month", "Monthly", "None"]) {
      expect(view.getByLabelText(label)).toBeTruthy();
    }
    expect(view.queryByLabelText("biweekly")).toBeNull();
    expect(view.queryByLabelText("quarterly")).toBeNull();
    expect(view.queryByLabelText("yearly")).toBeNull();
    expect(view.queryByLabelText("custom")).toBeNull();
    expect(view.queryByLabelText("Select next contribution date")).toBeNull();
    expect(view.queryByText("Next Contribution Date")).toBeNull();
    fireEvent.press(view.getByLabelText("Daily"));
    fireEvent.press(view.getByLabelText("Save savings goal changes"));
    await waitFor(() => expect(mockUpdate).toHaveBeenCalledWith("user-1", "device-1", "goal-1", expect.objectContaining({ contributionFrequency: "daily", plannedContributionAmountCentavos: 5_000, nextContributionDate: "2026-10-18", contributionDayOfMonth: null })));
  });

  it("clears the schedule when None is saved", async () => {
    const view = render(<SavingsGoalForm userId="user-1" deviceId="device-1" goal={goal} onCancel={jest.fn()} onSaved={jest.fn()} />);
    fireEvent.press(view.getByLabelText("None"));
    expect(view.queryByLabelText("Planned contribution amount")).toBeNull();
    expect(view.queryByLabelText("Select next contribution date")).toBeNull();
    fireEvent.press(view.getByLabelText("Save savings goal changes"));
    await waitFor(() => expect(mockUpdate).toHaveBeenCalledWith("user-1", "device-1", "goal-1", expect.objectContaining({ contributionFrequency: null, plannedContributionAmountCentavos: 0, autoSaveAmountCentavos: 0, nextContributionDate: null, contributionIntervalCount: null, contributionDayOfMonth: null })));
  });

  it("shows both calendar day inputs for Twice a Month", () => {
    const view = render(<SavingsGoalForm userId="user-1" deviceId="device-1" goal={goal} onCancel={jest.fn()} onSaved={jest.fn()} />);
    fireEvent.press(view.getByLabelText("Twice a Month"));
    expect(view.getByText("1ST DAY OF MONTH")).toBeTruthy();
    expect(view.getByText("2ND DAY OF MONTH")).toBeTruthy();
  });

  it("requires a weekly weekday and derives the occurrence from that choice", async () => {
    const view = render(<SavingsGoalForm userId="user-1" deviceId="device-1" goal={goal} onCancel={jest.fn()} onSaved={jest.fn()} />);
    fireEvent.press(view.getByLabelText("Weekly"));
    for (const day of ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]) expect(view.getByLabelText(day)).toBeTruthy();
    fireEvent.press(view.getByLabelText("Save savings goal changes"));
    expect(view.getByText("Select a contribution day from Sunday to Saturday.")).toBeTruthy();
    expect(mockUpdate).not.toHaveBeenCalled();
    fireEvent.press(view.getByLabelText("Wednesday"));
    fireEvent.press(view.getByLabelText("Save savings goal changes"));
    await waitFor(() => expect(mockUpdate).toHaveBeenCalledWith("user-1", "device-1", "goal-1", expect.objectContaining({ contributionFrequency: "weekly", contributionDayOfWeek: 3, nextContributionDate: "2026-10-21" })));
  });

  it("requires a valid monthly date number and derives its occurrence", async () => {
    const view = render(<SavingsGoalForm userId="user-1" deviceId="device-1" goal={goal} onCancel={jest.fn()} onSaved={jest.fn()} />);
    fireEvent.changeText(view.getByLabelText("Day of month"), "32");
    fireEvent.press(view.getByLabelText("Save savings goal changes"));
    expect(view.getByText("Enter a contribution date number from 1 to 31.")).toBeTruthy();
    expect(mockUpdate).not.toHaveBeenCalled();
    fireEvent.changeText(view.getByLabelText("Day of month"), "14");
    fireEvent.press(view.getByLabelText("Save savings goal changes"));
    await waitFor(() => expect(mockUpdate).toHaveBeenCalledWith("user-1", "device-1", "goal-1", expect.objectContaining({ contributionDayOfMonth: 14, nextContributionDate: "2026-11-14" })));
  });

  it("requires two ascending date numbers for Twice a Month", async () => {
    const view = render(<SavingsGoalForm userId="user-1" deviceId="device-1" goal={goal} onCancel={jest.fn()} onSaved={jest.fn()} />);
    fireEvent.press(view.getByLabelText("Twice a Month"));
    fireEvent.changeText(view.getByLabelText("First day of month"), "20");
    fireEvent.changeText(view.getByLabelText("Second day of month"), "5");
    fireEvent.press(view.getByLabelText("Save savings goal changes"));
    expect(view.getByText("Enter two date numbers from 1 to 31, with the first before the second.")).toBeTruthy();
    expect(mockUpdate).not.toHaveBeenCalled();
    fireEvent.changeText(view.getByLabelText("First day of month"), "5");
    fireEvent.changeText(view.getByLabelText("Second day of month"), "20");
    fireEvent.press(view.getByLabelText("Save savings goal changes"));
    await waitFor(() => expect(mockUpdate).toHaveBeenCalledWith("user-1", "device-1", "goal-1", expect.objectContaining({ contributionDayOfMonth: 5, contributionSecondDayOfMonth: 20, nextContributionDate: "2026-10-20" })));
  });

  it("preserves an existing legacy cadence until explicitly changed", async () => {
    const view = render(<SavingsGoalForm userId="user-1" deviceId="device-1" goal={{ ...goal, contributionFrequency: "biweekly", contributionIntervalCount: 2 }} onCancel={jest.fn()} onSaved={jest.fn()} />);
    expect(view.getByText(/Existing schedule: biweekly/)).toBeTruthy();
    fireEvent.press(view.getByLabelText("Save savings goal changes"));
    await waitFor(() => expect(mockUpdate).toHaveBeenCalledWith("user-1", "device-1", "goal-1", expect.objectContaining({ contributionFrequency: "biweekly", contributionIntervalCount: 2 })));
  });
});
