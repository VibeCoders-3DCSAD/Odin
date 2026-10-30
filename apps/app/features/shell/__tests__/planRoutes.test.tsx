jest.mock("expo-router", () => {
  const { useEffect } = require("react");
  return {
    router: { back: jest.fn(), canGoBack: jest.fn(() => true), replace: jest.fn(), push: jest.fn() },
    useFocusEffect: (effect: () => void | (() => void)) => useEffect(effect, [effect]),
    useLocalSearchParams: jest.fn(() => ({})),
  };
});
jest.mock("phosphor-react-native", () => {
  const Stub = () => null;
  return new Proxy({ __esModule: true }, { get: (_target, key) => (key === "__esModule" ? true : Stub) });
});
jest.mock("react-native-safe-area-context", () => {
  const { View } = require("react-native");
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }) };
});
jest.mock("../../auth/components/AccessProvider", () => ({ useSession: () => ({ accessToken: "token", userId: "user-1", deviceId: "device-1" }) }));
jest.mock("../../sync/SyncProvider", () => ({
  useSync: () => ({ syncing: false, queueCount: 0, syncVersion: 0, syncMessage: null, handleSync: jest.fn() }),
}));
jest.mock("../../../local-db/repositories/financialAccounts", () => ({ getFinancialAccount: jest.fn() }));
jest.mock("../../../local-db/repositories/debtAccounts", () => ({ listDebtAccounts: jest.fn() }));
jest.mock("../../../local-db/repositories/financialPlans", () => ({ getFinancialPlan: jest.fn() }));
// Screens are stubs that render their name; tests drive them through the props the route passes.
function mockScreen(name: string) {
  const { Text } = require("react-native");
  return { __esModule: true, default: jest.fn(() => <Text>{name}</Text>) };
}
jest.mock("../../debt-manager/DebtManagerOverview", () => mockScreen("DebtManagerOverview"));
jest.mock("../../debt-manager/DebtManagerScreen", () => mockScreen("DebtManagerScreen"));
jest.mock("../../debt-manager/NonCreditDebtListScreen", () => mockScreen("NonCreditDebtListScreen"));
jest.mock("../../debt-manager/NonCreditDebtDetailScreen", () => mockScreen("NonCreditDebtDetailScreen"));
jest.mock("../../financial-plan/FinancialPlanScreen", () => mockScreen("FinancialPlanScreen"));
jest.mock("../../financial-plan/PastFinancialPlansScreen", () => mockScreen("PastFinancialPlansScreen"));
jest.mock("../../financial-plan/PastFinancialPlanDetailScreen", () => mockScreen("PastFinancialPlanDetailScreen"));

import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { router, useLocalSearchParams } from "expo-router";
import DebtsRoute from "../../../app/(app)/(shell)/(tabs)/plan/debts";
import BudgetsRoute from "../../../app/(app)/(shell)/(tabs)/plan/budgets";
import CreditCardsRoute from "../../../app/(app)/(shell)/plan/debts/credit-cards/index";
import CreditCardRoute from "../../../app/(app)/(shell)/plan/debts/credit-cards/[id]";
import OtherDebtsRoute from "../../../app/(app)/(shell)/plan/debts/other/index";
import OtherDebtRoute from "../../../app/(app)/(shell)/plan/debts/other/[id]";
import PastPlansRoute from "../../../app/(app)/(shell)/plan/budgets/history/index";
import PastPlanRoute from "../../../app/(app)/(shell)/plan/budgets/history/[id]";
import DebtManagerOverview from "../../debt-manager/DebtManagerOverview";
import DebtManagerScreen from "../../debt-manager/DebtManagerScreen";
import NonCreditDebtListScreen from "../../debt-manager/NonCreditDebtListScreen";
import NonCreditDebtDetailScreen from "../../debt-manager/NonCreditDebtDetailScreen";
import FinancialPlanScreen from "../../financial-plan/FinancialPlanScreen";
import PastFinancialPlansScreen from "../../financial-plan/PastFinancialPlansScreen";
import PastFinancialPlanDetailScreen from "../../financial-plan/PastFinancialPlanDetailScreen";
import { transactionFormHref } from "../../ledger/transactionFormRoute";
import { getFinancialAccount } from "../../../local-db/repositories/financialAccounts";
import { listDebtAccounts } from "../../../local-db/repositories/debtAccounts";
import { getFinancialPlan } from "../../../local-db/repositories/financialPlans";
import { ROUTES } from "../../../routes";

// The props the route last rendered a stubbed screen with.
function propsOf<P>(screen: React.ComponentType<P>): P {
  const calls = jest.mocked(screen as unknown as jest.Mock).mock.calls;
  return calls[calls.length - 1][0] as P;
}

