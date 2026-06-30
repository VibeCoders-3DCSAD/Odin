# Development of Odin: A Personal Finance Management System for Filipino Working Young Adults Using Random Forest, LSTM, and Isolation Forest

---

**Document Type:** Technical Specification

**Version:** 4.0

**Date:** 2026-06-13

**Authors:**
- Gabion, Stefanie S.
- Guevarra, Joaquin Luis T.
- San Jose, Alexa Joanne Paula G.
- Togle, Charles Nathaniel B.

**Course Adviser:** Prof. Era Marie Gannaban

**Technical Adviser:** Prof. Christian Michael Mansueto

**Panels:**
- Prof. Daniel Dellosa (Chair)
- Prof. Jomariss Plan
- Prof. Janice Congzon

**Institutional Affiliation:** College of Computing and Information Sciences, University of Makati

---

# Notes

1. All *italicized statements* (including their subsections) are suggestions that may be modified with justification.

2. Article flow is hierarchical; if a system module, component, or general feature has dependencies, all of those must be discussed fully and completely first before it.

   2.1. The discussion of said dependencies must be as close to the dependent module as possible. For example, three dependency features for dependent feature A must be discussed in order of Article I, II, III (dependencies), then IV (dependent). Feature B whose dependencies are not the exact same must not be Article IV.

3. A system feature or topic merits its own article if it is depended upon by at least two other features or topics. If a feature is used by only one other feature or is self‑contained, it shall be described within that dependent feature's article as a section.

4. Cross‑cutting dependencies, or dependencies with two or more dependents, provided that they qualify as articles, shall be defined in dedicated articles before any module that uses them. These articles appear in order of conceptual dependency (e.g. User → Account → Transaction → Category).

---

# SYSTEM SPECIFICATION

---

## ===== Article I. Interface =====

### Section 1. Platform

1. The System shall be implemented as a mobile‑first application.

    1.1. *All core user flows must be fully operable on a mobile screen width of 375 density‑independent pixels or less.*

    1.2. *The layout shall adapt to any width between 320 and 450 dp without requiring horizontal scrolling.*

    > NOTE: The LSTM model is hosted on the server. Therefore, all processes except for the forecasting module shall be available offline.

2. A desktop web version shall also be provided.

    2.1. The desktop version shall use a centered container with a maximum width of 1200 pixels.

    2.2. The desktop version may use multi‑column layouts where appropriate.

    2.3. Web screens shall support the same core workflows as mobile, with more room for analysis and reporting.

3. *The mobile web version should lead to the Google Play link or installation link of the mobile application.*

### Section 2. Screens

1. The System shall implement the following primary screens:

    1.1. Registration

        1.1.1. Onboarding Questionnaire

        1.1.2. Onboarding Result and Financial Behavioral Profile Assignment

    1.2. Login

    1.3. User Profile

    1.4. Financial Behavioral Profile Overview

        1.4.1. Financial Behavioral Profile

        1.4.1. Profile Reassignment

    1.5. Dashboard

    1.6. Transaction Entry

        1.6.1. Manual Transaction Entry

        1.6.2. Recurring Transaction Entry

    1.7. Transactions History

    1.8. Budget Overview

        1.8.1. Budget Recommendation

        1.8.2. Budget Categories

    1.9. Forecasting Overview

    1.10. Anomaly Detection Overview

        1.10.1. Overspending Detection

        1.10.2. Anomaly Detection 

    1.11. Savings Goals Overview

        1.11.1. Savings Goal Hierarchy

    1.12. Debt Overview

        1.12.1. Debt Hierarchy

    1.13. Reports & Analytics

    1.14. Settings

        1.14.1. User Settings

        1.14.2. System Settings

        1.14.3. Help & Problem Reporting

    1.15. Notifications & Alerts

---

## ===== Article II. Users =====

### Section 1. Target Users

