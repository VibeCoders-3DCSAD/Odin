## 7. Debt Management

### 7.1 Debt Overview

- View overall total debt paid
- View overall debt progress
- View overall payment trend
- View overall debt forecasts
- View the debt budget
- View payment requirements, surplus, and shortfall
- Select a global repayment strategy: Snowball / Avalanche
- Include active credit-card statement targets and active non-credit-card debt payments in the debt budget

### 7.2 Credit Card Module

- Manage credit cards within Debt Manager as persistent Credit Card financial accounts, not as generic debt records
- View a credit card's issuer, credit limit, available credit, and default cutoff day
- View separate billing cycles for each credit card
- View the current billing cycle and prior billing-cycle history
- Record regular purchases, installment purchases, statements, and payments for a billing cycle
- View the current statement balance, minimum amount due, due date, finance charges, payment status, and credit balance
- Select a repayment strategy for each active credit-card account: Pay in Full / Pay Minimum / Percentage / Custom Payment
- Reconcile an issuer-reported available-credit amount at the credit-card account level

### 7.3 Credit Card Account Form

- Create and edit the credit-card account through Financial Accounts
- Card name, represented by the financial account name
- Institution or card issuer, represented by the financial account institution
- Credit limit
- Default cutoff day of the month (1-31)
- Available credit is displayed when supplied by the issuer or account data; it is not a required account-form input

### 7.3.1 Credit Card Account Form Placeholders

- Card name: `Enter account name`
- Institution or card issuer: `Enter institution name`
- Credit limit: `Enter credit limit`
- Default cutoff day: `Enter default cut-off day`

### 7.3.2 Credit Card Account Validation

- Require a card name
- Require a valid positive credit limit
- Require a valid default cutoff day in 1-31
- Preserve valid entries after validation failure
- Clear field errors when corrected

### 7.4 Credit Card Billing Cycles

- Create or maintain one billing cycle per credit card statement period
- Store the billing-cycle start date, cutoff date, optional statement date, transactions, statement, and payments
- Allow the user to override the default cutoff date for a billing cycle
- Route a transaction with a posting date on or before the cutoff date to that billing cycle
- Route a transaction with a posting date after the cutoff date to the next billing cycle
- Use the transaction date as an estimate only when the posting date is unavailable
- Preserve recorded billing cycles and statements as historical records when later card defaults change

### 7.4.1 Credit Card Billing Cycle Form

- Billing-cycle start date
- Cutoff date

### 7.4.2 Credit Card Billing Cycle Form Placeholders

- Billing-cycle start date: `Select billing-cycle start date`
- Cutoff date: `Select cut-off date`

### 7.4.3 Credit Card Billing Cycle Validation

- Require a billing-cycle start date
- Require a cutoff date
- Allow the statement date to remain empty until the bank-provided statement is recorded
- Preserve recorded cycles when card defaults are changed
- Preserve valid entries after validation failure
- Clear field errors when corrected

### 7.5 Credit Card Transactions and Installments

- Record a regular credit-card purchase in its applicable billing cycle
- Reduce available credit for a regular purchase, subject to issuer reconciliation
- Allow the user to identify a credit-card transaction as an installment purchase
- Create one long-term installment record in Debt Manager for an installment purchase
- Store an installment's original principal, remaining principal, term, remaining months, monthly amortization, interest rate when applicable, and settlement status
- Add only the installment amortization due for a billing cycle to that cycle
- Support zero-interest and interest-bearing installments
- Treat the full installment purchase as reducing available credit when the issuer does so
- Restore available credit when a payment is recorded; reconcile the displayed available credit when issuer records differ
- Require explicit confirmation before replacing Odin's calculated available credit with an issuer-reported amount
- Do not create an Obligation Module record for a credit-card installment; its monthly amortization is a payment requirement within the applicable billing cycle

### 7.5.1 Credit Card Transaction Form

- Transaction description or merchant
- Transaction amount
- Transaction date
- Posting date, when available
- Source credit-card account
- Expense category
- Purchase type: Regular Purchase / Installment Purchase

### 7.5.2 Credit Card Transaction Form Placeholders

- Transaction description or merchant: `Enter merchant or transaction description`
- Transaction amount: `Enter transaction amount`
- Transaction date: `Select transaction date`
- Posting date: `Select posting date`
- Source credit-card account: `Select credit card`
- Expense category: `Select expense category`
- Purchase type: `Select purchase type`

