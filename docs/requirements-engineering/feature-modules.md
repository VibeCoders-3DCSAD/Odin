# Odin Feature Modules

This document defines product-level capabilities, user-facing form fields, domain calculations, and user-facing state messages for requirements work. Every error, failure, unavailable, blocked, or network-required state defined below must display its corresponding message. It excludes database structures, code structure, and test cases.

## 1. User Authentication

### 1.1 Account Access

- Register an account
- Log in with email and password
- Log in with Google
- Verify email ownership
- Recover a forgotten password
- Log out
- Display authentication and network errors

### 1.2 Authentication Forms

- Registration: email, password, and password confirmation
- Login: email and password
- Forgot password: email
- Password validation and matching-password validation
- Email placeholder: `you@example.com`
- Password placeholder: `Enter your password`
- Password confirmation placeholder: `Re-enter your password`
- Forgot-password email placeholder: `Enter your registered email`

### 1.3 Authentication States

- Initial state: authentication form is ready for input
- Empty-input state: required fields are blank and submission is blocked
- Validation-failure state: one or more fields contain invalid or mismatched values
- Submitting state: authentication request is in progress and duplicate submission is prevented
- Invalid-credentials state: submitted login details are not accepted
- Account-exists state: registration email is already associated with an account
- Email-unverified state: access is restricted until email verification is completed
- Network-required state: the action cannot continue without an internet connection
- Network-error state: the request failed because connectivity was interrupted
- Server-error state: the authentication service could not complete the request
- Rate-limited state: the user must wait before retrying
- Success state: the requested authentication action completed
- Password-reset-sent state: the reset request was accepted
- Session-expired state: the user must authenticate again

### 1.4 Authentication Validation

- Prevent submission when required inputs are empty
- Reject malformed email addresses
- Enforce password requirements
- Require matching password and confirmation during registration
- Trim and normalize supported text inputs before validation
- Display validation feedback beside the affected input
- Preserve valid user input after validation failure
- Clear field-level errors when the corresponding input is corrected
- Keep authentication errors understandable and free of sensitive details

### 1.5 Authentication Messages

#### Validation Messages

- Empty email: `Enter your email first. Add your email before continuing.`
- Empty password: `Enter your password first. Add your password before continuing.`
- Invalid email during registration: `Use a valid email to create your account. Check the format and try again.`
- Invalid email during password recovery: `Enter a valid registered email. Check the address and try again.`
- Missing password: `Password is required. Enter your password before continuing.`
- Invalid password: `Your password does not meet the requirements. Choose a stronger password and try again.`
- Missing new password: `Choose a new password first. Enter a new password before continuing.`
- Mismatched registration passwords: `Your passwords do not match yet. Enter the same password in both fields.`
- Mismatched new passwords: `Your new passwords do not match yet. Enter the same password in both fields.`

#### Authentication Error Messages

- Invalid credentials: `Your email or password was not accepted. Check your details and try again.`
- Existing account: `An account with this email already exists. Sign in or use a different email address.`
- Unverified email: `Your email is not verified yet. Verify it first, then sign in.`
- Rate limited: `Too many attempts were made. Wait before trying again.`
- Invalid email address: `That email address is not valid. Enter a valid email address and try again.`
- Required refresh token: `Your session token is missing. Sign in again and retry.`
- Required Google token: `Your Google sign-in token is missing. Start Google sign-in again.`
- Google sign-in unavailable: `Google sign-in is not available right now. Use email and password instead.`
- Google sign-in cancelled: `Google sign-in was cancelled. Start it again or use email and password.`
- Google sign-in failure: `Google sign-in failed. Try again or use email and password.`
- Authentication failure: `Authentication failed. Check your details and try again.`
- Bad request: `Your request is not valid. Check your input and try again.`
- Authentication service failure: `The app could not complete that request. Please try again.`
- Registration failure: `Registration failed. Please try again.`
- Session bootstrap failure: `Your session could not be started. Sign in again and try again.`
- Profile bootstrap failure: `Your profile could not be loaded. Try again.`
- Session restore failure: `Your session could not be restored. Sign in again.`
- Consent status failure: `Your consent status could not be checked. Try again.`
- Missing access token: `No sign-in session was returned. Sign in again and try again.`
- Logout failure: `Logout failed. Check your connection and try again.`

#### Network and Session Error Messages

- Network required: `No internet connection is available. Connect to the internet and try again.`
- Network error: `Odin could not be reached. Check your internet connection and try again.`
- Request timeout: `The request timed out. Check your connection and try again.`
- Missing authorization token: `Your sign-in session is missing. Sign in again and retry.`
- Missing recovery session: `Your recovery session is missing. Request a new reset link and open it on this device.`
- Expired session: `Your secure session is no longer valid. Sign in again to continue.`

#### Verification and Password Recovery Messages

- Verification failure: `We could not verify your email yet. Open the latest verification link and try again.`
- Verification resend failure: `The verification email could not be sent. Check your connection and try again.`
- Verification sent: `A new verification email was sent to {email}. Check your inbox to continue.`
- Password reset failure: `Your password reset request failed. Check your connection and try again.`
- Password reset accepted: `If that email exists, a reset link is on the way now. Check your inbox to continue.`
- Password update failure: `Your password could not be updated. Check your details and try again.`
- Password update success: `Your password was updated. Sign in with your new password.`
- Generic failure: `Something went wrong. Please try again.`
- Email verification complete: `Email verification completed. Return to sign in to continue.`
- Verification-link instructions: `Check {email} for Odin's verification link. The link confirms email ownership and unlocks sign-in.`
- Verification reminder: `Verification email sent to {email}. Tap the link there, then come back and sign in.`
- Session-expired instructions: `Your secure session is no longer valid. Sign in again to protect your account.`
- Recovery-session ready: `Your reset session is ready. Choose a new password to continue.`
- Recovery-session missing: `This reset link did not include a recovery session. Request a new reset link and open it on this device.`

#### Authentication Progress and Success Messages

- Login in progress: `Signing you in... Please wait a moment.`
- Registration in progress: `Creating your Odin account... Please wait a moment.`
- Verification-link progress: `Opening your reset session... Please wait a moment.`
- Password-reset progress: `Sending your reset link... Please wait a moment.`
- Password-update progress: `Updating your password... Please wait a moment.`
- Google-login progress: `Opening Google sign-in... Please wait a moment.`
- Logout progress: `Logging you out... Please wait a moment.`
- Account-created success: `Account created. One more step. Verify your email to continue.`
- Email-verified success: `Email verified. You can now log in. Sign in to continue.`
- Logged-out success: `You are logged out. Sign in again when you are ready.`
- Native Google logout warning: `Logged out from Odin. Google sign-out could not be completed; try again from Google later.`

## 2. Onboarding Questionnaire

### 2.1 Guided Onboarding

- Complete a guided financial questionnaire
- Answer multiple-choice and open-input questions
- Validate required answers
- Save and resume incomplete onboarding
- Review answers before submission