1. The System is designed exclusively for the following users.

    1.1. Demographic requirement. The user shall be a Filipino working young adult aged twenty to forty years inclusive.

    1.2. Geographic requirement. The user shall live or work in Metro Manila, covering any of its sixteen cities and one municipality.

    1.3. Employment requirement. The user shall *classify their primary employment in* any of the following capacities:

        1.3.1 Regular Employees. This employment type is entitled to security of tenure, and usually entitled to statutory benefits (SSS, PhilHealth, Pag-IBIG, 13th month pay) on a pro-rata basis. This employment type supports the Stable income dimension.

            1.3.1.1. Full‑time Employee

            1.3.1.2. Part‑time Employee

        1.3.2. Independent Contractors. This employment type has variable security of tenure, and usually no employer-employee relationship. The individuals are responsible for their own taxes and governmental contributions as voluntary members. This employment type supports the Variable income dimension.

            1.3.2.1. Self‑employed Individual
            
            1.3.2.2. Freelancer
            
            1.3.2.3. Business Owner

            1.3.2.4. Entrepreneur

        1.3.3. Fixed-Term and Project Employees. This employment type has variable or low security of tenure. The individuals are employed only for the length of their contractual obligations (project completion dates, termination dates). This employment type supports the Variable income dimension.

            1.3.4. Contractual/project‑based employee or similar

            1.3.5. Business owner/entrepreneur

            1.3.6. Gig economy worker

    > NOTE: Primary employment is emphasized since the user can have more than one job (side hustles, freelancing). In the financial behavioral profile classification module, employment shall not bear more influence than other more appropriate features like income sources, income amount, income frequency, etc., which better defines the user's income stability.

    > NOTE: The "This employment type supports..." parts could probably be moved to the Financial Behavioral Profile Article/Section.

    > Employment classifications are based on the Department of Labor and Employment's own standards (Labor Code of the Philippines).

---

## ===== Article III. App Installation =====

### Section 1. Installation Site

1. *The System shall be distributed as a mobile‑first application for Android devices via an Android Package Kit.*

2. *The desktop web version shall be accessible via a standard web browser at a domain designated accordingly.*

### Section 2. Installation Guide

> NOTE: Add installation guide for the user starting from installation site all the way to working mobile app.

---

## ===== Article IV. Financial Behavioral Profile Structure =====

### Section 1. Financial Behavioral Dimensions

1. There are two binary dimensions that define the four financial behavioral profiles: **Income Stability** and **Obligation Level**.

2. Income stability is the capacity of the user's inflow to maintain a stable amount and frequency in regular intervals.

3. Depending on the user's income stability, they can be classified as either **Stable** or **Variable**.
    
4. Income stability shall be derived initially from the user’s *employment status and income variability as declared during onboarding*.

    4.1. Afterwards, income stability shall be derived from the user's actual transaction history.

5. Obligation level is the proportion of the user's necessary expenses (sum of Essential and Obligatory expenses; see Article X) and their total expenses.

6. Depending on the user's obligation level, they can be classified as either **Flexible** or **Obligated**.

7. Obligation level shall be derived from *declared fixed obligations, dependents, debt payments, and protected expenses as declared during onboarding*.

    7.1. Afterwards, obligation level shall be derived from the user's actual transaction history.

### Section 2. Financial Behavioral Profile

1. The financial behavioral profiles are derived from a combination of the user's income stability and obligation ratio.

2. The four financial behavioral profiles are:

    2.1. **Stable‑Flexible**

    2.2. **Stable‑Obligated**

    2.3. **Variable‑Flexible**

    2.4. **Variable‑Obligated**

---

## ===== Article V. Random Forest Classifier =====

### Section 1. Details

> NOTE: Should discuss prior things like training, design, architecture, etc., preferably as sections.

### Section 2. Input

### Section 3. Process

### Section 4. Output

### Section 5. Details

> NOTE: Should discuss posterior things like algorithm evaluation, explainability, fallback, etc., preferably as sections.

---

## ===== Article VI. Financial Behavioral Profile Classification Process =====

> NOTE: Autonomous reclassification shall simply follow the processes of the respective classification.

> NOTE: Outline the process of executing the Random Forest classification model, namely its input phase, process phase, and output phase. 

### Section 1. Manual Classification

> NOTE: Manual classification is when the user opts to select their profile instead of having the system assign it for them. This is when they have rejected their assigned profile during onboarding, or when they wish to change their profile via selection instead of retaking the questionnaire.

### Section 2. Questionnaire Classification

> NOTE: Questionnaire is different from the other classification processes, since the user invokes it during their registration or when they want to change their profile via the questionnaire.

### Section 3. Cold Start Classification

> NOTE: Cold start classification is when the system is due for its periodic reclassification check, but the user does not have sufficient transactions for the system to perform the standard classification.