### 7.5.3 Credit Card Transaction Validation

- Require a valid positive transaction amount
- Require a transaction date
- Require a source credit-card account
- Require an expense category when the transaction is an expense
- Require a valid posting date when provided
- Use the transaction date only as an estimate when posting date is unavailable
- Require a purchase type
- Preserve valid entries after validation failure
- Clear field errors when corrected

### 7.5.4 Credit Card Installment Form

- Installment description or merchant
- Original principal
- Remaining principal
- Term
- Remaining months
- Monthly amortization
- Interest rate, when applicable
- Interest type: Zero Interest / Interest-Bearing
- Settlement status

### 7.5.5 Credit Card Installment Form Placeholders

- Installment description or merchant: `Enter installment description`
- Original principal: `Enter original principal`
- Remaining principal: `Enter remaining principal`
- Term: `Enter installment term`
- Remaining months: `Enter remaining months`
- Monthly amortization: `Enter monthly amortization`
- Interest rate: `Enter interest rate`
- Interest type: `Select interest type`
- Settlement status: `Select settlement status`

### 7.5.6 Credit Card Installment Validation

- Require a valid positive original principal
- Require a valid non-negative remaining principal
- Require a valid positive term and non-negative remaining months
- Require a valid positive monthly amortization
- Require a valid non-negative interest rate when interest applies
- Require an interest type
- Require a settlement status
- Prevent remaining principal from exceeding original principal
- Prevent remaining months from exceeding the original term
- Preserve valid entries after validation failure
- Clear field errors when corrected

### 7.6 Credit Card Statements

- Ask the user whether a bank-provided statement has been received for the current cycle
- Do not calculate or invent a statement date before the bank-provided statement is recorded
- Allow the user to record a statement when it is received
- Allow the user to record the bank-provided statement balance, minimum amount due, finance charges or interest, and due date
- Treat the bank-provided statement as authoritative
- Keep statement balance, minimum amount due, finance charges, due date, and payments associated with their billing cycle

### 7.6.1 Credit Card Statement Form

- Statement date
- Statement balance or total amount due
- Minimum amount due
- Finance charges or interest
- Due date

### 7.6.2 Credit Card Statement Form Placeholders

- Statement date: `Select statement date`
- Statement balance or total amount due: `Enter statement balance`
- Minimum amount due: `Enter minimum amount due`
- Finance charges or interest: `Enter finance charges or interest`
- Due date: `Select due date`

### 7.6.3 Credit Card Statement Validation

- Require a statement date on or after the associated cutoff date
- Require a valid non-negative statement balance
- Require a valid non-negative minimum amount due
- Require the minimum amount due not to exceed the statement balance when both are provided
- Require a valid non-negative finance charge or interest amount when provided
- Require a due date
- Preserve the bank-provided statement as authoritative after recording
- Preserve valid entries after validation failure
- Clear field errors when corrected

### 7.7 Credit Card Payments and Credit Balances

- Record a payment amount, payment date, billing cycle, source account, related expense transaction, and notes
- Associate payments with the billing cycle or statement they settle
- Allow only one active Credit Card payment for each billing cycle
- Edit a Credit Card payment and its required related transaction together
- Delete a Credit Card payment with confirmation and reverse its required related transaction
- Mark a statement Fully Paid when total associated payments meet or exceed its statement balance
- Mark a statement Minimum Satisfied when payments meet the minimum amount due but remain below the statement balance
- Mark a statement Partially Paid when payments are below the statement balance and the minimum amount due is not yet satisfied
- Warn that the remaining balance may incur finance charges when a statement is not fully paid
- Prevent a payment from exceeding the statement balance
- Keep the official credit limit unchanged by an overpayment
- Do not automatically settle, shorten, or reduce an installment because of an overpayment
- Allow a user to record a completed installment early settlement with settlement date, remaining principal, settlement amount, and pre-termination fee when applicable
- Complete the installment when the early settlement is saved

Credit-card payment status applies to a billing-cycle statement. It does not create an Obligation Module record or change the status of a linked installment unless the user records an explicit early settlement.

### 7.7.1 Credit Card Payment Form

- Payment amount
- Payment date
- Billing cycle or statement
- Source account
- Notes
- Debt Manager's Pay action opens Transaction Management with the selected statement context; all editable payment and expense inputs remain on the Transaction screen

