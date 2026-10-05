# Budgie Level 1 DFD Mapping

## Processes

| ID | Process |
| --- | --- |
| 1.0 | Manage User Access and Settings |
| 2.0 | Manage Onboarding and Financial Profile Classification |
| 3.0 | Manage Income Sources and Accounts |
| 4.0 | Manage Expenses and Obligations |
| 5.0 | Manage Savings Goals |
| 6.0 | Manage Debt Records |
| 7.0 | Forecast Expenses |
| 8.0 | Generate Financial Plan |
| 9.0 | Generate Financial Information |

## External Entities

| Entity | DFD Role |
| --- | --- |
| USER | Source of the 19 Level 0 input flows and sink of the 17 Level 0 output flows |

## 1. Data Stores

The `USER` is an external entity. It is a source when it supplies data to
Budgie and a sink when it receives data from Budgie. The following data stores
hold Budgie's persistent information for the Level 1 DFD.

| ID | Data Store | Stored Information |
| --- | --- | --- |
| D1 | User Accounts and Settings | Registration details, credentials, recovery data, account status, and user settings |
| D2 | Onboarding Responses | Onboarding responses and initial financial information |
| D3 | Income Sources and Accounts | Income sources, cash accounts, bank accounts, and e-wallet accounts |
| D4 | Income Transactions | Recorded income transactions |
| D5 | Expense Categories | User-defined expense categories |
| D6 | Expense Transactions | Recorded expense transactions |
| D7 | Bills and Remittances | Bill details and remittance details |
| D8 | Savings Goals | Savings goal details and calculated goal progress |
| D9 | Savings Contributions and Preferences | Savings contribution records and contribution preferences |
| D10 | Debt Accounts | Debt account details and calculated debt balances |
| D11 | Debt Payments and Repayment Preferences | Debt payment records and debt repayment preferences |
| D12 | Financial Plans | Budget recommendations, budget plans, savings contribution plans, and debt repayment plans |

## 2. Process to Data Store Connections

Each data-store flow must connect to a process. External entities, including
the `USER`, must not connect directly to a data store. The required paths are:

- Input: `External Entity -> Process -> Data Store`
- Output: `Data Store -> Process -> External Entity`

Each arrow is directional and must have a data-flow name written as a noun
phrase, such as `Expense Transaction Data`. Where the table says "store and
retrieve," draw separate arrows: one from the process to the data store and
one from the data store to the process. Do not use one unlabeled, two-way arrow
or a double-sided arrow. "Store" and "retrieve" describe the connection's
purpose; they are not the label written on the arrows.

