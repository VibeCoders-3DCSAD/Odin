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

  it("opens routed reminder targets and leaves the rest for later", () => {
    expect(reminderTargetHref({ kind: "observation", id: "tx-1" })).toEqual({ pathname: ROUTES.spendingAlerts, params: { transactionId: "tx-1" } });
    expect(reminderTargetHref({ kind: "savings", id: "goal-1" })).toEqual({ pathname: ROUTES.planSavings, params: { goalId: "goal-1" } });
    for (const kind of ["biller", "income", "debt", "credit_card"] as const) expect(reminderTargetHref({ kind, id: "x" })).toBeNull();
  });
});