### 7.7.2 Credit Card Payment Form Placeholders

- Payment amount: `Enter payment amount`
- Payment date: `Select payment date`
- Billing cycle or statement: `Select billing cycle or statement`
- Source account: `Select source account`
- Notes: `Add payment notes`

### 7.7.3 Credit Card Payment Validation

- Require a valid positive payment amount
- Require a payment date
- Require a billing cycle or statement
- Require a source account and related expense transaction
- Prevent a second active payment from being recorded for the same billing cycle
- Prevent payments from exceeding the statement balance
- Preserve valid entries after validation failure
- Clear field errors when corrected

### 7.7.4 Credit Card Early Settlement Form

- Installment
- Settlement date
- Remaining principal
- Settlement amount
- Pre-termination fee, when applicable

### 7.7.5 Credit Card Early Settlement Form Placeholders

- Installment: `Select installment`
- Settlement date: `Select settlement date`
- Remaining principal: `Enter remaining principal`
- Settlement amount: `Enter settlement amount`
- Pre-termination fee: `Enter pre-termination fee`

### 7.7.6 Credit Card Early Settlement Validation

- Require an installment
- Require a settlement date
- Require valid non-negative remaining principal
- Require a valid positive settlement amount
- Require a valid non-negative pre-termination fee when provided
- Complete the installment when the early settlement is saved
- Preserve valid entries after validation failure
- Clear field errors when corrected

### 7.8 Credit Card Budgeting

- Resolve an active credit-card account without a saved repayment strategy to Pay in Full
- Pay in Full target: statement balance
- Pay Minimum target: minimum amount due, with a warning that finance charges may apply
- Percentage target: a user-selected percentage of the authoritative statement balance, rounded to centavos and no more than the statement balance, with a warning that finance charges may apply
- Custom Payment target: an amount at least equal to the minimum amount due and less than the statement balance, with a warning that finance charges may apply
- Apply the selected account repayment strategy to each credit-card statement target in the debt budget
- Keep each credit-card account's repayment strategy independent from Snowball and Avalanche; do not apply Snowball or Avalanche to statement targets

### 7.8.1 Credit Card Repayment Strategy Form

- Credit-card account
- Repayment strategy: Pay in Full / Pay Minimum / Percentage / Custom Payment
- Repayment percentage, when applicable
- Custom payment amount, when applicable

### 7.8.2 Credit Card Repayment Strategy Placeholders

- Credit-card account: `Select credit card`
- Repayment strategy: `Select repayment strategy`
- Repayment percentage: `Enter repayment percentage`
- Custom payment amount: `Enter custom payment amount`

### 7.8.3 Credit Card Repayment Strategy Validation

- Resolve an absent repayment strategy to Pay in Full
- Set Pay in Full target to the statement balance
- Set Pay Minimum target to the minimum amount due
- Derive Percentage from the authoritative statement balance and require its rounded target to be no more than the statement balance
- Require Custom Payment to be at least the minimum amount due and less than the statement balance
- Warn when Pay Minimum or Custom Payment may result in finance charges
- Keep each credit-card account strategy independent from Snowball and Avalanche

### 7.8.4 Credit Card States

- Initial state: credit-card management is ready for use
- Loading state: card, billing-cycle, statement, or payment data is loading
- Empty-list state: no credit cards are recorded
- Empty-billing-cycle state: a credit card has no recorded billing cycles
- Empty-statement state: a billing cycle has no recorded bank statement
- Statement-pending state: ask whether the bank-provided statement has been received for the current cycle
- Payment-recording state: a credit-card payment is being recorded
- Transaction-recording state: a regular or installment purchase is being recorded
- Installment-creation state: a long-term installment record is being created
- Fully-paid state: payments meet or exceed the statement balance
- Minimum-satisfied state: payments meet the minimum amount due but not the statement balance
- Partially-paid state: payments do not yet meet the minimum amount due
- Installment-active state: an installment has remaining principal or months
- Installment-completed state: the issuer recognized the early settlement or final payment
- Stale-state: card information may not reflect the latest issuer records
- Error state: credit-card information could not be loaded or saved
- Delete-confirmation state: the user must confirm card or record deletion when supported
- Success state: the requested credit-card action completed

### 7.8.5 Credit Card Messages

