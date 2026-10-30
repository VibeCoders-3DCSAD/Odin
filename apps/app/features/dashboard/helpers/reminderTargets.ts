import type { Href } from "expo-router";
import { ROUTES } from "../../../routes";
import { billerHref, incomeSourceHref } from "../../money/moneyRoutes";
import type { DashboardItemTarget } from "../types";

// Where a dashboard reminder opens.
export function reminderTargetHref(target: DashboardItemTarget): Href {
  switch (target.kind) {
    case "observation": return { pathname: ROUTES.spendingAlerts, params: { transactionId: target.id } };
    case "savings": return { pathname: ROUTES.planSavings, params: { goalId: target.id } };
    case "biller": return billerHref(target.id);
    case "income": return incomeSourceHref(target.id);
    case "debt": return { pathname: ROUTES.planOtherDebt, params: { id: target.id } };
    case "credit_card": return { pathname: ROUTES.planCreditCard, params: { id: target.id } };
  }
}
