# Budgie Level 2 DFD Mapping

## Scope and Balancing

This document maps the selected Level 2 decompositions for `2.0 Savings and
Debt Profile Classification`, `3.0 Financial Plan Management`, `4.0 Cash Flow,
Categories, and Accounts Management`, and `8.0 Financial Dashboard and
Reports`. Each diagram must preserve the data flows that cross its parent Level
1 process boundary. This is the DFD balancing rule.

The Level 0 context diagram remains actor-facing and shows only `USER`.
Supporting systems outside the Budgie application boundary first appear at Level
1 and in the selected Level 2 figures that exchange data with them.

## External Entities

| Entity | DFD Role |
| --- | --- |
| USER | Supplies selected Level 0 input flows and receives selected Level 0 output flows |
| ML Inference Service | Receives financial-classification, budget-recommendation, and expense-forecast requests; returns the corresponding results |

## Data Stores

Level 2 reuses the Level 1 data stores. Each parent decomposition shows only
the stores relevant to that process.

| ID  | Data Store                               | Stored Information                                                                         |
| --- | ---------------------------------------- | ------------------------------------------------------------------------------------------ |
| D2  | Income Sources and Accounts              | Income sources, cash accounts, bank accounts, and e-wallet accounts                        |
| D3  | Income Transactions                      | Recorded income transactions                                                               |
| D4  | Income and Expense Categories            | User-defined income and expense categories and subcategories                               |
| D5  | Expense Transactions                     | Recorded expense transactions                                                              |
| D6  | Bills and Remittances                    | Bill details, remittance details, payment schedules, and upcoming financial commitments    |
| D7  | Savings Goals                            | Savings goal details and calculated goal progress                                          |
| D8  | Savings Contributions and Preferences    | Savings contribution records and contribution preferences                                  |
| D9  | Debt Accounts                            | Debt account details and calculated debt balances                                          |
| D10 | Debt Payments and Repayment Preferences  | Debt payment records and debt repayment preferences                                        |
| D11 | Financial Plans                          | Budget recommendations, budget plans, savings contribution plans, and debt repayment plans |
| D12 | Savings and Debt Profile Classifications | Questionnaire assessments, assigned classifications, and classification history            |
| D13 | Unusual Expense Alerts                   | Unusual expense alerts, alert status, related records, and alert history                   |
| D14 | Forecast History                         | Generated forecast runs, series, points, and forecast explanations                         |

## Level 2 Figure Selection

Create a separate Level 2 figure only for a Level 1 process that needs further
explanation. Do not place subprocesses from different Level 1 parents in one
figure. Internal flows to another Level 1 process are boundary flows in the
selected diagram, labelled with the exact flow name from
`budgie-level-1-dfd-mapping.md`.

The selected figures are `Figure 1: 2.0 Savings and Debt Profile
Classification`, `Figure 2: 3.0 Financial Plan Management`, `Figure 3: 4.0
Cash Flow, Categories, and Accounts Management`, and `Figure 4: 8.0 Financial
Dashboard and Reports`.

### External-Entity Balance Checklist

Every flow between a selected parent and an external entity is represented by a
child subprocess with the same direction and flow name. The table is a drawing
checklist; it does not introduce additional flows.