### 2.2 Questionnaire Inputs

- Multiple-answer selections
- Single-answer selections
- Text inputs
- Numeric inputs
- Date or age inputs
- Employment and location inputs
- Multiple-answer placeholder: `Select all that apply`
- Single-answer placeholder: `Select an answer`
- Text-input placeholder: `Enter your answer`
- Numeric-input placeholder: `Enter a value`
- Date-input placeholder: `Select a date`
- Employment-input placeholder: `Select employment status`
- Location-input placeholder: `Select your location`

### 2.3 Questionnaire Validation

- Prevent submission when a required answer is empty
- Require at least one selection for multiple-answer questions
- Require one selection for single-answer questions
- Validate text answers against the question's allowed length
- Validate numeric answers as valid, non-negative values where applicable
- Validate dates against the question's allowed range
- Validate employment and location answers against available choices
- Display validation feedback beside the affected question
- Preserve valid answers after validation failure
- Clear question-level errors when the answer is corrected

### 2.4 Questionnaire Empty States

- Empty selection state: show `Select an answer`
- Empty multiple-selection state: show `Select all that apply`
- Empty text state: show `Enter your answer`
- Empty numeric state: show `Enter a value`
- Empty date state: show `Select a date`
- Empty employment state: show `Select employment status`
- Empty location state: show `Select your location`
- Do not treat a placeholder as a submitted answer
- Keep the Continue or Submit action blocked when required answers remain empty

### 2.5 Questionnaire States

- Initial state: questionnaire is ready for input
- Loading state: onboarding questions or saved answers are loading
- Empty-answer state: a required answer has not been provided
- Validation-failure state: one or more answers are invalid
- Saving state: onboarding answers are being saved
- Resume state: incomplete saved answers are being restored
- Review state: completed answers are ready for review
- Submission-error state: onboarding answers could not be submitted
- Save-error state: onboarding answers could not be saved
- Network-required state: onboarding requires an internet connection for this action
- Error state: onboarding data could not be loaded or saved
- Success state: onboarding answers were saved or submitted

### 2.6 Questionnaire Messages

#### Validation Messages

- Required answer: `This answer is required. Provide an answer before continuing.`
- Required multiple selection: `Select at least one answer. Choose an option before continuing.`

#### Onboarding Error Messages

- Reassessment start failure: `We could not start your reassessment. Please try again.`
- Session creation failure: `We could not create your onboarding session. Please try again.`
- Session loading failure: `We could not load your onboarding session. Check your connection and try again.`
- Save failure: `Your answers could not be saved. Please try again.`
- Research eligibility failure: `Your research eligibility could not be saved. Please try again.`
- Submission failure: `Your onboarding submission failed. Please try again.`
- Network failure: `A network error interrupted onboarding. Check your connection and try again.`
- Onboarding error: `Your onboarding data could not be loaded or saved. Check your connection and try again.`

#### Onboarding Notices

- Initial state: `Your onboarding questionnaire is ready. Answer the questions to continue.`
- Loading state: `Your onboarding questionnaire is loading. Please wait a moment.`
- Resume state: `Your saved onboarding answers are ready. Continue where you left off.`
- Review state: `Your answers are ready for review. Check them before submitting.`
- Success state: `Your onboarding answers were saved. Continue to review your financial profile.`
- Research eligibility success: `You are eligible to participate in the research study. You can opt out later through the system settings.`
- Network-required notice: `Onboarding requires an internet connection. Connect to the internet and try again.`

### 2.7 Financial Profile

- Generate an initial financial profile
- View the profile explanation
- Accept or reject the assigned profile
- Manually change the assigned profile
- Request profile reassessment
- View research eligibility separately from app access

## 3. Dashboard

### 3.1 Financial Overview

- View current available balance
- View current-month income
- View current-month expenses
- View balance and expense trends
- View spending distribution
- View recent expenses
- View budget health

### 3.2 Personal Finance Summary

- View savings goal summary
- View debt summary
- View alerts summary
- View spending forecast and insights
- View empty states when financial data is unavailable
- View cached or stale information when a service is unavailable

### 3.3 Dashboard Empty States

- No financial accounts: prompt the user to add an account
- No transactions: prompt the user to record an income or expense
- No income sources: prompt the user to add an income source
- No budget: prompt the user to create a budget
- No savings goals: prompt the user to create a savings goal
- No debts: show that no debts are currently recorded
- No alerts: show that there are no alerts to review
- No forecast: explain that forecast information is not yet available
- No chart data: show an empty chart state instead of a misleading chart
- Partial data: display available sections without blocking the dashboard

### 3.4 Dashboard States

- Loading state: show dashboard loading feedback before local data is ready
- Loaded state: show available financial summaries
- Empty state: show relevant setup prompts when no records exist
- Partial state: show available data and empty states for missing modules
- Stale-data state: identify cached or outdated downstream information
- Error state: show a safe recovery message without hiding unaffected dashboard data

### 3.5 Dashboard Messages

#### Dashboard Error Messages

- Data error: `Some dashboard information is unavailable. Try refreshing to recover it.`
- Summary loading error: `Your dashboard summary could not be loaded. Review the available trends and insights, then try again.`
- Refresh error: `Dashboard refresh failed. Check your connection and try again.`
- Savings error: `Savings goal information is unavailable. Refresh to try again.`
- Debt error: `Debt information is unavailable. Refresh to try again.`
- Alerts error: `Alerts are unavailable. Refresh to try again.`
- Forecast error: `Forecast information is unavailable. Refresh to try again.`

#### Dashboard Notice Messages

- Loading state: `Your dashboard is loading. Please wait a moment.`
- Loaded state: `Your dashboard is ready. Review your financial overview.`
- Empty state: `Your dashboard has no financial activity yet. Add an account or record a transaction to get started.`
- Cached summary: `Cached dashboard summary. Refresh to view the latest information.`
- No financial accounts: `No financial accounts are available. Add an account to make your available balance accurate.`
- No income sources: `No income sources are available. Set expected income to make your monthly plan more useful.`
- No chart data: `No chart data is available. Record activity this month to see the chart.`
- No expenses: `No expenses were recorded this month. Record an expense to see spending data.`
- No recent transactions: `No recent transactions are available. Record income or an expense to get started.`
- No expenses recorded: `No expenses have been recorded yet. Record an expense to track spending.`
- No budget: `Budget health is unavailable until a current status is calculated. Create a budget or refresh to try again.`
- No budget spending: `No spending is recorded for this budget. Record an expense to see budget health.`
- No alerts: `There are no alerts to review. Return later for new updates.`
- No forecast: `Forecast information is not yet available. Keep recording transactions to unlock personalized insights.`
- No savings goals: `No savings goals are available. Create a goal to start tracking progress.`
- No debts: `No debts are currently recorded. Add a debt when you need to track one.`

