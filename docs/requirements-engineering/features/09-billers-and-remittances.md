## 9. Billers and Remittances

### 9.1 Billers and Remittances Overview

- Allow users to manage bills, essential expenses, remittances, contributions, and upcoming financial commitments.
- Show the total scheduled amount due in the current month and the number of active billers and remittances.
- Distinguish the scheduled monthly total from the amount still unpaid.
- Allow users to view all active commitments, those due soon, those using automatic posting, and archived commitments.
- Include overdue commitments and unpaid commitments due within the next three days in the Due soon view.
- Show each commitment's amount, schedule, payment status, category when assigned, and automatic posting status.
- Provide guidance for adding a commitment when no billers or remittances exist.

### 9.2 Commitment Management

- Allow users to create, view, and edit billers and remittances.
- Allow users to identify a commitment by name, specify its expected amount, and choose the account it is paid from.
- Allow users to optionally categorize the expense and add notes.
- Require a positive scheduled amount and an eligible account belonging to the user.
- Allow users to review a commitment's schedule, source account, payment history, and upcoming occurrences.
- Keep scheduled commitments available to Financial Planning when assessing essential expenses and upcoming obligations.

### 9.3 Payment Schedules

- Support Daily, Weekly, Twice a month, Monthly, and None as repeat choices for new commitments.
- Treat None as a single payment due on the selected date.
- Allow users to choose a weekday for weekly payments and the appropriate day or days of the month for monthly and twice-monthly payments.
- Require two distinct days for twice-monthly schedules.
- Use the last available day of a shorter month when the scheduled day does not exist in that month.
- Allow repeating commitments to have a start date and an optional end date on or after the start date.
- Show the next scheduled posting date and the last recorded payment date where available.
- Keep older commitments with Every 2 weeks, Quarterly, or Yearly schedules readable and manageable.
- Allow users to review upcoming occurrences separately from past payment history.

### 9.4 Manual Payment Recording

- Allow users to record a payment from a commitment's details.
- Allow users to select the occurrence being paid and review its scheduled, paid, and remaining amounts.
- Suggest the remaining amount for the selected occurrence while allowing the user to enter the actual payment amount.
- Allow users to choose the payment date, source account, and optional payment notes.
- Record an expense transaction from the selected account together with the commitment payment.
- Allow multiple payments toward an occurrence and update its remaining amount accordingly.
- Provide a Post now shortcut for recording the current occurrence's remaining amount from the configured account.
- Prevent new payments against archived or deleted commitments.
- Prevent repeated submission of the same payment from creating duplicate expenses.

### 9.5 Payment Status and History

- Show the scheduled amount, total paid, and remaining amount for the current occurrence.
- Mark an occurrence paid when recorded payments meet or exceed its scheduled amount.
- Identify partially paid occurrences and overdue occurrences with an unpaid balance.
- Keep the remaining amount at zero once the occurrence is fully covered.
- Show payment history with the payment date, amount, occurrence covered, and whether the payment was posted automatically.
- Require confirmation before deleting a recorded payment.
- Delete the related expense transaction with the payment, restore the corresponding account balance, and update the occurrence's payment status.
- Preserve past transactions when the commitment's schedule changes or automatic posting is disabled.

### 9.6 Automatic Posting

- Allow users to enable or disable automatic posting for repeating commitments.
- Explain that automatic posting records an expense on the due date from the configured account and affects the budget.
- Show the next posting date and the account that will fund the payment.
- Keep automatic posting unavailable for non-repeating commitments.
- Post only the unpaid amount for a due occurrence, taking previously recorded payments into account.
- Process eligible unpaid occurrences from the date automatic posting was enabled, without duplicating existing postings.
- Allow due automatic postings to be processed locally when the app is used offline.
- Stop future automatic postings when the user disables automatic posting, archives the commitment, or deletes it.
- Preserve recorded payments and transactions when future automatic posting stops.

### 9.7 Available Money Before Posting

- Require sufficient available, unallocated money in the selected account before
  recording a manual payment or posting an automatic payment.
- Exclude money reserved for savings goals from the amount available for payments.
- Leave a payment unposted when available money is insufficient; do not record a
  payment or expense transaction, change the account balance, or withdraw savings.
- Explain that the user must add enough available money before the payment can
  be posted.

### 9.8 Archive, Restore, and Delete

- Require confirmation before archiving a biller or remittance.
- Retain archived commitments and their payment history in a separate view.
- Exclude archived commitments from current planning and new payment recording, and stop their automatic posting.
- Allow users to restore an archived commitment and review its schedule and automatic posting preference before resuming payments.
- Require a commitment to be archived before it can be deleted.
- Require a separate deletion confirmation explaining that the commitment will be removed while past transactions remain.
- Preserve previously recorded financial transactions when deleting a biller or remittance.

### 9.9 Feedback and Offline Availability

- Allow users to view and manage locally available commitments and record payments without an internet connection.
- Show clear loading, saving, empty, success, and error feedback.
- Explain when a commitment, category, payment account, or eligible occurrence is unavailable and guide users to an appropriate action.
- Preserve valid entries when an action fails and allow users to correct or retry it.
- Keep payment status and account balances consistent when a payment is recorded
  or removed, without changing savings goal allocations.
- Make clear that recording a payment tracks a financial transaction in the application; it does not send money to a biller or remittance recipient.