| Parent Process                                       | External Entity      | Parent Input Flows                                                                                                                                   | Parent Output Flows                                                                                                      | Responsible Subprocesses                                                                                                                                                                                                          |
| ---------------------------------------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `2.0 Savings and Debt Profile Classification`        | USER                 | `Savings and Debt Profile Questionnaire Response`                                                                                                    | `Savings and Debt Profile Classification`                                                                                | `2.1 Capture Profile Questionnaire`; `2.3 Store and Provide Profile Classification`                                                                                                                                               |
| `2.0 Savings and Debt Profile Classification`        | ML Inference Service | `Financial Classification Results`                                                                                                                   | `Financial Classification Request`                                                                                       | `2.2 Assess Savings and Debt Profile`                                                                                                                                                                                             |
| `3.0 Financial Plan Management`                      | USER                 | `Planning Amount`; `Budget Allocation Preference`                                                                                                    | `Budget Recommendation`; `Budget Plan`; `Savings Contribution Plan`; `Debt Repayment Plan`                               | `3.1 Capture Planning Inputs`; `3.2 Generate Budget Recommendation`; `3.3 Create Budget Plan`; `3.4 Create Savings Contribution Plan`; `3.5 Create Debt Repayment Plan`                                                           |
| `3.0 Financial Plan Management`                      | ML Inference Service | `Request Budget Recommendation`                                                                                                                      | `Budget Recommendation Request`                                                                                          | `3.2 Generate Budget Recommendation`                                                                                                                                                                                              |
| `4.0 Cash Flow, Categories, and Accounts Management` | USER                 | `Income Sources and Accounts`; `Income Transactions`; `Expense Transactions`; `Expense Category`; `Income and Expense List Filter and Sort Criteria` | `Expense Transactions List`; `Income Transactions List`; `Financial Accounts List`; `Income and Expense Categories List`; `Unusual Expense Alert` | `4.1 Manage Income Sources and Accounts`; `4.2 Manage Income and Expense Categories`; `4.3 Record and Update Income and Expense Transactions`; `4.4 Detect and Store Unusual Expense Alert`; `4.5 View and Categorize Cash Flow Transactions` |
| `8.0 Financial Dashboard and Reports`                | USER                 |                                                                                                                                                      | `Financial Dashboard`; `Expense Forecast`; `Unusual Expenses List`; `Financial Report`                                   | `8.1 Generate Financial Dashboard`; `8.2 Generate Financial Reports`; `8.3 Generate Expense Forecasts`; `8.4 Provide Unusual Expense Alerts List`                                                                                  |
| `8.0 Financial Dashboard and Reports`                | ML Inference Service | `Expense Forecast Results`                                                                                                                           | `Expense Forecast Request`                                                                                               | `8.3 Generate Expense Forecasts`                                                                                                                                                                                                  |

## 2.0 Savings and Debt Profile Classification

**Relevant data stores:** D7 Savings Goals, D8 Savings Contributions and
Preferences, D9 Debt Accounts, D10 Debt Payments and Repayment Preferences,
and D12 Savings and Debt Profile Classifications

| ID  | Subprocess                               | Primary Data Flows                                                                            |
| --- | ---------------------------------------- | --------------------------------------------------------------------------------------------- |
| 2.1 | Capture Profile Questionnaire            | Receives `Savings and Debt Profile Questionnaire Response` and prepares assessment data       |
| 2.2 | Assess Savings and Debt Profile          | Uses questionnaire, savings, and debt data with the ML inference result to assess the profile |
| 2.3 | Store and Provide Profile Classification | Stores classification history and returns the classification to USER                          |

### 2.0 Relationships

| Source                                         | Flow Name                                       | Destination                                    | Status |
| ---------------------------------------------- | ----------------------------------------------- | ---------------------------------------------- | ------ |
| USER                                           | Savings and Debt Profile Questionnaire Response | `2.1 Capture Profile Questionnaire`            | ✅      |
| `2.1 Capture Profile Questionnaire`            | Profile Questionnaire Assessment                | `2.2 Assess Savings and Debt Profile`          | ✅      |
| D7 Savings Goals                               | Savings Goal                                    | `2.2 Assess Savings and Debt Profile`          | ✅      |
| D8 Savings Contributions and Preferences       | Savings Contribution and Preference             | `2.2 Assess Savings and Debt Profile`          | ✅      |
| D9 Debt Accounts                               | Debt Account and Balance                        | `2.2 Assess Savings and Debt Profile`          | ✅      |
| D10 Debt Payments and Repayment Preferences    | Debt Payment and Repayment Preference           | `2.2 Assess Savings and Debt Profile`          | ✅      |
| D12 Savings and Debt Profile Classifications   | Savings and Debt Profile Classification         | `2.2 Assess Savings and Debt Profile`          | ✅      |
| `2.2 Assess Savings and Debt Profile`          | Financial Classification Request                | ML Inference Service                           | ✅      |
| ML Inference Service                           | Financial Classification Results                | `2.2 Assess Savings and Debt Profile`          | ✅      |
| `2.2 Assess Savings and Debt Profile`          | Savings and Debt Profile Classification         | `2.3 Store and Provide Profile Classification` | ✅      |
| `2.3 Store and Provide Profile Classification` | Savings and Debt Profile Classification         | D12 Savings and Debt Profile Classifications   | ✅      |
| `2.3 Store and Provide Profile Classification` | Savings and Debt Profile Classification         | USER                                           | ✅      |

## 3.0 Financial Plan Management

