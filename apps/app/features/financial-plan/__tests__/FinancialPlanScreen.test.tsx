import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";
import FinancialPlanScreen from "../FinancialPlanScreen";

const mockListRecentExpenseSubcategoryIds = jest.fn();
const mockListRecentExpenseCategoryIds = jest.fn();
const mockCreateFinancialPlan = jest.fn();
const mockGetAcceptedFinancialPlanForPeriod = jest.fn();
const mockGetFinancialPlanLabels = jest.fn();
const mockGetFinancialPlanSpending = jest.fn();
const mockDeleteFinancialPlan = jest.fn();
const mockListFinancialAccounts = jest.fn();
const mockListCategories = jest.fn();
const mockListSubcategories = jest.fn();
const mockRequestFinancialPlanRecommendation = jest.fn();
const mockRequestFinancialPlanCommitments = jest.fn();
const mockRunSync = jest.fn();

jest.mock("../../../local-db/repositories/financialPlans", () => ({
  createFinancialPlan: (...args: unknown[]) => mockCreateFinancialPlan(...args),
  deleteFinancialPlan: (...args: unknown[]) => mockDeleteFinancialPlan(...args),
  getAcceptedFinancialPlanForPeriod: (...args: unknown[]) => mockGetAcceptedFinancialPlanForPeriod(...args),
  getCurrentFinancialPlanPeriod: (date: string) => ({ start: `${date.slice(0, 7)}-01`, end: new Date(Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)), 0)).toISOString().slice(0, 10) }),
  getFinancialPlanLabels: (...args: unknown[]) => mockGetFinancialPlanLabels(...args),
  getFinancialPlanSpending: (...args: unknown[]) => mockGetFinancialPlanSpending(...args),
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

const mockRequestFinancialPlanExplanations = jest.fn();
jest.mock("../api", () => ({
  requestFinancialPlanCommitments: (...args: unknown[]) => mockRequestFinancialPlanCommitments(...args),
  requestFinancialPlanRecommendation: (...args: unknown[]) => mockRequestFinancialPlanRecommendation(...args),
  requestFinancialPlanExplanations: (...args: unknown[]) => mockRequestFinancialPlanExplanations(...args),
}));

