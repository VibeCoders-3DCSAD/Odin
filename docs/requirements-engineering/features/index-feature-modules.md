# Odin Feature Modules

## Product Modules

1. [Dashboard](03-dashboard.md) provides a quick overview of a next-month
   spending forecast, recent transactions, Financial Plan health, savings goals,
   debts, and account activity.
2. [User Authentication](01-user-authentication.md) allows users to securely
   register, log in, log out, and recover their accounts.
3. [Savings and Debt Profile Classification](17-savings-and-debt-profile-classification.md)
   allows users to complete a questionnaire and receive savings and debt
   classifications. These classifications inform the Financial Plan and update
   over time from recorded financial data.
4. [User Onboarding](02-user-onboarding.md) guides new users through
   financial preferences, income sources, expense categories, current savings
   goals, and current debts.
5. [Financial Plan Management](18-financial-plan-management.md) allows
   users to manage an accepted or created season-appropriate budget, savings
   contribution schedule, and debt repayment plan based on expense forecasts,
   available income, savings and debt profile classification, financial
   obligations, savings goals, and target debt payoff dates.
6. [Cash Flow Management](12-cash-flow-management.md) allows users to
   record, view, categorize, update, and monitor income and expense
   transactions.
7. [Income and Expense Categories Management](10-income-and-expense-categories-management.md)
   allows users to view, create, update, and delete custom categories and
   subcategories used to classify income, expense, and transfer transactions.
8. [Billers and Remittances](11-billers-and-remittances.md) allows users to
   create, update, and delete current bills, essential expenses, payment
   schedules, and upcoming financial commitments.
9. [Income Sources and Accounts Management](04-income-sources-and-accounts-management.md)
   allows users to manage salaries, allowances, side income, and other sources
   of earnings, while organizing associated cash, bank accounts, and e-wallets
   based on recorded transactions and balances.
10. [Savings Goal Management](08-savings-goal-management.md) allows users to
   define targets such as emergency funds, tuition, rent, medical expenses, or
   planned purchases; record contributions; monitor cumulative progress; and
   project goal completion.
11. [Debt Management](07-debt-management.md) allows users to record debts,
    track balances and payments, compare snowball and avalanche repayment
    strategies to project payoff timelines, and identify potential debt risks
    caused by insufficient budgets or known upcoming expenses.
12. [User Settings](09-user-settings.md) allows users to manage their
    profile, preferences, notifications, security, and application
    configurations.
13. [Financial Reports](15-financial-reports.md) allows users to
    view summaries and reports of income, expenses, savings, and debt for
    specified periods and categories, including personalized spending forecasts
    and alerts for unusual expenses or spending patterns. See the supporting
    [spending forecast](14-spending-forecast.md) and [spending alerts](13-spending-alerts.md)
    specifications.

Budgeting is not a standalone module. Budget plans and legacy budget-data
behavior are part of Financial Plan Management.

[Offline Sync and Recovery](16-offline-sync-and-recovery.md) is a
cross-cutting capability that supports all product modules.