#### Validation Messages

- Invalid credit-card inputs: `Some credit-card details are not valid. Check the highlighted fields and try again.`
- Invalid statement inputs: `Some statement details are not valid. Check the highlighted fields and try again.`
- Invalid payment inputs: `Some credit-card payment details are not valid. Check the highlighted fields and try again.`
- Invalid repayment strategy: `Choose a valid repayment strategy and payment amount before continuing.`
- Custom payment below minimum: `Custom payment must meet the minimum amount due. Enter a higher amount and try again.`
- Custom payment not below statement balance: `Custom payment must be less than the statement balance. Choose Pay in Full or enter a lower amount.`
- Invalid available credit: `Enter a valid available credit amount.`
- Available credit exceeds limit: `Available credit cannot exceed the credit limit.`

#### Notice Messages

- Empty credit-card list: `No credit cards are recorded yet. Add a credit card to track billing cycles and payments.`
- Empty billing cycle: `No billing cycles are recorded for this card. Add a billing cycle to track its statement activity.`
- Statement expected: `Your statement for {card name} should be available today. Record it to update your payment requirement.`
- Fully paid: `This statement is fully paid. No remaining statement balance is currently recorded.`
- Minimum satisfied: `The minimum payment is satisfied, but the remaining balance may incur finance charges.`
- Partially paid: `This statement is not fully paid and the minimum amount due is not yet satisfied. Review the remaining payment.`
- Available-credit reconciliation warning: `Enter the available credit shown by your issuer, then review and confirm the authoritative change.`
- Available-credit reconciliation confirmation: `This authoritative change replaces Odin's calculated available credit with the issuer-reported amount. Confirm only if it matches the issuer record.`
- Available-credit reconciled: `Issuer-reported available credit was reconciled.`
- Installment completed: `The installment settlement was recognized. Review the updated installment history.`
- Stale credit-card data: `Credit-card information may be out of date. Refresh or reconcile it with the latest issuer records.`

#### Progress and Success Messages

- Credit-card loading: `Your credit-card information is loading. Wait a moment for the details to appear.`
- Credit-card saving: `Your credit-card changes are being saved. Please wait before trying again.`
- Statement saving: `Your statement is being recorded. Please wait before trying again.`
- Payment saving: `Your credit-card payment is being recorded. Please wait before trying again.`
- Credit-card saved: `Your credit-card changes were saved. Review the billing-cycle details before continuing.`
- Statement saved: `Your statement was recorded. Review the payment requirement before continuing.`
- Payment saved: `Your credit-card payment was recorded. Review the statement status to confirm the update.`
- Transaction saved: `Your credit-card transaction was recorded. Review its billing-cycle assignment to confirm the update.`
- Installment saved: `Your installment was recorded. Review the monthly amortization and remaining balance.`

#### Error and Recovery Messages

- Credit-card transaction unavailable: `Credit-card transactions cannot be recorded until billing-cycle routing is available.`
- Credit-card error: `Your credit-card information could not be loaded or saved. Check your connection and try again.`
- Statement error: `Your statement could not be recorded. Check the details and try again.`
- Payment error: `Your credit-card payment could not be recorded. Check the details and try again.`
- Credit-card recovery: `Your credit-card changes could not be completed. Review the details and try again.`
- Issuer reconciliation notice: `The issuer's records may differ from this estimate. Review the latest statement and available credit before relying on the total.`

#### Confirmation Messages

- Credit Card payment deletion confirmation: `Deleting this payment removes it from the statement history and reverses its related transaction. Cancel to keep it or confirm deletion to continue.`

### 7.8.6 Credit Card Scope Boundaries

- Include regular credit-card purchases
- Include installment or amortization purchases
- Include billing cycles, cutoff dates, statements, minimum amounts due, finance charges, payments, credit balances, and early settlement requests
- Exclude cash advances
- Exclude cash-installment products derived from cash advances

### 7.9 Non-Credit-Card Debt Management

- Create a debt record
- Select a debt type
- View the list of debts
- View debt status
- View debt progress
- View payment history
- View remaining debt payments
- Edit a debt
- Archive a debt
- Prioritize or remove priority from a debt
- Record a debt payment through an expense transaction
- Manage hardship information when supported
- View active, archived, and deleted debt records according to their visibility rules

### 7.10 Non-Credit-Card Debt Status and Progress

