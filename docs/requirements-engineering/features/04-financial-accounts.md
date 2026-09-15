## 4. Financial Accounts

### 4.1 Account Management

- View total money across all accounts
- View the list of financial accounts
- Add a financial account
- View financial account details
- Edit a financial account
- Delete a financial account with confirmation

### 4.2 Account Form

- Account name
- Account type: Cash / Bank / E-Wallet / Savings / Credit Card / Loan / Other
- Balance
- Institution name
- Opening date
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
