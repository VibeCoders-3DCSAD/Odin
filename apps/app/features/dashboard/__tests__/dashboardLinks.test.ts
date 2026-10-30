import { dashboardLinkHref } from "../helpers/dashboardLinks";
import { reminderTargetHref } from "../helpers/reminderTargets";
import { transactionFormHref } from "../../ledger/transactionFormRoute";
import { ROUTES } from "../../../routes";

describe("dashboard links", () => {
  it("maps every page the dashboard links to onto a route", () => {
    expect(dashboardLinkHref("financial-accounts")).toBe(ROUTES.moneyAccounts);
    expect(dashboardLinkHref("income-sources")).toBe(ROUTES.moneyIncome);
    expect(dashboardLinkHref("financial-plan")).toBe(ROUTES.planBudgets);
    expect(dashboardLinkHref("savings-goals")).toBe(ROUTES.planSavings);
    expect(dashboardLinkHref("transactions")).toBe(ROUTES.activity);
    expect(dashboardLinkHref("categories")).toBe(ROUTES.categories);
    expect(dashboardLinkHref("add-transaction")).toEqual(transactionFormHref());
    expect(dashboardLinkHref("financial-reports")).toEqual({ pathname: ROUTES.financialReports, params: { focus: "forecast" } });
    expect(dashboardLinkHref("insurance")).toBeNull();
  });

  it("opens every reminder target on its page", () => {
    expect(reminderTargetHref({ kind: "observation", id: "tx-1" })).toEqual({ pathname: ROUTES.spendingAlerts, params: { transactionId: "tx-1" } });
    expect(reminderTargetHref({ kind: "savings", id: "goal-1" })).toEqual({ pathname: ROUTES.planSavings, params: { goalId: "goal-1" } });
    expect(reminderTargetHref({ kind: "biller", id: "biller-1" })).toEqual({ pathname: ROUTES.biller, params: { id: "biller-1" } });
    expect(reminderTargetHref({ kind: "income", id: "income-1" })).toEqual({ pathname: ROUTES.incomeSource, params: { id: "income-1" } });
    expect(reminderTargetHref({ kind: "debt", id: "debt-1" })).toEqual({ pathname: ROUTES.planOtherDebt, params: { id: "debt-1" } });
    expect(reminderTargetHref({ kind: "credit_card", id: "card-1" })).toEqual({ pathname: ROUTES.planCreditCard, params: { id: "card-1" } });
  });
});