- Partial-data notice: `Some sections are unavailable right now, but your available information is still shown. Refresh to try loading the missing sections.`
- Budget cached-data notice: `Cached budget data is being shown. Refresh to view the latest status.`
- Budget-health stale notice: `Budget health may be out of date. Refresh to check the latest status.`
- Budget on-track notice: `{amount} remains in this budget cycle. Continue reviewing your spending.`
- Budget warning notice: `{amount} remains in this budget cycle. Consider slowing spending in these categories.`
- Budget critical notice: `Only {amount} remains for the rest of this budget cycle. Review upcoming expenses and adjust your plan if needed.`
- Budget reached notice: `This budget has reached its planned amount. Review upcoming expenses and adjust your plan if needed.`

#### Dashboard Progress and Success Messages

- Refresh action: `Your dashboard needs fresh information. Refresh it to get the latest data.`
- Retry action: `Your dashboard could not recover the unavailable information. Refresh it and try again.`

### 3.6 Budget Health States

- Healthy: spending is within the current budget allocation
- Warning: spending is approaching the current budget allocation
- Low: spending has exceeded the current budget allocation or the remaining budget is insufficient for the rest of the cycle
- No-budget state: explain that budget health is unavailable until a budget is created
- No-spending state: show that budget health has no recorded spending to evaluate
- Stale state: identify budget health based on cached information
- Display the current health state with plain-language guidance
- Do not use shame-based language for the Low state

### 3.7 Dashboard Calculations

- Available balance: included account balances minus applicable outflows
- Net monthly cash flow: monthly income minus monthly expenses
- Budget health: actual spending compared with budget allocation
- Spending distribution: category or category-group expenses as a share of total expenses

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
- Opening balance
- Institution name
- Opening date
- Credit limit, when applicable
- Billing cycle: 28-31 days, for credit card accounts
- Cut-off day of the month (1-31), for credit card accounts
- Alert threshold percentage of credit limit, for credit card accounts

### 4.3 Account Form Placeholders

- Account name: `Enter account name`
- Account type: `Select account type`
- Opening balance: `Enter opening balance`
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

## 5. Income Sources

### 5.1 Income Source Overview

- View total expected monthly income
- View the list of income sources

### 5.2 Create Income Source

- Add an income source

### 5.3 Edit Income Source

- Edit an income source

### 5.4 Delete Income Source

- Delete an income source with confirmation

### 5.5 Income Source Form

- Income name
- Destination account
- Income category
- Income type: Stable / Variable
- Frequency: Weekly / Biweekly / Semi-Monthly / Monthly / Irregular / Custom
- Expected amount
- Minimum amount
- Maximum amount
- Pay date or schedule
- Notes

### 5.6 Income Calculations

- Monthly expected income is normalized from each source's frequency
- Variable income may be represented by expected, minimum, and maximum values

### 5.7 Income Scheduling and Automation

- Define an income schedule
- Define expected income ranges
- Link income to a destination account
- Require an existing income source before automation can be created
- Automate an income source through recurring transactions
- Create a recurring income transaction from an income source
- Maintain a one-way relationship: Income Source -> Recurring Transaction
- Use the income source's destination account for generated income
- Use the income source's schedule for generated transactions
- View the automation status of an income source
- View the next expected automated income
- Edit the recurring income schedule
- Pause or stop automated income generation
- Preserve previously generated income transactions when automation is stopped
- Prevent duplicate recurring automation for the same income source

### 5.8 Income Source States

- Initial state: income source management is ready for use
- Loading state: income sources or automation details are loading
- Empty-list state: no income sources are recorded
- Empty-input state: required income source fields are blank
- Validation-failure state: income source inputs are invalid
- Saving state: income source changes are being saved
- Duplicate-automation state: an income source already has recurring automation
- Automation-active state: recurring income generation is enabled
- Automation-paused state: recurring income generation is temporarily paused
- Automation-stopped state: recurring income generation has been stopped
- Network-required state: the requested income source action requires an internet connection
- Sync-failure state: income source changes could not be synchronized
- Delete-confirmation state: the user must confirm income source deletion
- Archive-confirmation state: the user must confirm income source archiving
- Error state: income source data could not be loaded or saved
- Success state: income source changes were saved

### 5.9 Income Source Messages

#### Validation Messages

- Empty income name: `Income name is required. Enter an income name before continuing.`
- Empty destination account: `Destination account is required. Select an account before continuing.`
- Empty income category: `Income category is required. Select a category before continuing.`
- Empty income type: `Income type is required. Select Stable or Variable before continuing.`
- Empty frequency: `Income frequency is required. Select a frequency before continuing.`
- Invalid expected amount: `Expected amount must be a valid amount. Enter a valid amount and try again.`
- Invalid income range: `Minimum and maximum amounts must be valid, and the minimum cannot exceed the maximum.`
- Invalid pay schedule: `Pay date or schedule is not valid. Enter a valid schedule and try again.`

#### Error Messages

- Income source error: `Your income source could not be loaded or saved. Check your connection and try again.`
- Duplicate automation: `This income source already has recurring automation. Edit the existing automation instead.`
- Sync failure: `Your income source changes could not be synchronized. Retry the sync when your connection is available.`

#### Notice Messages

- Initial state: `Income source management is ready. Add or review an income source to continue.`
- Empty income source list: `No income sources are recorded yet. Add an income source to plan expected income.`
- Automation active: `Automated income is active. Review the next expected income before making changes.`
- Automation paused: `Automated income is paused. Resume automation when you want future income generated.`
- Automation stopped: `Automated income is stopped. Create new automation if future income should be generated.`

#### Network and Session Error Messages

- Network required: `This income source action requires an internet connection. Reconnect and try again.`
- Network error: `We could not reach your income sources. Check your connection and try again.`

#### Progress and Success Messages

- Income source loading: `Your income sources are loading. Wait a moment for the list to appear.`
- Income source saving: `Your income source changes are being saved. Wait a moment for the update to finish.`
- Income source saved: `Your income source changes were saved. Continue managing expected income.`

#### Confirmation Messages

- Income source deletion confirmation: `Deleting this income source removes it from future planning. Cancel to keep it or confirm deletion to continue.`

#### Recovery Messages

- Income source sync recovery: `Some income source changes could not be synchronized. Retry them or review the failed changes before discarding anything.`

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
- Label a statement balance calculated before the bank-provided statement is recorded as an estimate
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
- Allow a user to record a separate installment early-settlement request with settlement date, remaining principal, settlement amount, pre-termination fee when applicable, and settlement status
- Mark an installment completed only when the issuer recognizes the settlement

Credit-card payment status applies to a billing-cycle statement. It does not create an Obligation Module record or change the status of a linked installment unless the issuer recognizes an explicit early settlement.

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
- Settlement status

### 7.7.5 Credit Card Early Settlement Form Placeholders

