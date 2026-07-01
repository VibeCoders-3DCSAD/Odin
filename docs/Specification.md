# Development of Odin: A Personal Finance Management System for Filipino Working Young Adults Using Random Forest, LSTM, and Isolation Forest

---

Document Type: Technical Specification

Version: 4.0

Date: 2026-06-13

Authors:
- Gabion, Stefanie S.
- Guevarra, Joaquin Luis T.
- San Jose, Alexa Joanne Paula G.
- Togle, Charles Nathaniel B.

Course Adviser: Prof. Era Marie Gannaban

Technical Adviser: Prof. Christian Michael Mansueto

Panels:
- Prof. Daniel Dellosa (Chair)
- Prof. Jomariss Plan
- Prof. Janice Congzon

Institutional Affiliation: College of Computing and Information Sciences, University of Makati

---

# RULES

1. Article flow is hierarchical; if a system module, component, or feature has dependencies, all of those must be discussed fully and completely first before it.

2. The discussion of said dependencies must be as close to the dependent module as possible. For example, three dependency features for dependent feature A must be discussed in order of Article I, II, III (dependencies), then IV (dependent). Feature B whose dependencies are not the exact same must not be Article IV.

3. A system feature or topic merits its own article if it is depended upon by at least two other features or topics. If a feature is used by only one other feature or is self‑contained, it shall be described within that dependent feature's article as a section.

4. Cross‑cutting dependencies, or dependencies with two or more dependents, provided that they qualify as articles, shall be defined in dedicated articles before any module that uses them. These articles appear in order of conceptual dependency (e.g. User → Account → Transaction → Category).

---

# SYSTEM SPECIFICATION

> TODO: Three out of the four core modules, the FBP classification module, the forecasting module, and the anomaly detection module, hereby known as the intelligent modules, implement a model, and are consequently hosted on the server side. Therefore, their functionality relies on Internet access.

> TODO: Include every module in the offline capability support list except for the FBP, forecasting, and anomaly detection module.
    
> TODO: Add this to the scope and delimitations: "iOS is explicitly excluded from the scope. No iOS‑specific development, testing, or distribution shall be undertaken."

> TODO: Add this to the onboarding: 'The System shall display an informational notice during onboarding that states: "Odin is a thesis project designed primarily for Filipino working young adults aged 20–40 in Metro Manila. All users are welcome to use the app, but please be aware that only data from users meeting these criteria will be used to train and improve Odin's AI models. By continuing, you acknowledge this limitation."'

---

## ===== Article 0. Acronyms and Abbreviations =====

### Section 1. Acronyms

### Section 2. Abbreviations

---

## ===== Article I. Application =====

### Section 1. Name

> PROP: The name of the completed System and deployed Application shall be "Odin".

> PROP: The tagline of the Application shall be: "Makes truly Filipino budgets."

### Section 2. Platform

1. The System shall be published and distributed as a mobile application for Android devices on the Google Play Store.

### Section 3. Permissions

> PROP: The System shall not request additional device permissions such as access to the phone's camera, contacts, ability to record audio, etc., as these are unnecessary.

### Section 4. On-line Functionality

> PROP: All modules of the System shall function with full capability during on-line connectivity.

### Section 5. Off-line Functionality

1. The System shall support offline capability for all modules except for the intelligent modules which rely on server-side model inference.

---

## ===== Article II. Interface =====

### Section 1. Screens

1. The System shall implement the following primary screens, their respective subscreens or modals, and their subscreen or modal type if applicable:

    1. Registration Screen

    2. Onboarding Screen

        1. Questionnaire Subscreen

        2. Results Subscreen

        3. Classification Subscreen

    3. Login Screen

        1. Forgotten Password Subscreen

    4. Dashboard Screen

    5. User Account Screen

    6. Financial Behavioral Profile Screen

    7. Transaction Entry Screen

        1. Recurring Transactions Subscreen

        2. Transaction Templates Subscreen

        3. Transaction Modal
        
            - Creation

        4. Transaction Template Modal

    8. Transaction History Screen

        1. Transaction Modal
        
            - Update

            - Deletion

    9. Budgeting Screen

    10. Forecasting Screen

    11. Anomaly Detection Screen

    12. Savings Goals Management Screen

    13. Debt Management Screen

    14. Reports & Analytics Screen

    15. Settings Screen

    16. Notifications Screen

2. The System shall support both light and dark themes, with the light theme as the default visual theme.

### Section 2. Navigation

1. The System shall implement a navigation toolbar anchored at the bottom of the screen, present in all primary screens.