**Relevant data stores:** D2 Income Sources and Accounts, D5 Expense
Transactions, D6 Bills and Remittances, D7 Savings
Goals, D8 Savings Contributions and Preferences, D9 Debt Accounts, D10 Debt
Payments and Repayment Preferences, D11 Financial Plans, and D12 Savings and
Debt Profile Classifications

| ID  | Subprocess                       | Primary Data Flows                                                                                              |
| --- | -------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| 3.1 | Capture Planning Inputs          | Receives planning inputs                                                                                         |
| 3.2 | Generate Budget Recommendation   | Uses available income, expenses, obligations, and profile classification to produce `Budget Recommendation`     |
| 3.3 | Create Budget Plan               | Produces `Budget Plan`                                                                                           |
| 3.4 | Create Savings Contribution Plan | Produces `Savings Contribution Plan`                                                                            |
| 3.5 | Create Debt Repayment Plan       | Produces `Debt Repayment Plan`                                                                                   |
| 3.6 | Maintain Accepted Financial Plan | Receives generated plans, retrieves and updates the accepted financial plan in D11 without altering its active allocations or projections |

### 3.0 Relationships

| Source                                       | Flow Name                               | Destination                            | Status |
| -------------------------------------------- | --------------------------------------- | -------------------------------------- | ------ |
| USER                                         | Planning Amount                         | `3.1 Capture Planning Inputs`          | ✅      |
| USER                                         | Budget Allocation Preference            | `3.1 Capture Planning Inputs`          | ✅      |
| `3.1 Capture Planning Inputs`                | Planning Inputs                         | `3.2 Generate Budget Recommendation`   | ✅      |
| D2 Income Sources and Accounts               | Income Source and Account               | `3.2 Generate Budget Recommendation`   | ✅      |
| D5 Expense Transactions                      | Expense Transaction                     | `3.2 Generate Budget Recommendation`   | ✅      |
| D6 Bills and Remittances                     | Bill and Remittance                     | `3.2 Generate Budget Recommendation`   | ✅      |
| D7 Savings Goals                             | Savings Goal                            | `3.2 Generate Budget Recommendation`   | ✅      |
| D8 Savings Contributions and Preferences     | Savings Contribution and Preference     | `3.2 Generate Budget Recommendation`   | ✅      |
| D9 Debt Accounts                             | Debt Account and Balance                | `3.2 Generate Budget Recommendation`   | ✅      |
| D10 Debt Payments and Repayment Preferences  | Debt Payment and Repayment Preference   | `3.2 Generate Budget Recommendation`   | ✅      |
| D12 Savings and Debt Profile Classifications | Savings and Debt Profile Classification | `3.2 Generate Budget Recommendation`   | ✅      |
| `3.2 Generate Budget Recommendation`         | Budget Recommendation Request           | ML Inference Service                   | ✅      |
| ML Inference Service                         | Budget Recommendation                   | `3.2 Generate Budget Recommendation`   | ✅      |
| `3.2 Generate Budget Recommendation`         | Budget Recommendation                   | USER                                   | ✅      |
| `3.2 Generate Budget Recommendation`         | Budget Recommendation                   | `3.3 Create Budget Plan`               | ✅      |
| `3.2 Generate Budget Recommendation`         | Savings Contributions                   | `3.4 Create Savings Contribution Plan` | ✅      |
| `3.2 Generate Budget Recommendation`         | Debt Repayments                         | `3.5 Create Debt Repayment Plan`       | ✅      |
| `3.3 Create Budget Plan`                     | Budget Plan                             | USER                                   | ✅      |
| `3.3 Create Budget Plan`                     | Budget Plan                             | `3.6 Maintain Accepted Financial Plan` | ✅      |
| `3.4 Create Savings Contribution Plan`       | Savings Contribution Plan               | USER                                   | ✅      |
| `3.4 Create Savings Contribution Plan`       | Savings Contribution Plan               | `3.6 Maintain Accepted Financial Plan` | ✅      |
| `3.5 Create Debt Repayment Plan`             | Debt Repayment Plan                     | USER                                   | ✅      |
| `3.5 Create Debt Repayment Plan`             | Debt Repayment Plan                     | `3.6 Maintain Accepted Financial Plan` | ✅<br>  |
| D11 Financial Plans                          | Financial Plan                          | `3.6 Maintain Accepted Financial Plan` | ✅      |
| `3.6 Maintain Accepted Financial Plan`       | Financial Plan                          | D11 Financial Plans                    | ✅      |

## 4.0 Cash Flow, Categories, and Accounts Management

