// Every navigable path in one place; screens call router.push(ROUTES.money.income)
// instead of hardcoding strings. Authenticated routes live in app/(app)/, a group
// that shares a guarded layout without adding a URL segment.
export const ROUTES = {
  login: "/login",
  registration: "/registration",
  forgotPassword: "/forgot-password",
  userOnboarding: "/user-onboarding",
  dashboard: "/dashboard",
  money: {
    index: "/money",
    income: "/money/income",
    accounts: "/money/accounts",
    billersRemittances: "/money/billers-remittances",
  },
  activity: "/activity",
  plan: {
    savings: "/plan/savings",
    debts: "/plan/debts",
    budgets: "/plan/budgets",
  },
  settings: "/settings",
  financialReports: "/financial-reports",
} as const;
