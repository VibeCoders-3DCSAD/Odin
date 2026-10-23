import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import DashboardScreen from "../DashboardScreen";
import { useDashboardData } from "../hooks/useDashboardData";

jest.mock("../hooks/useDashboardData", () => ({ useDashboardData: jest.fn() }));
jest.mock("../../../services/connectivity", () => ({ useConnectivityStore: (select: (state: { online: boolean }) => unknown) => select({ online: false }) }));
jest.mock("../../../lib/api", () => ({ API_BASE_URL: "http://test", REQUEST_TIMEOUT_MS: 1000 }));
jest.mock("../hooks/useDashboardReminders", () => ({
  useDashboardReminders: () => ({
    loading: false,
    refresh: jest.fn(),
    data: {
      attention: { unavailable: false, items: [{ id: "bill", title: "Electric bill", detail: "Overdue payment", amountCentavos: 248000, date: "2026-10-20", target: { kind: "biller", id: "bill" } }] },
      upcoming: { unavailable: false, items: [{ id: "salary", title: "Expected salary", detail: "Expected income", amountCentavos: 1600000, date: "2026-10-29", target: { kind: "income", id: "salary" } }] },
    },
  }),
}));
jest.mock("../../../local-db/repositories/safeToSpend", () => ({
  getSafeToSpend: jest.fn(async () => ({
    periodEnd: "2026-10-31", daysLeft: 13, plannedCentavos: 850000, spentCentavos: 580000,
    leftCentavos: 270000, dailyCentavos: 20769,
    categories: [{ allocationId: "food", label: "Food budget", plannedCentavos: 400000, spentCentavos: 380000 }],
  })),
}));

const mockUseDashboardData = jest.mocked(useDashboardData);
const refresh = jest.fn();

function populatedData(): ReturnType<typeof useDashboardData> {
  return {
    summary: {
      currentBalanceCentavos: 6248000, currentMonthIncomeCentavos: 5200000, currentMonthExpenseCentavos: 3670000,
      previousMonthIncomeCentavos: 4800000, previousMonthExpenseCentavos: 3800000,
      accountCount: 1, incomeSourceCount: 1, budgetCount: 1, transactionCount: 2,
      categorySpending: [{ category_id: "food", category_label: "Food & Groceries", total_centavos: 3670000, icon_key: "tag", color_hex: "#864500" }],
      recentTransactions: [{ id: "lunch", transaction_type: "expense", amount_centavos: 32000, transaction_date: "2026-10-18T12:30:00+08:00", merchant_name: "Lunch", counterparty_name: null, category_label: "Food & Groceries", icon_key: "tag", color_hex: "#864500" }],
    },
    trends: [{ date: "2026-10-17", balance_centavos: 0, expense_centavos: 10000 }, { date: "2026-10-18", balance_centavos: -32000, expense_centavos: 32000 }],
    snapshots: {
      savings_goals: { id: "goals", user_id: "user", source: "savings_goals", updated_at: "2026-10-23", stale: false, payload_json: JSON.stringify({ count: 2, saved_centavos: 8250000 }) },
      forecast: { id: "forecast", user_id: "user", source: "forecast", updated_at: "2026-10-23", stale: false, payload_json: JSON.stringify({ modelVersion: "v1", status: "SUCCESS", forecasts: [{ category: "Essentials", month: "2026-11", quarter: "2026Q4", amountCentavos: 4930000, userBaselineCentavos: 4800000, hfceMultiplier: 1.027, hfceForecastAmountMillionPhp: 1000, explanation: "Monthly spending" }] }) },
    },
    loading: false, refreshing: false, summaryUnavailable: false, summaryStale: false, snapshotsUnavailable: false, error: null, refresh,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUseDashboardData.mockReturnValue(populatedData());
});

it("keeps every populated dashboard section, amounts and navigation", async () => {
  const onNavigate = jest.fn();
  const onOpenReminder = jest.fn();
  const view = render(<DashboardScreen userId="user" deviceId="device" accessToken="token" onNavigate={onNavigate} onOpenReminder={onOpenReminder} />);
  await waitFor(() => expect(view.getByText("₱2,700 left until Oct 31")).toBeTruthy());

  for (const title of ["Dashboard", "Available Balance", "Income", "Expenses", "Net monthly cash flow", "Savings goals", "Needs Attention", "Upcoming", "Savings & Debt Profile", "Trends", "Spending", "Recent", "Safe to spend", "Spending forecast"]) {
    expect(view.getAllByText(title).length).toBeGreaterThan(0);
  }
  for (const text of ["62,480", "52,000", "36,700", "₱15,300", "2 savings goals in progress · ₱82,500 saved.", "Electric bill", "Expected salary", "Emergency fund", "Debt burden", "Financial margin", "Credit card", "Lunch", "-₱320", "100%", "About ₱208 a day for 13 days.", "3.8k / 4k", "PHP 49,300"]) {
    expect(view.getAllByText(text).length).toBeGreaterThan(0);
  }
  const links: [string, string][] = [["View Savings goals", "savings-goals"], ["View all spending categories", "categories"], ["View all transactions", "transactions"], ["Open Financial Plan", "financial-plan"], ["View spending forecast", "spending-forecast"]];
  for (const [label, page] of links) {
    fireEvent.press(view.getByLabelText(label));
    expect(onNavigate).toHaveBeenLastCalledWith(page);
  }
  fireEvent.press(view.getByLabelText("Review Electric bill"));
  expect(onOpenReminder).toHaveBeenLastCalledWith({ kind: "biller", id: "bill" });
  fireEvent.press(view.getByLabelText("Review Expected salary"));
  expect(onOpenReminder).toHaveBeenLastCalledWith({ kind: "income", id: "salary" });
});

it("preserves available sections and retry when the summary fails", () => {
  mockUseDashboardData.mockReturnValue({ ...populatedData(), summaryUnavailable: true });
  const view = render(<DashboardScreen userId="user" deviceId="device" accessToken="token" onNavigate={jest.fn()} onOpenReminder={jest.fn()} />);
  for (const text of ["Dashboard", "Dashboard summary unavailable", "Expense trends", "Savings goals", "Spending forecast", "Needs Attention", "Upcoming"]) {
    expect(view.getByText(text)).toBeTruthy();
  }
  fireEvent.press(view.getByLabelText("Retry dashboard refresh"));
  expect(refresh).toHaveBeenCalledTimes(1);
});