- Installment: `Select installment`
- Settlement date: `Select settlement date`
- Remaining principal: `Enter remaining principal`
- Settlement amount: `Enter settlement amount`
- Pre-termination fee: `Enter pre-termination fee`
- Settlement status: `Select settlement status`

### 7.7.6 Credit Card Early Settlement Validation

- Require an installment
- Require a settlement date
- Require valid non-negative remaining principal
- Require a valid positive settlement amount
- Require a valid non-negative pre-termination fee when provided
- Do not mark the installment completed until the issuer recognizes the settlement
- Preserve valid entries after validation failure
- Clear field errors when corrected

### 7.8 Credit Card Budgeting

- Require the user to select a repayment strategy for every active credit-card account before its statement due dates are planned
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

- Require a repayment strategy for every active credit-card account before its statement due dates are planned
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
- Estimated-statement state: the application-calculated balance is shown until the bank statement is recorded
- Statement-pending state: ask whether the bank-provided statement has been received for the current cycle
- Repayment-strategy-required state: an active credit-card account has no selected repayment strategy
- Payment-recording state: a credit-card payment is being recorded
- Transaction-recording state: a regular or installment purchase is being recorded
- Installment-creation state: a long-term installment record is being created
- Fully-paid state: payments meet or exceed the statement balance
- Minimum-satisfied state: payments meet the minimum amount due but not the statement balance
- Partially-paid state: payments do not yet meet the minimum amount due
- Installment-active state: an installment has remaining principal or months
- Early-settlement-requested state: an early settlement was recorded and awaits issuer recognition
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

#### Notice Messages

- Empty credit-card list: `No credit cards are recorded yet. Add a credit card to track billing cycles and payments.`
- Empty billing cycle: `No billing cycles are recorded for this card. Add a billing cycle to track its statement activity.`
- Statement expected: `Your statement for {card name} should be available today. Record it to update your payment requirement.`
- Estimated statement: `This statement balance is an estimate. Record the bank-provided statement when it is available.`
- Fully paid: `This statement is fully paid. No remaining statement balance is currently recorded.`
- Minimum satisfied: `The minimum payment is satisfied, but the remaining balance may incur finance charges.`
- Partially paid: `This statement is not fully paid and the minimum amount due is not yet satisfied. Review the remaining payment.`
- Early settlement pending: `The early settlement request was recorded. The installment remains active until the issuer recognizes it.`
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

## 8. Savings Goals Module

### 8.1 Savings Overview

- View total savings
- View total savings target
- View overall savings progress
- View active and completed goals
- View upcoming goal dates
- View the current-cycle Savings Envelope
- View unallocated savings money
- View an empty state when no goals exist

### 8.2 Savings Goal Management

- View the list of savings goals
- Create a savings goal
- Categorize a savings goal
- Set a goal target and target date
- Set a goal priority
- Link a goal to a financial account
- View goal details
- Edit a savings goal
- Mark a goal as achieved
- Archive a goal
- Delete a goal with confirmation

### 8.3 Savings Goal Creation Form

- Goal name
- Savings category or type
- Target amount
- Starting amount
- Target date
- Priority
- Linked financial account
- Notes

Savings categories remain provisional until validated through RRL, informal interviews, and SME review. Essentially, savings category or type must be validated against the top 10 savings of Filipinos to be financially free (e.g. emergency fund)

### 8.4 Savings Goal Form Placeholders

- Goal name: `Enter goal name`
- Savings category or type: `Select savings category`
- Target amount: `Enter target amount`
- Starting amount: `Enter starting amount`
- Target date: `Select target date`
- Priority: `Select goal priority`
- Linked financial account: `Select financial account`
- Notes: `Add goal notes`

### 8.5 Savings Selectors

- Savings category or type selector
- Goal priority selector
- Linked financial account selector
- Savings goal selector for contributions and transaction links
- Contribution source selector: Manual / Budget-based / Transaction
- Savings allocation strategy selector
- Date-range selector for contribution history
- Include only active goals in allocation selectors
- Show an empty selector state when no eligible goals or accounts exist

### 8.6 Savings Contributions

- Add a contribution to a goal
- View contribution history
- Edit a contribution
- Delete a contribution with confirmation
- Support manual and budget-based contributions
- Record a transaction as a savings contribution through an explicit transaction-entry action
- Select the savings goal receiving the contribution
- Create a contribution and then record its related transaction
- Display updated goal progress after contribution changes

### 8.7 Savings Contribution Form

- Contribution amount
- Contribution date
- Contribution source
- Source account
- Record as savings contribution, when applicable
- Savings goal, when recording a transaction as a contribution
- Record transaction from contribution, when applicable
- Notes

The user must explicitly choose the savings-contribution action. Supported entry paths are transaction -> contribution and contribution -> transaction. Ordinary transactions do not create or link to savings contributions automatically.

### 8.8 Savings Contribution Form Placeholders

- Contribution amount: `Enter contribution amount`
- Contribution date: `Select contribution date`
- Contribution source: `Select contribution source`
- Source account: `Select source account`
- Savings goal: `Select savings goal`
- Record transaction from contribution: `Record a transaction`
- Notes: `Add contribution notes`

### 8.9 Savings Validation

- Prevent submission when required goal or contribution fields are empty
- Require a goal name and savings category
- Require a positive target amount
- Require a non-negative starting amount
- Require a target date when the goal is date-based
- Require a positive contribution amount
- Require a contribution date
- Require a savings goal for every contribution
- Require a source account when recording a related transaction
- Prevent a completed or archived goal from receiving new contributions unless explicitly reopened
- Display validation feedback beside the affected field
- Preserve valid entries after validation failure
- Clear field errors when corrected

### 8.10 Savings Calculations

- Current goal amount is the starting amount plus contributions less deleted contributions
- Remaining goal amount is the target amount less the current goal amount
- Progress percentage is current goal amount compared with target amount
- Required contribution is the remaining goal amount distributed across the remaining contribution periods
- Current-cycle shortfall is the required contribution less contributions made during the cycle
- Progress cannot be negative and cannot exceed 100% in the primary progress display
- Remaining goal amount cannot be negative; excess contributions are shown separately when supported
- A goal is achieved when current goal amount meets or exceeds the target amount
- Deleted contributions do not affect active totals, progress, or projections
- Archived goals remain in historical totals but are excluded from active allocation

### 8.11 Savings Allocation

- Select a global savings allocation strategy
- Allocate the Budgeting Module's Savings Envelope across goals
- Prioritize each goal's required contribution
- Use the global strategy to resolve surplus allocation
- View allocation results for the current budget cycle
- View the reason for each allocation
- Review and approve supported allocation changes

### 8.12 Savings Allocation Rules

- Budgeting provides one Savings Envelope for the current cycle
- Savings allocates the envelope across active goals
- Required contributions are allocated before surplus
- The global savings strategy breaks ties when surplus remains
- Debt payoff surplus is handled by Budgeting before it becomes part of the Savings Envelope