2. The toolbar shall contain an "Add" button, a prominent circular button with a plus symbol, in the center of the toolbar between the second and third item.

3. Tapping the Add button shall open a modal or bottom sheet with the following actions:

    1. **Record Transaction**: This action opens the Transaction Entry Screen.

    2. **Create or Use Transaction Template**: This action opens the Transaction Template Modal.

2. The toolbar shall contain the following items, along with their respective linked screens, from left to right:

    > NOTE: The exact ordering and icons will be finalized during UI/UX design. The following are placeholders representing the primary destinations:

    1. **Dashboard**: Dashboard Screen

    2. **Transactions**: Transaction History Screen

    3. **Add Button**

    4. **Budget**: Budgeting Screen

    5. **Profile**: FBP Screen:

---

## ===== Article III. Users =====

### Section 1. General Users

1. The System shall define General Users as any individual who downloads and installs the application, regardless of age, geographic location, or employment status. 

2. General Users shall have full access to all features of the System.

### Section 2. Target Users

1. The System shall define Target Users as individuals who meet all of the following criteria:

    1. **Demographic criterion**: The user is a Filipino citizen aged 20 to 40 years inclusive.
    
    2. **Geographic criterion**: The user lives or works in the National Capital Region, also known as Metro Manila, covering any of the following cities or municipality:

        1. City of Caloocan
        
        2. City of Las Piñas
        
        3. City of Makati
        
        4. City of Malabon
        
        5. City of Mandaluyong
        
        6. City of Manila
        
        7. City of Marikina
        
        8. City of Muntinlupa
        
        9. City of Navotas
        
        10. City of Parañaque
        
        11. City of Pasay
        
        12. City of Pasig
        
        13. Municipality of Pateros
        
        14. Quezon City
        
        15. City of San Juan
        
        16. City of Taguig
        
        17. City of Valenzuela

    3. **Employment requirement**: The user declares a Primary Employment that falls into an employment type in any of the following employment category, based on the Department of Labor and Employment's Labor Code of the Philippines standards:

        1. **Regular Employment**: Entitled to security of tenure and statutory benefits on a pro‑rata basis. Supports the Stable income dimension. The following employment types fall under this category:

            - Full‑time Employee
            
            - Part‑time Employee

        2. **Independent Contract/Employment**: Variable security of tenure; no employer‑employee relationship; responsible for own taxes and contributions. Supports the Variable income dimension. The following employment types fall under this category:

            - Self‑employed Individual
            
            - Freelancer
            
            - Business Owner
            
            - Entrepreneur

        3. **Fixed‑Term/Project Employment**. Variable or low security of tenure; employed only for the length of contractual obligations. Supports the Variable income dimension. The following employment types fall under this category:

            - Contractual Employee/Worker

            - Project‑based Employee/Worker
            
            - Gig Economy Worker

---

## ===== Article IV. Financial Behavioral Profiles =====

### Section 1. Income Stability

> NOTE: Discuss income stability as a binary dimension, its labels, its quantitative/numerical measurability as a score, and its threshold.

2. Income stability is the capacity of the user's inflow to maintain a stable amount and frequency in regular intervals.

### Section 2. Obligation Weight

> NOTE: Discuss obligation weight as a binary dimension, its labels, its quantitative/numerical measurability as a score, and its threshold.

3. Obligation weight is the proportion of the user's necessary expenses (sum of Essential and Obligatory expenses) to their total expenses.

### Section 3. Financial Behavioral Profile

1. The four FBPs, derived from a combination of the user's income stability and obligation weight binary classifications, are:

    1. Stable‑Flexible

    2. Stable‑Obligated

    3. Variable‑Flexible

    4. Variable‑Obligated

### Section 4. Financial Behavioral Drift

> PROP: A user's financial behavioral profile may drift over time. If a user retained a different income stability or obligation weight score for (a set length of time), the system will flag the user for reclassification.

---

## ===== Article V. Financial Behavioral Profile Classifiers =====

### Section 1. Financial Behavioral Profile Classifier

> PROP: The following 

### Section 2. Data Collection

### Section 3. Data Preprocessing and Cleaning

### Section 4. Feature Engineering

### Section 5. Exploratory Data Analysis

### Section 6. Data Modeling

### Section 7. Model Evaluation

### Section 8. Optimization

### Section 9. Deployment

---

## ===== Article VI. Financial Behavioral Profile Classification =====

### Section 1. Standard Classification

> INFO: Standard process of model-based classification classifying the user's profile based on historical data.

### Section 2. Questionnaire Classification

> INFO: Special process of model-based classification classifying the user's profile based on questionnaire answers.