function withId(id: string | string[] | undefined) {
  jest.mocked(useLocalSearchParams).mockReturnValue({ id } as never);
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(router.canGoBack).mockReturnValue(true);
  jest.mocked(useLocalSearchParams).mockReturnValue({});
});

describe("Plan tab pages", () => {
  it("opens the debt lists and details from the Debts overview", () => {
    render(<DebtsRoute />);
    const props = propsOf(DebtManagerOverview);
    props.onOpenCreditCards();
    expect(router.push).toHaveBeenLastCalledWith(ROUTES.planCreditCards);
    props.onOpenNonCreditDebts();
    expect(router.push).toHaveBeenLastCalledWith(ROUTES.planOtherDebts);
    props.onOpenCard!("card-1");
    expect(router.push).toHaveBeenLastCalledWith({ pathname: ROUTES.planCreditCard, params: { id: "card-1" } });
    props.onOpenDebt!("debt-1");
    expect(router.push).toHaveBeenLastCalledWith({ pathname: ROUTES.planOtherDebt, params: { id: "debt-1" } });
  });

  it("opens past plans from the Budget page", () => {
    render(<BudgetsRoute />);
    propsOf(FinancialPlanScreen).onOpenPastPlans!();
    expect(router.push).toHaveBeenLastCalledWith(ROUTES.planPastPlans);
  });

});

describe("list pages", () => {
  it("opens a credit card and falls back to Debts without history", () => {
    const screen = render(<CreditCardsRoute />);
    expect(screen.getByText("Credit Cards")).toBeTruthy();
    expect(propsOf(DebtManagerScreen).accountId).toBeUndefined();
    propsOf(DebtManagerScreen).onOpenCard!("card-1");
    expect(router.push).toHaveBeenLastCalledWith({ pathname: ROUTES.planCreditCard, params: { id: "card-1" } });
    jest.mocked(router.canGoBack).mockReturnValue(false);
    fireEvent.press(screen.getByLabelText("Back"));
    expect(router.replace).toHaveBeenLastCalledWith(ROUTES.planDebts);
  });

  it("opens a non-credit debt and falls back to Debts without history", () => {
    const screen = render(<OtherDebtsRoute />);
    propsOf(NonCreditDebtListScreen).onOpenDebt("debt-1");
    expect(router.push).toHaveBeenLastCalledWith({ pathname: ROUTES.planOtherDebt, params: { id: "debt-1" } });
    jest.mocked(router.canGoBack).mockReturnValue(false);
    fireEvent.press(screen.getByLabelText("Back"));
    expect(router.replace).toHaveBeenLastCalledWith(ROUTES.planDebts);
  });

  it("opens a past plan and falls back to Budget without history", () => {
    const screen = render(<PastPlansRoute />);
    propsOf(PastFinancialPlansScreen).onOpenPlan("plan-1");
    expect(router.push).toHaveBeenLastCalledWith({ pathname: ROUTES.planPastPlan, params: { id: "plan-1" } });
    jest.mocked(router.canGoBack).mockReturnValue(false);
    fireEvent.press(screen.getByLabelText("Back"));
    expect(router.replace).toHaveBeenLastCalledWith(ROUTES.planBudgets);
  });
});

