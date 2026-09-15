## 8. Savings Accounts Module

### 8.1 Savings Overview

- View total savings
- View savings accounts by type: Personal Savings / HYSA / Goal Savings / Time
  Deposit
- View total savings target and overall savings progress for Goal Savings accounts
- View active and completed Goal Savings accounts
- View upcoming goal dates
- View the current-cycle Savings Envelope
- View unallocated savings money
- View an empty state when no goals exist

### 8.2 Savings Account and Goal Management

- View the list of Savings Accounts
- Create, view, edit, archive, and delete a Savings Account with confirmation
- Select one Savings Account type: Personal Savings / HYSA / Goal Savings / Time
  Deposit
- Categorize a Goal Savings account
- Set a target, target date, contribution schedule, and priority for a Goal
  Savings account
- Treat a Goal Savings account as its own holding account; it is not linked to
  a separate financial account
- Mark a Goal Savings account as achieved when its balance reaches its target

### 8.3 Savings Account Creation Form

- Account name
- Savings account type: Personal Savings / HYSA / Goal Savings /
  Time Deposit
- Current balance
- Institution
- Opening date
- Personal Savings: interest rate and minimum balance
- HYSA: base and boosted interest rates, interest calculation basis, interest
  credit frequency, and optional yield conditions
- Goal Savings: category, target amount, target date, contribution schedule,
  interest rate, and priority
- Goal Savings: Emergency Fund is a category or purpose, not a Savings Account
  type and not a debt
- Emergency Fund Goal Savings: target method: Fixed Amount /
  Essential-Expense Coverage
- Emergency Fund Goal Savings: essential-expense coverage period: 3 / 4 / 5 /
  6 months, when applicable
- Time Deposit: principal, interest rate, start date, maturity date, term, and
  early-withdrawal rule
- Notes

Goal Savings categories remain provisional until validated through RRL, informal
interviews, and SME review. Emergency Fund is a Goal Savings category.

For an Emergency Fund goal using Essential-Expense Coverage, the suggested target
equals the selected coverage period multiplied by the user's current monthly
essential expenses. The user may override the suggested target. A change to the
essential-expense baseline refreshes the suggestion but does not silently replace
a user-approved target.

### 8.3.1 Savings Account Type Inputs and Handling

The Savings account type is a required single-select control. Selecting a type
shows only that type's applicable inputs and preserves shared values. Before a
type change clears fields that do not apply to the newly selected type, require
confirmation and explain that those type-specific values will be removed. The
selected type determines the account's form fields, validation, displayed
details, and calculation rules.

All Savings Accounts use these shared inputs:

| Input | Control | Required | Handling |
| --- | --- | --- | --- |
| Account name | Single-line text input | Yes | Trim surrounding whitespace and use it as the account's display name. |
| Savings account type | Single-select segmented control or picker | Yes | Show the selected type's inputs and apply its rules below. |
| Current balance | Currency amount input | Yes | On creation, store as the account's starting balance. After creation, show the calculated current balance after contributions, withdrawals, and credited interest. |
| Institution | Single-line text input | No | Store as reference information only; it does not affect calculations. |
| Opening date | Date picker | No, except for Time Deposit | Store as the account opening date. For Time Deposit, use it as the start date. |
| Notes | Multi-line text input | No | Store as reference information only; it does not affect calculations. |

Personal Savings inputs:

| Input | Control | Required | Handling |
| --- | --- | --- | --- |
| Interest rate | Percentage amount input | Yes | Use as the annual rate for projected and credited interest. A value of `0` means the account earns no interest. |
| Minimum balance | Currency amount input | Yes | Store as the bank's minimum-balance reference. Show it in account details and warn when the current balance falls below it; do not block a withdrawal solely because it would go below the minimum. |
| Planned contribution amount | Currency amount input | Yes | Use as the planned contribution for each scheduled occurrence. It does not create a transaction without explicit user confirmation. |
| Contribution schedule | Shared frequency selector with next contribution date | Yes | Select Weekly, Biweekly, Semi-Monthly, Monthly, Quarterly, Yearly, or Custom. Use the schedule for balance projections only. |

HYSA inputs are progressive: show Account Details and Interest first, then reveal only the optional rule that the user enables.

