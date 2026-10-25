## 13. Financial Reports

### 13.1 Report Review and Periods

- Allow users to review financial summaries, spending forecasts, and unusual-spending observations within Financial Reports.
- Offer This month, Last month, This year, and This week as reporting periods.
- Also allow users to choose a custom date range with a start date and an end date on or after it.
- Show the dates covered by the selected reporting period.
- Allow users to refresh report information and update locally calculated summaries after transaction synchronization.
- Keep current savings and debt summaries clearly distinguishable from activity measured within the selected reporting period.

### 13.2 Report Filters

- Allow users to filter applicable report activity by account, category, and transaction type.
- Allow users to combine those filters with the selected reporting period or custom date range.
- Clearly identify the active filters and allow users to reset them.
- Explain when no activity matches the selected dates and filters.
- Keep current-position summaries and the future forecast clearly identified where they are independent of the selected historical activity range.

### 13.3 Cash Outflow Breakdown

- Show a `Where it went` breakdown of recorded cash outflow for the selected reporting period.
- Include expenses and explicit savings contributions in cash outflow while excluding ordinary transfers between accounts.
- Show a cash outflow pie chart with amounts and percentage shares.
- Distinguish debt repayments and savings contributions from other spending categories in the outflow breakdown.
- Show the top spending categories and their amounts for the period.

### 13.4 Forecast Versus Actual

- Compare last month's forecast spending with its recorded actual spending, independently of the selected reporting period.
- Show the forecast, actual spending, and amount over or under forecast.
- Show up to three categories with the largest absolute differences from the forecast, identifying whether each was over or under.
- Use the latest forecast saved during that month when available and show its saved date.
- When no saved run covers that month, request a forecast as of its first day using earlier spending. Label this result as recalculated and require an online connection for the request.
- Explain when earlier spending is insufficient or the comparison cannot be loaded without blocking other report sections.

### 13.5 Financial Plan Summaries

- Show budget versus actual spending using accepted Financial Plans that overlap the selected reporting period.
- Show the planned amount, recorded actual expenses, and the amount under or over budget.
- Include the relevant accepted monthly plans when reviewing a period spanning multiple months.
- Show current-cycle category, debt, and savings allocations together with total cash outflow for that plan cycle.
- Include extra amounts directed toward debt or savings in the corresponding allocation totals.
- Explain when no accepted Financial Plan overlaps the selected period.

### 13.6 Savings and Debt Summaries

- Show combined saved amounts, combined goal targets, and the proportion of those targets funded.
- Base savings progress on goal starting amounts and recorded contributions less withdrawals, without interest.
- Include retained archived goals in the combined savings summary and exclude deleted goals.
- Show original debt amounts, amounts paid down, and remaining balances for non-credit-card debts that are active or paid off.
- Exclude archived and deleted debts from that debt summary.
- Present savings and debt summaries as current totals, independently of the selected historical reporting period.
- Explain when no savings targets or eligible debts are available.

### 13.7 Spending Forecast

- Provide a spending outlook starting with the current Philippine calendar month, with monthly and quarterly views when at least six months of spending history support a monthly baseline. Use a quarterly view for provisional forecasts.
- Offer monthly ranges covering the past six months, three past and three forecast months, or six forecast months starting with the current month.
- Offer quarterly ranges covering the past six quarters, three past and three forecast quarters, or two past and four forecast quarters starting with the current quarter. Show available points when history is shorter than the selected range.
- Show total projected spending and allow users to select a category to inspect its projected spending over time.
- Include available historical spending alongside projections and visually distinguish actual activity from forecasts.
- Allow users to select a month or quarter and review its dates and total or category amount.
- Show current-month or current-quarter spending so far against its forecast, including category comparisons and amounts over forecast.
- Account for scheduled bills and remittances separately from other forecast spending to avoid double counting.
- Identify scheduled-payment projections as based on the user's recorded billers and remittances.
- Use recorded spending history while excluding unusual expenses identified as one-time or awaiting an answer. Include confirmed frequent spending in the ordinary baseline and project confirmed yearly payments in their recurring month.
- Explain projected changes, relatively expensive periods, and major spending categories in simple language.
- Make clear that forecasts are estimates and actual spending may differ.
- Keep the forecast's future horizon separate from the reporting period used for historical summaries.

### 13.8 Forecast Reliability and Availability

- Explain when limited spending history makes a forecast provisional rather than sufficiently personalized.
- Explain when insufficient seasonal history means the forecast may omit seasonal peaks and uses typical monthly spending instead.
- Guide users to record financial activity when there is not enough information to produce a forecast.
- Refresh forecasts through the connected forecasting service.
- Keep the last saved forecast available while a refresh is in progress or unsuccessful, including when offline.
- Indicate when saved forecast information may be outdated.
- Show useful forecast interpretations without requiring additional generated wording to finish first.
- Preserve an available forecast when optional interpretation generation fails.
- Keep up to five saved forecast runs per user per calendar month for later forecast-versus-actual review.

### 13.9 Unusual-Spending Observations

- Show saved unusual-spending observations within Financial Reports.
- Identify expenses that are unusually high or low compared with the user's own earlier spending in the same subcategory.
- Show the observed amount, usual spending range, subcategory, and transaction date in the observation list.
- Allow users to open an observation to review its usual spending amount, supporting history count, and account when available.
- Present observations as personal spending comparisons rather than claims of fraud or financial wrongdoing.
- Allow users to refresh the locally available observation list and review it offline.
- Provide a clear empty view when no saved unusual-spending observations exist.

### 13.10 Frequent Spending Confirmation

- Allow users to classify an identified unusual expense as one-time, frequent, or yearly.
- Include confirmed frequent spending in the history used for future comparisons in that subcategory.
- Keep one-time spending outside the usual-spending baseline and forecast. Include yearly payments in forecasts for their recurring month.
- Show the user's saved answer and explain its effect on future comparisons or forecasts.
- Keep the observation available for review after confirmation.
- Preserve the user's answer and allow retry when confirmation cannot be completed.

### 13.11 Feedback and Offline Reporting

- Calculate core report summaries from locally available financial data without requiring an internet connection.
- Distinguish locally calculated summaries from forecasts that require an online refresh.
- Show loading, empty, and error feedback for individual report sections so one unavailable section does not prevent review of the others.
- Explain invalid custom date ranges and unavailable report information clearly.
- Keep report information scoped to the current user's financial records.
- Keep all summaries and percentages clearly labeled so users can distinguish activity totals, current balances, planned amounts, actual spending, and estimates.
