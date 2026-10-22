## 10. Cash Flow Management

### 10.1 Transaction Recording

- Allow users to record income, expenses, and transfers between their financial accounts.
- Allow users to specify the amount, transaction date, relevant accounts, description or payer, and optional notes.
- Require a positive amount and eligible accounts belonging to the user.
- Require a destination account for income and a source account for expenses.
- Require distinct source and destination accounts for ordinary transfers.
- Require an appropriate income or expense category; allow transfers without a category.
- Allow users to choose categories and subcategories appropriate to the transaction type.
- Allow users to record transactions offline and synchronize them when connectivity is available.

### 10.2 Account Balances and Cash Flow

- Increase the receiving account's balance when income is recorded and reduce the paying account's balance when an expense is recorded.
- Move the same amount between the selected accounts for an ordinary transfer.
- Exclude transfers from income and expense totals.
- Update affected balances and summaries when transactions are corrected or deleted.
- Reflect credit-card purchases and payments in the relevant card's debt and available credit.
- Keep savings allocations within an account separate from money moving between accounts.

### 10.3 Savings Contributions

- Allow users to identify a new transaction using “This is a savings contribution” and select an eligible savings goal.
- Treat the contribution as a transfer or allocation to the selected goal rather than income or an expense.
- Also allow users to start a contribution from Savings Goals with the selected goal already provided.
- Require the goal to be linked to an eligible non-credit-card account.
- Keep the contribution destination fixed to the goal's linked account.
- Allow users to contribute available, unallocated money already held in the linked account without changing its account balance.
- Allow users to contribute from another eligible non-credit-card account by transferring money into the linked account.
- Show the available money in the linked account when choosing the contribution source.
- Prevent contributions from consuming money reserved for other savings goals.
- Record the contribution and any related transfer together, updating the goal's saved amount and progress.
- Guide users to create or link an active savings goal when no eligible goal is available.
- Keep ordinary deposits and transfers separate from goal contributions unless explicitly identified as contributions.

### 10.4 Savings Withdrawals and Expense Funding

- Allow users to start a savings withdrawal from Savings Goals and complete the associated transfer in Transaction Management.
- Use the selected goal's linked account as the withdrawal source and allow an eligible destination account.
- Reduce the goal's saved amount and record the related transfer together.
- When recording an expense, use unallocated money in the source account before money reserved for savings goals.
- If the expense requires reserved money, show the amount needed and allow users to explicitly choose how much to withdraw from each affected goal.
- Allow one expense to draw from multiple savings goals in the same account when necessary.
- Require confirmation of the savings funding decision before completing the expense.
- Prevent withdrawals beyond the selected goals' available saved amounts.
- Update related savings withdrawals when an expense is corrected and restore the corresponding goal amounts when it is deleted.

### 10.5 Non-Credit-Card Debt Payments

- Allow users to identify an eligible expense using “This is a payment for my debt” and select an active debt.
- Also allow users to start a payment from Debt Management with the selected debt already provided.
- Allow users to distinguish principal repayment from interest or fees.
- Record the expense and debt payment together, reducing the outstanding debt by the principal repaid.
- Prevent principal repayment beyond the outstanding debt and prevent principal plus interest or fees from exceeding the total payment.
- Update the linked payment, outstanding balance, and repayment progress when a payment is corrected or deleted.
- Keep ordinary expenses separate from debt payments unless explicitly identified as repayments.

### 10.6 Credit Card Purchases

- Recognize a credit card selected as an expense source and allow users to identify a regular or installment purchase within the transaction form.
- Allow users to provide the issuer's posting date when available; otherwise use the transaction date as an estimate.
- Assign the purchase to the applicable billing cycle based on the posting date and cut-off date.
- For installment purchases, allow users to describe the repayment term, remaining principal, amortization, and applicable interest arrangement.
- Create the installment with the purchase and include only its applicable amortization in the billing cycle's payment requirement.
- Reflect purchases in the card's debt and available credit, consistent with its installment treatment.
- Preserve existing installment arrangements during transaction editing; do not allow installment details to be changed through generic transaction edits.
- Prevent deletion of an installment purchase and explain that billing-cycle activity and credit commitments depend on it.

### 10.7 Credit Card Statement Payments

- Allow users to start payment from a recorded statement in Debt Management and complete the expense in Transaction Management.
- Preserve the selected statement and billing cycle while the user completes the payment.
- Record the expense and statement payment together and update payment status, remaining statement balance, and available credit.
- Support the credit-balance behavior defined in Debt Management when a payment exceeds the statement balance.
- Allow supported payment corrections and confirmed deletion to update the statement payment and its transaction together.
- Keep ordinary expenses separate from statement payments unless opened through the statement-payment flow.

### 10.8 Billers and Remittances Payments

- Record expenses created by the dedicated Billers and Remittances payment flow in transaction history.
- Reflect manual and automatically posted bill payments in account balances and the relevant commitment's payment status.
- Keep bill-payment entry and occurrence selection within Billers and Remittances.
- Prevent direct editing of a bill-payment transaction and guide users to delete it and record the corrected payment again.
- Require confirmation before deletion and reverse the related payment, account balance effects, and any associated savings withdrawals together.
- Preserve past transactions when a biller or remittance is archived or deleted.

### 10.9 Transaction History and Review

- Allow users to view income, expense, and transfer history with dates, amounts, descriptions, related accounts, and categories where applicable.
- Show income and expense totals for all transactions matching the current search and filters, including transactions beyond those currently displayed.
- Load additional history as users request more transactions.
- Allow users to search descriptions, payer or merchant information, and notes.
- Allow users to filter by transaction type, category, and date range, including a custom date range.
- Allow users to sort by date or amount and change the sort direction.
- Allow users to reset filters and distinguish an empty history from a search with no matching results.
- Refresh history and totals after recording, editing, deleting, or synchronizing transactions.

### 10.10 Transaction Corrections and Deletion

- Allow users to edit supported transaction details while preserving the transaction's type and any required savings or payment relationship.
- Use the supported payment flow when correcting linked debt or statement payments.
- Require explicit confirmation before deleting a transaction and explain the effects on balances and related records.
- Reverse deleted transactions' effects on balances, summaries, and supported linked savings or payment records together.
- Exclude deleted transactions from current history totals and financial calculations.
- Clearly explain restrictions when a linked transaction cannot be edited or deleted.

### 10.11 Scheduled Transactions

- Include expenses generated by Billers and Remittances automatic posting and income generated from scheduled Income Sources in transaction history.
- Manage schedules through the feature responsible for the income source or financial commitment.
- Reflect generated transactions in account balances, cash-flow totals, and relevant payment history.
- Avoid duplicate transactions when scheduled occurrences are processed more than once.
- Preserve recorded transactions when future scheduled posting is stopped.

### 10.12 Unusual Spending Feedback

- Allow users to receive an unusual-spending observation after recording an expense that differs from their usual spending pattern.
- Allow users to dismiss the observation or indicate that they expect to make this spending frequently.
- Keep the broader unusual-spending alerts and forecast requirements in Financial Reports.

### 10.13 Feedback and Offline Availability

- Allow users to view locally available transaction history and save supported transaction changes without an internet connection.
- Indicate when saved changes are awaiting synchronization and provide recovery guidance when synchronization fails.
- Show clear loading, saving, empty, success, and error feedback.
- Explain when an eligible account, category, goal, debt, or statement is unavailable and guide users to an appropriate action.
- Preserve valid entries after validation or saving failures so users can correct or retry them.
- Keep the displayed history and totals consistent with completed transaction changes.
