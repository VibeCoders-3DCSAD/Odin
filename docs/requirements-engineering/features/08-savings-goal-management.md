## 8. Savings Goal Management

### 8.1 Savings Overview

- View total savings
- Display financial savings accounts as Savings without subtype labels
- View total savings target and overall savings progress for Goal Savings accounts
- View active and completed Goal Savings accounts
- View upcoming goal dates
- View the current-cycle Savings Envelope
- View unallocated savings money
- View an empty state when no goals exist

### 8.2 Savings Account and Goal Management

- View the list of Savings Accounts
- Create, view, edit, archive, and delete a Savings Account with confirmation
- Create Savings accounts without selecting a subtype
- Create and edit Goal Savings accounts without a category input
- Set a target, target date, contribution schedule, and priority for a Goal
  Savings account
- Require an active financial account owned by the authenticated user when
  creating a Savings Goal. Persist its `linked_account_id` and sync it across
  devices; linking an account does not create a transaction or move money.
- List only the current user's active, non-deleted accounts in the searchable,
  bounded account selector. Show loading, retry, and empty states.
- Validate ownership and active status again at local persistence, API, and
  database boundaries. Revalidate when the selected account changes.
- Preserve existing unlinked goals and existing links after an account is
  archived. An unrelated goal edit must not discard or invalidate that link.
- Mark a Goal Savings account as achieved when its balance reaches its target

### 8.3 Savings Account Creation Form

Use the same account action sheet for every Savings account. Do not ask for a
subtype, minimum balance, deposit terms, or contribution schedule. After a
successful creation, offer a linked Savings Goal with "Yes" or "Maybe next time".
Contribution planning belongs in the Savings Goal form.

### 8.3.1 Savings Interest Inputs and Handling

| Input | Control | Required | Handling |
| --- | --- | --- | --- |
| Account name | Text input | Yes | Trim whitespace. |
| Opening balance | Currency input | Yes | Store the starting ledger balance. |
| Institution | Text input | No | Reference information. |
| Opening date | Date picker | No | Store the opening date. |
| Annual interest rate (%) | Decimal input | No | Accept a non-negative rate with at most two decimal places. Blank means unspecified; zero means no interest. |
| Advanced options | Expand/collapse button | No | Collapsed initially; collapsing preserves selections. |
| Balance basis | Daily Balance / Average Daily Balance (ADB) / Not sure | No | Reference only. Daily Balance refers to end-of-day balances; ADB refers to the average over a period. |
| Interest method | Simple Interest / Compound Interest / Not sure | No | Reference only. Simple excludes interest on accrued interest; compound includes previously credited interest retained in the account. |
| Rate structure | Fixed / Tiered or conditional / Not sure | No | Reference only. Tiered describes rates varying with balances or qualifying conditions. |
| Interest notes | Multiline text input | No | Trim whitespace; maximum 1000 characters. |

These three advanced selections are independent and can overlap. Store "Not
sure" as null; do not assume a bank calculation method. Persist and sync the
settings as validated `interest_reference` metadata owned by the current user.
They never credit interest, alter balances, or reduce suggested goal contributions.

Preserve existing minimum balances, rates, tiers, conditions, deposit terms, and
contribution schedules when editing older accounts. These legacy fields are no
longer inputs in the simplified form. For a legacy HYSA, the annual rate updates
the saved base rate; other legacy rate and eligibility details remain unchanged.

Savings Goal inputs:

Goal creation and editing do not ask for a Goal Category. Existing Emergency Fund
goals retain their purpose and allocation priority.