### Section 4. Standard Classification

> NOTE: The basic classification process we know and love.

---

## ===== Article VII. Financial Behavioral Profile Module =====

### Section 1. Onboarding Questionnaire

### Section 2. Onboarding Results

### Section 3. Profile Classification

### Section 4. User Profile Creation

### Section 5. Periodic Reclassification Check

> NOTE: Every set length of days, the system runs the classifier 

---

## ===== Article VIII. User Profile Module =====

### Section 1. User Profile

### Section 2. User Profile Settings

> NOTE: Should atleast cover user data export and toggling of opt-in for model training.

---

## ===== Article IX. Financial Account Structure =====

> NOTE: Need to consider: what if the user withdrew money from their savings, funds, or somewhere from their financial allocation group? Do we explain that it should be logged as a normal income transaction, or should we create a special process for it?

### Section 1. Financial Account

### Section 2. Financial Account Balance

> NOTE: Should tackle negative balance too.

### Section 3. Financial Account Flow

---

## ===== Article X. Transaction Structure =====

### Section 1. Transaction

> NOTE: Should cover the transaction types. For recurring transactions, should cover patterns.

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

## ===== Article XI. Expense Structure =====

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

## ===== Article XII. Transaction Entry Module =====

### Section 1. Manual Transaction Entry

### Section 2. Recurring Transaction Entry

### Section 3. Transaction Suggestions

> NOTE: Should discuss ease of use by displaying frequent income/expense details (and expense categories).

---

## ===== Article XIII. Transaction History Module =====

### Section 1. Transaction Records

### Section 2. Transaction Records Searching Operations

> NOTE: Includes searching, sorting, and filtering.

### Section 3. Transaction Editing & Deletion

> NOTE: Idk if it's more appropriate to discuss this topic here or in the intelligent modules that are affected by it, like the forecasting module. Or maybe an exact "Transaction Editing & Deletion" section in those modules as well?

### Section 2. Transaction Record Retention

> NOTE: The retention limit must be validated official guidelines, like from the BSP.
---

## ===== Article XIV. Budget Structure =====

### Section 1. Budget

### Section 2. Budget Size

### Section 3. Budget Period

### Section 4. Budget Allocations

### Section 5. Budget Constraints

> NOTE: Should discuss floors and ceilings.

### Section 6. Budget Feasibility

---

## ===== Article XV. Budget Strategy Structure =====

### Section 1. Budget Strategy

> NOTE: Should discuss the components of a budget strategy, like hierarchy and stuff. Here's what I'm thinking. The given budget strategies (e.g. 50/30/20) need to be distilled into a set of configurations, such that the user, with the custom budget strategy feature, can replicate the given budget strategies.
> There needs to be a restriction configuration (for the 50% needs portion of 50/30/20 that cannot be reduced, for example). There also needs to be a hierarchy configuration, for the order of allocation.
> We can brainstorm

> NOTE: The given budget strategies should be sourced from those mentioned in the RRL.

### Section 2. 50/30/20 Strategy

### Section 3. Savings-First Strategy

---

## ===== Article XV. Linear Programming Recommender =====

### Section 1. Details

> NOTE: Should discuss prior things like training, design, architecture, etc., preferably as sections.

### Section 2. Input

### Section 3. Process

### Section 4. Output

### Section 6. Details

> NOTE: Should discuss posterior things like algorithm evaluation, explainability, fallback, etc., preferably as sections.

> NOTE: Maybe move all expainability sections/subsections of algorithm articles to their process articles isntead.

## ===== Article XVI. Budget Recommendation Process =====

### Section 1. Cold-Start Budget Recommendation

> NOTE: Can cold-start budget recommendations be affected by budget infeasibility? 

### Section 2. Standard Budget Recommendation

### Section 3. Budget Infeasibility & Reduction

> NOTE: This section is for when budget size exceeds current balance plus foreseeable income streams. Discuss which allocations are reduced; in what order, and by how much per. Also need to discuss what to do when, after all legal reductions are performed, the budget is still infeasible. It may be important to consider not to tell the user outright that they don't have enough money for the budget period, as that can invoke panic and despair. This is an unfortunate occurence that is a reality to some Filipinos today, so our system must also be sensitive aside from being intelligent and ethical.

---

## ===== Article XVII. Budgeting Module =====

