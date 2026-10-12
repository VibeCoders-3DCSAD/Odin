## 3. Dashboard

### 3.1 Financial Overview

- View current available balance
- View current-month income
- View current-month expenses
- View balance and expense trends
- View spending distribution
- View recent expenses
- View Financial Plan allocation health

### 3.2 Personal Finance Summary

- View savings goal summary
- View debt summary
- View a next-month spending forecast summary and navigate to Financial Reports
  for forecast details
- View empty states when financial data is unavailable
- View cached or stale information when a service is unavailable

### 3.3 Dashboard Empty States

- No financial accounts: prompt the user to add an account
- No transactions: prompt the user to record an income or expense
- No income sources: prompt the user to add an income source
- No Financial Plan: prompt the user to generate a Financial Plan
- No savings goals: prompt the user to create a savings goal
- No debts: show that no debts are currently recorded
- No forecast: explain that forecast information is not yet available
- No chart data: show an empty chart state instead of a misleading chart
- Partial data: display available sections without blocking the dashboard

### 3.4 Dashboard States

- Loading state: show dashboard loading feedback before local data is ready
- Loaded state: show available financial summaries
- Empty state: show relevant setup prompts when no records exist
- Partial state: show available data and empty states for missing modules
- Stale-data state: identify cached or outdated downstream information
- Error state: show a safe recovery message without hiding unaffected dashboard data

### 3.5 Dashboard Messages

#### Dashboard Error Messages

- Data error: `Some dashboard information is unavailable. Try refreshing to recover it.`
- Summary loading error: `Your dashboard summary could not be loaded. Review the available trends and insights, then try again.`
- Refresh error: `Dashboard refresh failed. Check your connection and try again.`
- Savings error: `Savings goal information is unavailable. Refresh to try again.`
- Debt error: `Debt information is unavailable. Refresh to try again.`
- Forecast error: `Forecast information is unavailable. Refresh to try again.`

#### Dashboard Notice Messages

- Loading state: `Your dashboard is loading. Please wait a moment.`
- Loaded state: `Your dashboard is ready. Review your financial overview.`
- Empty state: `Your dashboard has no financial activity yet. Add an account or record a transaction to get started.`
- Cached summary: `Cached dashboard summary. Refresh to view the latest information.`
- No financial accounts: `No financial accounts are available. Add an account to make your available balance accurate.`
- No income sources: `No income sources are available. Set expected income to make your monthly plan more useful.`
- No chart data: `No chart data is available. Record activity this month to see the chart.`
- No expenses: `No expenses were recorded this month. Record an expense to see spending data.`
- No recent transactions: `No recent transactions are available. Record income or an expense to get started.`
- No expenses recorded: `No expenses have been recorded yet. Record an expense to track spending.`
- No Financial Plan: `Allocation health is unavailable until you accept a Financial Plan. Generate a plan or refresh to try again.`
- No planned spending: `No spending is recorded for this Financial Plan period. Record an expense to see allocation health.`
- No forecast: `Forecast information is not yet available. Keep recording transactions to unlock personalized insights.`
- No savings goals: `No savings goals are available. Create a goal to start tracking progress.`
- No debts: `No debts are currently recorded. Add a debt when you need to track one.`

- Partial-data notice: `Some sections are unavailable right now, but your available information is still shown. Refresh to try loading the missing sections.`
- Allocation cached-data notice: `Cached Financial Plan data is being shown. Refresh to view the latest status.`
- Allocation-health stale notice: `Allocation health may be out of date. Refresh to check the latest status.`
- Allocation on-track notice: `{amount} remains in this Financial Plan period. Continue reviewing your spending.`
- Allocation warning notice: `{amount} remains in this Financial Plan period. Consider slowing spending in these categories.`
- Allocation low notice: `Only {amount} remains for the rest of this Financial Plan period. Review upcoming expenses and adjust your plan if needed.`
- Allocation reached notice: `This Financial Plan allocation has reached its planned amount. Review upcoming expenses and adjust your plan if needed.`

#### Dashboard Progress and Success Messages

- Refresh action: `Your dashboard needs fresh information. Refresh it to get the latest data.`
- Retry action: `Your dashboard could not recover the unavailable information. Refresh it and try again.`

### 3.6 Financial Plan Allocation Health States

- Healthy: spending is within the accepted Financial Plan allocation
- Warning: spending is approaching the accepted Financial Plan allocation
- Low: spending has exceeded the accepted Financial Plan allocation or the remaining allocation is insufficient for the rest of the cycle
- No-Financial-Plan state: explain that allocation health is unavailable until a Financial Plan is accepted
- No-spending state: show that allocation health has no recorded spending to evaluate
- Stale state: identify allocation health based on cached information
- Display the current health state with plain-language guidance
- Do not use shame-based language for the Low state

### 3.7 Dashboard Calculations

- Available balance: included account balances minus applicable outflows
- Net monthly cash flow: monthly income minus monthly expenses
- Financial Plan allocation health: actual spending compared with the accepted Financial Plan allocation
- Spending distribution: category or category-group expenses as a share of total expenses