The Budgeting Module provides one Savings Envelope. The Savings Goals Module distributes that envelope across savings goals. Debt payoff surplus is handled by Budgeting before it reaches this allocation step.

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

- Goal target and current progress
- Target date
- Contribution history
- Current-cycle Savings Envelope
- Available income and expense forecast data
- Budget and debt information when available

### 8.15 Savings Reminders and Alerts

- Receive upcoming target-date reminders
- Receive missed-contribution reminders
- Receive behind-goal alerts
- Receive goal-achieved notifications
- Receive replenishment reminders after an approved goal reduction
- Acknowledge, dismiss, or snooze savings alerts
- Configure savings notification preferences

### 8.16 Savings States

- Initial state: savings module is ready for use
- Loading state: goals, contributions, allocations, or projections are loading
- Empty-list state: no savings goals exist
- Empty-contribution-history state: goal exists without contributions
- Empty-selector state: no eligible goal, account, or category is available
- Empty-envelope state: no savings money is available for allocation
- Goal-creation state: goal form is open for input
- Contribution-entry state: contribution form is open for input
- Transaction-linking state: a related transaction is being created or linked
- Validation-failure state: goal or contribution inputs are invalid
- Saving state: goal or contribution changes are being saved
- Active state: goal is included in current planning and allocation
- Behind state: goal is below its required contribution schedule
- On-track state: goal is meeting its required contribution schedule
- Achieved state: goal target has been met
- Archived state: goal is retained for history but excluded from active planning
- Deleted state: goal or contribution is marked deleted and excluded from active views
- Projection-fallback state: personalized projection data is unavailable and fallback estimates are shown
- Offline state: cached savings data is available while network features are unavailable
- Error state: savings data could not be loaded or saved
- Delete-confirmation state: the user must confirm deletion
- Archive-confirmation state: the user must confirm archiving
- Success state: savings changes were saved

### 8.17 Savings Messages

#### Validation Messages

- Invalid savings inputs: `Some savings details are not valid. Check the highlighted fields and try again.`

#### Error Messages

- Savings error: `Your savings information could not be loaded or saved. Check your connection and try again.`

#### Notice Messages

- Initial state: `Savings management is ready. Add or review a goal to continue.`
- Empty savings list: `No savings goals are recorded yet. Add a goal to start planning your savings.`
- Empty contribution history: `This savings goal has no recorded contributions. Add a contribution to update its progress.`
- No eligible savings selector: `No eligible goal, account, or category is available. Add one and try again.`
- Empty Savings Envelope: `No savings money is available for this cycle. Review your budget before allocating savings.`
- Projection fallback: `A personalized projection is not available right now. Use the estimate shown and try again later.`
- Offline savings: `Your saved savings information is available, but online actions are unavailable. Reconnect to continue.`
- Behind savings goal: `This goal is behind its contribution schedule. Review the required contribution and adjust your plan.`
- On-track savings goal: `This goal is on track. Continue making the planned contributions.`
- Achieved savings goal: `This goal has reached its target. Review the completed goal or choose another goal to fund.`
- Archived savings goal: `This goal is archived and excluded from active planning. Restore it before making new contributions.`
- Deleted savings goal: `This goal is deleted and unavailable for new contributions. Choose an active goal instead.`
- Goal creation state: `The savings goal form is ready. Enter the goal details before saving.`
- Contribution entry state: `The contribution form is ready. Enter the contribution details before saving.`
- Active savings goal: `This goal is active and included in current planning. Review its progress and next contribution.`

#### Progress and Success Messages

- Savings loading: `Your savings information is loading. Wait a moment for the latest details to appear.`
- Savings transaction linking: `Your related transaction is being created. Wait for the link to finish before leaving this screen.`
- Savings saving: `Your savings changes are being saved. Please wait before trying again.`
- Savings saved: `Your savings changes were saved. Review your goals before continuing.`

#### Confirmation Messages

- Savings deletion confirmation: `Deleting this goal or contribution removes it from active savings records. Cancel to keep it or confirm deletion to continue.`
- Savings archive confirmation: `Archiving this goal removes it from active planning but preserves its history. Cancel to keep it active or confirm archiving to continue.`

#### Recovery Messages

- Savings recovery: `Your savings changes could not be completed. Review the details and try again when your connection is available.`

## 9. Settings Module

### 9.1 Account and Profile

- View and edit the user profile
- View registered account information
- Change the password
- Manage connected authentication providers
- View email verification status
- View and manage the financial profile
- Resume incomplete onboarding

### 9.2 Settings Forms

- Display name
- Password change credentials
- Personalization preference
- Model-training consent
- Research-evaluation consent
- Notification preferences
- Data-retention preference, when available

### 9.3 Settings Form Placeholders

- Display name: `Enter display name`
- Current password: `Enter current password`
- New password: `Enter new password`
- Confirm new password: `Re-enter new password`
- Personalization preference: `Select personalization preference`
- Model-training consent: `Select model-training preference`
- Research-evaluation consent: `Select research-evaluation preference`
- Data-retention preference: `Select data-retention preference `
- Problem report: `Describe the problem`

### 9.4 Settings Selectors

- Personalization: On / Off
- Model-training consent: Granted / Not granted
- Research-evaluation consent: Granted / Not granted
- Data-retention preference, when available
- Savings notification preference
- Budget notification preference
- Debt notification preference
- Forecast notification preference
- Overspending notification preference
- In-app notification preference
- Push notification preference
- Connected authentication provider selector
- Export format selector, when multiple formats are supported

### 9.5 Settings Validation

- Require a valid display name when it is changed
- Require the current password for password changes
- Require a valid new password
- Require matching new-password fields
- Require an explicit choice for consent changes
- Prevent account deletion without explicit confirmation
- Preserve valid entries after validation failure
- Display validation feedback beside the affected field
- Clear field errors when corrected

### 9.6 Privacy and Consent

- View privacy settings
- Manage personalization consent
- Manage model-training consent
- Manage research-evaluation consent
- View thesis disclosure
- View data-use explanations
- View consent history and status
- View research eligibility separately from app access

### 9.7 Notification Preferences

- Manage savings notification preferences
- Manage budget notification preferences
- Manage debt notification preferences
- Manage forecast notification preferences
- Manage overspending notification preferences
- Manage in-app and push notification preferences

### 9.8 Data and Account Governance

- Export financial data
- View export status
- Manage data-retention preferences when available
- Request account deletion
- Review deletion consequences
- Cancel a pending deletion when supported
- Protect unsynced changes before account actions

### 9.9 Sync and Connectivity

- View synchronization status
- View pending and failed sync activity
- Retry failed synchronization
- Manually start synchronization
- Recover from exhausted sync failures
- Discard failed local changes with confirmation
- View offline and network-required states

### 9.10 Help and About

- View frequently asked questions
- View offline help content
- View sync guidance
- Report a problem
- View app version
- View thesis project information
- View the decision-support disclaimer
- View privacy information and applicable terms

### 9.11 Settings States

