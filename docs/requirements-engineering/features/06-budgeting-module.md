## 6. Budgeting Module

### 6.1 Budget Overview

- View the current budget

### 6.2 Create Budget

- Create a manual budget

### 6.3 Edit Budget

- Edit a budget

### 6.4 Delete Budget

- Delete a budget with confirmation

### 6.5 Budget Planning

- Select a budget period
- Define category allocations
- Define a debt allocation
- Define a Savings Envelope
- View unallocated money for the current cycle
- Activate, close, or archive a budget

### 6.6 Budget Form

- Budget period: Weekly / Monthly / Custom
- Start date
- End date
- Total budget
- Category allocations
- Debt allocation
- Savings allocation
- Surplus handling
- Deficit handling

### 6.7 Budget Form Placeholders

- Budget period: `Select budget period`
- Start date: `Select start date`
- End date: `Select end date`
- Total budget: `Enter total budget`
- Category allocation: `Enter category allocation`
- Debt allocation: `Enter debt allocation`
- Savings Envelope allocation: `Enter savings allocation`
- Category selector: `Select category`
- Surplus handling: `Select surplus handling`
- Deficit handling: `Select deficit handling`

### 6.8 Budget Form Validation

- Prevent submission when required fields are empty
- Require a budget period
- Require a start date and end date
- Require the end date to be after the start date
- Require a valid positive total budget
- Require valid non-negative allocations
- Require every allocation to identify a category, debt envelope, or Savings Envelope
- Prevent duplicate allocation targets in the same budget
- Prevent total allocations from exceeding the total budget
- Display validation feedback beside the affected field
- Preserve valid entries after validation failure
- Clear field errors when corrected

### 6.9 Budget States

- Initial state: budget form is ready for input
- Loading state: budget data is being loaded
- Empty state: no budget exists for the selected period
- Empty-allocation state: budget exists without category allocations
- Validation-failure state: budget cannot be saved because inputs are invalid
- Saving state: budget changes are being saved
- Loaded state: budget details and allocations are available
- Draft state: budget is being prepared and is not active
- Active state: budget is being used for the current cycle
- Closed state: budget period has ended or was closed
- Archived state: budget is retained but no longer active
- Surplus state: budget has money remaining after allocations
- Deficit state: planned allocations exceed available budget or required payment requirements cannot be covered
- Error state: budget data could not be loaded or saved
- Delete-confirmation state: the user must confirm budget deletion
- Success state: budget changes were saved

### 6.10 Budget Messages

#### Validation Messages

- Invalid budget inputs: `Some budget details are not valid. Check the highlighted fields and try again.`

#### Error Messages

- Budget error: `Your budget could not be loaded or saved. Check your connection and try again.`

#### Notice Messages

- Initial state: `Budget planning is ready. Create or open a budget to continue.`
- Empty budget: `No budget exists for this period. Create a budget to start planning your allocations.`
- Empty allocations: `This budget has no category allocations yet. Add allocations before reviewing its plan.`
- Loaded state: `Your budget details are available. Review the allocations before continuing.`
- Draft state: `This budget is still a draft. Review it and activate it when you are ready.`
- Active state: `This budget is active for the current cycle. Review your plan as spending changes.`
- Closed state: `This budget period is closed. Review its history or create a budget for a new period.`
- Archived state: `This budget is archived and no longer active. Restore it or return to current planning.`
- Surplus state: `Your budget has money remaining after allocations. Review the unallocated amount before continuing.`
- Budget deficit: `Your planned budget is higher than the money available. Lower an allocation or review your income and expenses.`

#### Progress and Success Messages

- Budget loading: `Your budget is loading. Wait a moment for the details to appear.`
- Budget saving: `Your budget is being saved. Please wait before trying again.`
- Budget saved: `Your budget was saved. Review the allocations before continuing.`

#### Confirmation Messages

- Budget deletion confirmation: `Deleting this budget removes it from planning. Cancel to keep it or confirm deletion to continue.`

#### Recovery Messages

