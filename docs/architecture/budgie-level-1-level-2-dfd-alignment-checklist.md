# Budgie Level 1 and Level 2 DFD Alignment Checklist

## Purpose

Use this checklist to verify DFD balancing for each Level 2 decomposition. A
Level 2 figure must preserve every flow that crosses its parent Level 1 process
boundary to an external entity. The external entity, direction, and flow name
must match Level 1 exactly. Internal subprocess flows and data-store flows are
outside this comparison.

**Comparison sources:**

- `budgie-level-1-dfd-mapping.md`, Final Input and Output Mapping and Process to Data Store Connections
- `budgie-level-2-dfd-mapping.md`, External-Entity Balance Checklist and selected Level 2 relationships

## Reconciliation Results

| Parent Level 1 Process | External Entity | Direction | Level 1 Flow Name | Level 2 Flow Name | Status |
| --- | --- | --- | --- | --- | --- |
| `2.0 Savings and Debt Profile Classification` | USER | Input | `Savings and Debt Profile Questionnaire Response` | `Savings and Debt Profile Questionnaire Response` | ✅ Aligned |
| `2.0 Savings and Debt Profile Classification` | USER | Output | `Savings and Debt Profile Classification` | `Savings and Debt Profile Classification` | ✅ Aligned |
| `2.0 Savings and Debt Profile Classification` | ML Inference Service | Output | `Financial Classification Request` | `Financial Classification Request` | ✅ Aligned |
| `2.0 Savings and Debt Profile Classification` | ML Inference Service | Input | `Financial Classification Results` | `Financial Classification Results` | ✅ Aligned |
| `3.0 Financial Plan Management` | USER | Input | `Planning Amount` | `Planning Amount` | ✅ Aligned |
| `3.0 Financial Plan Management` | USER | Input | `Budget Allocation Preference` | `Budget Allocation Preference` | ✅ Aligned |
| `3.0 Financial Plan Management` | USER | Output | `Budget Recommendation` | `Budget Recommendation` | ✅ Aligned |
| `3.0 Financial Plan Management` | USER | Output | `Budget Plan` | `Budget Plan` | ✅ Aligned |
| `3.0 Financial Plan Management` | USER | Output | `Savings Contribution Plan` | `Savings Contribution Plan` | ✅ Aligned |
| `3.0 Financial Plan Management` | USER | Output | `Debt Repayment Plan` | `Debt Repayment Plan` | ✅ Aligned |
| `3.0 Financial Plan Management` | ML Inference Service | Output | `Budget Recommendation Request` | `Budget Recommendation Request` | ✅ Aligned |
| `3.0 Financial Plan Management` | ML Inference Service | Input | `Request Budget Recommendation` | `Request Budget Recommendation` | ✅ Aligned |
| `4.0 Cash Flow, Categories, and Accounts Management` | USER | Input | `Income Sources and Accounts` | `Income Sources and Accounts` | ✅ Aligned |
| `4.0 Cash Flow, Categories, and Accounts Management` | USER | Input | `Income Transactions` | `Income Transactions` | ✅ Aligned |
| `4.0 Cash Flow, Categories, and Accounts Management` | USER | Input | `Expense Transactions` | `Expense Transactions` | ✅ Aligned |
| `4.0 Cash Flow, Categories, and Accounts Management` | USER | Input | `Expense Category` | `Expense Category` | ✅ Aligned |
| `4.0 Cash Flow, Categories, and Accounts Management` | USER | Input | `Income and Expense List Filter and Sort Criteria` | `Income and Expense List Filter and Sort Criteria` | ✅ Aligned |
| `4.0 Cash Flow, Categories, and Accounts Management` | USER | Output | `Expense Transactions List` | `Expense Transactions List` | ✅ Aligned |
| `4.0 Cash Flow, Categories, and Accounts Management` | USER | Output | `Income Transactions List` | `Income Transactions List` | ✅ Aligned |
| `4.0 Cash Flow, Categories, and Accounts Management` | USER | Output | `Financial Accounts List` | `Financial Accounts List` | ✅ Aligned |
| `4.0 Cash Flow, Categories, and Accounts Management` | USER | Output | `Income and Expense Categories List` | `Income and Expense Categories List` | ✅ Aligned |
| `4.0 Cash Flow, Categories, and Accounts Management` | USER | Output | `Unusual Expense Alert` | `Unusual Expense Alert` | ✅ Aligned |
| `8.0 Financial Dashboard and Reports` | USER | Output | `Financial Dashboard` | `Financial Dashboard` | ✅ Aligned |
| `8.0 Financial Dashboard and Reports` | USER | Output | `Expense Forecast` | `Expense Forecast` | ✅ Aligned |
| `8.0 Financial Dashboard and Reports` | USER | Output | `Unusual Expenses List` | `Unusual Expenses List` | ✅ Aligned |
| `8.0 Financial Dashboard and Reports` | USER | Output | `Financial Report` | `Financial Report` | ✅ Aligned |
| `8.0 Financial Dashboard and Reports` | ML Inference Service | Output | `Expense Forecast Request` | `Expense Forecast Request` | ✅ Aligned |
| `8.0 Financial Dashboard and Reports` | ML Inference Service | Input | `Expense Forecast Results` | `Expense Forecast Results` | ✅ Aligned |

## Completion Checklist

- [x] Every selected Level 2 parent process was compared with its Level 1 external-entity flows.
- [x] Each Level 1 `USER` input has an equivalent Level 2 input with the same name and direction.
- [x] Each Level 1 `USER` output has an equivalent Level 2 output with the same name and direction.
- [x] Each Level 1 ML Inference Service input has an equivalent Level 2 input with the same name and direction.
- [x] Each Level 1 ML Inference Service output has an equivalent Level 2 output with the same name and direction.
- [x] Renamed the two `2.0` ML Inference Service boundary flows in Level 2 to `Financial Classification Request` and `Financial Classification Results`.
- [x] Re-ran this checklist after the two Level 2 labels were corrected.

## Result

Level 1 and Level 2 are aligned for every selected parent process. Each
external-entity flow has the same entity, direction, and name at both levels.
