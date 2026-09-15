## 15. Reports and Analytics Module

### 15.1 Report Creation

- Generate weekly reports
- Generate monthly reports
- Generate custom date-range reports
- View cached reports offline
- View report freshness information

### 15.2 Report Content

- View income summaries
- View expense summaries
- View cash-flow summaries
- View account summaries
- View budget-versus-actual results
- View forecast-versus-actual results
- View savings progress
- View debt summaries
- View category breakdowns
- View current-cycle allocation summaries

### 15.3 Report Presentation

- View report details
- Compare reporting periods
- View category-level breakdowns
- Support mobile layouts
- Support desktop or web review layouts
- Display report empty states

### 15.4 Report Filters

- Report period
- Start date
- End date
- Account filter
- Category filter
- Transaction-type filter

### 15.5 Report Calculations

- Income totals aggregate income transactions in the selected period
- Expense totals aggregate expense transactions in the selected period
- Net cash flow is income less expenses
- Budget variance compares actual amounts with planned allocations
- Savings progress compares Goal Savings balances with target amounts
- Debt summaries compare opening, paid, and remaining balances

### 15.6 Report States

- Initial state: reports are ready for use
- Loading state: report data is being loaded or calculated
- Generating state: a report is being generated
- Empty-data state: no records match the selected reporting period or filters
- Invalid-range state: the selected date range is invalid
- Filtered state: report results reflect active filters
- Comparison state: two reporting periods are being compared
- Fresh state: report data is current
- Stale state: cached report data requires refresh
- Cached state: the latest available report is shown offline
- Offline state: network-required report generation is unavailable
- Error state: the report could not be generated or loaded
- Success state: the report is available for review

### 15.7 Report Messages

#### Validation Messages

- Invalid-range state: `The report date range is not valid. Choose an end date after the start date.`

#### Error Messages

- Report error: `Your report could not be generated or loaded. Check your filters and try again.`

#### Notice Messages

- Initial state: `Reports are ready to use. Choose a period or filters to review your financial activity.`
- Empty-data state: `No records match this report period or these filters. Change the dates or filters and try again.`
- Filtered state: `Your report reflects the selected filters. Adjust them if you want a different view.`
- Comparison state: `Two reporting periods are being compared. Review the differences or choose another period.`
- Fresh state: `Your report data is current. Review the results or change the reporting period.`
- Stale state: `This report may be out of date. Refresh it when you are online.`
- Cached state: `You are offline. Review your saved report or reconnect to get the latest data.`
- Offline state: `You are offline. Reconnect before generating a new report.`

#### Progress and Success Messages

- Loading state: `Loading your report. Please wait a moment.`
- Generating state: `Generating your report. Please wait a moment.`
- Success state: `Your report is ready. Review the results below.`
