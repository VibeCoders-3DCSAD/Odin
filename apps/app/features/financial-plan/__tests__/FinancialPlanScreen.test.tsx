import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";
import FinancialPlanScreen from "../FinancialPlanScreen";

const mockListRecentExpenseSubcategoryIds = jest.fn();
const mockListRecentExpenseCategoryIds = jest.fn();
const mockGetAcceptedFinancialPlanForPeriod = jest.fn();
const mockGetFinancialPlanLabels = jest.fn();
const mockGetFinancialPlanAllocationSpending = jest.fn();
const mockGetFinancialPlanSpentAmount = jest.fn();
const mockDeleteFinancialPlan = jest.fn();
const mockListFinancialAccounts = jest.fn();
const mockListCategories = jest.fn();
const mockListSubcategories = jest.fn();
const mockRequestFinancialPlanRecommendation = jest.fn();
const mockRunSync = jest.fn();

jest.mock("../../../local-db/repositories/financialPlans", () => ({
  createFinancialPlan: jest.fn(),
  deleteFinancialPlan: (...args: unknown[]) => mockDeleteFinancialPlan(...args),
  getAcceptedFinancialPlanForPeriod: (...args: unknown[]) => mockGetAcceptedFinancialPlanForPeriod(...args),
  getCurrentFinancialPlanPeriod: () => ({ start: "2026-10-01", end: "2026-10-31" }),
  getFinancialPlanLabels: (...args: unknown[]) => mockGetFinancialPlanLabels(...args),
  getFinancialPlanAllocationSpending: (...args: unknown[]) => mockGetFinancialPlanAllocationSpending(...args),
  getFinancialPlanSpentAmount: (...args: unknown[]) => mockGetFinancialPlanSpentAmount(...args),
}));

jest.mock("../../../local-db/repositories/forecastTransactions", () => ({
  listRecentExpenseCategoryIds: (...args: unknown[]) => mockListRecentExpenseCategoryIds(...args),
  listRecentExpenseSubcategoryIds: (...args: unknown[]) => mockListRecentExpenseSubcategoryIds(...args),
}));

jest.mock("../../../local-db/repositories/taxonomy", () => ({
  listCategories: (...args: unknown[]) => mockListCategories(...args),
  listSubcategories: (...args: unknown[]) => mockListSubcategories(...args),
  updateCategory: jest.fn(),
  updateSubcategory: jest.fn(),
}));

jest.mock("../../../local-db/repositories/financialAccounts", () => ({
  listFinancialAccounts: (...args: unknown[]) => mockListFinancialAccounts(...args),
}));

jest.mock("../../../local-db/sync/runSync", () => ({
  runSync: (...args: unknown[]) => mockRunSync(...args),
}));

jest.mock("../../debt-manager/debtTrendRange", () => ({ getPhilippineToday: () => "2026-10-15" }));

jest.mock("../api", () => ({ requestFinancialPlanRecommendation: (...args: unknown[]) => mockRequestFinancialPlanRecommendation(...args) }));