| Input | Control | Required | Handling |
| --- | --- | --- | --- |
| Target amount | Currency amount input | Yes | Use as the goal completion threshold and to calculate remaining amount and progress. |
| Target date | Date picker | Yes | Use to calculate the required contribution and projected completion status. |
| Planned contribution amount | Currency amount input | When frequency is not None | Use as the planned contribution for each scheduled occurrence. It does not create a transaction without explicit user confirmation. |
| Contribution frequency | Shared frequency selector | Yes | Select Daily, Weekly, Twice a Month, Monthly, or None. Twice a Month uses two selected calendar days. None disables scheduled contributions while allowing manual contributions; no planned amount is required. Daily needs no additional date inputs. Do not ask the user for a next contribution date. |
| Weekly contribution day | Weekday selector: Sunday through Saturday | Weekly only | Schedule contributions on the selected weekday. |
| Monthly contribution dates | Numeric date inputs, 1–31 | Twice a Month or Monthly | Twice a Month requires two ascending date numbers; Monthly requires one. In shorter months, use the last day when a selected date does not exist. |
| Interest rate on existing goals | Percentage amount input | No | Retain compatibility when editing existing goals. Do not show this field when adding a Savings Goal. |
| Priority | Single-select picker | Yes | Use for savings allocation after Emergency Fund priority. |
| Target method | Single-select picker | Emergency Fund only | For Emergency Fund, select Fixed Amount or Essential-Expense Coverage. Fixed Amount uses the entered target. |
| Essential-expense coverage period | Single-select picker: 3 / 4 / 5 / 6 months | Essential-Expense Coverage only | Multiply the selected period by current monthly essential expenses to suggest a target. Do not replace a user-approved target without confirmation. |

### 8.4 Savings Account Form Placeholders

- Account name: `Enter account name`
- Opening balance: `Enter opening balance`
- Institution: `Enter institution name`
- Opening date: `Select opening date`
- Annual interest rate: `Enter interest rate`
- Interest notes: `e.g. Higher rate applies when bank conditions are met`

### 8.5 Savings Selectors

- Financial account on Savings Goal creation: owned, active accounts only, using
  the same searchable action sheet as Transaction Management's From account.
- Advanced balance basis, interest method, and rate structure as defined above.
- Goal priority and contribution frequency: Daily / Weekly / Twice a Month /
  Monthly / None. Show contribution days before the planned amount.
- Goal for contributions and withdrawals: active Savings Goals only.
- Activity: Contribution / Withdrawal.
- Allocation strategy, target method, coverage period, and history date range.
- Show an empty selector state when no eligible goals or accounts exist.

### 8.6 Savings Contributions and Withdrawals

- Add a contribution to a Savings Account by opening Transaction Management
  with the selected account context
- Edit a contribution by opening its linked transaction in Transaction
  Management
- Use Transaction Management's recurring transaction option to schedule
  recurring savings contributions
- Record a transaction as a savings contribution through an explicit
  transaction-entry action
- Create a contribution and its linked transaction together when the
  transaction is saved
- Record a withdrawal from a Savings Account by opening Transaction
  Management with the selected account context
- Require a standalone withdrawal to use a Transfer transaction from the Savings Account
  account to an eligible destination account
- Create a withdrawal and its linked transfer together when the transfer is
  saved
- View contribution and withdrawal history separately
- Delete a contribution or withdrawal only as a correction action and require
  confirmation
- Display updated Goal Savings progress after linked transaction changes when
  the Savings Account type is Goal Savings

#### Goal contribution account selection

- The contribution form fixes **To account** to the savings goal's linked
  financial account. The destination cannot be changed in the transaction form.
- **From account** offers **Available money** in the linked account and eligible
  active financial accounts. Credit cards are excluded.
- Explain Available money as: "Money in this account that hasn’t been set aside
  for a savings goal."
- Allocating Available money increases the goal's saved amount and reduces the
  account's unallocated pool without changing its cash balance.
- Contributing from another account debits that source, credits the linked
  account, and increases the goal's saved amount in one atomic operation.
- Contributions cannot use money reserved for other goals. Recheck ownership,
  active accounts, the linked destination, and available funds when saving and
  syncing; the account selector is not an authorization boundary.
