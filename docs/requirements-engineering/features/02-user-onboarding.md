## 2. User Onboarding

### 2.1 Application Orientation

- Introduce newly registered users to Budgie's financial-management capabilities
- Explain the purpose of accounts, categories, cash flow, savings goals, debts,
  Financial Plans, reports, and settings
- Explain that Budgie is a financial decision-support application and users
  retain control of financial decisions
- Direct users to the relevant setup flow without requiring them to complete
  every setup action before using the application

### 2.2 Initial Setup Navigation

- Direct users to configure financial preferences
- Direct users to add income sources and financial accounts
- Direct users to review or configure expense categories
- Direct users to add current savings goals and debts when applicable
- Allow users to skip a setup action and return to it later
- Show setup progress and the next available setup action

### 2.3 Scope Boundary

- User Onboarding does not collect, save, review, submit, or assess financial
  questionnaire responses
- The Savings and Debt Profile Classification module owns the financial
  questionnaire, questionnaire drafts, and financial-condition assessment

### 2.4 Onboarding States

- Initial state: orientation is ready to begin
- Setup-navigation state: setup actions and their destinations are available
- Partial-setup state: one or more setup actions remain incomplete
- Complete state: the user has completed or skipped available setup actions
- Error state: onboarding guidance could not be loaded

### 2.5 Onboarding Messages

- Initial state: `Welcome to Budgie. Review the available setup steps to start organizing your finances.`
- Partial-setup state: `Your setup is not complete yet. Continue with the next step or return to it later from the app.`
- Complete state: `Your initial setup is complete. You can update these details whenever your finances change.`
- Error state: `Onboarding guidance could not be loaded. You can still set up your finances from the app.`