### Section 3. Cold-Start Classification

> NOTE: See if a cold-start fallback for the classifier is needed. My logic right now says no?

### Section 4. Manual Classification

> NOTE: Manual classification is when the user opts to select their profile instead of having the system assign it for them. This is when they have rejected their assigned profile during onboarding, or when they wish to change their profile via selection instead of retaking the questionnaire.

---

## ===== Article VII. Registration Module =====

### Section 1. Data Privacy and Security Notice

> NOTE: Discusses how user data privacy is enforced through anonymization and user data security is ensured through encryption.

### Section 2. Data Use and Consent Notice

> NOTE: Discusses how user data is used in the system's intelligent features. Also includes user agreement and consent.

### Section 3. Account Creation & Registration

---

## ===== Article VIII. Questionnaire Module =====

### Section 1. Questionnaire Issuance

### Section 2. Questionnaire Results

### Section 3. Questionnaire Classification

---

## ===== Article IX. Log-in and Log-out Module =====

### Section 1. Log-in

### Section 2. Forgotten Password

> NOTE: Either send OTP or send user to webpage where they can reset password.

### Section 3. Session

> NOTE: Auto-logout OR auto-lock.

### Section 4. Log-out

---

## ===== Article X. Financial Behavioral Profile Module =====

### Section 1. Financial Behavioral Profile

> INFO: Includes current FBP and user option to change FBP via questionnaire or simple manual user selection.

### Section 2. Financial Behavioral Drift Checking

> NOTE: Every set length of days, the system runs the classifier.


---

## ===== Article XI. User Accounts =====

### Section 1. User Account

> NOTE: Should atleast cover user data export and toggling of opt-in for model training.

