## 5. Income Sources

### 5.1 Income Source Overview

- View total expected monthly income
- View the list of income sources

### 5.2 Create Income Source

- Add an income source

### 5.3 Edit Income Source

- Edit an income source

### 5.4 Delete Income Source

- Delete an income source with confirmation

### 5.5 Income Source Form

- Income name
- Destination account
- Income category
- Income type: Stable / Variable
- Frequency: Weekly / Biweekly / Semi-Monthly / Monthly / Irregular / Custom
- Expected amount
- Minimum amount
- Maximum amount
- Pay date or schedule
- Notes

### 5.6 Income Calculations

- Monthly expected income is normalized from each source's frequency
- Variable income may be represented by expected, minimum, and maximum values

### 5.7 Income Scheduling and Automation

- Define an income schedule
- Define expected income ranges
- Link income to a destination account
- Require an existing income source before automation can be created
- Automate an income source through recurring transactions
- Create a recurring income transaction from an income source
- Maintain a one-way relationship: Income Source -> Recurring Transaction
- Use the income source's destination account for generated income
- Use the income source's schedule for generated transactions
- View the automation status of an income source
- View the next expected automated income
- Edit the recurring income schedule
- Pause or stop automated income generation
- Preserve previously generated income transactions when automation is stopped
- Prevent duplicate recurring automation for the same income source

### 5.8 Income Source States

- Initial state: income source management is ready for use
- Loading state: income sources or automation details are loading
- Empty-list state: no income sources are recorded
- Empty-input state: required income source fields are blank
- Validation-failure state: income source inputs are invalid
- Saving state: income source changes are being saved
- Duplicate-automation state: an income source already has recurring automation
- Automation-active state: recurring income generation is enabled
- Automation-paused state: recurring income generation is temporarily paused
- Automation-stopped state: recurring income generation has been stopped
- Network-required state: the requested income source action requires an internet connection
- Sync-failure state: income source changes could not be synchronized
- Delete-confirmation state: the user must confirm income source deletion
- Archive-confirmation state: the user must confirm income source archiving
- Error state: income source data could not be loaded or saved
- Success state: income source changes were saved

### 5.9 Income Source Messages

#### Validation Messages

- Empty income name: `Income name is required. Enter an income name before continuing.`
- Empty destination account: `Destination account is required. Select an account before continuing.`
- Empty income category: `Income category is required. Select a category before continuing.`
- Empty income type: `Income type is required. Select Stable or Variable before continuing.`
- Empty frequency: `Income frequency is required. Select a frequency before continuing.`
- Invalid expected amount: `Expected amount must be a valid amount. Enter a valid amount and try again.`
- Invalid income range: `Minimum and maximum amounts must be valid, and the minimum cannot exceed the maximum.`
- Invalid pay schedule: `Pay date or schedule is not valid. Enter a valid schedule and try again.`

#### Error Messages

- Income source error: `Your income source could not be loaded or saved. Check your connection and try again.`
- Duplicate automation: `This income source already has recurring automation. Edit the existing automation instead.`
- Sync failure: `Your income source changes could not be synchronized. Retry the sync when your connection is available.`

#### Notice Messages

- Initial state: `Income source management is ready. Add or review an income source to continue.`
- Empty income source list: `No income sources are recorded yet. Add an income source to plan expected income.`
- Automation active: `Automated income is active. Review the next expected income before making changes.`
- Automation paused: `Automated income is paused. Resume automation when you want future income generated.`
- Automation stopped: `Automated income is stopped. Create new automation if future income should be generated.`

#### Network and Session Error Messages

- Network required: `This income source action requires an internet connection. Reconnect and try again.`
- Network error: `We could not reach your income sources. Check your connection and try again.`

#### Progress and Success Messages

- Income source loading: `Your income sources are loading. Wait a moment for the list to appear.`
- Income source saving: `Your income source changes are being saved. Wait a moment for the update to finish.`
- Income source saved: `Your income source changes were saved. Continue managing expected income.`

#### Confirmation Messages

- Income source deletion confirmation: `Deleting this income source removes it from future planning. Cancel to keep it or confirm deletion to continue.`

#### Recovery Messages

- Income source sync recovery: `Some income source changes could not be synchronized. Retry them or review the failed changes before discarding anything.`
