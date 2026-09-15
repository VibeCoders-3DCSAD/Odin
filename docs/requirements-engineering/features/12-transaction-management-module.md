## 12. Transaction Management Module

### 12.1 Transaction Entry

- Record income
- Record expenses
- Record transfers
- Select the related accounts
- Categorize transactions
- Add descriptions and notes
- Choose a transaction date
- Record a posting date when it differs from the transaction date
- Save transactions while offline
- Detect Credit Card selection as the expense source
- Route a credit-card expense to the applicable billing cycle
- Allow the user to identify a credit-card expense as a regular or installment purchase
- Preserve transaction context while credit-card details are completed
- Allow the user to record the transaction as a savings contribution
- Allow the user to select a savings goal for the contribution
- Allow the user to record a transfer as a savings withdrawal
- Allow the user to select a savings goal for the withdrawal
- Allow the user to record the transaction as an obligation payment
- Allow the user to select an obligation for the payment
- Allow the user to record the transaction as a Credit Card statement payment
- Preserve selected Credit Card statement-payment context when Debt Manager opens the transaction form

### 12.2 Transaction Form

- Transaction type: Income / Expense / Transfer
- Amount
- Transaction date
- Source account
- Destination account
- Category or subcategory
- Merchant or payer
- Notes
- Recurring transaction option
- Recurrence schedule, when enabled
- Posting date, when the source account is a Credit Card
- Credit-card purchase type: Regular / Installment, when the source account is a Credit Card
- Record as savings contribution option
- Record as savings withdrawal option
- Savings goal selector when the option is enabled
- Record as debt payment option
- Debt selector when the option is enabled
- Record as obligation payment option
- Obligation selector when the option is enabled
- Record as Credit Card statement payment option
- Credit Card statement selector when the option is enabled

### 12.3 Transaction Form Placeholders

- Transaction type: `Select transaction type`
- Amount: `Enter amount`
- Transaction date: `Select transaction date`
- Source account: `Select source account`
- Destination account: `Select destination account`
- Category or subcategory: `Select category`
- Merchant or payer: `Enter merchant or payer`
- Notes: `Add transaction notes`
- Recurring transaction option: `Make recurring`
- Recurrence schedule: `Select recurrence schedule`
- Posting date: `Select posting date`
- Savings goal: `Select savings goal`
- Debt: `Select debt`
- Obligation: `Select obligation`
- Credit Card statement: `Select credit card statement`

### 12.4 Transaction Selectors

- Transaction type selector: Income / Expense / Transfer
- Source account selector
- Destination account selector
- Category or subcategory selector filtered by transaction type
- Transaction date selector
- Recurrence schedule selector when recurring is enabled
- Savings goal selector for explicit savings contributions
- Savings goal selector for explicit savings withdrawals
- Debt selector for explicit debt payments
- Obligation selector for explicit obligation payments
- Credit Card statement selector for explicit Credit Card statement payments
- Only show eligible active accounts and related records
- Show an empty selector state when no eligible account or related record exists

### 12.5 Transaction Validation

- Require a transaction type
- Require a positive amount
- Require a transaction date
- Require a source account for expenses and transfers
- Require a destination account for income and transfers
- Prevent the same account from being both source and destination
- Require a category or subcategory when applicable
- Require a recurrence schedule when recurring is enabled
- Allow at most one explicit savings contribution, savings withdrawal,
  non-credit-card debt, obligation, or Credit Card statement-payment
  relationship per transaction
- Require the selected Savings Account, debt, obligation, or Credit Card
  statement when its option is enabled
- Require a Transfer transaction, source account, destination account, and
  selected Savings Account when recording a savings withdrawal
- Require the selected Savings Account to be the transfer source for a
  savings withdrawal
- Prevent unsupported links between transaction types and related records
- Display validation feedback beside the affected field
- Preserve valid entries after validation failure
- Clear field errors when corrected

### 12.6 Credit Card Transaction Flow

- User selects a Credit Card as the expense source
- User enters the transaction details
- Odin determines the billing cycle from the posting date and cutoff date
- Odin uses the transaction date as an estimate when no posting date is available
- User identifies the transaction as a regular or installment purchase
- For a regular purchase, Odin records the transaction in the applicable billing cycle
- For an installment purchase, Odin creates or links the long-term installment and records only its applicable amortization in the billing cycle
- The user can review the billing cycle or linked installment after saving

### 12.7 Savings Contribution Transaction Flow