**Relevant data stores:** D2 Income Sources and Accounts, D3 Income
Transactions, D4 Income and Expense Categories, D5 Expense Transactions, and
D13 Unusual Expense Alerts

| ID  | Subprocess                                 | Primary Data Flows                                                                                                       |
| --- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| 4.1 | Manage Income Sources and Accounts         | Receives `Income Sources and Accounts`; stores and retrieves `Income Source and Account` in D2                           |
| 4.2 | Manage Income and Expense Categories       | Receives `Expense Category`; stores and retrieves `Income and Expense Category` in D4                                    |
| 4.3 | Record and Update Income and Expense Transactions | Receives `Income Transactions` and `Expense Transactions`; retrieves categories from D4 so the user can select one; stores and retrieves transaction records in D3 and D5 |
| 4.4 | Detect and Store Unusual Expense Alert     | Detects an unusual expense from the recorded expense transaction, sends the alert to USER, and stores `Unusual Expense Alert` in D13 |
| 4.5 | View and Categorize Cash Flow Transactions | Receives filter and sort criteria; retrieves account, transaction, category, and unusual expense alert data; returns the required lists to USER |

### 4.0 Relationships

| Source                                                  | Flow Name                                        | Destination                                             | Status |
| ------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------- | ------ |
| USER                                                    | Income Sources and Accounts                      | `4.1 Manage Income Sources and Accounts`                | ✅      |
| D2 Income Sources and Accounts                          | Income Source and Account                        | `4.1 Manage Income Sources and Accounts`                | ✅      |
| `4.1 Manage Income Sources and Accounts`                | Income Source and Account                        | D2 Income Sources and Accounts                          | ✅      |
| USER                                                    | Store Income and Expense Categories              | `4.2 Manage Income and Expense Categories`              | ✅      |
| D4 Income and Expense Categories                        | Retrieve Income and Expense Category             | `4.2 Manage Income and Expense Categories`              | ✅      |
| `4.2 Manage Income and Expense Categories`              | Income and Expense Category                      | D4 Income and Expense Categories                        | ✅      |
| USER                                                    | Income Transactions                              | `4.3 Record and Update Income and Expense Transactions` | ✅      |
| USER                                                    | Expense Transactions                             | `4.3 Record and Update Income and Expense Transactions` | ✅      |
| D3 Income Transactions                                  | Income Transaction                               | `4.3 Record and Update Income and Expense Transactions` | ✅      |
| D4 Income and Expense Categories                        | Income and Expense Category                      | `4.3 Record and Update Income and Expense Transactions` | ✅      |
| D5 Expense Transactions                                 | Expense Transaction                              | `4.3 Record and Update Income and Expense Transactions` | ✅      |
| `4.3 Record and Update Income and Expense Transactions` | Income Transaction                               | D3 Income Transactions                                  | ✅      |
| `4.3 Record and Update Income and Expense Transactions` | Expense Transaction                              | D5 Expense Transactions                                 | ✅      |
| D5 Expense Transactions                                 | Expense Transaction                              | `4.4 Detect and Store Unusual Expense Alert`            | ✅      |
| `4.4 Detect and Store Unusual Expense Alert`            | Unusual Expense Alert                            | D13 Unusual Expense Alerts                              | ✅      |
| `4.4 Detect and Store Unusual Expense Alert`            | Unusual Expense Alert                            | USER                                                    | ✅      |
| D2 Income Sources and Accounts                          | Income Source and Account                        | `4.5 View and Categorize Cash Flow Transactions`        | ✅<br>  |
| D3 Income Transactions                                  | Income Transaction                               | `4.5 View and Categorize Cash Flow Transactions`        | ✅<br>  |
| D4 Income and Expense Categories                        | Income and Expense Category                      | `4.5 View and Categorize Cash Flow Transactions`        | ✅<br>  |
| D5 Expense Transactions                                 | Expense Transaction                              | `4.5 View and Categorize Cash Flow Transactions`        | ✅<br>  |
| D13 Unusual Expense Alerts                              | Unusual Expense Alert                            | `4.5 View and Categorize Cash Flow Transactions`        | ✅      |
| USER                                                    | Income and Expense List Filter and Sort Criteria | `4.5 View and Categorize Cash Flow Transactions`        | ✅      |
| `4.5 View and Categorize Cash Flow Transactions`        | Expense Transactions List                        | USER                                                    | ✅      |
| `4.5 View and Categorize Cash Flow Transactions`        | Income Transactions List                         | USER                                                    | ✅      |
| `4.5 View and Categorize Cash Flow Transactions`        | Financial Accounts List                          | USER                                                    | ✅      |
| `4.5 View and Categorize Cash Flow Transactions`        | Income and Expense Categories List               | USER                                                    | ✅      |

