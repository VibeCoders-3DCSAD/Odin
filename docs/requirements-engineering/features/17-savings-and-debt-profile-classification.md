## 17. Savings and Debt Profile Classification

### 17.1 Savings and Debt Profile Classification

- Guide users through a financial questionnaire and collect questionnaire
  answers and cash-flow transaction history.
- Save and resume incomplete questionnaire answers.
- Allow users to review questionnaire answers before submission.
- Apply rule-based mathematical rules and statistics to calculate the user's financial-condition dimensions.
- Do not assign a Saver, Borrower, Both, or Neither categorical label.
- Display the calculated dimensions and a plain-language explanation.
- Allow the user to request reassessment when their financial data changes.

### 17.2 Financial Questionnaire Inputs

- Multiple-answer and single-answer selections
- Text, numeric, and date or age inputs
- Employment and location inputs
- Multiple-answer placeholder: `Select all that apply`
- Single-answer placeholder: `Select an answer`
- Text-input placeholder: `Enter your answer`
- Numeric-input placeholder: `Enter a value`
- Date-input placeholder: `Select a date`
- Employment-input placeholder: `Select employment status`
- Location-input placeholder: `Select your location`

### 17.3 Financial Questionnaire Validation

- Prevent submission while a required answer is empty.
- Require at least one selection for multiple-answer questions and one selection
  for single-answer questions.
- Validate text length, non-negative numeric values where applicable, dates
  against their allowed range, and employment and location values against
  available choices.
- Do not treat a placeholder as a submitted answer.
- Display validation feedback beside the affected question, preserve valid
  answers after validation failure, and clear question-level errors when the
  answer is corrected.

### 17.4 Financial Questionnaire States and Messages

- Initial state: questionnaire is ready for input.
- Loading state: questionnaire questions or saved answers are loading.
- Saving state: questionnaire answers are being saved.
- Resume state: incomplete saved answers are being restored.
- Review state: completed answers are ready for review.
- Submission-error state: answers could not be submitted.
- Save-error state: answers could not be saved.
- Network-required state: questionnaire submission requires an internet
  connection.
- Required-answer message: `This answer is required. Provide an answer before continuing.`
- Required-multiple-selection message: `Select at least one answer. Choose an option before continuing.`
- Resume message: `Your saved questionnaire answers are ready. Continue where you left off.`
- Review message: `Your answers are ready for review. Check them before submitting.`
- Submission-failure message: `Your questionnaire submission failed. Please try again.`

### 17.5 Financial-Condition Dimensions

- Emergency Fund Coverage (EFC)
- Debt-Service-to-Income (DSTI)
- Financial Margin (FM)
- Credit Card Behavior (CCB)

The exact rules and thresholds for each dimension must be documented and validated before the classifier is used to generate recommendations.

### 17.6 Assessment Inputs

- Financial questionnaire answers
- Recorded income and cash-flow transaction history
- Active savings balances and Emergency Fund goals
- Active debt balances and required debt payments
- Active credit-card statements, minimum amounts due, and payment history
- Current financial obligations

### 17.7 Assessment Outputs

- EFC, DSTI, FM, and CCB results
- Input freshness and assessment date
- Assessment explanation
- Reassessment availability

### 17.8 Assessment States

- Questionnaire state: financial-condition questions are ready for input
- Questionnaire-saving state: incomplete answers are being saved
- Questionnaire-resume state: saved answers are restored for continued input
- Questionnaire-review state: answers are ready for review before submission
- Initial state: financial-condition assessment is ready to begin
- Assessing state: assessment inputs are being evaluated
- Insufficient-data state: available inputs cannot support an assessment
- Available state: financial-condition dimensions are available
- Stale state: recorded financial data has changed since the last assessment
- Error state: the financial condition could not be assessed
