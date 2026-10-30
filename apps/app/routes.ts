import type { Href } from "expo-router";

type RouteMap = { readonly [key: string]: Href | RouteMap };

// Every navigable path in one place; screens call router.push(ROUTES.dashboard)
// instead of hardcoding strings. Authenticated routes live in app/(app)/, a group
// that shares a guarded layout without adding a URL segment. Typed routes check each
// entry against the files in app/, so add a path here when its screen lands.
export const ROUTES = {
  login: "/login",
  registration: "/registration",
  forgotPassword: "/forgot-password",
  userOnboarding: "/user-onboarding",
  dashboard: "/dashboard",
  money: "/money",
  moneyAccounts: "/money/accounts",
  moneyIncome: "/money/income",
  moneyBillers: "/money/billers-remittances",
  activity: "/activity",
  // Build /activity/new links with transactionFormHref() from features/ledger/transactionFormRoute.
  transactionForm: "/activity/new",
  plan: "/plan",
  planDebts: "/plan/debts",
  planSavings: "/plan/savings",
  planBudgets: "/plan/budgets",
  settings: "/settings",
  categories: "/settings/categories",
  financialReports: "/financial-reports",
  spendingAlerts: "/spending-alerts",
} as const satisfies RouteMap;