### Section 1. Budget Recommendation

### Section 2. Budget Health

> NOTE: Should include a health indicator and prescribed vs. actual tracker

### Section 3. Budget Surplus and Deficit

> NOTE: Should discuss the actions done after observing budget surplus or deficit at the end of the budget period. Not sure whether it's appropriate to discuss it in this article or somewhere else.

> NOTE: Should also discuss Budget Surplus Strategies (e.g., move surplus to balance or savings goal?)

> NOTE: We can justify allotting surplus to the currently most prioritized savings goal, justified by the Zero-Based Budget Strategy.

> NOTE: We also have to consider, what if the user does not have any savings goals at all?

### Section 4. Budget Editing (and Deletion?)

---

## ===== Article XVIII. Forecast Structure =====

### Section 1. Forecast Targets

### Section 2. Forecast Horizons

### Section 3. Forecast Granularities

---

## ===== Article XIX. Long Short-Term Memory Forecaster =====

### Section 1. Details

> NOTE: Should discuss prior things like training, design, architecture, etc., preferably as sections.

### Section 2. Input

### Section 3. Process

### Section 4. Output

### Section 6. Details

> NOTE: Should discuss posterior things like algorithm evaluation, explainability, fallback, etc., preferably as sections.

---

## ===== Article XX. Forecasting Process =====

### Section 1. Cold-Start Aggregated Forecasting

### Section 2. Cold-Start Per-Category Forecasting

### Section 3. Standard Aggregated Forecasting

### Section 4. Standard Per-Category Forecasting

---

## ===== Article XXI. Forecast Module

### Section 1. Forecast

---

## ===== Article XXI. Anomaly Structure =====

### Section 1. Overspending Anomalies

### Section 2. Statistical Anomalies

### Section 3. Exclusions

### Section 4. Whitelist

---

## ===== Article XXII. Isolation Forest Anomaly Detector =====

### Section 1. Details

> NOTE: Should discuss prior things like training, design, architecture, etc., preferably as sections.

### Section 2. Input

### Section 3. Process

### Section 4. Output

### Section 6. Details

> NOTE: Should discuss posterior things like algorithm evaluation, explainability, fallback, etc., preferably as sections.

---

## ===== Article XXIII. Anomaly Detection Process

### Section 1. Cold-Start Statistical Anomaly Detection

### Section 2. Standard Statistical Anomaly Detection

### Section 3. Standard Overspending Anomaly Detection

---

## ===== Article XXIV. Anomaly Detection Module =====

### Section 1. Anomaly Detection

### Section 2. Anomaly Alerts

### Section 3. Anomaly Whitelisting

### Section 4. Anomaly Remediation (?)

> NOTE: Further action to mitigate anomalous transaction if the user wishes?

---

## ===== Article XXV. Savings Goal Structure =====

### Section 1. Savings Goal

### Section 2. Savings Goal Progress

---

## ===== Article XXVI. Savings Goal Module =====

### Section 1. Savings Goal Hierarchy

> NOTE: Tackles the savings goals and their order of priority, as set by the user or system.

### Section 2. Savings Goal Strategies

### Section 3. Savings Goal Projection

---

## ===== Article XXVII. Debt Structure =====

### Section 1. Debt

---

## ===== Article XXVIII. Debt Module =====

### Section 1. Debt Hierarchy

### Section 2. Debt Strategies

### Section 3. Debt Projection

### Section 4. Debt Hardship

---

## ===== Article XXIX. Reports and Analytics =====

### Section 1. Budget vs. Actual Report

### Section 2. Forecast vs. Actual Comparison

### Section 3. Category Spending Summary

### Section 4. Savings Progress Report

### Section 5. Debt Progress Report

### Section 6. Date Range Filtering

---

## ===== Article XXX. Notifications Module =====

### Section 1. Notifications

> NOTE: Discuss types of notifications (informational, reminder, warning, alert), structure, etc.

### Section 2. Notification Delivery

### Section 3. Notification Preferences

---

## ===== Article XXXI. Dashboard Module =====

### Section 1. Dashboard

### Section 2. Key Metrics Cards

### Section 3. Recent Transactions

### Section 4. Forecast Snapshots

### Section 5. Savings and Debt Progress Highlights

---

## ===== Article XXXII. Settings =====

### Section 1. User Settings

### Section 2. System Settings

