import React from "react";
import { act, render, waitFor } from "@testing-library/react-native";
import TransactionHistoryScreen from "../TransactionHistoryScreen";
import { clearTransactionCache } from "../transactionCache";

const mockListTransactions = jest.fn();
const mockGetTransactionTotals = jest.fn();

jest.mock("../../../local-db/repositories/ledger/ledger", () => ({
  listTransactions: (...args: unknown[]) => mockListTransactions(...args),
  getTransactionTotals: (...args: unknown[]) => mockGetTransactionTotals(...args),
  getTransaction: jest.fn(),
  deleteTransaction: jest.fn(),
}));
jest.mock("../../../local-db/repositories/credit-cards/creditCardInstallments", () => ({ getCreditCardPurchaseMetadataForTransaction: jest.fn() }));
// Never resolves, so the category list does not update state after a test ends.
jest.mock("../../../local-db/repositories/ledger/taxonomy", () => ({ listCategories: () => new Promise(() => {}) }));
jest.mock("../../../local-db/repositories/alerts/unusualSpending", () => ({ confirmRecurringSpending: jest.fn() }));
jest.mock("../../../local-db/sync/runSync", () => ({ runSync: jest.fn() }));
jest.mock("../../../components/Toast", () => ({ useToast: () => ({ showToast: jest.fn() }) }));
jest.mock("../NewTransactionScreen", () => () => null);

function row(index: number) {
  return {
    id: `tx-${index}`,
    name: `Purchase ${index}`,
    transaction_type: "expense",
    transaction_date: "2026-10-01",
    amount_centavos: 1_000,
    category_label: null,
    financial_account_name: null,
    icon_key: null,
    color_hex: null,
    created_at: `2026-10-01T00:00:${String(index).padStart(2, "0")}Z`,
    row_id: index,
  };
}

function screen(userId: string, props: { syncVersion?: number; onLoadMoreChange?: (loadMore: (() => void) | null) => void } = {}) {
  return <TransactionHistoryScreen userId={userId} deviceId="device-1" accessToken="token" unusualSpending={null} onUnusualSpendingDismissed={() => {}} onNewTransaction={() => {}} {...props} />;
}

function renderScreen(userId: string) {
  return render(screen(userId));
}

const firstPage = Array.from({ length: 25 }, (_, index) => row(index));

describe("TransactionHistoryScreen cache", () => {
  beforeEach(() => {
    clearTransactionCache();
    mockListTransactions.mockReset();
    mockGetTransactionTotals.mockReset();
    mockListTransactions.mockResolvedValue(firstPage);
    mockGetTransactionTotals.mockResolvedValue({ income_centavos: 0, expense_centavos: 25_000 });
  });

  it("shows the cached list immediately after remounting and refreshes it in the background", async () => {
    const first = renderScreen("user-1");
    await waitFor(() => expect(first.getByText("Purchase 0")).toBeTruthy());
    first.unmount();

    let resolveRefresh: (rows: unknown[]) => void = () => {};
    mockListTransactions.mockReturnValueOnce(new Promise((resolve) => { resolveRefresh = resolve; }));
    const second = renderScreen("user-1");

    // The page mounts with the spinner so navigation is immediate, then paints the cache a frame later,
    // before the refresh query resolves.
    expect(second.queryByText("Purchase 0")).toBeNull();
    await waitFor(() => expect(second.getByText("Purchase 0")).toBeTruthy());
    expect(mockListTransactions).toHaveBeenLastCalledWith("user-1", expect.objectContaining({ limit: 25 }));

    resolveRefresh([{ ...row(99), name: "Added elsewhere" }, ...firstPage.slice(0, 24)]);
    await waitFor(() => expect(second.getByText("Added elsewhere")).toBeTruthy());
  });

  it("does not show another user's cached list", async () => {
    const first = renderScreen("user-1");
    await waitFor(() => expect(first.getByText("Purchase 0")).toBeTruthy());
    first.unmount();

    mockListTransactions.mockReturnValueOnce(new Promise(() => {}));
    const second = renderScreen("user-2");

    expect(second.queryByText("Purchase 0")).toBeNull();
  });

  it("refreshes every loaded page in place after a sync instead of falling back to the cached first page", async () => {
    let loadMore: (() => void) | null = null;
    const view = render(screen("user-1", { syncVersion: 0, onLoadMoreChange: (next) => { loadMore = next; } }));
    await waitFor(() => expect(view.getByText("Purchase 0")).toBeTruthy());

    const secondPage = Array.from({ length: 25 }, (_, index) => row(25 + index));
    mockListTransactions.mockResolvedValueOnce(secondPage);
    act(() => loadMore!());
    await waitFor(() => expect(view.getByText("Purchase 49")).toBeTruthy());

    let resolveRefresh: (rows: unknown[]) => void = () => {};
    mockListTransactions.mockReturnValueOnce(new Promise((resolve) => { resolveRefresh = resolve; }));
    view.rerender(screen("user-1", { syncVersion: 1, onLoadMoreChange: (next) => { loadMore = next; } }));

    expect(mockListTransactions).toHaveBeenLastCalledWith("user-1", expect.objectContaining({ limit: 50 }));
    // The loaded pages stay on screen while the refresh runs.
    expect(view.getByText("Purchase 49")).toBeTruthy();

    await act(async () => resolveRefresh([...firstPage, ...secondPage.slice(0, 24), { ...row(49), name: "Edited on another device" }]));
    expect(view.getByText("Edited on another device")).toBeTruthy();
    expect(view.getByText("Purchase 48")).toBeTruthy();
  });
});
