# Budgie Level 1 DFD Mapping

## Processes

| ID  | Process                                        |
| --- | ---------------------------------------------- |
| 1.0 | User Access and Settings                       |
| 2.0 | Savings and Debt Profile Classification        |
| 3.0 | Financial Plan Management                      |
| 4.0 | Cash Flow, Categories, and Accounts Management |
| 5.0 | Billers and Remittances                        |
| 6.0 | Savings Goal Management                        |
| 7.0 | Debt Management                                |
| 8.0 | Financial Dashboard and Reports                |

## External Entities

| Entity | DFD Role |
| --- | --- |
| USER | Source of the 20 Level 0 input flows and sink of the 22 Level 0 output flows |
| Supabase Auth | External identity provider for registration, authentication, and account recovery |
| ML Inference Service | Separately deployed service that provides financial classification, expense forecasts, and budget recommendations |

### Level 0 Convention

The Level 0 context diagram remains actor-facing and shows only `USER`, matching
the senior's convention. `Supabase Auth` and the `ML Inference Service` first
appear at Level 1 as supporting systems outside the Budgie application boundary.
They are not Budgie data stores or internal Budgie processes.

## 1. Data Stores

The `USER` is an external entity. It is a source when it supplies data to
Budgie and a sink when it receives data from Budgie. The following data stores
hold Budgie's persistent information for the Level 1 DFD.

| ID  | Data Store                               | Stored Information                                                                         |
| --- | ---------------------------------------- | ------------------------------------------------------------------------------------------ |
| D1  | User Accounts and Settings               | Budgie profile details, account status, and user settings                                  |
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
| D14 | Forecast History                         | Generated expense forecast runs, series, points, and explanations                          |

## 2. Process to Data Store Connections

Each data-store flow must connect to a process. External entities, including
the `USER`, must not connect directly to a data store. The required paths are:

- Input: `External Entity -> Process -> Data Store`
- Output: `Data Store -> Process -> External Entity`

Each `->` is directional and must have a data-flow name written as a noun
phrase, such as `Expense Transaction`. Draw store and retrieve operations
as separate directional connections with the same data-flow name. Draw request
and result interactions as separate directional connections.

