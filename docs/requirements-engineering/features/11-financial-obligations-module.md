## 11. Financial Obligations Module

### 11.1 Obligation Management

- View financial obligations
- Add an obligation
- Categorize an obligation
- Define an obligation schedule
- Set due-date information
- Add optional notes
- Record an obligation payment or contribution
- Record an obligation payment with or without a related transaction
- Create a related transaction from an existing obligation payment
- Edit an obligation
- Delete an obligation with confirmation
- Archive an obligation

### 11.2 Obligation Form

- Obligation name
- Expense category or subcategory
- Amount
- Frequency: Weekly / Biweekly / Semi-Monthly / Monthly / Quarterly / Yearly / Custom
- Due-date schedule
- Family-support indicator
- Dependent-support indicator
- Protected-by-default indicator
- Start date
- End date
- Notes

### 11.3 Obligation Form Placeholders

- Obligation name: `Enter obligation name`
- Expense category or subcategory: `Select expense category`
- Amount: `Enter obligation amount`
- Frequency: `Select payment frequency`
- Due-date schedule: `Select due-date schedule`
- Family-support indicator: `Mark family support`
- Dependent-support indicator: `Mark dependent support`
- Protected-by-default indicator: `Mark as protected`
- Start date: `Select start date`
- End date: `Select end date`
- Notes: `Add obligation notes`

### 11.4 Obligation Selectors

- Expense category or subcategory selector
- Frequency selector: Weekly / Biweekly / Semi-Monthly / Monthly / Quarterly / Yearly / Custom
- Due-date schedule selector
- Source account selector for related transactions
- Obligation selector for payment and transaction links
- Family-support and dependent-support selectors
- Protected-by-default selector
- Active versus archived obligation filter
- Show an empty selector state when no eligible obligation or account exists

### 11.5 Obligation Payment Form

- Payment amount
- Payment date
- Source account
- Payment period or occurrence
- Record related transaction option
- Payment notes

### 11.6 Obligation Payment Form Placeholders

- Payment amount: `Enter payment amount`
- Payment date: `Select payment date`
- Source account: `Select source account`
- Payment period or occurrence: `Select obligation period`
- Related transaction option: `Record a transaction`
- Payment notes: `Add payment notes`

### 11.7 Obligation Validation

- Require an obligation name
- Require an expense category or subcategory
- Require a positive obligation amount
- Require a payment frequency
- Require a due-date schedule when applicable
- Require a valid start date
- Require an end date after the start date when provided
- Require a positive obligation payment amount
- Require a payment date
- Require a source account when recording a related transaction
- Prevent a payment from being assigned to an archived or deleted obligation
- Display validation feedback beside the affected field
- Preserve valid entries after validation failure
- Clear field errors when corrected

### 11.8 Obligation Calculations and Rules

- Scheduled obligation amount is the configured amount for the current occurrence
- Paid amount is the total of active payments for the current occurrence
- Remaining amount is scheduled amount less paid amount
- An obligation is paid for the occurrence when paid amount meets or exceeds scheduled amount
- An obligation is partially paid when paid amount is greater than zero and below scheduled amount
- An obligation is overdue when the due date has passed and the scheduled amount remains unpaid
- Archived obligations are excluded from active planning but retained for history
- Removing automation does not remove existing obligation payments or transactions

### 11.9 Obligation States

- Initial state: obligation management is ready for use
- Loading state: obligations, schedules, or payment history are loading
- Empty-list state: no obligations are recorded
- Empty-payment-history state: obligation exists without recorded payments
- Empty-selector state: no eligible category, obligation, or source account is available
- Obligation-creation state: obligation form is open for input
- Payment-entry state: obligation payment form is open for input
- Validation-failure state: obligation or payment inputs are invalid
- Saving state: obligation or payment changes are being saved
- Transaction-linking state: a related transaction is being created or linked
- Active state: obligation is included in current planning
- Paid state: current obligation occurrence is fully paid
- Partially-paid state: current obligation occurrence is partially paid
- Overdue state: current obligation occurrence remains unpaid after its due date
- Archived state: obligation is retained but excluded from current planning
- Deleted state: obligation is marked deleted and excluded from active views
- Automated state: future occurrences are linked to recurring transactions
- Unlinked state: automation has been removed while past records remain
- Delete-confirmation state: the user must confirm deletion
- Archive-confirmation state: the user must confirm archiving
- Offline state: cached obligation data is available while network features are unavailable
- Error state: obligation data could not be loaded or saved
- Success state: obligation changes were saved

### 11.10 Obligation Messages

#### Validation Messages

- Invalid obligation input: `Some obligation details are not valid. Correct the marked fields and try again.`
- Obligation validation failure: `Your obligation could not be saved because some details are invalid. Correct the marked fields and try again.`

#### Error Messages

- No eligible obligation option: `No eligible category, obligation, or account is available. Add or choose a different option.`
- Archived or deleted obligation: `This obligation is no longer available for payments. Choose an active obligation instead.`
- Obligation error: `Your obligation data could not be loaded or saved. Try again.`
- Obligation loading failure: `Your obligations could not be loaded. Refresh and try again.`

#### Notice Messages

- Initial state: `Obligation management is ready. Add or review an obligation to continue.`
- Empty obligation list: `No obligations are recorded yet. Add an obligation to track scheduled commitments.`
- Empty payment history: `This obligation has no recorded payments. Record a payment when one is made.`
- Empty obligation selector: `No eligible category, obligation, or source account is available. Add one and try again.`
- Obligation creation: `The obligation form is ready for a new obligation. Enter the details and save when you are ready.`
- Payment entry: `The payment form is ready for an obligation payment. Enter the payment details and continue when you are ready.`
- Transaction linking: `Your related transaction is being created. Wait for the link to finish before leaving this screen.`
- Active obligation: `This obligation is included in current planning. Review its schedule or record a payment.`
- Paid obligation: `This obligation occurrence is fully paid. Review the payment details or continue to the next occurrence.`
- Partially paid obligation: `This obligation occurrence is partially paid. Record the remaining payment or review the details.`
- Overdue obligation: `This obligation occurrence is overdue and remains unpaid. Record a payment or review its schedule.`
- Archived obligation: `This obligation is archived and excluded from current planning. Restore it before managing new payments.`
- Deleted obligation: `This obligation is deleted and unavailable for new payments. Choose an active obligation instead.`
- Offline obligations: `Cached obligation details are available without internet access. Reconnect before using network-required actions.`
- Automated obligation: `Future occurrences are linked to recurring transactions. Review the automation or unlink it when needed.`
- Unlinked obligation: `Automation was removed, but past payments and transactions remain. Review the obligation history for those records.`

#### Progress and Success Messages

- Obligation loading: `Your obligations are loading. Wait a moment for the list to appear.`
- Obligation saving: `Your obligation changes are being saved. Wait a moment for the update to finish.`
- Obligation changes saved: `Your obligation changes were saved. Continue managing your obligations.`

#### Confirmation Messages

- Obligation deletion confirmation: `Deleting this obligation removes it from active views but preserves existing payment history. Cancel to keep it or confirm deletion to continue.`
- Obligation archive confirmation: `Archiving this obligation removes it from current planning but preserves its history. Cancel to keep it active or confirm archiving to continue.`

### 11.11 Obligation Automation

- Automate an obligation
- Link an obligation to a recurring transaction
- View the next automated occurrence
- Unlink an automated obligation
- Preserve past transactions when automation is removed