## 8.0 Financial Dashboard and Reports

**Relevant data stores:** D2 Income Sources and Accounts, D3 Income
Transactions, D4 Income and Expense Categories, D5 Expense Transactions, D7
Savings Goals, D9 Debt Accounts, D11 Financial Plans, D13 Unusual Expense
Alerts, and D14 Forecast History

| ID  | Subprocess                                               | Primary Data Flows                                                                                               |
| --- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| 8.1 | Generate Financial Dashboard                             | Retrieves current financial data and financial plans; returns `Financial Dashboard`                              |
| 8.2 | Generate Financial Reports                               | Retrieves financial data for the selected period and categories; returns `Financial Report`                      |
| 8.3 | Generate Expense Forecasts                               | Retrieves expense transactions; stores and retrieves forecast history in D14; returns `Expense Forecast` to USER |
| 8.4 | Provide Unusual Expense Alerts List                | Retrieves unusual expense alerts and returns `Unusual Expenses List`                                               |

### 8.0 Relationships

| Source                                                         | Flow Name                       | Destination                                                    | Status |
| -------------------------------------------------------------- | ------------------------------- | -------------------------------------------------------------- | ------ |
| D2 Income Sources and Accounts                                 | Income Source and Account       | `8.1 Generate Financial Dashboard`                             | ✅      |
| D3 Income Transactions                                         | Income Transaction              | `8.1 Generate Financial Dashboard`                             | ✅      |
| D4 Income and Expense Categories                               | Income and Expense Category     | `8.1 Generate Financial Dashboard`                             | ✅      |
| D5 Expense Transactions                                        | Expense Transaction             | `8.1 Generate Financial Dashboard`                             | ✅      |
| D7 Savings Goals                                               | Savings Goal and Progress       | `8.1 Generate Financial Dashboard`                             | ✅      |
| D9 Debt Accounts                                               | Debt Account and Balance        | `8.1 Generate Financial Dashboard`                             | ✅      |
| D11 Financial Plans                                            | Financial Plan                  | `8.1 Generate Financial Dashboard`                             | ✅      |
| `8.1 Generate Financial Dashboard`                             | Financial Dashboard             | USER                                                           | ✅      |
| D2 Income Sources and Accounts                                 | Income Source and Account       | `8.2 Generate Financial Reports`                               | ✅      |
| D3 Income Transactions                                         | Income Transaction              | `8.2 Generate Financial Reports`                               | ✅      |
| D4 Income and Expense Categories                               | Income and Expense Category     | `8.2 Generate Financial Reports`                               | ✅      |
| D5 Expense Transactions                                        | Expense Transaction             | `8.2 Generate Financial Reports`                               | ✅      |
| D7 Savings Goals                                               | Savings Goal and Progress       | `8.2 Generate Financial Reports`                               | ✅      |
| D9 Debt Accounts                                               | Debt Account and Balance        | `8.2 Generate Financial Reports`                               | ✅      |
| D11 Financial Plans                                            | Financial Plan                  | `8.2 Generate Financial Reports`                               | ✅      |
| `8.2 Generate Financial Reports`                               | Financial Report                | USER                                                           | ✅      |
| D5 Expense Transactions                                        | Expense Transaction             | `8.3 Generate Expense Forecasts`                               | ✅      |
| D14 Forecast History                                           | Store Retrieve Expense Forecast | `8.3 Generate Expense Forecasts`                               | ✅      |
| `8.3 Generate Expense Forecasts`                               | Expense Forecast Request        | ML Inference Service                                           | ✅      |
| ML Inference Service                                           | Expense Forecast                | `8.3 Generate Expense Forecasts`                               | ✅      |
| `8.3 Generate Expense Forecasts`                               | Store Expense Forecast          | D14 Forecast History                                           | ✅      |
| `8.3 Generate Expense Forecasts`                               | Expense Forecast                | USER                                                           | ✅      |
| D13 Unusual Expense Alerts                  | Unusual Expense Alert | `8.4 Provide Unusual Expense Alerts List` |        |
| `8.4 Provide Unusual Expense Alerts List`   | Unusual Expenses List | USER                                        |        |