- Initial state: settings are ready for use
- Loading state: profile, preferences, consent, or sync data is loading
- Hydration state: authenticated account state is being resolved before protected settings render
- Empty-provider state: no connected authentication provider is available
- Unverified-email state: the account email requires verification
- Incomplete-profile state: required profile or financial-profile information is missing
- Unsaved-changes state: editable settings differ from saved values
- Saving state: a settings change is being saved
- Password-change state: password credentials are being updated
- Consent-review state: consent history and current decisions are displayed
- Export-preparing state: financial data export is being prepared
- Export-ready state: the export is available
- Export-failed state: the export could not be prepared
- Deletion-confirmation state: the user must review and confirm account deletion
- Deletion-pending state: account deletion has been requested and may be canceled
- Offline state: cached settings are available while network-required actions are unavailable
- Syncing state: local changes are being synchronized
- Sync-failed state: synchronization failed and can be retried
- Validation-failure state: settings input is invalid
- Error state: settings data could not be loaded or saved
- Success state: the requested settings action completed

### 9.12 Settings Messages

#### Validation Messages

- Invalid settings input: `Some settings need attention. Correct the marked fields and try again.`
- Settings validation failure: `Some settings could not be accepted. Correct the marked fields and try again.`

#### Error Messages

- No authentication provider: `No sign-in option is connected. Connect an authentication provider and try again.`
- Unverified email: `Your email is not verified yet. Verify your email before using protected settings.`
- Incomplete profile: `Your profile is missing required information. Complete the missing details and try again.`
- Export failed: `Your data export could not be prepared. Try the export again.`
- Sync failed: `Your changes could not be sent. Check your connection and try again.`
- Settings error: `Your settings could not be loaded or saved. Try again.`
- Empty provider: `No connected sign-in provider is available. Connect one before managing provider settings.`
- Loading failure: `Your settings are still loading. Wait a moment and try again.`
- Export failure: `Your data export failed to prepare. Try the export again.`

#### Notice Messages

- Initial state: `Your settings are ready. Review or update your preferences when you are ready.`
- Offline settings: `Some settings are available without internet access. Reconnect before using network-required actions.`
- Hydration: `Your account security is still being checked. Wait until settings finish loading.`
- Incomplete profile: `Your profile is incomplete. Add the missing information before continuing.`
- Unsaved changes: `You have unsaved settings changes. Save them or leave without saving.`
- Consent review: `Your consent choices are ready to review. Confirm each choice before saving.`
- Export preparing: `Your financial data export is being prepared. Wait for it to become available.`
- Export ready: `Your financial data export is ready. Download it before leaving this screen.`
- Deletion pending: `Your account deletion request is pending. Cancel the request before it is processed if you want to keep your account.`

#### Progress and Success Messages

- Settings loading: `Your settings are loading. Wait a moment for them to appear.`
- Password change: `Your password is being updated. Wait for confirmation before signing in again.`
- Settings syncing: `Your local settings changes are syncing. Keep the app open until syncing finishes.`
- Settings saving: `Your settings are being saved. Wait a moment for the update to finish.`
- Settings saved: `Your settings were saved. Continue using the app.`

#### Confirmation Messages

- Account deletion confirmation: `Deleting your account removes your account and associated financial data. Cancel to keep your account or confirm deletion to continue.`

#### Recovery Messages

- Sync recovery: `Some settings changes could not be synchronized. Retry them or review the failed changes before discarding anything.`

## 10. Categories and Restrictions Module

### 10.1 Category Taxonomy

- View category groups
- View categories and subcategories
- Navigate through the category hierarchy
- Search categories
- Create custom categories
- Create custom subcategories
- Edit custom categories and subcategories
- Delete custom categories and subcategories with confirmation
- Preserve existing records when a category is deleted

### 10.2 Category Forms

- Category group
- Category label
- Category description
- Filipino-context indicator
- Subcategory kind: Income / Expense / Transfer
- Protected indicator
- Spending restriction: Open / Protected / Fixed

Current category groups are Essentials, Obligatory, Discretionary, and Financial Allocation.

### 10.3 Category Form Placeholders

- Category group: `Select category group`
- Parent category: `Select parent category`
- Category label: `Enter category name`
- Category description: `Add category description`
- Filipino-context indicator: `Mark Filipino-context category`
- Subcategory kind: `Select subcategory kind`
- Protected indicator: `Mark as protected`
- Spending restriction: `Select spending restriction`

### 10.4 Category Selectors

- Category group selector
- Parent category selector for subcategories
- Category and subcategory selector for transactions and obligations
- Subcategory kind selector: Income / Expense / Transfer
- Spending restriction selector: Open / Protected / Fixed
- Filipino-context filter
- Protected-category filter
- System versus custom category filter
- Search and category-group filters may be combined
- Show an empty selector state when no eligible category exists

### 10.5 Category Validation

- Require a category group
- Require a non-empty category label
- Require a parent category when creating a subcategory
- Require a subcategory kind for subcategories
- Prevent duplicate category or subcategory labels within the same parent
- Prevent unsupported restriction changes on system categories
- Prevent deletion of protected or system categories when restricted
- Display validation feedback beside the affected field
- Preserve valid entries after validation failure
- Clear field errors when corrected

### 10.6 Category Context and Restrictions

- Identify Filipino-context categories
- Identify protected categories and subcategories
- Mark spending as open, protected, or fixed
- Apply restrictions to budgeting
- Apply restrictions to recommendations
- Prevent protected spending from being reduced by recommendations
- Prevent deletion of system or protected taxonomy items when restricted

### 10.7 Restriction Rules

- Open spending may be adjusted by budget recommendations
- Protected spending must be preserved by recommendations
- Fixed spending represents a non-reducible allocation
- Restrictions apply to both categories and subcategories

### 10.8 Category States

- Initial state: category management is ready for use
- Loading state: taxonomy or category details are loading
- Empty-list state: no categories or subcategories are available
- Empty-search state: no categories match the search or filters
- Empty-selector state: no eligible parent or transaction category is available
- Category-creation state: category form is open for input
- Subcategory-creation state: subcategory form is open for input
- Validation-failure state: category inputs are invalid
- Saving state: category changes are being saved
- Custom state: category may be edited or deleted by the user
- System state: category is managed by Odin and cannot be freely changed
- Open state: spending may be adjusted by recommendations
- Protected state: spending must be preserved by recommendations
- Fixed state: spending is non-reducible
- Delete-confirmation state: the user must confirm deletion
- Restricted-deletion state: deletion is blocked by system or protection rules
- Records-preserved state: existing records remain readable after category deletion
- Error state: category data could not be loaded or saved
- Success state: category changes were saved

### 10.9 Category Messages

#### Validation Messages

- Invalid category input: `Some category details are not valid. Correct the marked fields and try again.`
- Category validation failure: `Your category could not be saved because some details are invalid. Correct the marked fields and try again.`

#### Error Messages

