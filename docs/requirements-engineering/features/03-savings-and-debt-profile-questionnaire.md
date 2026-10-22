## 3. Savings and Debt Profile Questionnaire

### 3.1 Purpose and Application Flow

- Collect the user's financial situation and seasonal preferences to support
  savings and debt classification and Financial Planning.
- Follow the first-use sequence: [Account Registration](01-account-registration.md)
  → Savings and Debt Profile Questionnaire → interactive
  [User Onboarding](04-user-onboarding.md).
- Require email verification, authenticated access, and applicable terms consent
  before users answer the questionnaire.
- Allow returning users to resume an unfinished questionnaire without asking
  users to repeat a submitted questionnaire on every login.
- Keep questionnaire completion separate from tutorial completion.

### 3.2 Financial Profile Questions

Present the following questions in order:

| Order | Topic | Functional requirement |
| --- | --- | --- |
| 1 | Preferred name | Allow users to provide the name they want the application to use. |
| 2 | Monthly income | Ask for monthly income after taxes and other non-debt deductions, before loan and credit-card repayments. |
| 3 | Savings runway | Ask how long available savings could cover essential needs if income stopped. Offer one month, two months, three months, more than three months, and an option for users who are unsure. |
| 4 | Essential living costs | Ask for estimated monthly essential expenses, including food, housing, utilities, transport, medicine, and necessary care. Allow users to indicate uncertainty. |
| 5 | Current debt | Ask whether the user is currently paying off debt. |
| 6 | Debt payment percentage | For users paying debt, ask what percentage of monthly income goes to required repayments, including payroll-deducted loans and credit-card minimums. Allow users to indicate uncertainty. |
| 7 | Credit-card payments | Ask whether the user does not use a credit card, always pays on or before the due date, or has carried an unpaid balance after the due date for one to eleven months or over a year. |
| 8 | Higher-expense seasons | Ask when expenses are usually higher and allow multiple selections. |
| 9 | Lower-expense seasons | Ask when expenses are usually lower and allow multiple selections. |
| 10 | Savings seasons | Ask when the user is more likely to save and allow multiple selections. |
| 11 | Review | Allow users to review and edit their answers before submitting the questionnaire. |

### 3.3 Seasonal Choices and Custom Events

- Offer New Year, Summer, Back-to-School, Rainy Season, Undas, and Christmas and
  Ber Months, with their associated months clearly displayed.
- Allow users to indicate that they have no particular season for higher
  expenses, lower expenses, or savings.
- Allow users to add named personal events and select their associated months.
- Make custom events available across all three seasonal questions and display
  selected events during review.
- Prevent duplicate or invalid event names and require at least one month for
  each custom event.
- Prevent combining no particular season with other choices in the same answer.
- Prevent the same season or event from being selected for both higher and
  lower expenses.
- When higher-expense answers change, remove conflicting lower-expense choices
  and ask the user to answer again if no lower-expense choices remain.
- Keep savings preferences independent from expense preferences.
- Use seasonal preferences to explain Financial Plans without changing forecast
  amounts or allocations solely because a season was selected.

### 3.4 Navigation and Progress

- Present one question at a time and show progress through applicable questions.
- Allow users to move forward and backward while retaining their answers.
- Show the debt-payment question only when the user reports current debt.
- Allow users to return to a question from the review screen and correct it.
- Save questionnaire progress and allow users to resume with their saved answers.
- Keep answers private to the signed-in user.
- Explain when progress could not be saved and allow users to retry.

### 3.5 Validation and Connectivity

- Require an answer to each applicable question before submission.
- Accept valid non-negative monetary amounts and debt-payment percentages from
  zero to one hundred.
- Distinguish an uncertain answer from having no income, no debt, or no savings.
- Explain invalid or missing answers beside the affected question and retain
  other valid answers when corrections are needed.
- Require an internet connection to load, save, and submit the questionnaire.
- Explain connectivity failures and allow users to retry without re-entering
  answers still available in the current questionnaire.
- Prevent repeated submission while answers are being saved or assessed.

### 3.6 Submission and Assessment

- Allow users to submit their reviewed answers for an initial financial assessment.
- Keep questionnaire submission separate from optional research and
  model-training consent.
- Assess the user's financial situation using their reported income, essential
  costs, savings runway, required debt payments, and credit-card behavior.
- Distinguish questionnaire estimates from actual recorded balances and payments.
- Present Emergency Fund Coverage, Debt-Service-to-Income, Financial Margin,
  and Credit Card Behavior results with understandable explanations.
- Explain emergency fund coverage as the ability of available emergency savings
  to cover essential expenses, debt burden as required repayments relative to
  income, and financial margin as income remaining after essential costs and
  required debt payments.
- Explain credit-card behavior using the user's reported payment pattern.
- Show when the assessment was made and the information it was based on.
- Keep assessment results private to the signed-in user.
- Apply defined and validated assessment rules consistently; do not assign a
  Saver, Borrower, Both, or Neither categorical label.
- Explain when information is insufficient to produce a result.
- If answers are saved but assessment is temporarily unavailable, allow users to
  continue and retry assessment later from the Dashboard.
- After first-time submission and review of the results, direct users to the
  interactive onboarding tour.

### 3.7 Questionnaire States

- Loading: questionnaire or saved progress is being loaded.
- Answering: the user is completing an applicable question.
- Validation: an answer needs correction before continuing.
- Saving: questionnaire progress is being saved.
- Resuming: saved answers are restored for continuation.
- Review: answers are ready for checking and editing.
- Submitting: reviewed answers are being submitted for assessment.
- Results available: assessment results and explanations are displayed.
- Assessment unavailable: answers are saved but results cannot currently be shown.
- Connection required: the user must reconnect to continue online actions.
- Error: loading, saving, or submission failed and retry is available.
- Complete: the user can continue to the interactive onboarding tour.