- Budget recovery: `Your budget could not be completed. Review the highlighted details or try saving again.`

### 6.11 Budget Calculations

- Allocated budget is the sum of category, debt, and Savings Envelope allocations
- Unallocated money is the total budget less allocated amounts
- Budget health compares actual spending with the relevant allocation
- Budget allocations cannot exceed the total budget

### 6.12 Budget Tracking

- View budget health
- Compare planned and actual spending
- View allocation progress by category
- View debt allocation progress
- View savings progress
- Respect protected and fixed spending restrictions

### 6.13 Budget Optimization

- Request a budget recommendation
- View suggested category allocations
- View suggested debt allocation
- View suggested Savings Envelope allocation
- View the recommendation explanation
- Edit a recommendation
- Accept or reject a recommendation
- Keep recommendations separate from user-created budgets until accepted

### 6.14 Budget Optimizer Form

- Budget period: `Select budget period`
- Start date: `Select start date`
- End date: `Select end date`
- Total budget: `Enter total budget`
- Current income context: `Select income context`
- Current expense context: `Select expense context`
- Generate recommendation action

### 6.15 Budget Optimizer States

- Initial state: optimizer is ready for input
- Empty-input state: required recommendation inputs are blank
- Validation-failure state: recommendation inputs are invalid
- Generating state: recommendation is being calculated
- Recommendation-ready state: recommendation is available for review
- Recommendation-stale state: source income, expense, debt, savings, or restriction data has changed
- Recommendation-error state: recommendation could not be generated
- Recommendation-unavailable state: insufficient data is available
- Editing state: user is modifying the recommendation
- Accepted state: user accepted the recommendation
- Rejected state: user rejected the recommendation
- Cancelled state: user left the recommendation without applying it

### 6.16 Budget Optimizer Messages

#### Validation Messages

- Empty budget period: `Budget period is required. Select a budget period before continuing.`
- Empty start date: `Start date is required. Select a start date before continuing.`
- Empty end date: `End date is required. Select an end date before continuing.`
- Invalid date range: `End date must be after the start date. Select a valid date range and try again.`
- Invalid total budget: `Total budget must be a valid positive amount. Enter a valid amount and try again.`
- Empty income context: `Income context is required. Select an income context before continuing.`
- Empty expense context: `Expense context is required. Select an expense context before continuing.`

#### Error Messages

- Recommendation error: `Your budget recommendation could not be created. Check your details and try again.`

#### Notice Messages

- Initial state: `The budget optimizer is ready. Provide the requested details to generate a recommendation.`
- Recommendation unavailable: `A budget recommendation is not available yet. Add more income and spending details, then try again.`
- Recommendation outdated: `This recommendation uses older information. Refresh the details before applying it.`
- Editing state: `You are editing the budget recommendation. Review your changes before applying them.`
- Recommendation cancelled: `The recommendation was left unapplied. Review it again or return to budget planning.`

#### Progress and Success Messages

- Recommendation progress: `Your budget recommendation is being prepared. Please wait a moment.`
- Recommendation accepted: `Your budget recommendation was accepted. Review it before saving your budget.`
- Recommendation ready: `Your budget recommendation is ready. Review it before applying it.`
- Recommendation rejected: `Your budget recommendation was rejected. Generate another recommendation or return to budget planning.`

#### Recovery Messages

- Recommendation recovery: `Your recommendation could not be applied. Review the source details and try again.`

### 6.17 Budget Optimizer Validation

- Prevent generation when the budget period is empty and display the budget-period validation message
- Prevent generation when the start date is empty and display the start-date validation message
- Prevent generation when the end date is empty and display the end-date validation message
- Prevent generation when the date range is invalid and display the date-range validation message
- Prevent generation when the total budget is invalid and display the total-budget validation message
- Prevent generation when the income context is empty and display the income-context validation message
- Prevent generation when the expense context is empty and display the expense-context validation message
- Require recommendation inputs to belong to the current user
- Require an explicit user action before applying a recommendation
- Preserve the original recommendation when it is edited or accepted
