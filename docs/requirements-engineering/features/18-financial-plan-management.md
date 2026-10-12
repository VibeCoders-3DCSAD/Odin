## 18. Financial Plan Management

### 18.1 Financial Plan

- Generate a user-reviewable monthly Financial Plan.
- Generate plans only for the next calendar month.
- Combine a Budget Plan, Savings Contribution Plan, and Debt Repayment Plan.
- Use available income, forecast expenses, financial obligations, savings goals,
  debt targets, and Savings and Debt Profile Classification as plan inputs.
- Keep recommendations separate from user-created plans until the user accepts them.
- Allow the user to review, edit, accept, or reject a recommendation before it
  becomes the plan for its period.
- An accepted plan persists its immutable input snapshot locally and remains
  viewable while offline.

### 18.2 Plan Inputs

- Monthly total spendable amount
- Available income
- Next-month total and category-level expense forecast
- Financial obligations due during the plan period
- Active savings goals and Emergency Fund requirements
- Active debt payment requirements and target payoff dates
- Savings and Debt Profile Classification, including EFC, DSTI, FM, and CCB
- Current category restriction snapshots, including fixed amounts and minimum
  floors
- Allocation rules use `Fixed`, `Minimum`, and `Flexible`: Fixed is exact,
  Minimum is a non-reducible floor, and Flexible has a zero floor.
- Allow users to select either broad expense categories or specific expense
  subcategories for a plan. Selecting a broad category excludes its individual
  subcategories from that plan, and selecting an individual subcategory excludes
  its broad category.
- Automatically include Fixed and Minimum categories and subcategories. Users
  cannot remove these required selections.
- Recommend previously used categories and subcategories for selection. A
  selected category without spending history requires a one-time planned amount.
- Allow users to set a category or subcategory's default treatment to Flexible,
  Minimum, or Fixed for future Financial Plans.

### 18.3 Budget Plan

- Generate a monthly budget recommendation using Linear Programming.
- Use the next-month expense forecast for each selected category or
  subcategory as an input to the recommendation.
- Build forecasts from non-anomalous expense history. When an ML forecast is
  unavailable, use the selected category or subcategory's recorded spending as
  a fallback forecast.
- Respect available income, the total spendable amount, financial obligations, savings goals, debt targets, and user preferences.
- Treat Fixed category amounts and Minimum category floors as hard allocation
  constraints.
- Do not reduce a Fixed or Minimum category below its required amount.
- Return an infeasible plan when the total spendable amount cannot cover all required category floors, financial obligations, and debt payment requirements.
- Explain the conflicting constraints without altering category rules or
  inventing a reduced allocation.
- Show each recommendation's allocation rule, forecast amount, allocated amount,
  and any unfunded or constrained allocation.

### 18.4 Savings Contribution Plan

- Recommend contributions toward active savings goals.
- Include Emergency Fund requirements and goal target dates.
- Use Savings and Debt Profile Classification as an input to contribution
  prioritization.
- Show recommended contribution schedules and any projected goal shortfalls.
- Reserve scheduled contributions for active savings goals that are due during
  the plan period.
- When a plan is infeasible, allow users to skip savings contributions only
  after explicit confirmation that the omission may delay goal completion.

### 18.5 Debt Repayment Plan

- Include required payments for active debts and credit-card statement targets.
- Use target payoff dates and Savings and Debt Profile Classification as plan
  inputs.
- Show the payment schedule, projected payoff timeline, and any payment shortfall.
- Keep credit-card repayment strategies and non-credit-card repayment strategies subject to the Debt Management Module rules.
- Reserve each active debt's next in-period minimum payment and each in-period
  authoritative credit-card statement minimum due.
- When a plan is infeasible, allow users to skip debt repayments only after
  explicit confirmation that the omission may result in missed payments.
- Show any optional post-allocation surplus separately from required debt and
  savings reservations. The classification may advise an eligible emergency
  fund or debt as a destination, but the user chooses any surplus amount.

### 18.6 Legacy Budget Data

- Existing budget drafts and allocations remain syncable as legacy records.
- The Budget Tracker is removed from the application and legacy drafts are no
  longer presented in the user interface.
- Existing budget allocations are never reinterpreted as Financial Plan
  `Fixed`, `Minimum`, or `Flexible` rules.
- New monthly planning is created only through Financial Plan Management.
- Financial Plan Management does not copy, replace, delete, or mutate legacy
  budget records while generating or accepting a plan.
- The tracker empty state directs users to Financial Plan Management and does
  not offer a manual draft form or a legacy budget recommendation workflow.

### 18.7 Plan States

- Initial state: plan generation is ready for input
- Insufficient-data state: required plan inputs are unavailable
- Generating state: the Financial Plan is being prepared
- Recommendation-ready state: a plan is available for review
- Stale state: a source input changed after the recommendation was generated
- Accepted state: the user accepted the plan
- Edited state: the user modified a recommendation before accepting it
- Rejected state: the user rejected the recommendation
- Skipped-commitments state: the user explicitly excluded debt repayments or
  savings contributions after reviewing the consequence
- Error state: the Financial Plan could not be generated
- Infeasible state: required commitments exceed available funds; show the
  shortfall without reducing Fixed or Minimum requirements.

### 18.8 Future: Past Financial Plans

- Allow users to view accepted Financial Plans from completed plan periods.
- Preserve the accepted plan's allocations, debt reservations, savings
  reservations, and input snapshot as the historical baseline. Later changes
  to category rules, debt strategies, savings goals, or classifications do not
  alter a past plan.
- Compare user-owned posted transactions in the plan period against each planned
  category and subcategory allocation.
- Show planned, actual, and variance amounts for each category, and identify
  categories that exceeded their allocation.
- Show total planned spending, actual spending, and whether actual spending
  exceeded the plan.
- Compare actual savings contributions with planned savings reservations and
  identify additional contributions.
- Compare actual debt payments with planned debt reservations and identify
  additional payments.
- Distinguish a missing plan commitment from an actual transaction that has not
  yet been recorded.
- Keep past-plan analysis scoped to the authenticated user and the plan's own
  period.
