## 3. Dashboard

### 3.1 Financial Overview

- View current available balance
- View current-month income
- View current-month expenses
- View balance and expense trends
- View spending distribution
- View recent expenses
- View budget health

### 3.2 Personal Finance Summary

- View savings goal summary
- View debt summary
- View alerts summary
- View spending forecast and insights
- View empty states when financial data is unavailable
- View cached or stale information when a service is unavailable

### 3.3 Dashboard Empty States

- No financial accounts: prompt the user to add an account
- No transactions: prompt the user to record an income or expense
- No income sources: prompt the user to add an income source
- No budget: prompt the user to create a budget
- No savings goals: prompt the user to create a savings goal
- No debts: show that no debts are currently recorded
- No alerts: show that there are no alerts to review
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
- Alerts error: `Alerts are unavailable. Refresh to try again.`
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
- No budget: `Budget health is unavailable until a current status is calculated. Create a budget or refresh to try again.`
- No budget spending: `No spending is recorded for this budget. Record an expense to see budget health.`
- No alerts: `There are no alerts to review. Return later for new updates.`
- No forecast: `Forecast information is not yet available. Keep recording transactions to unlock personalized insights.`
- No savings goals: `No savings goals are available. Create a goal to start tracking progress.`
- No debts: `No debts are currently recorded. Add a debt when you need to track one.`

- Partial-data notice: `Some sections are unavailable right now, but your available information is still shown. Refresh to try loading the missing sections.`
- Budget cached-data notice: `Cached budget data is being shown. Refresh to view the latest status.`
- Budget-health stale notice: `Budget health may be out of date. Refresh to check the latest status.`
- Budget on-track notice: `{amount} remains in this budget cycle. Continue reviewing your spending.`
- Budget warning notice: `{amount} remains in this budget cycle. Consider slowing spending in these categories.`
- Budget critical notice: `Only {amount} remains for the rest of this budget cycle. Review upcoming expenses and adjust your plan if needed.`
- Budget reached notice: `This budget has reached its planned amount. Review upcoming expenses and adjust your plan if needed.`

#### Dashboard Progress and Success Messages

- Refresh action: `Your dashboard needs fresh information. Refresh it to get the latest data.`
- Retry action: `Your dashboard could not recover the unavailable information. Refresh it and try again.`

### 3.6 Budget Health States

- Healthy: spending is within the current budget allocation
- Warning: spending is approaching the current budget allocation
- Low: spending has exceeded the current budget allocation or the remaining budget is insufficient for the rest of the cycle
- No-budget state: explain that budget health is unavailable until a budget is created
- No-spending state: show that budget health has no recorded spending to evaluate
- Stale state: identify budget health based on cached information
- Display the current health state with plain-language guidance
- Do not use shame-based language for the Low state

### 3.7 Dashboard Calculations

- Available balance: included account balances minus applicable outflows
- Net monthly cash flow: monthly income minus monthly expenses
- Budget health: actual spending compared with budget allocation
- Spending distribution: category or category-group expenses as a share of total expenses