| Input | Control | Required | Handling |
| --- | --- | --- | --- |
| Account name, bank or provider, current balance, and date opened | Shared text, currency, and date controls | Name and balance only | Store the account's display and starting-balance details. |
| Regular interest rate | Percentage amount input | Yes | Use as the normal annual rate. Accept a number with or without a `%` suffix. |
| Interest calculation basis | Single-select picker | Yes | Select Daily Balance, Average Daily Balance, Other, or I'm Not Sure. Preserve Other and unknown choices without assuming a calculation method. |
| Interest credit frequency | Single-select picker | Yes | Select Daily, Monthly, Every 3 Months, Yearly, At Maturity, Other, or I'm Not Sure. |
| Minimum balance needed and maximum eligible balance | Currency amount inputs | No | Store the applicable balance limits for the configured rate. |
| Higher rate available? | Segmented Yes / No / I'm Not Sure control | Yes | Reveal higher-rate configuration only for Yes. Preserve an unsure answer as unknown. |
| Higher interest rate and qualification frequency | Percentage input and selector | Required when higher rate is available | Store the annual rate and the required qualification period. |
| Higher-rate requirements | Repeatable dynamic form | Required when higher rate is available | Add Money, Make Transactions, Spend Money, Maintain a Balance, Receive Salary or Income, or Other. Each requirement captures its amount or count and period where applicable; Other requires a description. |
| Balance-based rates? | Segmented Yes / No / I'm Not Sure control | Yes | Reveal balance-rate configuration only for Yes. |
| Rate application and balance ranges | Radio control and repeatable rows | Required when balance-based rates are enabled | Select Whole Balance, Tiered Balance, or I'm Not Sure. Label every range's From, Up to, and annual rate. The final range may have no upper limit; ranges cannot overlap. |
| Limited-time offer? | Segmented Yes / No control | Yes | Reveal promotion inputs only for Yes. |
| Promotional rate, dates, and requirements | Percentage input, date pickers, and optional requirement builder | Rate and dates required when a promotion is enabled | Require an inclusive start and end date and reuse the requirement builder when the promotion has conditions. |
| Regular savings plan? | Toggle or segmented Yes / No control | No | Reveal contribution planning only when enabled. A disabled plan stores no schedule. |
| Savings-plan amount, frequency, next deposit, and custom days | Currency input, selector, and date picker | Required when the plan is enabled | Use only for projections. Custom frequency requires a positive number of days. |

Goal Savings inputs:

| Input | Control | Required | Handling |
| --- | --- | --- | --- |
| Category | Single-select picker | Yes | Classify the goal for display and allocation. Emergency Fund is a category, not an account type. |
| Target amount | Currency amount input | Yes | Use as the goal completion threshold and to calculate remaining amount and progress. |
| Target date | Date picker | Yes | Use to calculate the required contribution and projected completion status. |
| Planned contribution amount | Currency amount input | Yes | Use as the planned contribution for each scheduled occurrence. It does not create a transaction without explicit user confirmation. |
| Contribution frequency | Shared frequency selector | Yes | Select Weekly, Biweekly, Semi-Monthly, Monthly, Quarterly, Yearly, or Custom. Use the same frequency selector used for recurring financial schedules. |
| Next contribution date | Date picker | Yes | Anchor the contribution schedule and determine the scheduled occurrences before the target date. |
| Interest rate | Percentage amount input | No | When provided, use as the annual rate for projected and credited interest; otherwise project no interest. |
| Priority | Single-select picker | Yes | Use for savings allocation after Emergency Fund priority. |
| Target method | Single-select picker | Emergency Fund only | For Emergency Fund, select Fixed Amount or Essential-Expense Coverage. Fixed Amount uses the entered target. |
| Essential-expense coverage period | Single-select picker: 3 / 4 / 5 / 6 months | Essential-Expense Coverage only | Multiply the selected period by current monthly essential expenses to suggest a target. Do not replace a user-approved target without confirmation. |

Time Deposit inputs:

| Input | Control | Required | Handling |
| --- | --- | --- | --- |
| Principal | Currency amount input | Yes | Store as the deposited principal and opening balance. Do not allow a different opening-balance value for a Time Deposit. |
| Interest rate | Percentage amount input | Yes | Use as the annual rate for maturity and interest projections. |
| Start date | Date picker | Yes | Start the deposit term and interest projection. Use the shared opening date as this value. |
| Maturity date | Date picker | Yes | End the deposit term and interest projection; it must be after the start date. |
| Term | Numeric duration input with unit selector | Yes | Store the agreed term and use it to cross-check the maturity date against the start date. |
| Early-withdrawal rule | Multi-line text input | Yes | Store the bank's restriction or penalty terms for reference. Show this rule and require confirmation before an early withdrawal; do not infer a monetary penalty from free text. |

### 8.4 Savings Account Form Placeholders