- Edits and deletion update both the transaction and its goal activity together.
  Allocation-only transactions must have zero cash effect in account balances,
  interest calculations, reports, and savings account deposit history.

### 8.7 Savings Activity Transaction Context

- Savings Account
- Savings activity: Contribution / Withdrawal
- Transaction Management owns the amount, date, accounts, recurrence schedule,
  and notes inputs

The user must explicitly choose the savings activity. Savings Goals opens
Transaction Management with the selected Savings Account and activity
context. Ordinary income and deposits do not automatically increase goal progress.

#### Expenses from a linked financial account

- All linked goals share one unallocated balance: account balance minus the sum
  of their saved amounts. Archived goals continue to reserve their funds.
- Ordinary expenses consume unallocated money first and leave goal progress
  unchanged while enough unallocated money remains.
- If an expense uses reserved savings, require an explicit split across one or
  more linked goals. Show the amount required, each goal's available savings,
  and confirmation before saving. Never select goals or split equally by default.
- Save the expense and selected goal withdrawals atomically, with ownership,
  available balances, and exact split totals checked locally and on the server.
- Editing an expense replaces its withdrawals. Reducing it to unallocated money
  restores the withdrawn savings; deleting it restores all affected goals.
- Automatic expense posting must stop when it would use reserved goal money.
  Manual bill payments use the same explicit goal withdrawal confirmation.
- Preserve withdrawal identities across edits so other devices converge without
  duplicate activities. Retrying sync must not apply withdrawals twice.
- If goals already exceed the account balance, show the existing shortage in the
  withdrawal prompt and ask the user to review their allocations.
- An explicitly confirmed account overdraft retains the existing transaction
  behavior; withdrawals never exceed the available savings in the selected goals.

### 8.8 Savings Activity Context Placeholders

- Savings Account: `Select savings account`
- Savings activity: `Select savings activity`

### 8.9 Savings Validation

- Prevent submission when required Savings Account or savings activity fields are
  empty
- Require an account name, Savings Account type, and valid non-negative
  balance
- An annual interest rate is optional; validate it as non-negative when provided.
  Do not require a minimum balance in the simplified Savings form.
- Validate advanced reference settings against the supported choices and limit
  notes to 1000 characters. The remaining subtype-specific rules below apply
  only to preserved legacy data, not the current form
- Require a non-negative planned contribution amount, contribution frequency,
  and next contribution date only when a Personal Savings or HYSA savings plan is enabled
- Require a valid non-negative HYSA base interest rate, interest calculation
  basis, and interest credit frequency
- Require a valid non-negative HYSA higher interest rate and at least one
  complete requirement when a higher rate is available
- Preserve an explicit HYSA I'm Not Sure choice as unknown; do not coerce it to
  a Yes or No value
- Require valid non-negative HYSA minimum balance, maximum eligible balance,
  deposit amount, and direct-deposit threshold when provided
- Require a positive HYSA required-transaction count when provided
- Require each enabled HYSA balance range to have a valid lower bound and
  non-negative rate; require an upper bound except for the final no-limit range.
  The lower bound cannot exceed the upper bound and ranges cannot overlap
- Require the HYSA maximum eligible balance to be greater than or equal to the
  minimum balance when both are provided
- Require a valid HYSA promotional rate and start and end dates when a
  promotional period is configured; the end date must be on or after the start
  date
- Require a positive Goal Savings target amount, contribution frequency,
  and target date. Require a non-negative planned contribution amount when the
  frequency is not None
- Require a contribution weekday for Weekly, two ascending date numbers from
  1 to 31 for Twice a Month, and one date number from 1 to 31 for Monthly
- Derive scheduled occurrences from the selected cadence and require an occurrence
  on or before the target date; do not require a next contribution date input
- Require a valid non-negative interest rate for Goal Savings when provided
- Require a target method and coverage period from 3 to 6 months when an
  Emergency Fund uses Essential-Expense Coverage
