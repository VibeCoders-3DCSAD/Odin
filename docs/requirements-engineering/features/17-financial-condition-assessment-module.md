## 17. Financial Condition Assessment Module

### 17.1 Financial Condition Assessment

- Collect and store questionnaire answers and cash-flow transaction history.
- Apply rule-based mathematical rules and statistics to calculate the user's financial-condition dimensions.
- Do not assign a Saver, Borrower, Both, or Neither categorical label.
- Display the calculated dimensions and a plain-language explanation.
- Allow the user to request reassessment when their financial data changes.

### 17.2 Financial-Condition Dimensions

- Emergency Fund Coverage (EFC)
- Debt-Service-to-Income (DSTI)
- Financial Margin (FM)
- Credit Card Behavior (CCB)

The exact rules and thresholds for each dimension must be documented and validated before the classifier is used to generate recommendations.

### 17.3 Assessment Inputs

- Onboarding questionnaire answers
- Recorded income and cash-flow transaction history
- Active savings balances and Emergency Fund goals
- Active debt balances and required debt payments
- Active credit-card statements, minimum amounts due, and payment history
- Current financial obligations

### 17.4 Assessment Outputs

- EFC, DSTI, FM, and CCB results
- Input freshness and assessment date
- Assessment explanation
- Reassessment availability

### 17.5 Assessment States

- Initial state: financial-condition assessment is ready to begin
- Assessing state: assessment inputs are being evaluated
- Insufficient-data state: available inputs cannot support an assessment
- Available state: financial-condition dimensions are available
- Stale state: recorded financial data has changed since the last assessment
- Error state: the financial condition could not be assessed