| Source | Flow Name | Destination |
| --- | --- | --- |
| `1.0 Manage User Access and Settings` | User Registration and Settings Data | D1 User Accounts and Settings |
| D1 User Accounts and Settings | Account Credential and Status Data | `1.0 Manage User Access and Settings` |
| `2.0 Manage Onboarding and Financial Profile Classification` | Onboarding Response Data | D2 Onboarding Responses |
| D2 Onboarding Responses | Onboarding and Initial Financial Data | `2.0 Manage Onboarding and Financial Profile Classification` |
| D3 Income Sources and Accounts | Income Source and Account Data | `2.0 Manage Onboarding and Financial Profile Classification` |
| D4 Income Transactions | Income Transaction Data | `2.0 Manage Onboarding and Financial Profile Classification` |
| D6 Expense Transactions | Expense Transaction Data | `2.0 Manage Onboarding and Financial Profile Classification` |
| D8 Savings Goals | Savings Goal Data | `2.0 Manage Onboarding and Financial Profile Classification` |
| D9 Savings Contributions and Preferences | Savings Contribution and Preference Data | `2.0 Manage Onboarding and Financial Profile Classification` |
| D10 Debt Accounts | Debt Account and Balance Data | `2.0 Manage Onboarding and Financial Profile Classification` |
| D11 Debt Payments and Repayment Preferences | Debt Payment and Repayment Preference Data | `2.0 Manage Onboarding and Financial Profile Classification` |
| `3.0 Manage Income Sources and Accounts` | Income Source and Account Data | D3 Income Sources and Accounts |
| D3 Income Sources and Accounts | Income Source and Account Data | `3.0 Manage Income Sources and Accounts` |
| `3.0 Manage Income Sources and Accounts` | Income Transaction Data | D4 Income Transactions |
| D4 Income Transactions | Income Transaction Data | `3.0 Manage Income Sources and Accounts` |
| `4.0 Manage Expenses and Obligations` | Expense Category Data | D5 Expense Categories |
| D5 Expense Categories | Expense Category Data | `4.0 Manage Expenses and Obligations` |
| `4.0 Manage Expenses and Obligations` | Expense Transaction Data | D6 Expense Transactions |
| D6 Expense Transactions | Expense Transaction Data | `4.0 Manage Expenses and Obligations` |
| `4.0 Manage Expenses and Obligations` | Bill and Remittance Data | D7 Bills and Remittances |
| D7 Bills and Remittances | Bill and Remittance Data | `4.0 Manage Expenses and Obligations` |
| `5.0 Manage Savings Goals` | Savings Goal Data | D8 Savings Goals |
| D8 Savings Goals | Savings Goal and Progress Data | `5.0 Manage Savings Goals` |
| `5.0 Manage Savings Goals` | Savings Contribution and Preference Data | D9 Savings Contributions and Preferences |
| D9 Savings Contributions and Preferences | Savings Contribution and Preference Data | `5.0 Manage Savings Goals` |
| `6.0 Manage Debt Records` | Debt Account and Balance Data | D10 Debt Accounts |
| D10 Debt Accounts | Debt Account and Balance Data | `6.0 Manage Debt Records` |
| `6.0 Manage Debt Records` | Debt Payment and Repayment Preference Data | D11 Debt Payments and Repayment Preferences |
| D11 Debt Payments and Repayment Preferences | Debt Payment and Repayment Preference Data | `6.0 Manage Debt Records` |
| D6 Expense Transactions | Expense Transaction Data | `7.0 Forecast Expenses` |
| D7 Bills and Remittances | Bill and Remittance Data | `8.0 Generate Financial Plan` |
| D8 Savings Goals | Savings Goal Data | `8.0 Generate Financial Plan` |
| D9 Savings Contributions and Preferences | Savings Contribution and Preference Data | `8.0 Generate Financial Plan` |
| D10 Debt Accounts | Debt Account and Balance Data | `8.0 Generate Financial Plan` |
| D11 Debt Payments and Repayment Preferences | Debt Payment and Repayment Preference Data | `8.0 Generate Financial Plan` |
| `8.0 Generate Financial Plan` | Financial Plan Data | D12 Financial Plans |
| D12 Financial Plans | Financial Plan Data | `8.0 Generate Financial Plan` |
| D3 Income Sources and Accounts | Income Source and Account Data | `9.0 Generate Financial Information` |
| D4 Income Transactions | Income Transaction Data | `9.0 Generate Financial Information` |
| D6 Expense Transactions | Expense Transaction Data | `9.0 Generate Financial Information` |
| D7 Bills and Remittances | Bill and Remittance Data | `9.0 Generate Financial Information` |
| D8 Savings Goals | Savings Goal and Progress Data | `9.0 Generate Financial Information` |
| D9 Savings Contributions and Preferences | Savings Contribution and Preference Data | `9.0 Generate Financial Information` |
| D10 Debt Accounts | Debt Account and Balance Data | `9.0 Generate Financial Information` |
| D11 Debt Payments and Repayment Preferences | Debt Payment and Repayment Preference Data | `9.0 Generate Financial Information` |
| D12 Financial Plans | Financial Plan Data | `9.0 Generate Financial Information` |

## 3. Internal Flows

These flows connect Level 1 processes and do not appear as external flows in the Level 0 context diagram.
Use the value in the **Flow Name** column as the label written on each arrow.