- Account name: `Enter account name`
- Savings account type: `Select savings account type`
- Current balance: `Enter current balance`
- Institution: `Enter institution name`
- Opening date: `Select opening date`
- Personal Savings interest rate: `Enter interest rate`
- Personal Savings minimum balance: `Enter minimum balance`
- Savings planned contribution amount: `Enter contribution amount`
- Savings contribution frequency: `Select contribution frequency`
- Savings next contribution date: `Select contribution date`
- HYSA regular interest rate: `3.50`
- HYSA interest calculation basis: `Select calculation method`
- HYSA interest credit frequency: `Select credit frequency`
- HYSA higher interest rate: `5.00`
- HYSA requirement amount: `Amount in PHP`
- HYSA transaction requirement: `Number of transactions`
- HYSA other requirement: `Describe what your bank requires`
- HYSA balance range start: `0`
- HYSA balance range end: `99,999`
- HYSA balance range rate: `3.50`
- HYSA promotional rate: `0.00`
- HYSA promotional period start: `Select promotion start date`
- HYSA promotional period end: `Select promotion end date`
- Goal Savings category: `Select savings category`
- Goal Savings target amount: `Enter target amount`
- Goal Savings target date: `Select target date`
- Goal Savings planned contribution amount: `Enter contribution amount`
- Goal Savings contribution frequency: `Select contribution frequency`
- Goal Savings first or next contribution date: `Select contribution date`
- Goal Savings interest rate: `Enter interest rate`
- Priority: `Select goal priority`
- Target method: `Select target method`
- Essential-expense coverage period: `Select coverage period`
- Time Deposit principal: `Enter principal amount`
- Time Deposit interest rate: `Enter interest rate`
- Time Deposit start date: `Select start date`
- Time Deposit maturity date: `Select maturity date`
- Time Deposit term: `Enter deposit term`
- Time Deposit early-withdrawal rule: `Describe early-withdrawal rule`
- Notes: `Add goal notes`

### 8.5 Savings Selectors

- Savings account type selector
- Goal Savings category selector
- Goal priority selector
- Savings contribution frequency selector: Weekly / Biweekly / Semi-Monthly / Monthly / Quarterly / Yearly / Custom
- Goal Savings account selector for contributions, withdrawals, and transaction
  links
- Savings activity selector: Contribution / Withdrawal
- Savings allocation strategy selector
- HYSA interest calculation-basis selector: Daily Balance / Average Daily Balance / Other / I'm Not Sure
- HYSA interest credit-frequency selector: Daily / Monthly / Every 3 Months / Yearly / At Maturity / Other / I'm Not Sure
- HYSA higher-rate availability selector: Yes / No / I'm Not Sure
- HYSA higher-rate qualification selector: Daily / Monthly / Every 3 Months / Yearly / Custom
- HYSA requirement-type selector: Add Money / Make Transactions / Spend Money / Maintain a Balance / Receive Salary or Income / Other
- HYSA balance-based-rate selector: Yes / No / I'm Not Sure
- HYSA rate-application selector: Whole Balance / Tiered Balance / I'm Not Sure
- HYSA limited-time-offer selector: Yes / No
- Target method selector
- Essential-expense coverage-period selector
- Date-range selector for contribution history
- Include only active Goal Savings accounts in allocation selectors
- Show an empty selector state when no eligible goals or accounts exist

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
- Require a withdrawal to use a Transfer transaction from the Savings Account
  account to an eligible destination account
- Create a withdrawal and its linked transfer together when the transfer is
  saved
- View contribution and withdrawal history separately
- Delete a contribution or withdrawal only as a correction action and require
  confirmation
- Display updated Goal Savings progress after linked transaction changes when
  the Savings Account type is Goal Savings

### 8.7 Savings Activity Transaction Context

- Savings Account
- Savings activity: Contribution / Withdrawal
- Transaction Management owns the amount, date, accounts, recurrence schedule,
  and notes inputs

The user must explicitly choose the savings activity. Savings Goals opens
Transaction Management with the selected Savings Account and activity
context. Ordinary
transactions do not create or link to savings activities automatically.

### 8.8 Savings Activity Context Placeholders

- Savings Account: `Select savings account`
- Savings activity: `Select savings activity`

### 8.9 Savings Validation

- Prevent submission when required Savings Account or savings activity fields are
  empty
- Require an account name, Savings Account type, and valid non-negative
  balance
- Require a valid non-negative interest rate and minimum balance for Personal
  Savings
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
- Require a Goal Savings category, positive target amount, non-negative
  planned contribution amount, contribution frequency, first or next
  contribution date, and target date
- Require the first or next contribution date to be on or before the target
  date
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
- Allocate the Budgeting Module's Savings Envelope across Goal Savings accounts
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

- Budgeting provides one Savings Envelope for the current cycle
- Savings allocates the envelope across active Goal Savings accounts
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
- Debt payoff surplus is handled by Budgeting before it becomes part of the Savings Envelope

The Budgeting Module provides one Savings Envelope. The Savings Accounts Module
distributes that envelope across Goal Savings accounts. Debt payoff surplus is
handled by Budgeting before it reaches this allocation step.

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
- HYSA-conditional-input state: only inputs enabled by the selected HYSA rules are visible
- HYSA-unknown-rule state: a bank rule is explicitly unknown and is not assumed
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