- User selects the savings-contribution option
- User selects a Savings Account
- User saves the transaction
- Odin creates the transaction and contribution together
- The selected Savings Account displays the new contribution; Goal Savings also
  displays updated progress
- Ordinary transactions remain unrelated to Savings Accounts

### 12.8 Contribution Transaction Flow

- User selects Add Contribution for a Savings Account
- Odin opens the transaction form with the selected Savings Account context and
  savings-contribution option enabled
- User completes the transaction details and may enable a recurring schedule
- Odin creates the transaction and contribution together
- The selected Savings Account displays the contribution and related transaction

### 12.8.1 Savings Withdrawal Transaction Flow

- User selects a savings withdrawal from Savings Goals or Transaction Management
- Odin opens the transaction form with the selected Savings Account context
- User completes a Transfer from the Savings Account to an
  eligible destination account
- Odin creates the transfer and withdrawal together
- Odin requires confirmation when a Time Deposit withdrawal occurs before
  maturity
- The selected Savings Account displays the withdrawal and related transfer;
  Goal Savings also displays updated progress

### 12.9 Debt Payment Transaction Flow

- User selects the debt-payment option
- User selects a debt
- User saves the transaction
- Odin creates the transaction and debt payment together
- The selected debt displays the payment and updated balance or progress
- Ordinary transactions remain unrelated to debts

### 12.9.1 Credit Card Statement Payment Transaction Flow

- User selects Pay for a recorded Credit Card statement in Debt Manager
- Odin opens the transaction form with the selected Credit Card statement and billing-cycle context
- User completes or confirms the expense transaction details
- Odin creates the expense transaction and Credit Card statement payment together
- The statement displays the payment, updated payment status, and remaining balance or credit balance
- Ordinary transactions remain unrelated to Credit Card statements

### 12.10 Obligation Payment Transaction Flow

- User selects the obligation-payment option
- User selects an obligation and payment period, when applicable
- User saves the transaction
- Odin creates the transaction and obligation payment together
- The selected obligation displays the payment and updated occurrence status
- Ordinary transactions remain unrelated to obligations

### 12.11 Transaction History

- View transaction history
- View transaction type and amount
- View related account and category
- View merchant or payer information
- View income and expense totals
- Display an empty state when no transactions exist

### 12.12 Transaction Search and Review

- Search transactions
- Filter by transaction type
- Filter by date range
- Sort by date
- Sort by amount
- Change sort direction
- Reset filters

### 12.13 Transaction Changes

- Edit a transaction
- Delete a transaction with confirmation
- Correct account balance effects after changes
- Preserve deleted transactions for synchronization
- Protect linked debt-payment transactions from unsupported generic changes
- Protect linked Credit Card statement-payment transactions from unsupported generic changes

### 12.14 Recurring Transactions

- Create a recurring transaction
- Configure its recurrence schedule
- View recurring transactions
- View upcoming occurrences
- Stop a recurring transaction
- Generate recurring transaction entries

### 12.15 Transaction Calculations

- Expense transactions reduce the source account balance
- Income transactions increase the destination account balance
- Transfers reduce the source account and increase the destination account by the same amount
- Transaction edits recalculate affected account balances
- Deleted transactions no longer contribute to active balances or summaries
- Transfer totals are excluded from income and expense totals
- Linked savings contributions update the selected goal's current amount and progress
- Linked savings withdrawals update the selected goal's current amount and
  progress
- Each generated recurring transaction with a savings-contribution relationship
  creates its linked savings contribution
- Linked debt payments update the selected debt's remaining balance and progress
- Linked obligation payments update the selected obligation occurrence's paid and remaining amounts
- Linked Credit Card statement payments update the selected statement's paid amount, payment status, and credit balance
- Editing or deleting a linked Credit Card statement-payment transaction updates or removes its payment relationship and account-balance effects together
- Recurring transactions generate entries according to their configured schedule

### 12.16 Transaction States