| Source Process | Flow Name | Destination Process |
| --- | --- | --- |
| `2.0 Manage Onboarding and Financial Profile Classification` | Savings and Debt Profile Classification | `8.0 Generate Financial Plan` |
| `2.0 Manage Onboarding and Financial Profile Classification` | Savings and Debt Profile Classification | `9.0 Generate Financial Information` |
| `3.0 Manage Income Sources and Accounts` | Income Sources, Accounts, and Transaction Records | `9.0 Generate Financial Information` |
| `4.0 Manage Expenses and Obligations` | Expense Transaction Data | `7.0 Forecast Expenses` |
| `4.0 Manage Expenses and Obligations` | Expense and Obligation Data | `8.0 Generate Financial Plan` |
| `4.0 Manage Expenses and Obligations` | Expense and Obligation Records | `9.0 Generate Financial Information` |
| `5.0 Manage Savings Goals` | Savings Goal and Contribution Planning Data | `8.0 Generate Financial Plan` |
| `5.0 Manage Savings Goals` | Savings Goal Progress and Projection Data | `9.0 Generate Financial Information` |
| `6.0 Manage Debt Records` | Debt Repayment Planning Data | `8.0 Generate Financial Plan` |
| `6.0 Manage Debt Records` | Debt Balance and Payoff Projection Data | `9.0 Generate Financial Information` |
| `7.0 Forecast Expenses` | Expense Forecast | `8.0 Generate Financial Plan` |
| `7.0 Forecast Expenses` | Expense Forecast | `9.0 Generate Financial Information` |
| `8.0 Generate Financial Plan` | Budget Recommendation and Financial Plan Data | `9.0 Generate Financial Information` |

## 4. Final Input and Output Mapping

The Level 1 DFD must preserve the 19 input flows and 17 output flows in the Level 0 context diagram.

### Inputs

| Level 0 Input Data Flow | Level 1 Process |
| --- | --- |
| Registration Details | `1.0 Manage User Access and Settings` |
| Login Credentials | `1.0 Manage User Access and Settings` |
| Account Recovery Request | `1.0 Manage User Access and Settings` |
| User Settings | `1.0 Manage User Access and Settings` |
| Onboarding Response | `2.0 Manage Onboarding and Financial Profile Classification` |
| Income Sources and Accounts Data | `3.0 Manage Income Sources and Accounts` |
| Income Transaction Data | `3.0 Manage Income Sources and Accounts` |
| Expense Transaction Data | `4.0 Manage Expenses and Obligations` |
| Expense Category Data | `4.0 Manage Expenses and Obligations` |
| Bill Details | `4.0 Manage Expenses and Obligations` |
| Remittance Details | `4.0 Manage Expenses and Obligations` |
| Savings Goal Data | `5.0 Manage Savings Goals` |
| Savings Contribution Data | `5.0 Manage Savings Goals` |
| Savings Contribution Preferences | `5.0 Manage Savings Goals` |
| Debt Account Data | `6.0 Manage Debt Records` |
| Debt Payment Data | `6.0 Manage Debt Records` |
| Debt Repayment Preference | `6.0 Manage Debt Records` |
| Planning Amount | `8.0 Generate Financial Plan` |
| Budget Allocation Preference | `8.0 Generate Financial Plan` |

### Outputs

| Level 0 Output Data Flow | Level 1 Process |
| --- | --- |
| Authentication Status | `1.0 Manage User Access and Settings` |
| Account Status | `1.0 Manage User Access and Settings` |
| Savings and Debt Profile Classification | `2.0 Manage Onboarding and Financial Profile Classification` |
| Unusual Expense Alert | `4.0 Manage Expenses and Obligations` |
| Savings Goal Progress | `5.0 Manage Savings Goals` |
| Savings Goal Projection | `5.0 Manage Savings Goals` |
| Debt Balance | `6.0 Manage Debt Records` |
| Debt Payoff Projection | `6.0 Manage Debt Records` |
| Expense Forecast | `7.0 Forecast Expenses` |
| Budget Recommendation | `8.0 Generate Financial Plan` |
| Budget Plan | `8.0 Generate Financial Plan` |
| Savings Contribution Plan | `8.0 Generate Financial Plan` |
| Debt Repayment Plan | `8.0 Generate Financial Plan` |
| Financial Dashboard | `9.0 Generate Financial Information` |
| Income Transaction History | `9.0 Generate Financial Information` |
| Expense Transaction History | `9.0 Generate Financial Information` |
| Financial Report | `9.0 Generate Financial Information` |
