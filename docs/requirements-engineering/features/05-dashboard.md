## 5. Dashboard

This document describes the current Dashboard's functional behavior.

### 5.1 Financial Overview

- Display the available balance across active accounts included in the Dashboard.
- Display current-month income and expenses from recorded, posted transactions.
- Show income and expense comparisons with the previous month when available.
- Display net monthly cash flow as income less expenses.

### 5.2 Savings Goal Summary

- Display the available savings goal summary, including goal count and saved
  amount when available.
- Allow users to open Savings Goals or create a goal when none is available.
- Identify cached savings information and offer refresh when information is
  outdated or unavailable.

### 5.3 Savings and Debt Profile Classification

- Display savings and debt profile classification covering emergency savings, debt burden,
  financial margin, and credit-card behavior.
- Explain results in plain language, including emergency savings coverage,
  required debt payments relative to income, and money remaining after expenses
  and debt payments.
- Display credit-card results separately when multiple assessments are available.
- Distinguish credit-card behavior based on self-report from recorded history.
- Show Still learning guidance when a result or sufficient history is unavailable.
- Allow users to update their savings and debt profile classification using recorded financial information.
- Show loading feedback while classification is loading or updating and a recovery message when
  an update fails.

### 5.4 Balance vs Expense Trends

- Display a line chart comparing balance and expenses during the current month.
- Distinguish the balance and expense lines with separate colors and a legend.
- Show an empty chart explanation when there is no activity this month.
- When balance information is unavailable, show available expense trends.

### 5.5 Spending Pie Chart

- Display current-month spending distribution in a pie chart with total spending
  shown at the center.
- Show each category's color, name, and percentage of total spending.
- Display the four largest categories and group remaining spending under
  Other categories.
- Allow users to open the category list through View all.
- Show an empty chart explanation when no expenses were recorded this month.

### 5.6 Recent Transactions

- Display up to ten recent expenses, ordered from newest to oldest.
- Show the description, category, amount, and date or time for each expense.
- Allow users to open full transaction history through View all.
- Prompt users to record income or an expense when no transaction history exists.
- Explain when transaction history exists but no expenses have been recorded.
- The current Dashboard list contains expenses; full transaction history is
  available from the Transactions screen.

### 5.7 Safe to Spend

- Use the accepted Financial Plan covering the current date to summarize
  remaining spending allocations.
- Display the remaining amount and the end of the plan period.
- Show an approximate daily allowance for the remaining days when funds remain.
- Explain when the plan has no budget remaining or spending exceeds the plan.
- Show up to three allocations closest to their limits, with spent and planned
  amounts and progress bars.
- Use green, amber, and red progress bars to distinguish spending below,
  approaching, and reaching the planned amount.
- Allow users to open Financial Planning from the summary.
- Prompt users to create a Financial Plan when no applicable plan is available.
- Show loading feedback and an error message when plan information cannot load.

### 5.8 Spending Forecast Summary

- Display the available spending forecast period and total forecast amount.
- Explain that the forecast uses completed-month spending and national household
  consumption trends.
- Explain that posted financial activity is needed when no forecast is available.
- Offer Refresh when the forecast is outdated or unavailable.
- Display a View forecast details action.
- Keep detailed forecast analysis and unusual-spending alerts within
  [Financial Reports](13-financial-reports.md).