> NOTE: Should cover the ff: Opt-in for model training (use user data to train and improve Odin's models), Data privacy & security, Opt-in for data selling to Chinese markets, User Consent (part of registration), Delete user data, Export user data

---

## ===== Article XII. Financial Accounts =====

### Section 1. General Account

### Section 2. Savings Account

### Section 3. Debt Account

### Section 4. Account Balance

> NOTE: Should tackle negative balance too.

> NOTE: Debt accounts should be negative or zero only.

### Section 5. Financial Account Flow

> NOTE: Income -> Balance -> Expenses
>                         -> Savings
>                         -> Debt
---

## ===== Article XIII. Transactions =====

### Section 1. Transaction Types

> NOTE: Should cover the transaction types. For recurring transactions, should cover patterns.

> NOTE: What did I mean by patterns haha

### Section 2. Transaction Fields

### Section 3. Transaction Validation Rules

### Section 4. Transaction Templates

> NOTE: Templates are literally templates of a transaction that have some or all fields filled in (e.g., a "take-out food" template). 

> The structure now is, if I'm correct:
> Create:
    > Transaction Record (also known as "Add Transaction" or "Record Transaction")
        > Single
            > Income/Expense/Transfer
            > Manual/Recurring
        > Template
    > Template
        > Income/Expense/Transfer
        > Manual/Recurring

---

## ===== Article XIV. Income =====

### Section 1. Income

> INFO: Discuss income, distinction between employment/occupation income and other types of inflows, income categories, etc.

---

## ===== Article XV. Expenses =====

### Section 1. Expense

> NOTE: This discusses the Expense Item (or just Item) and its properties. 

> NOTE: Obviously, the user is in charge of creating the expense items. Items do not necessarily have to be one single individual object; they can be a collection of objects (e.g., Groceries: a collection of ingredients, goods, hygiene products) AS LONG AS that Item falls under one expense group ONLY (e.g., Groceries Item usually contains objects all classified as Essential). This is crucial for the forecasting and budget recommendation. In the event that a single expense item falls under more than one group, its costs must be split.

### Section 2. Expense Categories and Subcategories

> NOTE: This discusses the Subcategories to which Items are classified under (e.g. Ingredients under Food, Milk under Non-Alcoholic Beverages). This also discusses the Categories to which Subcategories are classified under (e.g. Food Subcategory under Food & Non-Alcoholic Beverages Category).

> NOTE: Categories and Subcategories are based on the PSA PCOICOP.

> NOTE: Users can also create their own custom categories and subcategories, but they must classify it under an expense group. 

### Section 3. Expense Groups

> NOTE: This discusses the Groups to which Categories are classified under (e.g. Food & Non-Alcoholic Beverages under Essentials).

> NOTE: Users cannot create a custom expense group. 

### Section 4. Expense Restrictions

> NOTE: Expense Categories and Subcategories have Restriction Levels that can be set by the user. The system also creates default levels for each. They can be Free, meaning their floors and ceilings can be set to whatever; Protected, meaning their floors are set; and Locked, meaning both the floor and ceiling are one, AKA there's a set amount that must be reached, no more and no less. 

---

## ===== Article XVI. Transaction Entry Module =====

### Section 1. Transaction Entry

> INFO: Discusses the transaction entry, fields, option to set as recurring

### Section 2. Recurring Transactions

> INFO: Discusses the recurring transactions subscreen; list of recurring transactions set by the user, with options to edit or delete

### Section 3. Transaction Templates

> INFO: Discusses the transaction templates subscreen; list of templates made by the user, with options to edit or delete

### Section 4. Transaction Suggestions

> NOTE: Should discuss ease of use by displaying frequent income/expense details (and expense categories).

---

## ===== Article XVII. Transaction History Module =====

### Section 1. Transaction History

### Section 2. Searching, Sorting, and Filtering Operations

> NOTE: Includes searching, sorting, and filtering.

### Section 3. Editing & Deletion

### Section 2. Transaction Record Retention

> NOTE: The retention limit must be validated official guidelines, like from the BSP.
---

## ===== Article XVIII. Budgets =====

### Section 1. Budget

### Section 2. Size

### Section 3. Period

### Section 4. Allocation

> NOTE: Per category group, cat., and subcat.

### Section 5. Constraint

> NOTE: Should discuss floors and ceilings.

### Section 6. Feasibility

> NOTE: If suggested budget, considering the requirements and constraints like floors (protected & locked), can be supported by current balance, then it is considered Feasible. If not Feasible, system will begin budget reduction.

### Section 7. Strategy

> NOTE: Should discuss the components of a budget strategy, like hierarchy and stuff. Here's what I'm thinking. The given budget strategies (e.g. 50/30/20) need to be distilled into a set of configurations, such that the user, with the custom budget strategy feature, can replicate the given budget strategies.
> There needs to be a restriction configuration (for the 50% needs portion of 50/30/20 that cannot be reduced, for example). There also needs to be a hierarchy configuration, for the order of allocation.
> We can brainstorm

> NOTE: The given budget strategies should be sourced from those mentioned in the RRL.

---

## ===== Article XIX. Budget Recommenders =====

### Section 1. Budget Recommenders

### Section 2. Data Collection

### Section 3. Data Preprocessing and Cleaning

### Section 4. Feature Engineering

### Section 5. Exploratory Data Analysis

### Section 6. Data Modeling

### Section 7. Model Evaluation

### Section 8. Optimization

### Section 9. Deployment

## ===== Article XX. Budget Recommendation Process =====

### Section 2. Standard Budget Recommendation

### Section 1. Cold-Start Budget Recommendation

> NOTE: Can cold-start budget recommendations be affected by budget infeasibility? 

### Section 3. Reduced Budget Recommendation

> NOTE: This section is for when recommended budget becomes infeasible and size exceeds current balance plus foreseeable income streams. Discuss which allocations are reduced; in what order, and by how much per. Also need to discuss what to do when, after all legal reductions are performed, the budget is still infeasible. It may be important to consider not to tell the user outright that they don't have enough money for the budget period, as that can invoke panic and despair. This is an unfortunate occurence that is a reality to some Filipinos today, so our system must also be sensitive aside from being intelligent and ethical.

---

## ===== Article XXI. Budgeting Module =====

### Section 1. Budget Health

> NOTE: Should include a health indicator and prescribed vs. actual tracker

### Section 2. Budget Recommendation

### Section 3. Budget Setup

### Section 3. Budget Surplus and Deficit

> NOTE: Should discuss the actions done after observing budget surplus or deficit at the end of the budget period. Not sure whether it's appropriate to discuss it in this article or somewhere else.

> NOTE: Should also discuss Budget Surplus Strategies (e.g., move surplus to balance or savings goal?)

> NOTE: We can justify allotting surplus to the currently most prioritized savings goal, justified by the Zero-Based Budget Strategy.

> NOTE: We also have to consider, what if the user does not have any savings goals at all?

### Section 4. Budget Editing

---

## ===== Article XXII. Forecasts =====

### Section 1. Forecast Target

### Section 2. Forecast Horizon

---

## ===== Article XXIII. Forecasters =====

### Section 1. Forecasters

### Section 2. Data Collection

### Section 3. Data Preprocessing and Cleaning

### Section 4. Feature Engineering

### Section 5. Exploratory Data Analysis

### Section 6. Data Modeling

### Section 7. Model Evaluation

### Section 8. Optimization

### Section 9. Deployment

---

## ===== Article XXIV. Forecasting Process =====

### Section 1. Standard Forecasting

### Section 2. Cold-Start Forecasting

---

## ===== Article XXV. Forecasting Module

### Section 1. Total Forecast

### Section 2. Category Group Forecast

### Section 3. Category Forecast

### Section 4. Forecast Breakdown

---

## ===== Article XXVI. Anomalies =====

### Section 1. Overspending Transaction

### Section 2. Anomalous Transaction

### Section 3. Exclusion

### Section 4. Whitelist

---

## ===== Article XXVII. Anomaly Detectors =====

### Section 1. Anomaly Detector

### Section 2. Data Collection

### Section 3. Data Preprocessing and Cleaning

### Section 4. Feature Engineering

### Section 5. Exploratory Data Analysis

### Section 6. Data Modeling

### Section 7. Model Evaluation

### Section 8. Optimization

### Section 9. Deployment

---

## ===== Article XXVIII. Anomaly Detection Process

### Section 1. Standard Anomalous Transaction Detection

### Section 2. Cold-Start Anomalous Transaction Detection

### Section 3. Standard Overspending Transaction Detection

---

## ===== Article XXIX. Anomaly Detection Module =====

### Section 1. Anomaly Detection

### Section 2. Anomaly Alerts

### Section 3. Anomaly Whitelisting

> NOTE: Editing and deletion possible.

### Section 4. Anomaly Remediation (?)

> NOTE: Further action to mitigate anomalous transaction if the user wishes?

---

## ===== Article XXX. Savings Goals =====

### Section 1. Savings Goal

### Section 2. Savings Goal Progress

### Section 3. Savings Goal Milestone

---

## ===== Article XXXI. Savings Goal Module =====

### Section 1. Savings Goal Hierarchy

> NOTE: Tackles the savings goals and their order of priority, as set by the user or system.

### Section 2. Savings Goal Strategies

### Section 3. Savings Goal Projection

---

## ===== Article XXXII. Debts =====

### Section 1. Debt

---

## ===== Article XXXIII. Debt Module =====

### Section 1. Debt Hierarchy

### Section 2. Debt Strategies

### Section 3. Debt Projection

### Section 4. Debt Hardship

> NOTE: User will unfortunately have to record the penalty if any. System will suggest outside help at this situation.

---

## ===== Article XXXIV. Reports and Analytics =====

### Section 1. Budget vs. Actual Report

### Section 2. Forecast vs. Actual Comparison

### Section 3. Category Spending Summary

### Section 4. Savings Progress Report

### Section 5. Debt Progress Report

### Section 6. Date Range Filtering

---

## ===== Article XXXV. Notifications Module =====

### Section 1. Notifications

> NOTE: Discuss types of notifications (informational, reminder, warning, alert), structure, etc.

### Section 2. Notification Delivery

### Section 3. Notification Preferences

---

## ===== Article XXXVI. Dashboard Module =====

### Section 1. Dashboard

### Section 2. Key Metrics Cards

### Section 3. Recent Transactions

### Section 4. Forecast Snapshots

### Section 5. Savings and Debt Progress Highlights

---

## ===== Article XXXVII. Settings =====

### Section 1. User Settings

### Section 2. System Settings

### Section 3. Privacy and Consent

### Section 4. FAQ and Problem Reporting

1. The FAQ and Problem Reporting screen shall provide two distinct functions: self‑serve FAQ content and direct problem reporting.

    1.1. The FAQ content shall consist of static in‑app documentation covering common topics such as navigating the app, understanding the financial behavioral profiles, and interpreting forecasts and anomalies.

    1.2. The problem reporting function shall allow the user to submit a report directly from the app without leaving the screen.

2. The problem reporting form shall contain at least the following fields:

    2.1. **Subject.** A concise title for the issue.

    2.2. **Message body.** A free‑text description of the problem, concern, or question.

3. Upon submission, the System shall dispatch the report to the development team via email using a configured SMTP server.

    3.1. The email shall include the user's registered email address as the reply‑to so the team can respond directly.

    3.2. The email shall also include the user's internal user ID for diagnostic context.

    3.3. No full ticketing system, admin dashboard, agent role, or status workflow shall be implemented. The team shall manage incoming reports via their email inbox.

4. *The form shall show a success confirmation after sending and shall handle network or server errors gracefully with a retry option.*

---

## ===== Article XXXVIII. Offboarding =====

### Section 1. User Data Deletion

### Section 2. User Account Deletion

---