describe("credit card detail", () => {
  it("refuses malformed ids without querying", async () => {
    for (const id of ["../card", "card 1", ["card-1", "card-2"], undefined]) {
      withId(id as string);
      const screen = render(<CreditCardRoute />);
      expect(await screen.findByText("This credit card can't be opened")).toBeTruthy();
      screen.unmount();
    }
    expect(getFinancialAccount).not.toHaveBeenCalled();
    expect(DebtManagerScreen).not.toHaveBeenCalled();
  });

  it("shows not found for another user's card or a non-card account, with a way back", async () => {
    withId("card-1");
    jest.mocked(getFinancialAccount).mockResolvedValueOnce(null);
    const screen = render(<CreditCardRoute />);
    expect(await screen.findByText("This credit card can't be opened")).toBeTruthy();
    expect(getFinancialAccount).toHaveBeenCalledWith("user-1", "card-1");
    jest.mocked(router.canGoBack).mockReturnValue(false);
    fireEvent.press(screen.getByLabelText("Go back"));
    expect(router.replace).toHaveBeenLastCalledWith(ROUTES.planCreditCards);
    screen.unmount();

    jest.mocked(getFinancialAccount).mockResolvedValueOnce({ id: "card-1", kind: "cash" } as never);
    expect(await render(<CreditCardRoute />).findByText("This credit card can't be opened")).toBeTruthy();
    expect(DebtManagerScreen).not.toHaveBeenCalled();
  });

  it("pays and edits statement payments through the transaction form", async () => {
    withId("card-1");
    jest.mocked(getFinancialAccount).mockResolvedValue({ id: "card-1", kind: "credit_card" } as never);
    const screen = render(<CreditCardRoute />);
    await screen.findByText("DebtManagerScreen");
    const props = propsOf(DebtManagerScreen);
    expect(props).toMatchObject({ userId: "user-1", deviceId: "device-1", accountId: "card-1" });
    props.onPayStatement!({ statementId: "st-1", cycleId: "cy-1" });
    expect(router.push).toHaveBeenLastCalledWith(transactionFormHref({ kind: "pay-statement", statementId: "st-1", cycleId: "cy-1" }));
    props.onEditPayment!({ id: "pay-1", transaction_id: "tx-1", statement_id: "st-1", cycle_id: "cy-1" } as never);
    expect(router.push).toHaveBeenLastCalledWith(transactionFormHref({ kind: "edit-statement-payment", transactionId: "tx-1", statementId: "st-1", cycleId: "cy-1" }));
    jest.mocked(router.canGoBack).mockReturnValue(false);
    act(() => props.onBack!());
    expect(router.replace).toHaveBeenLastCalledWith(ROUTES.planCreditCards);
  });
});

describe("non-credit debt detail", () => {
  it("shows not found for a debt this user does not have", async () => {
    withId("debt-2");
    jest.mocked(listDebtAccounts).mockResolvedValue([{ id: "debt-1" }] as never);
    const screen = render(<OtherDebtRoute />);
    expect(await screen.findByText("This debt can't be opened")).toBeTruthy();
    expect(listDebtAccounts).toHaveBeenCalledWith("user-1", "all");
    expect(NonCreditDebtDetailScreen).not.toHaveBeenCalled();
  });

  it("refuses malformed ids without querying", async () => {
    withId("debt-1;drop");
    expect(await render(<OtherDebtRoute />).findByText("This debt can't be opened")).toBeTruthy();
    expect(listDebtAccounts).not.toHaveBeenCalled();
  });

  it("records and edits debt payments through the transaction form", async () => {
    withId("debt-1");
    jest.mocked(listDebtAccounts).mockResolvedValue([{ id: "debt-1" }] as never);
    const screen = render(<OtherDebtRoute />);
    await screen.findByText("NonCreditDebtDetailScreen");
    const props = propsOf(NonCreditDebtDetailScreen);
    expect(props.debtId).toBe("debt-1");
    props.onRecordPayment("debt-1");
    expect(router.push).toHaveBeenLastCalledWith(transactionFormHref({ kind: "record-debt-payment", debtAccountId: "debt-1" }));
    props.onEditPayment({ id: "dp-1", debt_account_id: "debt-1", transaction_id: "tx-1" } as never);
    expect(router.push).toHaveBeenLastCalledWith(transactionFormHref({ kind: "edit-debt-payment", transactionId: "tx-1", debtPaymentId: "dp-1", debtAccountId: "debt-1" }));
    jest.mocked(router.canGoBack).mockReturnValue(false);
    act(() => props.onBack());
    expect(router.replace).toHaveBeenLastCalledWith(ROUTES.planOtherDebts);
  });
});

describe("past plan detail", () => {
  it("shows not found for a plan this user does not have", async () => {
    withId("plan-1");
    jest.mocked(getFinancialPlan).mockResolvedValue(null);
    const screen = render(<PastPlanRoute />);
    expect(await screen.findByText("This plan can't be opened")).toBeTruthy();
    expect(getFinancialPlan).toHaveBeenCalledWith("user-1", "plan-1");
    expect(PastFinancialPlanDetailScreen).not.toHaveBeenCalled();
  });

  it("opens the user's plan and goes back to past plans", async () => {
    withId("plan-1");
    jest.mocked(getFinancialPlan).mockResolvedValue({ id: "plan-1" } as never);
    const screen = render(<PastPlanRoute />);
    await waitFor(() => expect(screen.getByText("PastFinancialPlanDetailScreen")).toBeTruthy());
    expect(propsOf(PastFinancialPlanDetailScreen).planId).toBe("plan-1");
    jest.mocked(router.canGoBack).mockReturnValue(false);
    act(() => propsOf(PastFinancialPlanDetailScreen).onBack());
    expect(router.replace).toHaveBeenLastCalledWith(ROUTES.planPastPlans);
  });
});