- Initial state: transaction form is ready for input
- Loading state: accounts, categories, or related records are loading
- Empty-history state: no transactions are recorded
- Empty-selector state: no eligible account, category, savings goal, debt, or obligation is available
- Income-entry state: an income transaction is being entered
- Expense-entry state: an expense transaction is being entered
- Transfer-entry state: a transfer is being entered
- Savings-contribution state: transaction is explicitly linked to a savings goal
- Debt-payment state: transaction is explicitly linked to a debt
- Obligation-payment state: transaction is explicitly linked to an obligation
- Credit-card-statement-payment state: transaction is explicitly linked to a Credit Card statement payment
- Credit-card-routing state: transaction requires Debt Manager details
- Recurring-entry state: recurring transaction settings are being configured
- Validation-failure state: transaction inputs are invalid
- Saving state: transaction is being saved
- Offline-pending state: transaction is saved locally and awaiting synchronization
- Syncing state: transaction is being synchronized
- Sync-failed state: transaction synchronization failed and can be retried
- Linked-record-update state: a related savings, debt, or obligation record is being updated
- Edit state: an existing transaction is being changed
- Delete-confirmation state: the user must confirm deletion
- Protected-link state: a linked debt-payment transaction cannot be changed through unsupported generic edits
- Credit-card-statement-payment-edit state: a linked Credit Card statement payment is being changed through its supported payment flow
- Credit-card-statement-payment-delete-confirmation state: the user must confirm deletion of a linked Credit Card statement payment
- Error state: transaction data could not be loaded or saved
- Success state: transaction and any selected relationship were saved

### 12.17 Transaction Messages

#### Validation Messages

- Invalid transaction input: `Some transaction details are not valid. Correct the marked fields and try again.`
- Transaction validation failure: `Your transaction could not be saved because some details are invalid. Correct the marked fields and try again.`

#### Error Messages

- No eligible transaction option: `No eligible account or related record is available. Add or choose a different option.`
- Transaction sync failed: `Your transaction could not be sent. Check your connection and try again.`
- Protected transaction link: `This linked debt payment cannot be changed here. Open the debt details to make supported changes.`
- Protected Credit Card statement-payment link: `This linked Credit Card statement payment cannot be changed here. Open the statement payment to make supported changes.`
- Transaction error: `Your transaction could not be loaded or saved. Try again.`
- Transaction loading failure: `Your transaction data could not be loaded. Refresh and try again.`

#### Notice Messages

- Initial state: `Transaction entry is ready. Choose a transaction type to get started.`
- Empty transaction history: `No transactions are recorded yet. Add an income, expense, or transfer to get started.`
- Empty transaction selector: `No eligible account, category, savings goal, debt, or obligation is available. Add one and try again.`
- Income entry: `You are entering an income transaction. Complete the details and save it when you are ready.`
- Expense entry: `You are entering an expense transaction. Complete the details and save it when you are ready.`
- Transfer entry: `You are entering a transfer. Complete the account details and save it when you are ready.`
- Savings contribution: `This transaction will be linked to a savings goal. Choose the goal and save the transaction to record the contribution.`
- Debt payment: `This transaction will be linked to a debt payment. Choose the debt and save the transaction to record the payment.`
- Obligation payment: `This transaction will be linked to an obligation payment. Choose the obligation and save the transaction to record the payment.`
- Credit Card statement payment: `This transaction will be linked to a Credit Card statement payment. Review the statement and save the transaction to record the payment.`
- Credit card routing: `This credit card transaction needs debt details. Continue to Debt Manager to finish it.`
- Offline transaction: `Your transaction was saved on this device. Reconnect to send it to your account.`
- Offline pending transaction: `Your transaction is waiting to sync from this device. Reconnect to send it to your account.`
- Protected link: `This linked debt-payment transaction cannot be changed through generic edits. Open the debt details to make supported changes.`
- Protected Credit Card statement-payment link: `This linked Credit Card statement payment cannot be changed through generic edits. Open the statement payment to make supported changes.`
- Recurring entry: `Recurring transaction settings are ready to configure. Choose a schedule before saving the transaction.`
- Linked-record update: `The related savings, debt, or obligation record is being updated. Wait for the update to finish before leaving this screen.`
- Edit state: `You are editing an existing transaction. Review the changes and save them when you are ready.`

#### Progress and Success Messages

- Transaction loading: `Your transaction data is loading. Wait a moment for it to appear.`
- Transaction saving: `Your transaction is being saved. Wait a moment for the update to finish.`
- Transaction syncing: `Your transaction is being sent to your account. Keep the app open for a moment.`
- Transaction saved: `Your transaction and selected related record were saved. Continue reviewing your finances.`

#### Confirmation Messages

- Transaction deletion confirmation: `Deleting this transaction removes its active account and summary effects. Cancel to keep it or confirm deletion to continue.`
- Credit Card statement-payment deletion confirmation: `Deleting this Credit Card statement payment removes its payment and active transaction effects. Cancel to keep it or confirm deletion to continue.`

#### Recovery Messages

- Transaction sync recovery: `Your transaction could not be synchronized. Retry it when you are online or review it before discarding the local change.`