- Require a positive principal, valid non-negative interest rate, start date,
  maturity date, term, and early-withdrawal rule for Time Deposit
- Require the Time Deposit maturity date to be after its start date
- Require the Time Deposit maturity date to agree with its start date and term
- Require a Savings Account before recording a contribution or withdrawal
- Require all contribution and withdrawal transaction inputs through
  Transaction Management
- Prevent a completed or archived Goal Savings account from receiving new
  contributions unless explicitly reopened
- Require explicit confirmation before an early Time Deposit withdrawal
- Display validation feedback beside the affected field
- Preserve valid entries after validation failure
- Clear field errors when corrected

### 8.10 Savings Calculations

Advanced interest reference options do not feed these calculations or create
interest transactions. The subtype-specific projections below describe retained
legacy data only; new accounts do not collect those detailed rules.

- Personal Savings uses its interest rate for interest projections and credited
  interest.
- Personal Savings and HYSA projections include their configured scheduled
  contributions but do not create contribution transactions automatically.
- HYSA interest accrues using its selected calculation basis and credits to the
  account at its selected credit frequency.
- Derive HYSA bank-requirements-met as Yes only when every configured condition
  with available data is satisfied and no configured condition is known to fail.
  When one or more configured conditions cannot be evaluated, use the user's
  explicit Yes or No confirmation and identify the eligibility as manually
  confirmed.
- For a HYSA without an active promotion, use its base rate when bank requirements
  are not met. When requirements are met, use the applicable balance-tier rate;
  if no tier applies, use the boosted rate; if no boosted rate is configured,
  use the base rate.
- When a HYSA has a maximum eligible balance, apply the selected boosted or tier
  rate only up to that amount and the base rate to the remaining balance.
- During an active HYSA promotional period, use the promotional rate before any
  base, boosted, or tier rate.
- Time Deposit uses its principal, interest rate, start date, maturity date, and
  term for maturity and interest projections.
- A Goal Savings balance reflects its initial balance plus active contributions
  and credited interest, less active withdrawals
- Remaining goal amount is the target amount less the Goal Savings balance
- Progress percentage is Goal Savings balance compared with target amount
- Required contribution for a Goal Savings account at each scheduled occurrence
  is the greater of its planned contribution amount and the remaining goal amount
  distributed across its remaining scheduled contribution occurrences through the
  target date, capped by the remaining goal amount
- The total minimum savings contribution requirement for the current budget
  cycle is the sum of required scheduled contributions due in that cycle across
  active Goal Savings accounts and active Personal Savings or HYSA accounts with
  configured contribution plans
- Current-cycle shortfall is each Goal Savings account's required scheduled
  contribution less contributions made during that cycle
- Progress cannot be negative and cannot exceed 100% in the primary progress display
- Remaining goal amount cannot be negative
- An amount that exceeds a goal's required contribution remains available as
  savings surplus for allocation to eligible goals
- Savings surplus is allocated using Emergency Fund priority, then the selected
  Avalanche or Snowball strategy; allocation results do not create transfers
  without an explicit user-confirmed transaction
- A Goal Savings account is achieved when its balance meets or exceeds its
  target amount
- A withdrawal can return an achieved Goal Savings account to Active when its balance
  falls below the target
- Deleted contributions and withdrawals do not affect active totals, progress,
  or projections
- Archived goals remain in historical totals but are excluded from active allocation
- Round Goal Savings targets, contributions, withdrawals, and interest calculations,
  allocations, and projections to centavos using standard half-up rounding
- Do not retain fractional-centavo balances

### 8.11 Savings Allocation

- Select a global savings allocation strategy: Avalanche / Snowball
- Allocate the Financial Plan Management savings contribution schedule across
  Goal Savings accounts
- Allocate savings surplus across eligible Goal Savings accounts
- Prioritize each Goal Savings account's required contribution
- View the total minimum savings contribution requirement for the current
  budget cycle across Goal Savings and configured Personal Savings or HYSA plans