describe("FinancialPlanScreen", () => {
  beforeEach(() => {
    mockListRecentExpenseSubcategoryIds.mockResolvedValue([]);
    mockListRecentExpenseCategoryIds.mockResolvedValue([]);
    mockGetAcceptedFinancialPlanForPeriod.mockResolvedValue({
      id: "plan-1",
      periodStart: "2026-10-01",
      periodEnd: "2026-10-31",
      inputSnapshot: { forecast: { quality: "HIGH" } },
      recommendation: {
        availableFundsCentavos: 100_000,
        allocations: [{ allocationRule: "FLEXIBLE", allocatedAmountCentavos: 60_000, floorAmountCentavos: 0, categoryId: "food" }],
        debtReservations: [],
        savingsReservations: [],
      },
    });
    mockGetFinancialPlanLabels.mockResolvedValue({ categories: { food: "Food" }, subcategories: {}, debtAccounts: {}, savingsGoals: {}, creditCardStatements: {} });
    mockGetFinancialPlanAllocationSpending.mockResolvedValue({ "category:food": 0 });
    mockGetFinancialPlanSpentAmount.mockResolvedValue(0);
    mockDeleteFinancialPlan.mockResolvedValue({});
    mockListFinancialAccounts.mockResolvedValue([]);
    mockListCategories.mockResolvedValue([]);
    mockListSubcategories.mockResolvedValue([]);
    mockRequestFinancialPlanRecommendation.mockReset();
    mockRunSync.mockResolvedValue({ successful: true });
  });

  it("opens the saved Financial Plan instead of the category selector", async () => {
    const view = render(<FinancialPlanScreen userId="user-1" deviceId="device-1" accessToken="token" syncVersion={0} />);

    await waitFor(() => expect(view.getByText("Financial Plan")).toBeTruthy());

    expect(view.getByText("Food")).toBeTruthy();
    expect(view.getByText("Remaining Money in Plan")).toBeTruthy();
    expect(view.getByText("₱1,000.00")).toBeTruthy();
    expect(view.getByText("₱600.00 remaining of ₱600.00")).toBeTruthy();
    expect(view.queryByLabelText("Food flexible amount in pesos")).toBeNull();
    expect(view.queryByText(/Forecast trust:/)).toBeNull();
    expect(mockGetAcceptedFinancialPlanForPeriod).toHaveBeenCalledWith("user-1", "2026-10-01", "2026-10-31");
  });

  it("shows saved billers between Savings & Debt and Category Allocations without deducting them again", async () => {
    const saved = await mockGetAcceptedFinancialPlanForPeriod();
    mockGetAcceptedFinancialPlanForPeriod.mockResolvedValue({ ...saved, inputSnapshot: { ...saved.inputSnapshot, obligations: { reservations: [
      { scheduledPaymentId: "rent", label: "Monthly rent", amountCentavos: 30_000, dueDate: "2026-10-20" },
    ] } } });
    const view = render(<FinancialPlanScreen userId="user-1" deviceId="device-1" accessToken="token" syncVersion={0} />);
    await waitFor(() => expect(view.getByText("Monthly rent")).toBeTruthy());
    expect(view.getByText("Due 2026-10-20")).toBeTruthy();
    expect(view.getAllByText("₱300.00")).toHaveLength(2);
    expect(view.getByText("₱1,000.00")).toBeTruthy();
    const text = JSON.stringify(view.toJSON());
    expect(text.indexOf("Savings & Debt")).toBeLessThan(text.indexOf("Billers and Remittances"));
    expect(text.indexOf("Billers and Remittances")).toBeLessThan(text.indexOf("Category Allocations"));
    expect(view.queryByLabelText("Billers and Remittances surplus amount in pesos")).toBeNull();
  });

  it("shows an empty biller reservation section for a legacy saved plan", async () => {
    const view = render(<FinancialPlanScreen userId="user-1" deviceId="device-1" accessToken="token" syncVersion={0} />);
    await waitFor(() => expect(view.getByText("Billers and Remittances")).toBeTruthy());
    expect(view.getByText("No saved biller or remittance reservations for this period.")).toBeTruthy();
  });

  it("recognizes a parent's subcategory spending without asking for a manual baseline", async () => {
    mockGetAcceptedFinancialPlanForPeriod.mockResolvedValue(null);
    mockListFinancialAccounts.mockResolvedValue([{ kind: "cash", current_balance_centavos: 100_000 }]);
    mockListCategories.mockResolvedValue([{ id: "housing", label: "Housing", minimum_amount_centavos: null, fixed_amount_centavos: null }]);
    mockListSubcategories.mockResolvedValue([{ id: "rent", category_id: "housing", label: "Rent", kind: "expense", minimum_amount_centavos: null, fixed_amount_centavos: null }]);
    mockListRecentExpenseSubcategoryIds.mockResolvedValue(["rent"]);
    const view = render(<FinancialPlanScreen userId="user-1" deviceId="device-1" accessToken="token" syncVersion={0} />);
    await waitFor(() => expect(view.getByLabelText("Include Housing in Financial Plan")).toBeTruthy());
    fireEvent.press(view.getByLabelText("Include Housing in Financial Plan"));
    expect(view.queryByLabelText("One-time plan amount for Housing in pesos")).toBeNull();
    expect(view.getByLabelText("Include Rent in Financial Plan").props.accessibilityState.checked).toBe(false);
  });

  it("shows the selection flow when only a previous-month plan was accepted", async () => {
    const previousPlan = await mockGetAcceptedFinancialPlanForPeriod();
    mockGetAcceptedFinancialPlanForPeriod.mockImplementation(async (_userId: string, start: string) => start === "2026-09-01" ? { ...previousPlan, periodStart: "2026-09-01", periodEnd: "2026-09-30" } : null);
    const view = render(<FinancialPlanScreen userId="user-1" deviceId="device-1" accessToken="token" syncVersion={0} />);

    await waitFor(() => expect(view.getByLabelText("Create Financial Plan recommendation")).toBeTruthy());

    expect(view.queryByText("Remaining Money in Plan")).toBeNull();
    expect(mockGetAcceptedFinancialPlanForPeriod).toHaveBeenCalledWith("user-1", "2026-10-01", "2026-10-31");
  });

  it("reduces a saved allocation after its category receives a transaction", async () => {
    const view = render(<FinancialPlanScreen userId="user-1" deviceId="device-1" accessToken="token" syncVersion={0} />);
    await waitFor(() => expect(view.getByText("₱600.00 remaining of ₱600.00")).toBeTruthy());

    mockGetFinancialPlanAllocationSpending.mockResolvedValue({ "category:food": 10_000 });
    mockGetFinancialPlanSpentAmount.mockResolvedValue(10_000);
    view.rerender(<FinancialPlanScreen userId="user-1" deviceId="device-1" accessToken="token" syncVersion={1} />);

    await waitFor(() => expect(view.getByText("₱500.00 remaining of ₱600.00")).toBeTruthy());
    expect(view.getByText("₱900.00")).toBeTruthy();
  });

  it("requires confirmation before resetting a saved Financial Plan", async () => {
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const view = render(<FinancialPlanScreen userId="user-1" deviceId="device-1" accessToken="token" syncVersion={0} />);
    await waitFor(() => expect(view.getByLabelText("Reset Financial Plan")).toBeTruthy());

    fireEvent.press(view.getByText("Reset plan"));

    expect(alert).toHaveBeenCalledWith("Reset Financial Plan?", expect.stringContaining("debt reservations"), expect.any(Array));
    alert.mockRestore();
  });

  it("opens past plans from both the saved plan and the selection flow", async () => {
    const onOpenPastPlans = jest.fn();
    const saved = render(<FinancialPlanScreen userId="user-1" deviceId="device-1" accessToken="token" syncVersion={0} onOpenPastPlans={onOpenPastPlans} />);
    await waitFor(() => expect(saved.getByLabelText("View past Financial Plans")).toBeTruthy());
    fireEvent.press(saved.getByText("Past plans"));
    expect(onOpenPastPlans).toHaveBeenCalledTimes(1);
    saved.unmount();

    mockGetAcceptedFinancialPlanForPeriod.mockResolvedValue(null);
    const selecting = render(<FinancialPlanScreen userId="user-1" deviceId="device-1" accessToken="token" syncVersion={0} onOpenPastPlans={onOpenPastPlans} />);
    await waitFor(() => expect(selecting.getByLabelText("Create Financial Plan recommendation")).toBeTruthy());
    fireEvent.press(selecting.getByLabelText("View past Financial Plans"));
    expect(onOpenPastPlans).toHaveBeenCalledTimes(2);
  });

  it("uses active non-savings, non-credit-card account balances as available money", async () => {
    mockGetAcceptedFinancialPlanForPeriod.mockResolvedValue(null);
    mockListFinancialAccounts.mockResolvedValue([
      { kind: "cash", current_balance_centavos: 25_000 },
      { kind: "bank", current_balance_centavos: 75_000 },
      { kind: "savings", current_balance_centavos: 50_000 },
      { kind: "credit_card", current_balance_centavos: 10_000 },
    ]);

    const view = render(<FinancialPlanScreen userId="user-1" deviceId="device-1" accessToken="token" syncVersion={0} />);

    await waitFor(() => expect(view.getByText("Available money: PHP 1,000.00")).toBeTruthy());
    expect(mockListFinancialAccounts).toHaveBeenCalledWith("user-1", "active");
  });

  it("lets the user enter a different planning amount and refresh an infeasible plan", async () => {
    mockGetAcceptedFinancialPlanForPeriod.mockResolvedValue(null);
    mockListFinancialAccounts.mockResolvedValue([{ kind: "cash", current_balance_centavos: 100_000 }]);
    mockListSubcategories.mockResolvedValue([{ id: "rent", category_id: null, label: "Rent", kind: "expense", minimum_amount_centavos: 75_000, fixed_amount_centavos: null, always_in_budget: true }]);
    mockRequestFinancialPlanRecommendation
      .mockResolvedValueOnce({ response: { ok: true }, body: { payload: {
        status: "INFEASIBLE", period: { start: "2026-11-01", end: "2026-11-30" }, inputSnapshot: {}, explanations: [],
        recommendation: { availableFundsCentavos: -25_000, shortfallCentavos: 25_000, allocations: [{ subcategoryId: "rent", categoryId: null, allocationRule: "MINIMUM", allocatedAmountCentavos: 75_000, floorAmountCentavos: 75_000, ceilingAmountCentavos: 75_000, forecastAmountCentavos: 75_000 }], debtReservations: [], savingsReservations: [] },
      } } })
      .mockResolvedValueOnce({ response: { ok: true }, body: { payload: {
        status: "RECOMMENDATION_READY", period: { start: "2026-11-01", end: "2026-11-30" }, inputSnapshot: {}, explanations: [],
        recommendation: { availableFundsCentavos: 25_000, allocations: [{ subcategoryId: "rent", categoryId: null, allocationRule: "MINIMUM", allocatedAmountCentavos: 75_000, floorAmountCentavos: 75_000, ceilingAmountCentavos: 100_000, forecastAmountCentavos: 75_000 }], debtReservations: [], savingsReservations: [] },
      } } });

    const view = render(<FinancialPlanScreen userId="user-1" deviceId="device-1" accessToken="token" syncVersion={0} />);
    await waitFor(() => expect(view.getByLabelText("Create Financial Plan recommendation")).toBeTruthy());
    fireEvent.press(view.getByLabelText("Create Financial Plan recommendation"));
    await waitFor(() => expect(view.getByText("Have another number in mind?")).toBeTruthy());

    fireEvent.changeText(view.getByLabelText("New planning amount in pesos"), "1000");
    fireEvent.press(view.getByLabelText("Refresh plan with new amount"));

    await waitFor(() => expect(mockRequestFinancialPlanRecommendation).toHaveBeenCalledTimes(2));
    expect(mockRequestFinancialPlanRecommendation.mock.calls[1][3]).toBe(100_000);
    expect(mockRunSync).toHaveBeenCalledWith("user-1", "device-1", "token");
  });

  it("requires confirmation before skipping debt repayments and shows the warning", async () => {
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    mockGetAcceptedFinancialPlanForPeriod.mockResolvedValue(null);
    mockListFinancialAccounts.mockResolvedValue([{ kind: "cash", current_balance_centavos: 100_000 }]);
    mockListSubcategories.mockResolvedValue([{ id: "rent", category_id: null, label: "Rent", kind: "expense", minimum_amount_centavos: 75_000, fixed_amount_centavos: null, always_in_budget: true }]);
    mockRequestFinancialPlanRecommendation
      .mockResolvedValueOnce({ response: { ok: true }, body: { payload: {
        status: "INFEASIBLE", period: { start: "2026-11-01", end: "2026-11-30" }, inputSnapshot: {}, explanations: [],
        recommendation: { availableFundsCentavos: -25_000, shortfallCentavos: 25_000, allocations: [], debtReservations: [{ debtAccountId: "debt-1", amountCentavos: 10_000, dueDate: "2026-11-12" }], savingsReservations: [] },
      } } })
      .mockResolvedValueOnce({ response: { ok: true }, body: { payload: {
        status: "RECOMMENDATION_READY", period: { start: "2026-11-01", end: "2026-11-30" }, inputSnapshot: {}, explanations: [],
        recommendation: { availableFundsCentavos: 25_000, allocations: [], debtReservations: [], savingsReservations: [] },
      } } });

    const view = render(<FinancialPlanScreen userId="user-1" deviceId="device-1" accessToken="token" syncVersion={0} />);
    await waitFor(() => expect(view.getByLabelText("Create Financial Plan recommendation")).toBeTruthy());
    fireEvent.press(view.getByLabelText("Create Financial Plan recommendation"));
    await waitFor(() => expect(view.getByLabelText("Skip Debt Repayments")).toBeTruthy());

    fireEvent.press(view.getByLabelText("Skip Debt Repayments"));
    expect(alert).toHaveBeenCalledWith("Skip debt repayments?", expect.stringContaining("may result in missed payments"), expect.any(Array));
    const actions = alert.mock.calls[0]![2] as { onPress?: () => void }[];
    await act(async () => {
      actions[1]!.onPress?.();
    });

    await waitFor(() => expect(view.getByText("Skipped plan commitments")).toBeTruthy());
    expect(mockRequestFinancialPlanRecommendation.mock.calls[1]![5]).toEqual({ debtRepayments: true, savingsContributions: false });
    alert.mockRestore();
  });

  it("includes commitments by default and lets the user skip savings before generating a plan", async () => {
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    mockGetAcceptedFinancialPlanForPeriod.mockResolvedValue(null);
    mockListFinancialAccounts.mockResolvedValue([{ kind: "cash", current_balance_centavos: 100_000 }]);
    mockListSubcategories.mockResolvedValue([{ id: "rent", category_id: null, label: "Rent", kind: "expense", minimum_amount_centavos: 75_000, fixed_amount_centavos: null, always_in_budget: true }]);
    mockRequestFinancialPlanRecommendation
      .mockResolvedValueOnce({ response: { ok: true }, body: { payload: {
        status: "RECOMMENDATION_READY", period: { start: "2026-11-01", end: "2026-11-30" }, inputSnapshot: {}, explanations: [],
        recommendation: { availableFundsCentavos: 100_000, allocations: [], debtReservations: [{ debtAccountId: "debt-1", amountCentavos: 10_000, dueDate: "2026-11-12" }], savingsReservations: [{ savingsGoalId: "goal-1", amountCentavos: 5_000, dueDate: "2026-11-15" }] },
      } } })
      .mockResolvedValueOnce({ response: { ok: true }, body: { payload: {
        status: "RECOMMENDATION_READY", period: { start: "2026-11-01", end: "2026-11-30" }, inputSnapshot: {}, explanations: [],
        recommendation: { availableFundsCentavos: 100_000, allocations: [], debtReservations: [{ debtAccountId: "debt-1", amountCentavos: 10_000, dueDate: "2026-11-12" }], savingsReservations: [] },
      } } });

    const view = render(<FinancialPlanScreen userId="user-1" deviceId="device-1" accessToken="token" syncVersion={0} />);
    await waitFor(() => expect(view.getByLabelText("Create Financial Plan recommendation")).toBeTruthy());

    expect(view.getByLabelText("Skip Savings Contributions").props.accessibilityState?.checked).toBe(false);
    expect(view.getByLabelText("Skip Debt Repayments")).toBeTruthy();
    fireEvent.press(view.getByLabelText("Skip Savings Contributions"));
    expect(alert).toHaveBeenCalledWith("Skip savings contributions?", expect.stringContaining("delay"), expect.any(Array));
    const actions = alert.mock.calls[0]![2] as { onPress?: () => void }[];
    await act(async () => {
      actions[1]!.onPress?.();
    });

    expect(view.getByLabelText("Skip Savings Contributions").props.accessibilityState?.checked).toBe(true);
    fireEvent.press(view.getByLabelText("Create Financial Plan recommendation"));
    await waitFor(() => expect(mockRequestFinancialPlanRecommendation).toHaveBeenCalledTimes(1));
    expect(mockRequestFinancialPlanRecommendation.mock.calls[0]![5]).toEqual({ debtRepayments: false, savingsContributions: true });
    alert.mockRestore();
  });
});
