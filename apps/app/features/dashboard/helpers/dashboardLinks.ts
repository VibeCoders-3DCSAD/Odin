import type { Href } from "expo-router";
import { ROUTES } from "../../../routes";
import { transactionFormHref } from "../../ledger/transactionFormRoute";

// DashboardScreen names its links by page; these are the routes they open. Unknown names open nothing.
export function dashboardLinkHref(page: string): Href | null {
  switch (page) {
    case "financial-accounts": return ROUTES.moneyAccounts;
    case "income-sources": return ROUTES.moneyIncome;
    case "financial-plan": return ROUTES.planBudgets;
    case "savings-goals": return ROUTES.planSavings;
    case "transactions": return ROUTES.activity;
    case "add-transaction": return transactionFormHref();
    case "categories": return ROUTES.categories;
    // Reports scrolls down to the forecast when opened from here.
    case "financial-reports": return { pathname: ROUTES.financialReports, params: { focus: "forecast" } };
    default: return null;
  }
}