- No eligible category: `No eligible category is available. Create or choose a different category.`
- System category restriction: `This system category cannot be changed freely. Choose a custom category instead.`
- Restricted deletion: `This category cannot be deleted because it is protected or managed by Odin. Choose a different category.`
- Category error: `Your category data could not be loaded or saved. Try again.`
- Category loading failure: `Your category list could not be loaded. Refresh and try again.`

#### Notice Messages

- Initial state: `Category management is ready. Create or review a category to continue.`
- Empty category list: `No categories or subcategories are available. Create a custom category to get started.`
- Empty category search: `No categories match your search or filters. Change the search or filters and try again.`
- Empty category selector: `No eligible parent or transaction category is available. Create or choose a different category.`
- Category creation: `The category form is ready for a new category. Enter the details and save when you are ready.`
- Subcategory creation: `The subcategory form is ready for a new subcategory. Enter the details and save when you are ready.`
- Custom category: `This custom category can be edited or deleted. Choose an action to manage it.`
- Protected spending: `This spending is protected from reductions. Review another spending category if you need to adjust the plan.`
- Fixed spending: `This spending cannot be reduced. Adjust another open spending category instead.`
- Open spending: `This spending can be adjusted by recommendations. Review or change it when you are ready.`
- System category: `This category is managed by Odin. Choose a custom category when you need to make changes.`
- Records preserved: `Existing records remain readable after this category is deleted. Review the records under their preserved history.`

#### Progress and Success Messages

- Category loading: `Your categories are loading. Wait a moment for the list to appear.`
- Category saving: `Your category changes are being saved. Wait a moment for the update to finish.`
- Category changes saved: `Your category changes were saved. Continue managing your categories.`

#### Confirmation Messages

- Category deletion confirmation: `Deleting this category removes it from future selection but preserves existing records. Cancel to keep it or confirm deletion to continue.`

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
- Allow at most one explicit savings, non-credit-card debt, obligation, or Credit Card statement-payment relationship per transaction
- Require the selected savings goal, debt, obligation, or Credit Card statement when its option is enabled
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
- User selects a savings goal
- User saves the transaction
- Odin creates the transaction and contribution together
- The selected savings goal displays the new contribution and updated progress
- Ordinary transactions remain unrelated to savings goals

### 12.8 Contribution Transaction Flow

- User records a contribution for a savings goal
- User selects the option to record a related transaction
- Odin opens the transaction form with the contribution context
- User completes or confirms the transaction details
- Odin links the transaction to the contribution
- The savings goal displays the contribution and related transaction

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

## 13. Alerts and Notifications Module

### 13.1 Alert Inbox

- View alerts
- View unread alerts
- View alert category and severity
- View alert explanations
- View cached alerts offline
- Display an empty state when no alerts exist

### 13.2 Alert Actions

- Open the related budget, debt, savings goal, or transaction
- Mark an alert as read
- Acknowledge an alert
- Dismiss an alert
- Snooze an alert
- Clear alerts with confirmation

### 13.3 Alert Sources

- Budget health alerts
- Overspending alerts
- Forecast alerts
- Savings goal alerts
- Debt payment alerts
- Synchronization alerts

### 13.4 Alert States

- Initial state: alert inbox is ready for use
- Loading state: alerts are loading
- Empty state: no alerts exist
- Unread state: one or more alerts require attention
- Read state: alert has been reviewed
- Acknowledged state: alert has been confirmed by the user
- Dismissed state: alert is hidden from the active inbox
- Snoozed state: alert is postponed until its reminder time
- Action-pending state: an alert action is being processed
- Related-record state: the related budget, debt, savings goal, or transaction is opening
- Offline state: cached alerts are available while network data is unavailable
- Error state: alerts could not be loaded or updated
- Success state: the alert action completed

### 13.5 Alert Messages

#### Error Messages

- Alert load or update error: `Your alerts could not be loaded or updated. Refresh and try again.`

#### Notice Messages

- Initial state: `Your alert inbox is ready. Review an alert to see what needs your attention.`
- Empty state: `No alerts are available. Return later for new updates.`
- Unread state: `You have unread alerts. Open them to review what needs your attention.`
- Read state: `This alert has been reviewed. Open it again if you need its details.`
- Acknowledged state: `This alert was acknowledged. Reopen it if you need to review its details.`
- Dismissed state: `This alert was dismissed from the active inbox. Review your alert history if you need it again.`
- Snoozed state: `This alert was snoozed until its reminder time. Return when it is ready for review.`
- Offline state: `You are offline. Review your saved alerts or reconnect to get the latest alerts.`

#### Progress and Success Messages

- Loading state: `Loading your alerts. Please wait a moment.`
- Action pending: `Updating your alert. Please wait a moment.`
- Related-record state: `Opening the related item. Please wait a moment.`
- Success state: `Your alert was updated. Continue reviewing your alerts.`

#### Confirmation Messages

- Clear alerts confirmation: `Clearing these alerts removes them from the active inbox. Cancel to keep them or confirm clearing to continue.`

## 14. Forecasting and Financial Intelligence Module

### 14.1 Forecasting

- View income forecasts
- View expense forecasts
- View balance forecasts
- View category forecasts
- View expected recurring events
- View forecast periods
- View forecast explanations
- Refresh forecasts online
- View cached forecasts offline

### 14.2 Forecast Trust Information

- Identify personalized forecasts
- Identify fallback forecasts
- Identify cold-start forecasts
- View forecast confidence and freshness
- View the last forecast update

### 14.3 Anomaly and Overspending Detection

- Detect unusual spending
- Detect overspending risks
- Explain detected spending patterns
- Mark intentional spending as expected
- Manage spending suppression rules

### 14.4 Forecasting States

- Initial state: forecasting is ready for use
- Loading state: forecasts or intelligence results are being generated
- Personalized state: forecasts use sufficient user-specific history
- Fallback state: forecasts use a general fallback method
- Cold-start state: forecasts have limited historical data
- Fresh state: forecast data is current within the freshness window
- Stale state: forecast data is available but requires refresh
- Refreshing state: an online forecast refresh is in progress
- Cached state: the latest available forecast is shown offline
- Empty-data state: insufficient data exists for a meaningful forecast
- Anomaly-detected state: unusual spending has been identified
- Overspending-risk state: spending is projected to exceed a relevant limit
- Expected-spending state: the user marked detected spending as intentional
- Suppressed state: a configured suppression rule hides matching detections
- Error state: forecasts or intelligence results could not be generated
- Success state: forecasts or intelligence results were updated

### 14.5 Forecasting and Intelligence Messages

#### Error Messages

- Forecast generation error: `Your forecasts could not be created. Refresh and try again.`

#### Notice Messages

