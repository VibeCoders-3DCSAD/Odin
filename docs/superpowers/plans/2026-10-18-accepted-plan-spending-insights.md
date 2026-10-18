# Accepted Plan Spending Insights

**Goal:** Show current, factual spending insights for accepted plans without an external AI dependency.

**Architecture:** A pure feature-local helper compares existing allocation spending and the plan's period total with accepted category budgets. The screen renders those insights for saved plans and preserves recommendation explanations before acceptance. Read current spending immediately after acceptance and on existing sync refreshes.

**Constraints:** Use category allocations as the percentage denominator; never divide by zero or cap overspending at 100%. Include spending outside planned categories in the plan total, identify it separately, and reuse the repository's exclusion of separately reserved payments. Do not forecast future overspending from elapsed days or treat missing spending data as zero.

- [x] Add calculated summary, remaining/overspent amounts, category pressure, unplanned spending, and period-progress insights with edge-case tests.
- [x] Integrate the helper with saved-plan loading, acceptance, and sync refreshes; keep recommendation-time explanations separate.
- [x] Verify zero budgets, percentages above 100%, out-of-plan spending, period boundaries, immediate acceptance, and updated transactions.
- [x] Run affected frontend tests and document the behavior.

## Validation Results

- 35 targeted frontend tests passed across the screen, spending insight helper, and repository spending review.
- Verified live refresh, newly accepted plans, late AI responses, overspending, zero budgets, unplanned expenses, and missing-data handling.
- `git diff --check` passed.
- App-wide TypeScript checking still reports existing errors in budgeting forecast fixtures, dashboard snapshots, financial-plan presentation/local persistence, savings envelope queries, and prior migration/repository tests. None are in the files changed for this feature.