| Connection                                                                                    | Flow Name                                               | Status |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------- | ------ |
| `1.0 User Access and Settings` -> D1 User Accounts and Settings                               | User Profile, Account Status, and Settings              | ✅      |
| D1 User Accounts and Settings -> `1.0 User Access and Settings`                               | User Profile, Account Status, and Settings              | ✅      |
| `1.0 User Access and Settings` -> Supabase Auth                                               | Registration, Authentication, and Recovery Request      | ✅      |
| Supabase Auth -> `1.0 User Access and Settings`                                               | Authentication and Identity                             | ✅      |
| D7 Savings Goals -> `2.0 Savings and Debt Profile Classification`                             | Savings Goal                                            | ✅      |
| D8 Savings Contributions and Preferences -> `2.0 Savings and Debt Profile Classification`     | Savings Contribution and Preference                     | ✅<br>  |
| D9 Debt Accounts -> `2.0 Savings and Debt Profile Classification`                             | Debt Account and Balance                                | ✅<br>  |
| D10 Debt Payments and Repayment Preferences -> `2.0 Savings and Debt Profile Classification`  | Debt Payment and Repayment Preference                   | ✅<br>  |
| `2.0 Savings and Debt Profile Classification` -> D12 Savings and Debt Profile Classifications | Savings and Debt Profile Classification                 | ✅<br>  |
| D12 Savings and Debt Profile Classifications -> `2.0 Savings and Debt Profile Classification` | Savings and Debt Profile Classification                 | ✅<br>  |
| `2.0 Savings and Debt Profile Classification` -> ML Inference Service                         | Financial Classification Request                        | ✅      |
| ML Inference Service -> `2.0 Savings and Debt Profile Classification`                         | Financial Classification Results                        | ✅      |
| D2 Income Sources and Accounts -> `3.0 Financial Plan Management`                             | Income Source and Account                               | ✅      |
| D5 Expense Transactions -> `3.0 Financial Plan Management`                                    | Expense Transaction                                     | ✅      |
| D6 Bills and Remittances -> `3.0 Financial Plan Management`                                   | Bill and Remittance                                     | ✅      |
| D7 Savings Goals -> `3.0 Financial Plan Management`                                           | Savings Goal                                            | ✅      |
| D8 Savings Contributions and Preferences -> `3.0 Financial Plan Management`                   | Savings Contribution and Preference                     | ✅      |
| D9 Debt Accounts -> `3.0 Financial Plan Management`                                           | Debt Account and Balance                                | ✅      |
| D10 Debt Payments and Repayment Preferences -> `3.0 Financial Plan Management`                | Debt Payment and Repayment Preference                   | ✅      |
| D12 Savings and Debt Profile Classifications -> `3.0 Financial Plan Management`               | Savings and Debt Profile Classification                 | ✅      |
| `3.0 Financial Plan Management` -> D11 Financial Plans                                        | Financial Plan                                          | ✅      |
| D11 Financial Plans -> `3.0 Financial Plan Management`                                        | Financial Plan                                          | ✅      |
| `3.0 Financial Plan Management` -> ML Inference Service                                       | Budget Recommendation Request                           | ✅      |
| ML Inference Service -> `3.0 Financial Plan Management`                                       | Request Budget Recommendation                           | ✅      |
| `4.0 Cash Flow, Categories, and Accounts Management` -> D2 Income Sources and Accounts        | Income Source and Account                               | ✅      |
| D2 Income Sources and Accounts -> `4.0 Cash Flow, Categories, and Accounts Management`        | Income Source and Account                               | ✅      |
| `4.0 Cash Flow, Categories, and Accounts Management` -> D3 Income Transactions                | Income Transaction                                      | ✅      |
| D3 Income Transactions -> `4.0 Cash Flow, Categories, and Accounts Management`                | Income Transaction                                      | ✅      |
| `4.0 Cash Flow, Categories, and Accounts Management` -> D4 Income and Expense Categories      | Income and Expense Category                             | ✅      |
| D4 Income and Expense Categories -> `4.0 Cash Flow, Categories, and Accounts Management`      | Income and Expense Category                             | ✅      |
| `4.0 Cash Flow, Categories, and Accounts Management` -> D5 Expense Transactions               | Expense Transaction                                     | ✅      |
| D5 Expense Transactions -> `4.0 Cash Flow, Categories, and Accounts Management`               | Expense Transaction                                     | ✅      |
| `5.0 Billers and Remittances` -> D6 Bills and Remittances                                     | Bill and Remittance                                     | ✅      |
| D6 Bills and Remittances -> `5.0 Billers and Remittances`                                     | Bill and Remittance                                     | ✅      |
| `5.0 Billers and Remittances` -> D5 Expense Transactions                                      | Bill Payment Expense                                    | ✅      |
| `6.0 Savings Goal Management` -> D7 Savings Goals                                             | Savings Goals                                           | ✅      |
| D7 Savings Goals -> `6.0 Savings Goal Management`                                             | Savings Goals                                           | ✅      |
| `6.0 Savings Goal Management` -> D8 Savings Contributions and Preferences                     | Savings Contribution and Preference                     | ✅      |
| D8 Savings Contributions and Preferences -> `6.0 Savings Goal Management`                     | Savings Contribution and Preference                     | ✅      |
| `7.0 Debt Management` -> D9 Debt Accounts                                                     | Debt Account and Balance                                | ✅      |
| D9 Debt Accounts -> `7.0 Debt Management`                                                     | Debt Account and Balance                                | ✅      |
| `7.0 Debt Management` -> D10 Debt Payments and Repayment Preferences                          | Debt Payment and Repayment Preference                   | ✅      |
| D10 Debt Payments and Repayment Preferences -> `7.0 Debt Management`                          | Debt Payment and Repayment Preference                   | ✅      |
| D2 Income Sources and Accounts -> `8.0 Financial Dashboard and Reports`                       | Income Source and Account                               | ✅      |
| D3 Income Transactions -> `8.0 Financial Dashboard and Reports`                               | Income Transaction                                      | ✅      |
| D4 Income and Expense Categories -> `8.0 Financial Dashboard and Reports`                     | Income and Expense Category                             | ✅      |
| D5 Expense Transactions -> `8.0 Financial Dashboard and Reports`                              | Expense Transaction                                     | ✅      |
| D7 Savings Goals -> `8.0 Financial Dashboard and Reports`                                     | Savings Goal and Progress                               | ✅      |
| D9 Debt Accounts -> `8.0 Financial Dashboard and Reports`                                     | Debt Account and Balance                                | ✅      |
| D11 Financial Plans -> `8.0 Financial Dashboard and Reports`                                  | Financial Plan                                          | ✅      |
| D14 Forecast History -> `8.0 Financial Dashboard and Reports`                                 | Retrieve Expense Forecast                               | ✅      |
| `8.0 Financial Dashboard and Reports` -> D14 Forecast History                                 | Store Expense Forecast                                  | ✅      |
| `4.0 Cash Flow, Categories, and Accounts Management` -> D13 Unusual Expense Alerts            | Unusual Expense Alert                                   |        |
| D13 Unusual Expense Alerts -> `4.0 Cash Flow, Categories, and Accounts Management`            | Unusual Expense Alert                                   |        |
| D13 Unusual Expense Alerts -> `8.0 Financial Dashboard and Reports`                           | Unusual Expense Alert                                   |        |
| `8.0 Financial Dashboard and Reports` -> ML Inference Service                                 | Expense Forecast Request                                |        |
| ML Inference Service -> `8.0 Financial Dashboard and Reports`                                 | Expense Forecast Results                                |        |

## 3. Final Input and Output Mapping

The Level 1 DFD must preserve the 20 input flows and 22 output flows in the Level 0 context diagram.
Draw every row below as a separate directional connection to or from `USER`.
Do not connect `USER` directly to a data store.