- Active status: debt is currently included in balances, budgets, and forecasts
- Archived status: debt is retained for history but excluded from active planning
- Deleted status: debt is marked deleted and retained for synchronization and audit purposes
- Ahead progress: payments are ahead of the expected schedule
- On Schedule progress: payments meet the expected schedule
- Behind progress: payments are insufficient or overdue
- Finished status: debt balance has been paid in full
- Display status and progress independently
- Do not treat an archived debt as a finished debt

### 7.10.1 Non-Credit-Card Debt Repayment Forecast

- Ask `When do you want to get this debt paid?` and require a target payoff date when creating or editing an active debt
- Forecast the payoff date from the current balance, configured payment amount, payment frequency, and next payment date
- Advanced: the configured payment amount exceeds the amount required to clear the balance by the target payoff date
- On track: the configured payment amount meets the amount required to clear the balance by the target payoff date
- Underpaid: the configured payment amount is insufficient to clear the balance by the target payoff date
- Not in schedule: a target payoff date, next payment date, payment amount, or supported recurring payment frequency is unavailable
- Display the repayment forecast independently from the debt record status and payment-history progress

### 7.11 Transaction-Triggered Debt Recording

- Detect when a credit-card account is selected as an expense source
- Route the transaction to the applicable credit-card billing cycle
- Allow the user to identify the transaction as a regular purchase or installment purchase
- Carry the transaction amount, date, posting date when available, source account, and category into the credit-card flow
- Save the transaction and credit-card relationship together
- Return the user to the transaction, billing-cycle, or installment details after recording

### 7.12 Non-Credit-Card Debt Payment Transaction Flow

- User selects Record payment for a debt in Debt Manager, or selects Record as debt payment while entering an expense transaction
- Debt Manager opens the transaction form with the selected debt-payment context
- User completes or confirms the transaction details
- Odin creates the expense transaction and linked debt payment together
- The debt displays the payment and related transaction

Ordinary transactions remain unrelated to debts. A non-credit-card debt payment cannot be created without its linked expense transaction.

### 7.13 Non-Credit-Card Debt Form

- Debt type
- Debt name
- Lender name
- Original loan amount or amount owed
- Current outstanding balance, when adding an existing loan or debt
- Disbursement or start date
- Maturity date
- Interest rate
- Interest rate period
- Interest method
- Payment or amortization amount
- Payment frequency: Weekly / Biweekly / Semi-monthly / Monthly / Quarterly / Custom
- First or next payment date
- Target payoff date
- Debt-specific term information when applicable
- Fees
- Penalty information
- Notes
- Global strategy selection: Snowball / Avalanche

Personal Loan, Salary Loan, Multipurpose Loan, Business Loan, and Auto Loan use the Common Loan Model. Their type-specific fields add context and relationships without creating separate repayment engines.

### 7.14 Non-Credit-Card Debt Type Selection

- Personal Loan
- Salary Loan
- Multipurpose Loan
- Business Loan
- Auto Loan
- Custom Debt

Debt types are selectable presets. Existing debt records must remain readable if a preset is later changed or removed. Credit cards are created as Credit Card financial accounts and managed through the Credit Card Module.

### 7.15 Non-Credit-Card Debt Form Placeholders

- Debt type: `Select debt type`
- Debt name: `Enter debt name`
- Lender name: `Enter lender name`
- Original loan amount or amount owed: `Enter original amount`
- Current outstanding balance: `Enter current balance`
- Disbursement or start date: `Select start date`
- Maturity date: `Select maturity date`
- Interest rate: `Enter interest rate`
- Interest rate period: `Select interest rate period`
- Interest method: `Select interest method`
- Payment or amortization amount: `Enter payment amount`
- Payment frequency: `Select payment frequency`
- First or next payment date: `Select payment date`
- Target payoff date: `Select target payoff date`
- Debt-specific term: `Enter loan or installment term`
- Notes: `Add notes`

### 7.15.1 Non-Credit-Card Debt Type-Specific Placeholders