- Use the global strategy to resolve surplus allocation
- View allocation results for the current budget cycle
- View the reason for each allocation
- Review and approve supported allocation changes

Savings Avalanche allocates after Emergency Fund priority to the eligible Goal
Savings account
with the largest current-cycle shortfall. Savings Snowball allocates after
Emergency Fund priority to the eligible Goal Savings account with the smallest
remaining goal
amount.

### 8.12 Savings Allocation Rules

- Financial Plan Management provides one savings contribution schedule for the
  current cycle
- Savings Goal Management allocates the schedule across active Goal Savings
  accounts
- Emergency Fund Goal Savings accounts take priority until their selected essential-expense
  coverage target is met
- Required contributions are allocated before surplus
- The required contribution amount for each active Goal Savings account comes
  from its contribution schedule and target date
- The total minimum savings contribution requirement is the sum of active Goal
  Savings accounts' required scheduled contributions plus configured Personal
  Savings and HYSA contributions due in the current budget cycle
- When the envelope cannot cover all required contributions, fund Emergency
  Fund Goal Savings accounts first, then apply the selected strategy
- Apply Emergency Fund priority and the selected strategy to all savings
  surplus after required contributions are allocated
- Display funded, partially funded, and unfunded amounts with the reason for
  each allocation
- Debt payoff surplus is handled by Financial Plan Management before it becomes
  part of the savings contribution schedule

Financial Plan Management provides one savings contribution schedule. Savings
Goal Management distributes that schedule across Goal Savings accounts. Debt
payoff surplus is handled by Financial Plan Management before it reaches this
allocation step.

### 8.13 Savings Projections

- View projected goal completion
- View the contribution needed to meet a target date
- View current-cycle contribution shortfall
- Use available income, expense, and budget information when generating projections
- View the effect of the current Savings Envelope
- View personalized, fallback, or cold-start projection status
- Refresh projections online
- View cached projections offline
- View projection freshness and last update time
- View plain-language projection explanations

### 8.14 Savings Projection Inputs

- Goal Savings target, balance, and current progress
- Goal Savings target date
- Goal Savings planned contribution amount, contribution frequency, and first
  or next contribution date
- Contribution history
- Withdrawal history
- Scheduled recurring contribution transactions
- Savings Account interest rates, HYSA current balance, calculation basis,
  credit frequency, eligibility status, yield conditions, balance tiers, and
  promotional period
- Time Deposit principal, start date, maturity date, term, and early-withdrawal
  rule
- Current-cycle Savings Envelope
- Available income and expense forecast data
- Budget and debt information when available

### 8.15 Savings Reminders and Alerts

- Receive upcoming target-date reminders
- Receive missed-contribution reminders
- Receive behind-goal alerts
- Receive goal-achieved notifications
- Receive replenishment reminders after a withdrawal from an Emergency Fund
  Goal Savings account
- Receive reminders for upcoming recurring savings contributions
- Receive reminders when a recurring savings contribution is missed
- Acknowledge, dismiss, or snooze savings alerts
- Configure savings notification preferences

### 8.16 Savings States

- Initial state: savings module is ready for use
- Loading state: Savings Accounts, contributions, allocations, or projections are loading
- Empty-list state: no Savings Accounts exist
- Empty-contribution-history state: Goal Savings account exists without contributions
- Empty-selector state: no eligible Goal Savings account or category is available
- Empty-envelope state: no savings money is available for allocation
- Account-creation state: Savings Account form is open for input
- Contribution-entry state: contribution transaction context is open in
  Transaction Management
- Withdrawal-entry state: withdrawal transfer context is open in Transaction
  Management