`2.0 Savings and Debt Profile Classification` receives the starting questionnaire
when the user first opens the app. It uses that assessment and persisted savings
and debt information to classify the user's profile and update it as financial data
is recorded.

### Inputs

| Source | Flow Name                                        | Destination                                          | Status |
| ------ | ------------------------------------------------ | ---------------------------------------------------- | ------ |
| `USER` | Registration Details                             | `1.0 User Access and Settings`                       | ✅      |
| `USER` | Login Credentials                                | `1.0 User Access and Settings`                       | ✅      |
| `USER` | Account Recovery Request                         | `1.0 User Access and Settings`                       | ✅      |
| `USER` | Savings and Debt Profile Questionnaire Response  | `2.0 Savings and Debt Profile Classification`        | ✅      |
| `USER` | Income Sources and Accounts                      | `4.0 Cash Flow, Categories, and Accounts Management` | ✅      |
| `USER` | Income Transactions                              | `4.0 Cash Flow, Categories, and Accounts Management` | ✅      |
| `USER` | Expense Transactions                             | `4.0 Cash Flow, Categories, and Accounts Management` | ✅      |
| `USER` | Expense Category                                 | `4.0 Cash Flow, Categories, and Accounts Management` | ✅      |
| `USER` | Income and Expense List Filter and Sort Criteria | `4.0 Cash Flow, Categories, and Accounts Management` | ✅      |
| `USER` | Billers Details                                  | `5.0 Billers and Remittances`                        | ✅      |
| `USER` | Remittances Details                              | `5.0 Billers and Remittances`                        | ✅      |
| `USER` | Savings Goals                                    | `6.0 Savings Goal Management`                        | ✅      |
| `USER` | Savings Contribution                             | `6.0 Savings Goal Management`                        | ✅      |
| `USER` | Savings Contribution Preferences                 | `6.0 Savings Goal Management`                        | ✅      |
| `USER` | Debt Accounts                                    | `7.0 Debt Management`                                | ✅      |
| `USER` | Debt Payments                                    | `7.0 Debt Management`                                | ✅      |
| `USER` | Debt Repayment Preference                        | `7.0 Debt Management`                                | ✅      |
| `USER` | Planning Amount                                  | `3.0 Financial Plan Management`                      | ✅      |
| `USER` | Budget Allocation Preference                     | `3.0 Financial Plan Management`                      | ✅      |
| `USER` | User Settings                                    | `1.0 User Access and Settings`                       | ✅      |

### Outputs

| Source                                               | Flow Name                               | Destination | Status |
| ---------------------------------------------------- | --------------------------------------- | ----------- | ------ |
| `1.0 User Access and Settings`                       | Authentication Status                   | `USER`      | ✅      |
| `1.0 User Access and Settings`                       | Account Status                          | `USER`      | ✅      |
| `2.0 Savings and Debt Profile Classification`        | Savings and Debt Profile Classification | `USER`      | ✅      |
| `3.0 Financial Plan Management`                      | Budget Recommendation                   | `USER`      | ✅      |
| `3.0 Financial Plan Management`                      | Budget Plan                             | `USER`      | ✅      |
| `3.0 Financial Plan Management`                      | Savings Contribution Plan               | `USER`      | ✅      |
| `3.0 Financial Plan Management`                      | Debt Repayment Plan                     | `USER`      | ✅      |
| `4.0 Cash Flow, Categories, and Accounts Management` | Expense Transactions List               | `USER`      | ✅      |
| `4.0 Cash Flow, Categories, and Accounts Management` | Income Transactions List                | `USER`      | ✅      |
| `4.0 Cash Flow, Categories, and Accounts Management` | Financial Accounts List                 | `USER`      | ✅      |
| `4.0 Cash Flow, Categories, and Accounts Management` | Income and Expense Categories List      | `USER`      | ✅      |
| `4.0 Cash Flow, Categories, and Accounts Management` | Unusual Expense Alert                   | `USER`      | ✅      |
| `5.0 Billers and Remittances`                        | Billers List                            | `USER`      | ✅      |
| `5.0 Billers and Remittances`                        | Remittances List                        | `USER`      | ✅      |
| `6.0 Savings Goal Management`                        | Savings Goal Progress                   | `USER`      | ✅      |
| `6.0 Savings Goal Management`                        | Savings Contribution Forecast           | `USER`      | ✅      |
| `7.0 Debt Management`                                | Debt Balances                           | `USER`      | ✅      |
| `7.0 Debt Management`                                | Debt Repayment Forecast                 | `USER`      | ✅      |
| `8.0 Financial Dashboard and Reports`                | Financial Dashboard                     | `USER`      | ✅      |
| `8.0 Financial Dashboard and Reports`                | Expense Forecast                        | `USER`      | ✅      |
| `8.0 Financial Dashboard and Reports`                | Unusual Expenses List                   | `USER`      | ✅      |
| `8.0 Financial Dashboard and Reports`                | Financial Report                        | `USER`      | ✅      |