- Personal Loan purpose: `Select loan purpose`
- Salary Loan linked income source: `Select linked income source`
- Salary Loan repayment method: `Select repayment method`
- Salary Loan deduction amount: `Enter deduction amount`
- Salary Loan deduction schedule: `Select deduction schedule`
- Multipurpose Loan purpose: `Select loan purpose or purposes`
- Business Loan or income source: `Select linked business or income source`
- Business Loan purpose: `Select business loan purpose`
- Auto Loan vehicle description: `Enter vehicle description`
- Auto Loan purchase price: `Enter vehicle purchase price`
- Auto Loan downpayment: `Enter downpayment`
- Custom Debt interest method: `Select interest method`

### 7.16 Debt Strategy Selection

- Strategy selector: `Select repayment strategy`
- Snowball strategy
- Avalanche strategy
- Show the selected strategy in the debt overview
- Apply the selected strategy to active debts only

### 7.17 Non-Credit-Card Debt Payment Form

- Payment amount
- Payment date
- Principal amount, when available
- Interest or fee amount, when available
- Payment notes

Debt Manager's Record payment action opens Transaction Management with the selected debt context; source account, category, and all editable expense inputs remain on the Transaction screen.

### 7.18 Non-Credit-Card Debt Payment Form Placeholders

- Payment amount: `Enter payment amount`
- Payment date: `Select payment date`
- Principal amount: `Enter principal amount`
- Interest or fee amount: `Enter interest or fee amount`
- Payment notes: `Add payment notes`

### 7.19 Non-Credit-Card Debt Payment Validation

- Prevent submission when required payment fields are empty
- Require a valid positive payment amount
- Require a payment date
- Require a linked expense transaction with a valid source account and category
- Prevent payment amounts greater than the current non-credit-card debt balance unless explicitly supported
- Require principal and interest amounts to be non-negative
- Prevent principal and interest amounts from exceeding the payment amount
- Display validation feedback beside the affected field
- Preserve valid entries after validation failure
- Clear field errors when corrected

### 7.20 Non-Credit-Card Debt Payment States

- Initial state: payment form is ready for input
- Empty-input state: required payment fields are blank
- Validation-failure state: payment inputs are invalid
- Saving state: payment is being recorded
- Transaction-entry state: the required expense transaction is being entered
- Success state: the payment and linked transaction were recorded
- Error state: payment could not be recorded
- Empty-source-account state: no eligible source account is available
- Delete-confirmation state: the user must confirm payment deletion when supported

### 7.21 Non-Credit-Card Debt Payment Messages

#### Validation Messages

- Invalid payment inputs: `Some payment details are not valid. Check the highlighted fields and try again.`

#### Error Messages

- Payment error: `Your payment could not be recorded. Check your connection and try again.`

#### Notice Messages

- Initial state: `Debt payment recording is ready. Enter the payment details to continue.`
- Empty payment input: `Required payment details are missing. Complete the highlighted fields before continuing.`
- No source account: `No eligible account is available for this payment. Add an account and try again.`

#### Progress and Success Messages

- Payment saving: `Your payment is being recorded. Please wait before trying again.`
- Payment saved: `Your payment was recorded. Review the debt details to confirm the update.`
- Payment transaction entry: `Complete the expense transaction to record this debt payment. Wait for the save to finish before leaving this screen.`

#### Confirmation Messages

- Payment deletion confirmation: `Deleting this payment removes it from the debt history. Cancel to keep it or confirm deletion to continue.`

#### Recovery Messages

- Payment recovery: `Your payment could not be completed. Review the payment details and try again.`

### 7.22 Non-Credit-Card Debt Type-Specific Inputs

- Personal Loan: optional loan purpose: Emergency / Medical / Education / Home Improvement / Debt Consolidation / Personal Purchase / Other
- Salary Loan: required linked income source and repayment method: Payroll Deduction / Automatic Debit / Manual Payment / Other
- Salary Loan: require deduction amount and deduction schedule when the repayment method is Payroll Deduction
- Multipurpose Loan: loan purpose: Home Improvement / Education / Medical / Livelihood / Emergency / Utility / Other
- Business Loan: linked business or income-source context and loan purpose: Working Capital / Inventory / Equipment / Expansion / Operating Expenses / Emergency / Other
- Auto Loan: vehicle description, vehicle purchase price, and downpayment
- Auto Loan: derive financed principal from vehicle purchase price less downpayment when both values are available
- Custom Debt: configurable amount owed, current balance, repayment amount, repayment frequency, next payment date, maturity date when applicable, and interest details
- Custom Debt: support No Interest, a specified interest rate and method, or Provider Calculated interest