- Initial state: `Forecasting is ready. Review the available financial outlook or refresh it when you are online.`
- Personalized state: `This forecast uses your financial history. Review the explanation to understand the result.`
- Fallback state: `A general forecast is being shown. Add more financial history for a more personal forecast.`
- Cold-start state: `There is limited financial history for this forecast. Add more activity to improve it.`
- Fresh state: `Your forecast is current within the freshness window. Review the latest results.`
- Stale state: `This forecast may be out of date. Refresh it when you are online.`
- Empty-data state: `There is not enough financial information for a meaningful forecast. Add more activity and try again.`
- Cached state: `You are offline. Review your saved forecast or reconnect to refresh it.`
- Anomaly-detected state: `Unusual spending was detected. Review the pattern and mark it expected if it was intentional.`
- Overspending-risk state: `Spending is projected to exceed a relevant limit. Review the affected category and adjust your plan if needed.`
- Expected-spending state: `This spending was marked as expected. Review the suppression or detection details if you want to change it.`
- Suppressed state: `A suppression rule is hiding matching detections. Review the rule if you want those detections shown again.`

#### Progress and Success Messages

- Loading state: `Loading your financial intelligence. Please wait a moment.`
- Refreshing state: `Refreshing your forecast. Please wait a moment.`
- Success state: `Your forecasts were updated. Review the latest results.`

## 15. Reports and Analytics Module

### 15.1 Report Creation

- Generate weekly reports
- Generate monthly reports
- Generate custom date-range reports
- View cached reports offline
- View report freshness information

### 15.2 Report Content

- View income summaries
- View expense summaries
- View cash-flow summaries
- View account summaries
- View budget-versus-actual results
- View forecast-versus-actual results
- View savings progress
- View debt summaries
- View category breakdowns
- View current-cycle allocation summaries

### 15.3 Report Presentation

- View report details
- Compare reporting periods
- View category-level breakdowns
- Support mobile layouts
- Support desktop or web review layouts
- Display report empty states

### 15.4 Report Filters

- Report period
- Start date
- End date
- Account filter
- Category filter
- Transaction-type filter

### 15.5 Report Calculations

- Income totals aggregate income transactions in the selected period
- Expense totals aggregate expense transactions in the selected period
- Net cash flow is income less expenses
- Budget variance compares actual amounts with planned allocations
- Savings progress compares current goal amounts with target amounts
- Debt summaries compare opening, paid, and remaining balances

### 15.6 Report States

- Initial state: reports are ready for use
- Loading state: report data is being loaded or calculated
- Generating state: a report is being generated
- Empty-data state: no records match the selected reporting period or filters
- Invalid-range state: the selected date range is invalid
- Filtered state: report results reflect active filters
- Comparison state: two reporting periods are being compared
- Fresh state: report data is current
- Stale state: cached report data requires refresh
- Cached state: the latest available report is shown offline
- Offline state: network-required report generation is unavailable
- Error state: the report could not be generated or loaded
- Success state: the report is available for review

### 15.7 Report Messages

#### Validation Messages

- Invalid-range state: `The report date range is not valid. Choose an end date after the start date.`

#### Error Messages

- Report error: `Your report could not be generated or loaded. Check your filters and try again.`

#### Notice Messages

- Initial state: `Reports are ready to use. Choose a period or filters to review your financial activity.`
- Empty-data state: `No records match this report period or these filters. Change the dates or filters and try again.`
- Filtered state: `Your report reflects the selected filters. Adjust them if you want a different view.`
- Comparison state: `Two reporting periods are being compared. Review the differences or choose another period.`
- Fresh state: `Your report data is current. Review the results or change the reporting period.`
- Stale state: `This report may be out of date. Refresh it when you are online.`
- Cached state: `You are offline. Review your saved report or reconnect to get the latest data.`
- Offline state: `You are offline. Reconnect before generating a new report.`

#### Progress and Success Messages

- Loading state: `Loading your report. Please wait a moment.`
- Generating state: `Generating your report. Please wait a moment.`
- Success state: `Your report is ready. Review the results below.`

## 16. Offline Sync and Recovery Module

### 16.1 Sync Visibility

- View synchronization status
- View pending changes
- View failed changes
- View discarded changes
- View the last successful synchronization
- View offline, syncing, and synchronized states

### 16.2 Sync Recovery

- Retry individual failed changes
- Retry failed changes in bulk
- Manually start synchronization
- View friendly recovery guidance
- View paginated failed-change history
- Discard failed changes with explicit confirmation
- Preserve local data during synchronization failures

### 16.3 Account Safety

- Prevent logout while unsynced changes remain
- Attempt synchronization before account deletion
- Keep local changes recoverable after failed synchronization
- Display network-required messaging for online-only actions

### 16.4 Sync States

- Initial state: synchronization is ready for use
- Offline state: the device has no network connection
- Pending state: local changes are waiting to synchronize
- Syncing state: local changes are being uploaded or remote changes downloaded
- Synchronized state: local and remote data are current
- Partially-synchronized state: some changes succeeded while others remain pending
- Failed state: one or more changes could not synchronize
- Retry-pending state: failed changes are queued for another attempt
- Retrying state: failed changes are being retried
- Discard-confirmation state: the user must confirm discarding failed local changes
- Discarded state: failed local changes were explicitly discarded
- Recovery state: the user is reviewing guidance for failed changes
- Logout-blocked state: logout is blocked while unsynced changes remain
- Deletion-sync state: synchronization is required before account deletion
- Network-required state: the requested action requires connectivity
- Error state: synchronization status or recovery data could not be loaded
- Success state: synchronization or recovery action completed

### 16.5 Offline Sync and Recovery Messages

#### Error Messages

- Failed state: `Some changes could not be synchronized. Review them and retry or discard them.`
- Logout-blocked state: `You have unsynced changes. Synchronize them before logging out.`
- Deletion-sync state: `Your changes must be synchronized before account deletion. Reconnect and try again.`
- Network-required state: `This action needs an internet connection. Reconnect and try again.`
- Error state: `Synchronization information could not be loaded. Refresh and try again.`

#### Notice Messages

- Initial state: `Synchronization is ready. Review your sync status or start a synchronization when you are online.`
- Offline state: `You are offline. Your local changes will sync when you reconnect.`
- Pending state: `Some changes are waiting to sync. Reconnect to send them.`
- Synchronized state: `Your data is synchronized. Continue using Odin with the latest saved changes.`
- Partially-synchronized state: `Some changes were synchronized and others are still waiting. Review the remaining changes.`
- Retry-pending state: `A failed change is waiting for another attempt. Reconnect or retry it when ready.`
- Discard-confirmation state: `Discarding this change removes it from the sync queue. Confirm only if you no longer need it.`
- Discarded state: `The change was discarded. Review your remaining changes and record it again if you still need it.`
- Recovery state: `Recovery guidance is available. Review the change details before choosing retry or discard.`

#### Progress and Success Messages

- Syncing state: `Synchronizing your changes. Please wait a moment.`
- Retrying state: `Retrying the failed changes. Please wait a moment.`
- Success state: `Your synchronization or recovery action is complete. Review the updated status.`
