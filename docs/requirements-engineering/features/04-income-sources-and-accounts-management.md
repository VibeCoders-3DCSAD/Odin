## 4. Income Sources and Accounts Management

### 4.1 Account Management

- View total money across all accounts
- View the list of financial accounts
- Add a financial account
- After successfully creating a savings account, show a modal: "Congratulations
  on your new savings account!" and "Do you want to add a goal?"
- Offer "Yes" to open Add Savings Goal with the new account preselected, or
  "Maybe next time" to return to Accounts. Do not show this invitation for
  account edits, other account kinds, cancelled forms, or failed saves.
- View financial account details
- Edit a financial account
- Delete a financial account with confirmation

### 4.2 Account Form

- Account name
- Account type choices: Cash / Bank / E-Wallet / Credit Card / Other. Savings is excluded from the selector. Existing savings accounts retain their stored type and remain editable.
- Savings uses one form without a Personal Savings, HYSA, Goal Savings, or Time Deposit subtype selector. Display these accounts as Savings; preserve existing stored account details and edit them in the same account action sheet.
- Savings interest configuration belongs entirely under Advanced Options. Offer Daily Balance/ADB and Simple/Compound/None with fixed nominal annual rates only. Exclude tiered and conditional controls. None saves a zero rate and disables interest settings while preserving history.
- Preserve legacy savings terms and schedules when editing; do not require minimum balance.
- Balance
- Institution name
- Opening date
- Configure planned contributions, their frequency, and contribution dates in
  Savings Goals. Omit these controls from financial-account forms, including
  HYSA forms. Preserve schedules already saved on older accounts when editing.
- Credit limit, when applicable
- Billing cycle: 28-31 days, for credit card accounts
- Cut-off day of the month (1-31), for credit card accounts
- Alert threshold percentage of credit limit, for credit card accounts

### 4.3 Account Form Placeholders

- Account name: `Enter account name`
- Account type: `Select account type`
- Balance: `Enter balance`
- Institution name: `Enter institution name`
- Opening date: `Select opening date`
- Credit limit: `Enter credit limit`
- Billing cycle: `Enter billing cycle in days`
- Cut-off day: `Enter default cut-off day`
- Alert threshold percentage: `Enter alert percentage`

### 4.4 Account States

- Initial state: account form is ready for input
- Empty-input state: required account fields are blank
- Validation-failure state: one or more account values are invalid
- Loading state: account data is being loaded
- Saving state: account changes are being saved
- Empty-list state: no financial accounts exist
- No-institution state: institution is optional and has not been provided
- Duplicate-account state: the account cannot be saved because it duplicates an existing account
- Delete-confirmation state: the user must confirm account deletion
- Error state: account data could not be loaded or saved
- Success state: account was created or updated

### 4.5 Account Messages

#### Validation Messages

- Empty account name: `Account name is required. Enter an account name before continuing.`
- Empty account type: `Account type is required. Select an account type before continuing.`
- Invalid opening balance: `Opening balance must be a valid amount. Enter a valid amount and try again.`
- Invalid credit limit: `Credit limit must be a valid amount. Enter a valid amount and try again.`
- Invalid credit limit: `Credit limit must be greater than 0. Enter any positive amount and try again.`

#### Account Error Messages

- Create failure: `This financial account "{account name}" could not be created. Check the details and try again.`
- Update failure: `This financial account "{account name}" could not be updated. Check the details and try again.`
- Delete failure: `This financial account "{account name}" could not be deleted. Check your connection and try again.`
- Generic failure: `Something went wrong. Please try again.`

#### Account Notices

- Loading state: `Your financial accounts are loading. Please wait a moment.`
- Empty-list notice: `No accounts are available yet. Tap + to add your first account.`
- No-institution notice: `No institution was added. Continue without one or add it later.`
- Duplicate-account notice: `This account may already exist. Check the account details and try again.`
- Delete-confirmation notice: `This account and its transactions will be permanently removed. Confirm only if you want to continue.`

#### Account Progress and Success Messages

- Saving progress: `Your account is being saved. Please wait a moment.`
- Account success: `Your account was saved. Continue managing your accounts.`

### 4.6 Account Validation and Calculations

- Require an account name
- Require an account type
- Require a valid opening balance
- Require a valid credit limit for credit card accounts when enabled
- Require a credit limit greater than 0 when provided
- Require a billing cycle from 28 to 31 days for credit card accounts
- Require a valid cut-off day in 1-31 for credit card accounts; short months clamp the cutoff to the month's last day
- Require an alert threshold percentage from 0 to 100 for credit card accounts
- Alert the user when a credit card balance exceeds its configured alert threshold percentage of the credit limit
- Current account balance reflects the opening balance and supported transaction effects
- Total money includes all financial accounts

### 4.7 Income Source Overview

- View total expected monthly income
- View the list of income sources

### 4.8 Create Income Source

- Add an income source

### 4.9 Edit Income Source

- Edit an income source

### 4.10 Delete Income Source

- Delete an income source with confirmation

### 4.11 Income Source Form

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

### 4.12 Income Calculations

- Monthly expected income is normalized from each source's frequency
- Variable income may be represented by expected, minimum, and maximum values

### 4.13 Income Scheduling and Automation

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

### 4.14 Income Source States

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

### 4.15 Income Source Messages

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

### Fixed savings interest form

- All interest fields live under Advanced Options, including the rate. Rates are nominal annual percentages, not APY; the label remains Interest Rate.
- Defaults: Daily Balance, Compound upon crediting, daily calculation, monthly credit periods, period-end posting, today as start, calendar-month ADB, Actual/365, withholding enabled at 20%, and manual entry of actual bank interest. Rates themselves have no assumed value.
- Offer custom credit intervals in days, configurable posting day/date, an independent ADB period, optional minimum qualifying and maximum interest-bearing balances, and Actual/366 or Actual/Actual.
- Backdating a new start requires a starting balance. None disables all interest controls, saves zero interest and preserves rate history and historical transactions.
- Store effective-dated rate changes; existing saved rate entries are read-only in the form. Validate dates, tax percentages, intervals, bounds, increasing rate-history dates and safe integer centavos.
- Simple interest requires independent principal accounting. The selected convention reduces deposited principal before credited interest on withdrawals. Compound behavior applies only upon crediting net interest; no invisible daily compounding.
- Automated interest is excluded. Do not offer automatic projection or credit controls. Enter actual bank interest manually as income. Disable legacy cron/posting paths without changing historical transactions or balances. The stored compatibility flag `autoProject` always normalizes to false.
- Visibility preference covers current balance, gross accrual, estimated tax, net interest, applicable rate, next credit date and calculation breakdown.
- **Implementation boundary:** the current change saves and validates the revised form configuration. These bank terms do not generate transactions or balance changes. Automated credit generation has been removed; migration 20261116000009 also disables the legacy worker.