### Section 3. Privacy and Consent

### Section 4. Help and Problem Reporting

1. The Help and Problem Reporting screen shall provide two distinct functions: self‑serve help content and direct problem reporting.

    1.1. The help content shall consist of static in‑app documentation covering common topics such as navigating the app, understanding the financial behavioral profiles, and interpreting forecasts and anomalies.

    1.2. The problem reporting function shall allow the user to submit a report directly from the app without leaving the screen.

2. The problem reporting form shall contain at least the following fields:

    2.1. **Subject.** A concise title for the issue.

    2.2. **Message body.** A free‑text description of the problem, concern, or question.

    2.3. *Optional file attachment. This may be omitted in the initial implementation and added later.*

3. Upon submission, the System shall dispatch the report to the development team via email using the already‑configured SMTP server.

    3.1. The email shall include the user's registered email address as the reply‑to so the team can respond directly.

    3.2. The email shall also include the user's internal user ID for diagnostic context.

    3.3. No full ticketing system, admin dashboard, agent role, or status workflow shall be implemented. The team shall manage incoming reports via their email inbox.

4. *The form shall show a success confirmation after sending and shall handle network or server errors gracefully with a retry option.*

## ===== Article XXXIII. Offboarding =====

### Section 1. User Data Deletion

### Section 2. User Account Deletion

---

# PAPER SPECIFICATION

---

## Article I: Introduction Section

### Section 1. Background

1. The Background subsection shall contain at least the following elements.

    1.1. Domain context. Overview of personal finance management in the Philippines, including prevalence of financial distress among young adults (cite BSP CFS 2021, PSA data).

    1.2. Problem space. Discussion of budgeting, saving, and debt management challenges specific to Metro Manila working young adults (age 20‑40).

    1.3. Existing solutions. Survey of existing PFM apps (both international and local) and their limitations for Filipino users.

2. Length requirement. Minimum 500 words, maximum 1000 words.

### Section 2. Problem Statement

1. The Problem subsection shall be structured as follows.

    1.1. General problem. A single sentence stating the overarching problem the System addresses.

        1.1.1. Example: "Filipino working young adults lack access to a personal finance management system that adapts to their variable income patterns, cultural spending norms, and behavioral profiles."

    1.2. Specific problems. Enumerated list (3‑5 items) of sub‑problems, each mapped to a system module.

### Section 3. Objectives.

1. General objective. "To design, implement, and evaluate Odin, a personal finance management system for Filipino working young adults in Metro Manila using Random Forest, LSTM, and Isolation Forest algorithms."

2. Specific objectives. Enumerated list (5‑8 items), each corresponding to a system module or evaluation activity.

    2.1. Each objective must be verifiable and mapped to a metric in Article XIII of the System Specification.

### Section 4. Significance.

1. The Significance subsection shall list primary and secondary beneficiaries.

    1.1. Primary beneficiaries. Filipino working young adults (age 20‑40, Metro Manila).

    1.2. Secondary beneficiaries.

        1.2.1. Researchers in financial technology for developing economies.
        
        1.2.2. PFM app developers targeting Southeast Asian markets.
        
        1.2.3. Policymakers interested in financial inclusion metrics.

### Section 5. Scope and Delimitations.

1. Scope (inclusions). Reference Article XV of the System Specification but restate in prose.

2. Delimitations (exclusions). Reference Article XV exclusions of the System Specification.

### Section 6. Definition of Terms.

1. Reproduce the terms from Article XVI of the System Specification that appear in the paper.

---

## Article II: Review of Related Literature (RRL) Topics

### Section 1. Topic Organization.

1. The RRL chapter shall be organized into exactly 12 topics as listed below.

2. For each topic, the paper shall contain:

    2.1. A minimum of 10 peer‑reviewed citations (except where local data is scarce, in which case government reports and conference proceedings are acceptable).

> NOTE: The minimum are actually as follows:
> Local studies: Philippines-based, does NOT discuss or utilize algorithms or models; at least 25 total.
> International studies: NOT Philippines-based, does NOT discuss or utilize algorithms or models; at least 25 total.
> Algorithm-specific:
    > Random Forest: At least 10 each for local and int'l; 20 total.
    > LSTM: At least 10 each for local and int'l; 20 total.
    > Isolation Forest: At least 10 each for local and int'l; 20 total.
    > Linear Programming: ACTUALLY this is debatable; does not technically classify as a computer algorithm or model, technically mathematical; can be classified as rule-based though; Can instead research rule-based budget recom. algos.; at least 10 each for local and int'l; 20 total.

    2.2. A synthesis paragraph that identifies gaps that Odin addresses.

    2.3. A table or figure summarizing key findings (where appropriate).