- Transaction-linking state: a related transaction is being created or linked
- Validation-failure state: Savings Account or contribution inputs are invalid
- Advanced-options state: optional reference fields are expanded or collapsed without losing values
- Unknown-interest state: "Not sure" remains null without assuming a calculation method
- Saving state: Savings Account or contribution changes are being saved
- Active state: Goal Savings account is included in current planning and allocation
- Behind state: Goal Savings account is below its required contribution schedule
- On-track state: Goal Savings account is meeting its required contribution schedule
- Achieved state: Goal Savings account target has been met
- Locked-withdrawal-warning state: an early withdrawal may be restricted or
  penalized
- Archived state: Savings Account is retained for history but excluded from active planning
- Deleted state: Savings Account or contribution is marked deleted and excluded from active views
- Projection-fallback state: personalized projection data is unavailable and fallback estimates are shown
- Offline state: cached savings data is available while network features are unavailable
- Error state: savings data could not be loaded or saved
- Delete-confirmation state: the user must confirm deletion
- Archive-confirmation state: the user must confirm archiving
- Success state: savings changes were saved

### 8.17 Savings Messages

#### Validation Messages

- Invalid savings inputs: `Some savings details are not valid. Check the highlighted fields and try again.`
- Missing HYSA inputs: `Complete: {fields}.`

#### Error Messages

- Savings error: `Your savings information could not be loaded or saved. Check your connection and try again.`

#### Notice Messages

- Initial state: `Savings management is ready. Add or review a savings account to continue.`
- Empty savings list: `No savings accounts are recorded yet. Add an account to start planning your savings.`
- Empty contribution history: `This Goal Savings account has no recorded contributions. Add a contribution to update its progress.`
- No eligible savings selector: `No eligible Goal Savings account or category is available. Add one and try again.`
- Empty Savings Envelope: `No savings money is available for this cycle. Review your budget before allocating savings.`
- Projection fallback: `A personalized projection is not available right now. Use the estimate shown and try again later.`
- Offline savings: `Your saved savings information is available, but online actions are unavailable. Reconnect to continue.`
- Behind savings goal: `This Goal Savings account is behind its contribution schedule. Review the required contribution and adjust your plan.`
- On-track savings goal: `This Goal Savings account is on track. Continue making the planned contributions.`
- Achieved savings goal: `This Goal Savings account has reached its target. Review the completed goal or choose another goal to fund.`
- Archived savings goal: `This Goal Savings account is archived and excluded from active planning. Restore it before making new contributions.`
- Deleted savings goal: `This Goal Savings account is deleted and unavailable for new contributions. Choose an active account instead.`
- Account creation state: `The savings account form is ready. Enter the account details before saving.`
- Contribution entry state: `The contribution transaction is ready. Review the account details and recurrence before saving.`
- Withdrawal entry state: `The withdrawal transfer is ready. Review the source and destination accounts before saving.`
- Locked withdrawal warning: `This Time Deposit may have an early-withdrawal rule. Review the terms before continuing.`
- Active savings goal: `This Goal Savings account is active and included in current planning. Review its progress and next contribution.`

#### Progress and Success Messages

- Savings loading: `Your savings information is loading. Wait a moment for the latest details to appear.`
- Savings transaction linking: `Your related transaction is being created. Wait for the link to finish before leaving this screen.`
- Savings saving: `Your savings changes are being saved. Please wait before trying again.`
- Savings saved: `Your savings changes were saved. Review your accounts before continuing.`

#### Confirmation Messages

- Savings deletion confirmation: `Deleting this account, contribution, or withdrawal removes it from active savings records. Cancel to keep it or confirm deletion to continue.`
- Savings withdrawal confirmation: `This withdrawal reduces the Goal Savings balance. Cancel to keep the money in this account or confirm the transfer to continue.`
- Savings archive confirmation: `Archiving this account removes it from active planning but preserves its history. Cancel to keep it active or confirm archiving to continue.`

#### Recovery Messages

- Savings recovery: `Your savings changes could not be completed. Review the details and try again when your connection is available.`