### 7.23 Non-Credit-Card Debt Form Validation

- Prevent submission when required fields are empty
- Require a debt type
- Require a debt name
- Require a lender or provider when the debt type requires one
- Require a valid positive original loan amount or amount owed
- Require a valid non-negative current balance
- Require a valid disbursement or start date and first or next payment date for Common Loan Model debt types
- Require valid interest information when interest applies
- Support Flat or Add-on, Diminishing Balance, Provider Calculated, and No Interest methods
- Require a valid positive payment or amortization amount when the selected debt type has a repayment schedule
- Require a payment frequency
- Require a valid due date when a due date applies
- Require a valid target payoff date on or after the next payment date
- Require type-specific inputs for the selected debt type
- Require the linked income source for Salary Loans
- Require the repayment method for Salary Loans
- Require a valid deduction amount and deduction schedule for Salary Loans using Payroll Deduction
- Require a valid non-negative Auto Loan vehicle purchase price and downpayment when provided
- Require the Auto Loan financed principal to be non-negative when it is derived
- Prevent the Auto Loan downpayment from exceeding the vehicle purchase price when both values are provided
- Display validation feedback beside the affected field
- Preserve valid entries after validation failure
- Clear field errors when corrected

### 7.24 Non-Credit-Card Debt States

- Initial state: debt form is ready for input
- Loading state: debt data is being loaded
- Empty-list state: no debts are recorded
- Empty-payment-history state: debt exists without recorded payments
- Empty-input state: required debt fields are blank
- Debt-type-selection state: the user must select a debt type
- Validation-failure state: debt inputs are invalid
- Saving state: debt changes are being saved
- Payment-recording state: a payment is being recorded
- Active state: debt is included in current planning
- Archived state: debt is retained but excluded from current planning
- Deleted state: debt is marked deleted and excluded from active views
- Finished state: debt is fully paid
- Error state: debt data could not be loaded or saved
- Delete-confirmation state: the user must confirm deletion
- Archive-confirmation state: the user must confirm archiving
- Success state: debt changes were saved

### 7.25 Non-Credit-Card Debt Messages

#### Validation Messages

- Invalid debt inputs: `Some debt details are not valid. Check the highlighted fields and try again.`

#### Error Messages

- Debt error: `Your debt information could not be loaded or saved. Check your connection and try again.`

#### Notice Messages

- Initial state: `Debt management is ready. Add or review a debt to continue.`
- Empty debt list: `No debts are recorded yet. Add a debt to track repayment progress.`
- Empty payment history: `This debt has no recorded payments. Record a payment when one is made.`
- Empty debt input: `Required debt details are missing. Complete the highlighted fields before continuing.`
- Empty debt type: `No debt type is selected. Choose a debt type before continuing.`
- Deleted debt: `This debt is no longer active. Return to the active debt list to manage current debts.`
- Archived debt: `This debt is archived and excluded from current planning. Restore it before managing active repayment.`
- Active debt: `This debt is active and included in current planning. Review its progress and required payments.`
- Finished debt: `This debt is fully paid. Review its history or return to active debts.`

#### Progress and Success Messages

- Debt loading: `Your debt information is loading. Wait a moment for the details to appear.`
- Debt saving: `Your debt changes are being saved. Please wait before trying again.`
- Payment recording: `Your debt payment is being recorded. Please wait before trying again.`
- Debt saved: `Your debt changes were saved. Review the debt details before continuing.`

#### Confirmation Messages

- Debt deletion confirmation: `Deleting this debt removes it from active views. Cancel to keep it or confirm deletion to continue.`
- Debt archive confirmation: `Archiving this debt removes it from current planning but preserves its history. Cancel to keep it active or confirm archiving to continue.`

#### Recovery Messages

- Debt recovery: `Your debt changes could not be completed. Review the debt details and try again.`

### 7.26 Debt Calculations

- Total payment requirement is the sum of active credit-card statement targets and required payments for active non-credit-card debts
- Debt surplus is debt budget remaining after payment requirements
- Debt shortfall is payment requirements remaining after available debt budget
- Snowball prioritizes the lowest remaining balance among active non-credit-card debts after their required payments are covered
- Avalanche prioritizes the highest applicable interest rate among active non-credit-card debts after their required payments are covered
- Credit-card statement targets and non-credit-card required payments are considered before strategy-based surplus allocation
