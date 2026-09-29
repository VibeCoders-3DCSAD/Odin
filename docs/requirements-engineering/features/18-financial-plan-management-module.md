## 18. Financial Plan Management Module

### 18.1 Financial Plan

- Generate a user-reviewable monthly Financial Plan.
- Combine a Budget Plan, Savings Contribution Plan, and Debt Repayment Plan.
- Use available income, forecast expenses, financial obligations, savings goals, debt targets, and the Financial Condition Assessment as plan inputs.
- Keep recommendations separate from user-created plans until the user accepts them.
- Allow the user to review, accept, edit, or reject a recommendation.

### 18.2 Plan Inputs

- Monthly total spendable amount
- Available income
- Next-month total and category-level expense forecast
- Financial obligations due during the plan period
- Active savings goals and Emergency Fund requirements
- Active debt payment requirements and target payoff dates
- Financial Condition Assessment, including EFC, DSTI, FM, and CCB
- Current category restriction snapshots, including fixed amounts, protected floors, and category ceilings

### 18.3 Budget Plan

- Generate a monthly budget recommendation using Linear Programming.
- Use the next-month expense forecast as an input to the recommendation.
- Respect available income, the total spendable amount, financial obligations, savings goals, debt targets, and user preferences.
- Treat fixed category amounts, protected category floors, and category ceilings as hard Linear Programming constraints.
- Do not reduce a fixed or protected category below its required amount.
- Return an infeasible plan when the total spendable amount cannot cover all required category floors, financial obligations, and debt payment requirements.
- Explain the conflicting constraints without altering category restrictions or inventing a reduced allocation.
- Show the recommendation explanation and any unfunded or constrained allocations.

### 18.4 Savings Contribution Plan

- Recommend contributions toward active savings goals.
- Include Emergency Fund requirements and goal target dates.
- Use the Financial Condition Assessment as an input to contribution prioritization.
- Show recommended contribution schedules and any projected goal shortfalls.

### 18.5 Debt Repayment Plan

- Include required payments for active debts and credit-card statement targets.
- Use target payoff dates and the Financial Condition Assessment as plan inputs.
- Show the payment schedule, projected payoff timeline, and any payment shortfall.
- Keep credit-card repayment strategies and non-credit-card repayment strategies subject to the Debt Management Module rules.

### 18.6 Plan States

- Initial state: plan generation is ready for input
- Insufficient-data state: required plan inputs are unavailable
- Generating state: the Financial Plan is being prepared
- Recommendation-ready state: a plan is available for review
- Stale state: a source input changed after the recommendation was generated
- Accepted state: the user accepted the plan
- Edited state: the user modified the accepted recommendation
- Rejected state: the user rejected the recommendation
- Error state: the Financial Plan could not be generated
