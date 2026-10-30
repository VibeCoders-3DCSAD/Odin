import type { Href } from "expo-router";
import { ROUTES } from "../../../routes";
import { billerHref, incomeSourceHref } from "../../money/moneyRoutes";
import type { DashboardItemTarget } from "../types";

// Where a dashboard reminder opens. Null means its page is not routed yet, so the reminder does nothing.
export function reminderTargetHref(target: DashboardItemTarget): Href | null {
  switch (target.kind) {
    case "observation": return { pathname: ROUTES.spendingAlerts, params: { transactionId: target.id } };
    case "savings": return { pathname: ROUTES.planSavings, params: { goalId: target.id } };
    case "biller": return billerHref(target.id);
    case "income": return incomeSourceHref(target.id);
    case "debt": return null;
    case "credit_card": return null;
  }
}