describe("FinancialPlanScreen", () => {
  beforeEach(() => {
    mockRequestFinancialPlanCommitments.mockReset().mockResolvedValue({ period: { start: "2026-10-01", end: "2026-10-31" }, debtReservations: [], savingsReservations: [] });
    mockListRecentExpenseSubcategoryIds.mockResolvedValue([]);
    mockListRecentExpenseCategoryIds.mockResolvedValue([]);
    mockCreateFinancialPlan.mockReset().mockResolvedValue({ id: "new-plan" });
    mockRequestFinancialPlanExplanations.mockReset().mockResolvedValue(null);
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
    mockGetFinancialPlanSpending.mockResolvedValue({ allocationSpending: { "category:food": 0 }, spentCentavos: 0 });
    mockDeleteFinancialPlan.mockResolvedValue({});
    mockListFinancialAccounts.mockResolvedValue([]);
    mockListCategories.mockResolvedValue([]);
    mockListSubcategories.mockResolvedValue([]);
    mockRequestFinancialPlanRecommendation.mockReset();
    mockRunSync.mockResolvedValue({ successful: true });
  });

  it("shows the Essentials shortfall above Plan insights", async () => {
    mockGetAcceptedFinancialPlanForPeriod.mockResolvedValue({
      id: "plan-1", periodStart: "2026-10-01", periodEnd: "2026-10-31",
      inputSnapshot: { restrictions: { allocations: [{ id: "food", target: "category", priorityGroup: "ESSENTIAL" }] } },
      recommendation: {
        availableFundsCentavos: 100_000,
        allocations: [{ categoryId: "food", allocationRule: "FLEXIBLE", allocatedAmountCentavos: 60_000, floorAmountCentavos: 0, forecastAmountCentavos: 80_000 }],
        debtReservations: [], savingsReservations: [],
      },
    });
    const view = render(<FinancialPlanScreen userId="user-1" deviceId="device-1" accessToken="token" syncVersion={0} />);
    await waitFor(() => expect(view.getByText("Essentials shortfall: ₱200.00")).toBeTruthy());
    const output = JSON.stringify(view.toJSON());
    expect(output.indexOf("Essentials shortfall:")).toBeLessThan(output.indexOf("Plan insights"));
    expect(view.getAllByText("Essentials shortfall: ₱200.00")).toHaveLength(1);
  });

  async function openRecommendationForAcceptance(explanationRequest?: unknown) {
    mockGetAcceptedFinancialPlanForPeriod.mockResolvedValue(null);
    mockListFinancialAccounts.mockResolvedValue([{ kind: "cash", current_balance_centavos: 100_000 }]);
    mockListSubcategories.mockResolvedValue([{ id: "rent", category_id: null, label: "Rent", kind: "expense", minimum_amount_centavos: 60_000, fixed_amount_centavos: null, always_in_budget: true }]);
    mockGetFinancialPlanLabels.mockResolvedValue({ categories: {}, subcategories: { rent: "Rent" }, debtAccounts: {}, savingsGoals: {}, creditCardStatements: {} });
    mockRequestFinancialPlanRecommendation.mockResolvedValue({ response: { ok: true }, body: { payload: {
      status: "RECOMMENDATION_READY", period: { start: "2026-10-01", end: "2026-10-31" }, inputSnapshot: {}, explanations: ["Recommendation insight."], explanationRequest,
      recommendation: { availableFundsCentavos: 100_000, allocations: [{ subcategoryId: "rent", categoryId: null, allocationRule: "MINIMUM", allocatedAmountCentavos: 60_000, floorAmountCentavos: 60_000 }], debtReservations: [], savingsReservations: [] },
    } } });
    const view = render(<FinancialPlanScreen userId="user-1" deviceId="device-1" accessToken="token" syncVersion={0} />);
    await waitFor(() => expect(view.getByLabelText("Continue to Plan")).toBeTruthy());
    fireEvent.press(view.getByLabelText("Continue to Plan"));
    await waitFor(() => expect(view.getByLabelText("Accept and save Financial Plan")).toBeTruthy());
    return view;
  }

  async function openCommitmentSetup() {
    mockGetAcceptedFinancialPlanForPeriod.mockResolvedValue(null);
    mockListFinancialAccounts.mockResolvedValue([{ kind: "cash", current_balance_centavos: 100_000 }]);
    mockListSubcategories.mockResolvedValue([{ id: "rent", category_id: null, label: "Rent", kind: "expense", minimum_amount_centavos: 20_000, fixed_amount_centavos: null }]);
    mockRequestFinancialPlanCommitments.mockResolvedValue({
      period: { start: "2026-10-01", end: "2026-10-31" },
      debtReservations: [{ debtAccountId: "debt-1", amountCentavos: 10_000, dueDate: "2026-10-20" }],
      savingsReservations: [{ savingsGoalId: "goal-1", amountCentavos: 5_000, dueDate: "2026-10-25" }],
      obligations: [{ scheduledPaymentId: "bill-1", amountCentavos: 2_000, dueDate: "2026-10-22" }],
    });
    mockRequestFinancialPlanRecommendation.mockResolvedValue({ response: { ok: true }, body: { payload: {
      status: "RECOMMENDATION_READY", period: { start: "2026-10-01", end: "2026-10-31" }, inputSnapshot: {}, explanations: [],
      recommendation: { availableFundsCentavos: 98_000, allocations: [{ subcategoryId: "rent", allocationRule: "MINIMUM", allocatedAmountCentavos: 20_000, floorAmountCentavos: 20_000 }], debtReservations: [], savingsReservations: [] },
    } } });
    const view = render(<FinancialPlanScreen userId="user-1" deviceId="device-1" accessToken="token" syncVersion={0} />);
    await waitFor(() => expect(view.getByLabelText("Continue to Plan")).toBeTruthy());
    return view;
  }

  it.each([
    { choice: "Include savings contributions", shown: "Savings goal", hidden: "Debt account", remaining: "₱930.00", debtRepayments: true, savingsContributions: false, key: "savings:goal-1:2026-10-25", amountCentavos: 5_000 },
    { choice: "Include debt repayments", shown: "Debt account", hidden: "Savings goal", remaining: "₱880.00", debtRepayments: false, savingsContributions: true, key: "debt:debt-1:2026-10-20", amountCentavos: 10_000 },
  ])("plans only the selected commitment: $choice", async ({ choice, shown, hidden, remaining, debtRepayments, savingsContributions, key, amountCentavos }) => {
    const view = await openCommitmentSetup();
    expect(view.getByLabelText(choice).props.accessibilityState.checked).toBe(false);
    expect(view.queryByLabelText(`${shown} budget amount in pesos`)).toBeNull();
    fireEvent.press(view.getByLabelText(choice));
    fireEvent.press(view.getByLabelText("Continue to Plan"));
    expect(view.getByLabelText(`${shown} budget amount in pesos`)).toBeTruthy();
    expect(view.queryByLabelText(`${hidden} budget amount in pesos`)).toBeNull();
    expect(view.getByText(remaining)).toBeTruthy();
    expect(view.getByText("-₱20.00")).toBeTruthy();
    expect(mockRequestFinancialPlanRecommendation).not.toHaveBeenCalled();
    fireEvent.press(view.getByLabelText("Recommend Budget Allocation"));
    await waitFor(() => expect(mockRequestFinancialPlanRecommendation).toHaveBeenCalled());
    await waitFor(() => expect(view.getByText("Category Allocations")).toBeTruthy());
    expect(mockRequestFinancialPlanRecommendation.mock.calls[0][5]).toEqual({ debtRepayments, savingsContributions, commitmentBudgets: [{ key, amountCentavos }] });
  });

  it("generates immediately with explicit exclusions when neither commitment is selected", async () => {
    const view = await openCommitmentSetup();
    fireEvent.press(view.getByLabelText("Continue to Plan"));
    await waitFor(() => expect(mockRequestFinancialPlanRecommendation).toHaveBeenCalled());
    expect(mockRequestFinancialPlanRecommendation.mock.calls[0][5]).toEqual({ debtRepayments: true, savingsContributions: true });
    expect(view.queryByLabelText("Recommend Budget Allocation")).toBeNull();
  });

  it("prevents generation when commitments and scheduled bills exceed the planning amount", async () => {
    const view = await openCommitmentSetup();
    fireEvent.press(view.getByLabelText("Include debt repayments"));
    fireEvent.press(view.getByLabelText("Continue to Plan"));
    fireEvent.changeText(view.getByLabelText("Debt account budget amount in pesos"), "990");
    expect(view.getByText("-₱10.00")).toBeTruthy();
    expect(view.getByLabelText("Recommend Budget Allocation").props.accessibilityState.disabled).toBe(true);
    expect(mockRequestFinancialPlanRecommendation).not.toHaveBeenCalled();
  });

  it("preserves draft amounts and choices when returning to setup and retrying a failed request", async () => {
    const view = await openCommitmentSetup();
    fireEvent.press(view.getByLabelText("Include debt repayments"));
    fireEvent.press(view.getByLabelText("Continue to Plan"));
    fireEvent.changeText(view.getByLabelText("Debt account budget amount in pesos"), "75.25");
    fireEvent.press(view.getByLabelText("Back to plan setup"));
    expect(view.getByLabelText("Include debt repayments").props.accessibilityState.checked).toBe(true);
    fireEvent.press(view.getByLabelText("Continue to Plan"));
    expect(view.getByLabelText("Debt account budget amount in pesos").props.value).toBe("75.25");
    mockRequestFinancialPlanRecommendation.mockRejectedValueOnce(new Error("Try again."));
    fireEvent.press(view.getByLabelText("Recommend Budget Allocation"));
    await waitFor(() => expect(view.getByText("Try again.")).toBeTruthy());
    expect(view.getByLabelText("Debt account budget amount in pesos").props.value).toBe("75.25");
    fireEvent.press(view.getByLabelText("Recommend Budget Allocation"));
    await waitFor(() => expect(mockRequestFinancialPlanRecommendation).toHaveBeenCalledTimes(2));
    expect(mockRequestFinancialPlanRecommendation.mock.calls[1][5].commitmentBudgets).toEqual([{ key: "debt:debt-1:2026-10-20", amountCentavos: 7_525 }]);
  });

  it("loads current spending immediately after acceptance and keeps tracking insights when late AI text arrives", async () => {
    let resolveExplanations!: (value: string[]) => void;
    mockRequestFinancialPlanExplanations.mockReturnValue(new Promise<string[]>((resolve) => { resolveExplanations = resolve; }));
    mockGetFinancialPlanSpending.mockResolvedValue({ allocationSpending: { "subcategory:rent": 15_000 }, spentCentavos: 15_000 });
    const view = await openRecommendationForAcceptance({ evidence: {} });
    fireEvent.press(view.getByLabelText("Accept and save Financial Plan"));

    const summary = "You've spent ₱150.00 of your ₱600.00 category budget (25% used). ₱450.00 remaining.";
    await waitFor(() => expect(view.getByText(summary)).toBeTruthy());
    expect(mockGetFinancialPlanSpending).toHaveBeenCalledWith("user-1", "new-plan");
    expect(view.getByText("₱450.00 remaining of ₱600.00")).toBeTruthy();
    expect(view.queryByText("Recommendation insight.")).toBeNull();
    expect(view.queryByLabelText("Advanced plan settings")).toBeNull();
    await act(async () => { resolveExplanations(["Old recommendation from AI."]); });
    expect(view.getByText(summary)).toBeTruthy();
    expect(view.queryByText("Old recommendation from AI.")).toBeNull();
  });

  it("keeps a newly accepted plan saved when its spending cannot be read, without claiming zero spending", async () => {
    mockGetFinancialPlanSpending.mockRejectedValueOnce(new Error("Read unavailable"));
    const view = await openRecommendationForAcceptance();
    fireEvent.press(view.getByLabelText("Accept and save Financial Plan"));
    await waitFor(() => expect(view.getByLabelText("Reset Financial Plan")).toBeTruthy());
    expect(view.getByText("Your plan is saved. Spending insights are temporarily unavailable.")).toBeTruthy();
    expect(view.getByText("Unavailable")).toBeTruthy();
    expect(view.queryByText(/0% used/)).toBeNull();
    expect(view.queryByText("₱600.00 remaining of ₱600.00")).toBeNull();
    expect(view.queryByLabelText("Accept and save Financial Plan")).toBeNull();
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
    expect(view.queryByLabelText("Advanced plan settings")).toBeNull();
    expect(mockGetAcceptedFinancialPlanForPeriod).toHaveBeenCalledWith("user-1", "2026-10-01", "2026-10-31");
  });

  it("keeps excluded savings and debt sections hidden after reopening a saved plan", async () => {
    const savedPlan = await mockGetAcceptedFinancialPlanForPeriod();
    mockGetAcceptedFinancialPlanForPeriod.mockResolvedValue({ ...savedPlan, inputSnapshot: {
      ...savedPlan.inputSnapshot, commitmentSelection: { debtRepayments: false, savingsContributions: false },
    } });
    const view = render(<FinancialPlanScreen userId="user-1" deviceId="device-1" accessToken="token" syncVersion={0} />);
    await waitFor(() => expect(view.getByLabelText("Reset Financial Plan")).toBeTruthy());
    expect(view.queryByText("Debt repayments")).toBeNull();
    expect(view.queryByText("Savings contributions")).toBeNull();
  });

  it("shows saved billers between Savings & Debt and Category Allocations without deducting them again", async () => {
    const saved = await mockGetAcceptedFinancialPlanForPeriod();
    mockGetAcceptedFinancialPlanForPeriod.mockResolvedValue({ ...saved, inputSnapshot: { ...saved.inputSnapshot, obligations: { reservations: [
      { scheduledPaymentId: "rent", label: "Monthly rent", amountCentavos: 30_000, dueDate: "2026-10-20" },
    ] } } });
    const view = render(<FinancialPlanScreen userId="user-1" deviceId="device-1" accessToken="token" syncVersion={0} />);
    await waitFor(() => expect(view.getByText("Monthly rent")).toBeTruthy());
    expect(view.getByText(/Due 2026-10-20/)).toBeTruthy();
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

  it("allows a November preview before acceptance and hides advanced settings when returning to a saved plan", async () => {
    const savedOctoberPlan = await mockGetAcceptedFinancialPlanForPeriod();
    mockGetAcceptedFinancialPlanForPeriod.mockImplementation(async (_userId: string, start: string) => start === "2026-10-01" ? savedOctoberPlan : null).mockResolvedValueOnce(null);
    mockListFinancialAccounts.mockResolvedValue([{ kind: "cash", current_balance_centavos: 100_000 }]);
    mockListSubcategories.mockResolvedValue([{ id: "rent", category_id: null, label: "Rent", kind: "expense", minimum_amount_centavos: 50_000, fixed_amount_centavos: null, always_in_budget: true }]);
    mockRequestFinancialPlanRecommendation.mockResolvedValue({ response: { ok: true }, body: { payload: {
      status: "RECOMMENDATION_READY", period: { start: "2026-11-01", end: "2026-11-30" }, inputSnapshot: {}, explanations: [],
      recommendation: { availableFundsCentavos: 100_000, allocations: [{ subcategoryId: "rent", categoryId: null, allocationRule: "MINIMUM", allocatedAmountCentavos: 50_000, floorAmountCentavos: 50_000 }], debtReservations: [], savingsReservations: [] },
    } } });
    const view = render(<FinancialPlanScreen userId="user-1" deviceId="device-1" accessToken="token" syncVersion={0} />);
    await waitFor(() => expect(view.getByLabelText("Continue to Plan")).toBeTruthy());
    fireEvent.press(view.getByLabelText("Advanced plan settings"));
    fireEvent.press(view.getByLabelText("Next plan month"));
    await waitFor(() => expect(view.getByLabelText("Continue to Plan")).toBeTruthy());
    expect(mockGetAcceptedFinancialPlanForPeriod).toHaveBeenCalledWith("user-1", "2026-11-01", "2026-11-30");
    fireEvent.press(view.getByLabelText("Continue to Plan"));
    await waitFor(() => expect(view.getByText("Review your plan for 2026-11-01 to 2026-11-30.")).toBeTruthy());
    expect(mockRequestFinancialPlanRecommendation).toHaveBeenCalledWith("token", ["rent"], [], 100_000, [], { debtRepayments: true, savingsContributions: true }, expect.anything(), "2026-11");
    expect(view.getByText(/Development preview only/)).toBeTruthy();
    expect(view.queryByLabelText("Accept and save Financial Plan")).toBeNull();
    fireEvent.press(view.getByLabelText("Advanced plan settings"));
    fireEvent.press(view.getByLabelText("Previous plan month"));
    await waitFor(() => expect(view.getByLabelText("Reset Financial Plan")).toBeTruthy());
    expect(view.queryByText(/Development preview only/)).toBeNull();
    expect(view.queryByLabelText("Advanced plan settings")).toBeNull();
  });

  it("hides advanced month settings in production builds", async () => {
    const original = __DEV__;
    Object.defineProperty(globalThis, "__DEV__", { value: false, configurable: true, writable: true });
    try {
      const view = render(<FinancialPlanScreen userId="user-1" deviceId="device-1" accessToken="token" syncVersion={0} />);
      await waitFor(() => expect(view.getByText("Financial Plan")).toBeTruthy());
      expect(view.queryByLabelText("Advanced plan settings")).toBeNull();
    } finally {
      Object.defineProperty(globalThis, "__DEV__", { value: original, configurable: true, writable: true });
    }
  });

  it("shows the selection flow when only a previous-month plan was accepted", async () => {
    const previousPlan = await mockGetAcceptedFinancialPlanForPeriod();
    mockGetAcceptedFinancialPlanForPeriod.mockImplementation(async (_userId: string, start: string) => start === "2026-09-01" ? { ...previousPlan, periodStart: "2026-09-01", periodEnd: "2026-09-30" } : null);
    const view = render(<FinancialPlanScreen userId="user-1" deviceId="device-1" accessToken="token" syncVersion={0} />);

    await waitFor(() => expect(view.getByLabelText("Continue to Plan")).toBeTruthy());

    expect(view.queryByText("Remaining Money in Plan")).toBeNull();
    expect(mockGetAcceptedFinancialPlanForPeriod).toHaveBeenCalledWith("user-1", "2026-10-01", "2026-10-31");
  });

  it("reduces a saved allocation after its category receives a transaction", async () => {
    const view = render(<FinancialPlanScreen userId="user-1" deviceId="device-1" accessToken="token" syncVersion={0} />);
    await waitFor(() => expect(view.getByText("₱600.00 remaining of ₱600.00")).toBeTruthy());

    mockGetFinancialPlanSpending.mockResolvedValue({ allocationSpending: { "category:food": 10_000 }, spentCentavos: 10_000 });
    view.rerender(<FinancialPlanScreen userId="user-1" deviceId="device-1" accessToken="token" syncVersion={1} />);

    await waitFor(() => expect(view.getByText("₱500.00 remaining of ₱600.00")).toBeTruthy());
    expect(view.getByText("₱900.00")).toBeTruthy();
    expect(view.getByText("You've spent ₱100.00 of your ₱600.00 category budget (16.7% used). ₱500.00 remaining.")).toBeTruthy();
  });

  it("shows overspending as a negative remaining amount instead of zero", async () => {
    mockGetFinancialPlanSpending.mockResolvedValue({ allocationSpending: { "category:food": 75_000 }, spentCentavos: 75_000 });
    const view = render(<FinancialPlanScreen userId="user-1" deviceId="device-1" accessToken="token" syncVersion={0} />);

    await waitFor(() => expect(view.getByText("-₱150.00 remaining of ₱600.00 · over budget")).toBeTruthy());
  });

  it("shows spending over the plan funds without displaying a recommendation-editing warning", async () => {
    mockGetFinancialPlanSpending.mockResolvedValue({ allocationSpending: { "category:food": 120_000 }, spentCentavos: 120_000 });
    const view = render(<FinancialPlanScreen userId="user-1" deviceId="device-1" accessToken="token" syncVersion={0} />);
    await waitFor(() => expect(view.getByText("You've spent ₱1,200.00 of your ₱600.00 category budget (200% used). ₱600.00 over budget.")).toBeTruthy());
    expect(view.queryByText("Reduce allocations or surplus amounts before saving this plan.")).toBeNull();
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
    await waitFor(() => expect(selecting.getByLabelText("Continue to Plan")).toBeTruthy());
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
    await waitFor(() => expect(view.getByLabelText("Continue to Plan")).toBeTruthy());
    fireEvent.press(view.getByLabelText("Continue to Plan"));
    await waitFor(() => expect(view.getByText("Have another number in mind?")).toBeTruthy());

    fireEvent.changeText(view.getByLabelText("New planning amount in pesos"), "1000");
    fireEvent.press(view.getByLabelText("Refresh plan with new amount"));

    await waitFor(() => expect(mockRequestFinancialPlanRecommendation).toHaveBeenCalledTimes(2));
    expect(mockRequestFinancialPlanRecommendation.mock.calls[1][3]).toBe(100_000);
    expect(mockRunSync).toHaveBeenCalledWith("user-1", "device-1", "token", { pull: false });
  });

  it("shows the plan with its built-in explanations, then swaps in the AI explanations", async () => {
    mockGetAcceptedFinancialPlanForPeriod.mockResolvedValue(null);
    mockListFinancialAccounts.mockResolvedValue([{ kind: "cash", current_balance_centavos: 100_000 }]);
    mockListSubcategories.mockResolvedValue([{ id: "rent", category_id: null, label: "Rent", kind: "expense", minimum_amount_centavos: 75_000, fixed_amount_centavos: null, always_in_budget: true }]);
    const explanationRequest = { evidence: { planPeriodLabel: "November 2026" }, leading: [] };
    mockRequestFinancialPlanRecommendation.mockResolvedValueOnce({ response: { ok: true }, body: { payload: {
      status: "RECOMMENDATION_READY", period: { start: "2026-11-01", end: "2026-11-30" }, inputSnapshot: {}, explanations: ["Built-in explanation."], explanationRequest,
      recommendation: { availableFundsCentavos: 25_000, allocations: [{ subcategoryId: "rent", categoryId: null, allocationRule: "MINIMUM", allocatedAmountCentavos: 75_000, floorAmountCentavos: 75_000, ceilingAmountCentavos: 100_000, forecastAmountCentavos: 75_000 }], debtReservations: [], savingsReservations: [] },
    } } });
    let resolveExplanations: (value: string[]) => void = () => {};
    mockRequestFinancialPlanExplanations.mockReturnValueOnce(new Promise((resolve) => { resolveExplanations = resolve; }));

    const view = render(<FinancialPlanScreen userId="user-1" deviceId="device-1" accessToken="token" syncVersion={0} />);
    await waitFor(() => expect(view.getByLabelText("Continue to Plan")).toBeTruthy());
    fireEvent.press(view.getByLabelText("Continue to Plan"));

    await waitFor(() => expect(view.getByText("Built-in explanation.")).toBeTruthy());
    expect(mockRequestFinancialPlanExplanations).toHaveBeenCalledWith("token", explanationRequest);
    resolveExplanations(["AI explanation."]);
    await waitFor(() => expect(view.getByText("AI explanation.")).toBeTruthy());
    expect(view.queryByText("Built-in explanation.")).toBeNull();
  });

  it("leaves the loading state with an error when the recommendation request times out", async () => {
    mockGetAcceptedFinancialPlanForPeriod.mockResolvedValue(null);
    mockListFinancialAccounts.mockResolvedValue([{ kind: "cash", current_balance_centavos: 100_000 }]);
    mockListSubcategories.mockResolvedValue([{ id: "rent", category_id: null, label: "Rent", kind: "expense", minimum_amount_centavos: 75_000, fixed_amount_centavos: null, always_in_budget: true }]);
    const timeout = new Error("Aborted");
    timeout.name = "AbortError";
    mockRequestFinancialPlanRecommendation.mockRejectedValueOnce(timeout);

    const view = render(<FinancialPlanScreen userId="user-1" deviceId="device-1" accessToken="token" syncVersion={0} />);
    await waitFor(() => expect(view.getByLabelText("Continue to Plan")).toBeTruthy());
    fireEvent.press(view.getByLabelText("Continue to Plan"));

    await waitFor(() => expect(view.getByText("Your Financial Plan took too long to generate. Try again.")).toBeTruthy());
    expect(view.queryByText("Preparing this month's plan...")).toBeNull();
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
    await waitFor(() => expect(view.getByLabelText("Continue to Plan")).toBeTruthy());
    fireEvent.press(view.getByLabelText("Include debt repayments"));
    fireEvent.press(view.getByLabelText("Include savings contributions"));
    fireEvent.press(view.getByLabelText("Continue to Plan"));
    fireEvent.press(view.getByLabelText("Recommend Budget Allocation"));
    await waitFor(() => expect(view.getByLabelText("Skip Debt Repayments")).toBeTruthy());

    fireEvent.press(view.getByLabelText("Skip Debt Repayments"));
    expect(alert).toHaveBeenCalledWith("Skip debt repayments?", expect.stringContaining("may result in missed payments"), expect.any(Array));
    const actions = alert.mock.calls[0]![2] as { onPress?: () => void }[];
    await act(async () => {
      actions[1]!.onPress?.();
    });

    await waitFor(() => expect(view.getByText("Skipped plan commitments")).toBeTruthy());
    expect(mockRequestFinancialPlanRecommendation.mock.calls[1]![5]).toEqual({ debtRepayments: true, savingsContributions: false, commitmentBudgets: [] });
    alert.mockRestore();
  });

  it("shows commitment due dates and lets the user budget each amount", async () => {
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
    await waitFor(() => expect(view.getByLabelText("Continue to Plan")).toBeTruthy());

    fireEvent.press(view.getByLabelText("Include debt repayments"));
    fireEvent.press(view.getByLabelText("Include savings contributions"));
    fireEvent.press(view.getByLabelText("Continue to Plan"));
    fireEvent.press(view.getByLabelText("Recommend Budget Allocation"));
    await waitFor(() => expect(mockRequestFinancialPlanRecommendation).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(view.getByText(/Due 2026-11-12/)).toBeTruthy());
    expect(view.getByText("Debt repayments")).toBeTruthy();
    const debtAmount = view.getByLabelText("Debt account budget amount in pesos");
    expect(debtAmount.props.value).toBe("100.00");
    fireEvent.changeText(debtAmount, "75.00");
    expect(view.getByLabelText("Debt account budget amount in pesos").props.value).toBe("75.00");
  });

  it("defers generation until commitment amounts are reviewed and submits the user's budgets", async () => {
    mockGetAcceptedFinancialPlanForPeriod.mockResolvedValue(null);
    mockListFinancialAccounts.mockResolvedValue([{ kind: "cash", current_balance_centavos: 100_000 }]);
    mockListSubcategories.mockResolvedValue([{ id: "rent", category_id: null, label: "Rent", kind: "expense", minimum_amount_centavos: 20_000, fixed_amount_centavos: null }]);
    mockRequestFinancialPlanCommitments.mockResolvedValue({ period: { start: "2026-10-01", end: "2026-10-31" }, debtReservations: [{ debtAccountId: "debt-1", amountCentavos: 10_000, dueDate: "2026-10-20" }], savingsReservations: [{ savingsGoalId: "goal-1", amountCentavos: 5_000, dueDate: "2026-10-25" }] });
    const view = render(<FinancialPlanScreen userId="user-1" deviceId="device-1" accessToken="token" syncVersion={0} />);
    await waitFor(() => expect(view.getByLabelText("Continue to Plan")).toBeTruthy());
    expect(view.queryByLabelText("Debt account budget amount in pesos")).toBeNull();
    fireEvent.press(view.getByLabelText("Include debt repayments"));
    fireEvent.press(view.getByLabelText("Include savings contributions"));
    fireEvent.press(view.getByLabelText("Continue to Plan"));
    expect(view.getByText("Amount due: ₱100.00")).toBeTruthy();
    expect(view.queryByText("Category Allocations")).toBeNull();
    expect(mockRequestFinancialPlanRecommendation).not.toHaveBeenCalled();
    const debt = view.getByLabelText("Debt account budget amount in pesos");
    fireEvent(debt, "focus");
    fireEvent.changeText(debt, "");
    expect(view.getByLabelText("Recommend Budget Allocation").props.accessibilityState.disabled).toBe(true);
    fireEvent.changeText(debt, "7");
    fireEvent.changeText(debt, "75.");
    expect(view.getByLabelText("Debt account budget amount in pesos").props.value).toBe("75.");
    fireEvent.changeText(debt, "75.25");
    expect(view.getByText("Amount due: ₱100.00")).toBeTruthy();
    expect(view.getByText(/may result in a missed payment/)).toBeTruthy();
    fireEvent.press(view.getByLabelText("Recommend Budget Allocation"));
    await waitFor(() => expect(mockRequestFinancialPlanRecommendation).toHaveBeenCalled());
    expect(mockRequestFinancialPlanRecommendation.mock.calls[0][5].commitmentBudgets).toEqual([{ key: "debt:debt-1:2026-10-20", amountCentavos: 7_525 }, { key: "savings:goal-1:2026-10-25", amountCentavos: 5_000 }]);
  });

  it("recalculates remaining funds and prevents saving an increased commitment above the budget", async () => {
    mockGetAcceptedFinancialPlanForPeriod.mockResolvedValue(null);
    mockListFinancialAccounts.mockResolvedValue([{ kind: "cash", current_balance_centavos: 100_000 }]);
    mockListSubcategories.mockResolvedValue([{ id: "rent", category_id: null, label: "Rent", kind: "expense", minimum_amount_centavos: 20_000, fixed_amount_centavos: null }]);
    mockRequestFinancialPlanRecommendation.mockResolvedValue({ response: { ok: true }, body: { payload: {
      status: "RECOMMENDATION_READY", period: { start: "2026-10-01", end: "2026-10-31" }, inputSnapshot: { debtRequirements: { reservations: [{ debtAccountId: "debt-1", amountCentavos: 10_000, dueDate: "2026-10-20" }] } }, explanations: [],
      recommendation: { availableFundsCentavos: 90_000, allocations: [{ categoryId: "food", allocationRule: "FLEXIBLE", floorAmountCentavos: 0, allocatedAmountCentavos: 80_000 }], debtReservations: [{ debtAccountId: "debt-1", amountCentavos: 10_000, dueDate: "2026-10-20" }], savingsReservations: [] },
    } } });
    const view = render(<FinancialPlanScreen userId="user-1" deviceId="device-1" accessToken="token" syncVersion={0} />);
    await waitFor(() => expect(view.getByLabelText("Continue to Plan")).toBeTruthy());
    fireEvent.press(view.getByLabelText("Include debt repayments"));
    fireEvent.press(view.getByLabelText("Include savings contributions"));
    fireEvent.press(view.getByLabelText("Continue to Plan"));
    fireEvent.press(view.getByLabelText("Recommend Budget Allocation"));
    await waitFor(() => expect(view.getByText("Remaining Money in Plan")).toBeTruthy());
    fireEvent.changeText(view.getByLabelText("Debt account budget amount in pesos"), "300");
    expect(view.getByText("-₱100.00")).toBeTruthy();
    expect(view.queryByLabelText("Accept and save Financial Plan")).toBeNull();
    expect(view.getByLabelText("Update Budget Allocation")).toBeTruthy();
    expect(view.getByText("Amount due: ₱100.00")).toBeTruthy();
  });

  it("retains original amounts due when reopening a plan with a smaller budget", async () => {
    mockGetAcceptedFinancialPlanForPeriod.mockResolvedValue({ id: "plan-1", periodStart: "2026-10-01", periodEnd: "2026-10-31", inputSnapshot: { debtRequirements: { reservations: [{ debtAccountId: "debt-1", amountCentavos: 10_000, dueDate: "2026-10-20" }] } }, recommendation: { availableFundsCentavos: 92_500, allocations: [], debtReservations: [{ debtAccountId: "debt-1", amountCentavos: 7_500, dueDate: "2026-10-20" }], savingsReservations: [] } });
    const view = render(<FinancialPlanScreen userId="user-1" deviceId="device-1" accessToken="token" syncVersion={0} />);
    await waitFor(() => expect(view.getByText("Amount due: ₱100.00")).toBeTruthy());
    expect(view.getAllByText("₱75.00").length).toBeGreaterThan(0);
    expect(view.queryByLabelText("Debt account budget amount in pesos")).toBeNull();
  });

  it("lets the user reduce a commitment to resolve an infeasible plan", async () => {
    mockGetAcceptedFinancialPlanForPeriod.mockResolvedValue(null);
    mockListFinancialAccounts.mockResolvedValue([{ kind: "cash", current_balance_centavos: 100_000 }]);
    mockListSubcategories.mockResolvedValue([{ id: "rent", category_id: null, label: "Rent", kind: "expense", minimum_amount_centavos: 75_000, fixed_amount_centavos: null }]);
    const due = { debtAccountId: "loan", amountCentavos: 50_000, dueDate: "2026-10-20" };
    mockRequestFinancialPlanRecommendation.mockResolvedValue({ response: { ok: true }, body: { payload: { status: "INFEASIBLE", period: { start: "2026-10-01", end: "2026-10-31" }, inputSnapshot: { debtRequirements: { reservations: [due] } }, explanations: [], recommendation: { availableFundsCentavos: 50_000, requiredFundsCentavos: 125_000, shortfallCentavos: 25_000, allocations: [{ subcategoryId: "rent", allocationRule: "MINIMUM", floorAmountCentavos: 75_000, allocatedAmountCentavos: 75_000 }], debtReservations: [due], savingsReservations: [] } } } });
    const view = render(<FinancialPlanScreen userId="user-1" deviceId="device-1" accessToken="token" syncVersion={0} />);
    await waitFor(() => expect(view.getByLabelText("Continue to Plan")).toBeTruthy());
    fireEvent.press(view.getByLabelText("Include debt repayments"));
    fireEvent.press(view.getByLabelText("Include savings contributions"));
    fireEvent.press(view.getByLabelText("Continue to Plan"));
    fireEvent.press(view.getByLabelText("Recommend Budget Allocation"));
    await waitFor(() => expect(view.getByText("This plan cannot cover all requirements")).toBeTruthy());
    fireEvent.changeText(view.getByLabelText("Debt account budget amount in pesos"), "250");
    expect(view.queryByText("This plan cannot cover all requirements")).toBeNull();
    expect(view.queryByLabelText("Accept and save Financial Plan")).toBeNull();
    expect(view.getByText("Amount due: ₱500.00")).toBeTruthy();
    mockRequestFinancialPlanRecommendation.mockRejectedValueOnce(new Error("Budget recommendation unavailable."));
    fireEvent.press(view.getByLabelText("Update Budget Allocation"));
    await waitFor(() => expect(view.getByText("Budget recommendation unavailable.")).toBeTruthy());
    expect(view.queryByLabelText("Accept and save Financial Plan")).toBeNull();
    expect(mockCreateFinancialPlan).not.toHaveBeenCalled();
    expect(view.getByLabelText("Debt account budget amount in pesos").props.value).toBe("250.00");
    mockRequestFinancialPlanRecommendation.mockResolvedValueOnce({ response: { ok: true }, body: { payload: {
      status: "RECOMMENDATION_READY", period: { start: "2026-10-01", end: "2026-10-31" },
      inputSnapshot: { debtRequirements: { reservations: [due] } }, explanations: [],
      recommendation: { availableFundsCentavos: 75_000, allocations: [{ subcategoryId: "rent", allocationRule: "MINIMUM", floorAmountCentavos: 75_000, allocatedAmountCentavos: 75_000 }], debtReservations: [{ ...due, amountCentavos: 25_000 }], savingsReservations: [] },
    } } });
    fireEvent.press(view.getByLabelText("Update Budget Allocation"));
    await waitFor(() => expect(view.getByLabelText("Accept and save Financial Plan")).toBeTruthy());
    expect(mockRequestFinancialPlanRecommendation.mock.calls[2][5].commitmentBudgets).toEqual([{ key: "debt:loan:2026-10-20", amountCentavos: 25_000 }]);
    fireEvent.press(view.getByLabelText("Accept and save Financial Plan"));
    await waitFor(() => expect(mockCreateFinancialPlan).toHaveBeenCalled());
    expect(mockCreateFinancialPlan.mock.calls[0][2]).toMatchObject({ inputSnapshot: { debtRequirements: { reservations: [due] } }, recommendation: { availableFundsCentavos: 75_000 }, debtReservations: [{ ...due, amountCentavos: 25_000 }] });
  });
});