### Section 2. The Twelve Topics.

1. Topic 1. Filipino Working Young Adults and the Financial Problem.

2. Topic 2. Filipino Cultural Context in Personal Finance.

3. Topic 3. Expense Categorization in Personal Finance Systems.

4. Topic 4. Existing Personal Finance and Budget Management Systems.

5. Topic 5. Financial Behavioral Profiling.

6. Topic 6. Spending Forecasting.

7. Topic 7. Budget Recommendation.

8. Topic 8. Anomalous Spending Detection.

9. Topic 9. Mobile‑First Design.

10. Topic 10. Data Privacy, Security, and User Trust.

11. Topic 11. User Retention and Engagement.

12. Topic 12. System Evaluation.

---

## Article III: Research Methodology

### Section 1. Research Paradigm.

1. The study shall adopt a pragmatist paradigm (mixed methods) combining quantitative (ML metrics, SUS) and qualitative (thematic analysis of feedback).

### Section 2. Research Design.

1. The research design shall be developmental, with the following phases.

    1.1. Requirements analysis.

    1.2. Synthetic data generation.

    1.3. Algorithm prototyping.

    1.4. System development (Agile, 2‑week sprints).

    1.5. Internal testing.

    1.6. User evaluation.

### Section 3. Agile Development Methodology.

1. The team shall use Scrum with 2‑week sprints.

> NOTE: No. Just normal agile.

### Section 4. Evaluation Design.

1. ISO 25010 shall be operationalized via test cases.

2. SUS shall be administered after 14 days of use.

3. ML metrics shall be computed via Python on synthetic data.

### Section 5. Data Collection for ML Training.

1. Primary data source. Synthetic data from BSP CFS 2021 and PSA FIES 2018.

2. Secondary data source (optional). Pre‑survey of 50‑100 Filipino working young adults.

3. Tertiary data source (pilot). Up to 10 pilot users with consent, used only for final inference evaluation, not training.

### Section 6. Ethical Considerations.

1. The following ethical requirements shall be met.

    1.1. Informed consent obtained from all participants.

    1.2. Compliance with RA 10173 (Data Privacy Act).

    1.3. Anonymization of user data as specified in System Specification Article XIV.

    1.4. Ethics clearance from UMak Research Ethics Committee.

    1.5. App disclaimer displayed on first launch.

---

> NOTE: There's no Chapter 4 and 5.

## Article IV: Expected Outcomes and Contribution

1. The thesis shall produce the following outputs.

    1.1. Functional Odin application.

    1.2. Random Forest classifier (accuracy ≥ 0.85).

    1.3. LSTM forecasting model (sMAPE < 25% / 30% as per category).

    1.4. Isolation Forest anomaly detector (F1 ≥ 0.675).

    1.5. LP‑based budget recommendation (adherence ≥ 70%).

    1.6. Thesis manuscript.

    1.7. Public GitHub repository.

---

## Article V: Thesis Timeline

1. The following milestones and durations shall be used.

Milestone	Duration
RRL completion (12 pillars)	8 weeks
Synthetic data generation	2 weeks
Algorithm prototyping	4 weeks
System development (4 sprints)	8 weeks
Internal testing	2 weeks
User evaluation (SUS + ML metrics)	3 weeks
Thesis writing and revision	6 weeks
Final defense preparation	2 weeks

2. A Gantt chart shall be included in the final paper.

---

---

## Article VII: References Style

1. References shall follow APA 7th edition.

2. Minimum 60 references, of which at least 40 shall be peer‑reviewed journal articles or conference proceedings.

> NOTE: Update the references minimum.

---

## Article VIII: Appendices Required

1. The following appendices shall be included.

Appendix	Content
A	Onboarding questionnaire
B	SUS survey form
C	User consent form (English and Tagalog)
D	Synthetic data generation code (Python)
E	Hyperparameter tuning grids
F	Walk‑forward validation results (tables)
G	System architecture diagram
H	Database schema
I	User manual
