# Full Odin App PRD

## Problem Statement

Filipino working young adults aged 20 to 40 in Metro Manila need a *personal finance management* system that reflects how they actually receive, spend, and allocate money, *classifies their financial behavior using Random Forest, forecasts spending using LSTM, detects anomalies using Isolation Forest, and recommends budgets using Linear Programming*. Existing tools are often generic expense trackers: they help record past spending, but they do not adequately support variable income, fixed obligations, family and community contributions, protected expense categories, culturally cyclical spending, savings goals, debt pressure, or forward-looking budget guidance.

The target user needs a mobile-first and web-accessible personal *finance* management system that turns manual transaction logging into useful guidance. The system must help users understand their cash position, classify their financial behavior, forecast likely spending, detect unusual or risky transactions, recommend budget allocations, track savings goals, and manage debt repayment strategies.

The research team also needs the app to support thesis evaluation. Odin must be structured so its user-facing modules, data flows, model outputs, and quality attributes can be tested through functional test cases, model evaluation metrics, ISO 25010 quality characteristics, and SUS-based usability evaluation.

## Solution

Build Odin as a mobile-first personal *finance* management application with web access. The app will provide a guided onboarding flow for Filipino working young adults aged 20 to 40, remain fully operable on mobile screens at 375 dp or less without horizontal scrolling from 320 to 450 dp, use a centered desktop container up to 1200 px, classify users into one of four financial behavioral profiles using a Random Forest classifier, let users manually record income, expenses, transfers, recurring transactions, and transaction templates, organize spending through a PSA PCOICOP-based category hierarchy with Free, Protected, and Locked restriction levels, generate profile-aware budget recommendations via a Linear Programming recommender, show spending forecasts via LSTM, detect anomalous or risky spending behavior via Isolation Forest, track savings goals with Snowball and Avalanche strategies, and guide debt repayment using Avalanche and Snowball strategies.

Odin should behave as a decision-support tool, not a licensed financial adviser. The app should explain recommendations and alerts in plain user-facing language, preserve user control over final decisions, and avoid shaming users for culturally or personally necessary expenses.

Confirmed primary screens (matching Specification v4.0 hierarchy):

1. Registration
   1.1. Onboarding questionnaire
   1.2. Onboarding result and financial behavioral profile assignment
2. Login
3. User Profile
4. Financial Behavioral Profile Overview
   4.1. Profile details
   4.2. Profile reassignment
5. Dashboard
6. Transaction Entry
   6.1. Manual transaction entry
   6.2. Recurring transaction entry
7. Transactions History
8. Budget Overview
   8.1. Budget recommendation
   8.2. Budget categories
9. Forecasting Overview
10. Anomaly Detection Overview
    10.1. Overspending detection
    10.2. Anomaly detection
11. Savings Goals Overview
    11.1. Savings goal hierarchy
12. Debt Overview
    12.1. Debt hierarchy
13. Reports & Analytics
14. Settings
    14.1. User Settings
    14.2. System Settings
    14.3. Help & Problem Reporting
15. Notifications & Alerts

The financial behavioral profile model shall use two binary dimensions, Income Stability and Obligation Level, producing the four fixed profiles Stable-Flexible, Stable-Obligated, Variable-Flexible, and Variable-Obligated. The app shall support manual classification, questionnaire classification, cold-start classification, and standard classification, with periodic reclassification using the same rules and user confirmation before any profile change takes effect.

## User Stories

1. As a new user, I want to create an account, so that my financial records are stored under my own profile.
2. As a returning user, I want to log in securely, so that other people cannot access my financial data.
3. As a privacy-conscious user, I want to understand what data Odin collects before onboarding, so that I can decide whether to proceed.
4. As a first-time user, I want a guided onboarding walkthrough, so that I understand the main features without reading a manual.
5. As a first-time user, I want to enter my employment status and income stability, so that Odin can understand my work context and whether my income is stable or variable.
6. As a first-time user, I want to enter my income frequency, so that Odin can align budgets and forecasts to my real pay cycle.
7. As a first-time user, I want to declare fixed obligations, so that Odin can distinguish unavoidable payments from flexible spending.
8. As a first-time user, I want to declare financial dependents or family support obligations, so that Odin can account for Filipino household responsibilities.
9. As a first-time user, I want to mark important expense categories as protected, so that Odin does not recommend reducing non-negotiable spending.
10. As a first-time user, I want Odin to assign a financial behavioral profile, so that my budget guidance is personalized.
11. As a user, I want to see why I was assigned a profile, so that I can trust the profile result.
12. As a user, I want to override or request a reassessment of my profile, so that the system does not trap me in an inaccurate classification.
13. As a user whose income or obligations change, I want Odin to detect sustained behavior changes, so that my profile can adapt over time.
14. As a user, I want to confirm profile changes before they take effect, so that I retain control over my financial identity in the app.
15. As a user, I want to add an income transaction quickly, so that my available balance stays accurate.
16. As a user, I want to add an expense transaction quickly, so that manual logging is not too much work.
17. As a user, I want to add a transfer transaction, so that moving money between accounts does not distort my income or expense totals.
18. As a user, I want to select a clear expense category when adding a transaction, so that my reports and forecasts are meaningful.
19. As a user, I want category suggestions or smart defaults, so that transaction entry takes less effort.
20. As a user, I want to edit transactions, so that I can correct mistakes after logging.
21. As a user, I want to delete transactions, so that accidental entries do not affect my budget.
22. As a user, I want to search and filter transaction history, so that I can review specific expenses.
23. As a user, I want to view transactions by date range, so that I can inspect weekly, semi-monthly, or monthly behavior.
24. As a user, I want to create recurring income transactions, so that salary or regular income can be logged automatically.
25. As a user, I want to create recurring expense transactions, so that rent, subscriptions, bills, and contributions are not forgotten.
26. As a user, I want reminders for recurring transactions before they post, so that I can prepare for upcoming obligations.
27. As a user, I want to pause or stop recurring transactions, so that the app reflects changes in my real obligations.
28. As a user, I want expense categories that include Filipino-specific obligations, so that family support, paluwagan, community contributions, and government contributions are not hidden under generic labels.
29. As a user, I want categories grouped into broad financial buckets, so that I can understand essentials, obligatory spending, discretionary spending, and financial allocation at a glance.
30. As a user, I want to customize category labels where appropriate, so that the system matches my lived financial language.
31. As a user, I want Odin to prevent category ambiguity where possible, so that I do not abandon logging because categories are confusing.
32. As a user, I want a dashboard showing current balance, budget status, recent transactions, alerts, goals, and forecast highlights, so that I can understand my finances quickly.
33. As a user, I want dashboard cards to focus on the most urgent items, so that I know what needs action today.
34. As a user, I want to see spending by category, so that I can identify where my money is going.
35. As a user, I want to see spending by budget period, so that I can compare actual spending against my plan.
36. As a user, I want to set a budget period, so that my plan matches how I receive and spend money.
37. As a user, I want to set total budget size, so that Odin knows how much money can be allocated.
38. As a user, I want to set per-category allocations, so that my plan has practical spending limits.
39. As a user, I want to mark budget categories as protected, so that Odin respects essential or culturally required expenses.
40. As a user, I want Odin to recommend a budget allocation, so that I have a starting point instead of building a plan from scratch.
41. As a user, I want budget recommendations to use my profile and forecasts, so that they fit my actual income and spending behavior.
42. As a user, I want Odin to explain budget recommendations, so that I understand why money is being allocated a certain way.
43. As a user, I want to accept, modify, or reject budget recommendations, so that I remain in control.
44. As a user, I want surplus handling options, so that leftover budget can be carried forward, reallocated, or saved.
45. As a user, I want deficit warnings, so that I can respond before overspending gets worse.
46. As a user, I want spending forecasts for upcoming periods, so that I can plan before expenses happen.
47. As a user, I want forecasts by category, so that I can prepare for specific spending pressure.
48. As a user, I want total forecast views, so that I can understand the overall direction of my spending.
49. As a user, I want a next-month forecast graph with Essentials, Discretionary, Financial Allocation, and Obligatory lines, so that I can compare upcoming spending pressure across the main budget groups.
50. As a new user, I want a cold-start forecast based on profile and population baselines, so that the app is useful before I have enough personal history.
51. As a user, I want the app to clearly label cold-start forecasts, so that I do not mistake population estimates for personalized predictions.
52. As a user, I want forecasts to account for paydays and calendar cycles, so that normal payday or holiday effects are not treated as surprises.
53. As a user, I want forecasts to improve as I log more transactions, so that the app becomes more personalized over time.
54. As a user, I want alerts when spending is unusually high for a category, so that I can correct behavior early.
55. As a user, I want alerts when I am likely to exceed a budget, so that I can adjust before the period ends.
56. As a user, I want anomaly alerts to explain the reason, so that I know whether the alert is useful.
57. As a user, I want to mark an unusual transaction as intentional, so that the same kind of planned spending is not repeatedly flagged.
58. As a user, I want culturally expected spending events to be handled carefully, so that Christmas, enrollment, family support, paluwagan, or community contributions do not create misleading alerts.
59. As a user, I want alert frequency controls, so that I do not ignore Odin because it notifies me too often.
60. As a user, I want savings goals with target amounts and dates, so that I can track progress toward emergency funds or major purchases.
61. As a user, I want to link contributions to savings goals, so that progress updates automatically.
62. As a user, I want to see whether a savings goal is on track, behind, or achieved, so that I know whether to adjust.
63. As a user, I want projected goal completion dates, so that I understand how current saving behavior affects my timeline.
64. As a user with multiple goals, I want to view my savings goals in a priority table and apply Snowball or Avalanche allocation strategies, so that Odin can recommend contributions in the right order.
65. As a user, I want to create debt accounts, so that I can track repayment obligations separately from ordinary expenses.
66. As a user, I want to enter debt interest rates and minimum payments, so that repayment projections are realistic.
67. As a user, I want to compare Avalanche and Snowball repayment strategies, so that I can choose the strategy that fits my needs.
68. As a user, I want projected payoff dates, so that I know when I may become debt-free.
69. As a user, I want to switch debt payoff strategy, so that I can adjust when my priorities change.
70. As a user, I want reports and analytics by week, month, and custom date range, so that I can review my financial behavior.
71. As a user, I want reports that compare planned budget, actual spending, and forecasted spending, so that I can see whether my plan is realistic.
72. As a user, I want reports on protected categories and obligations, so that I understand how much of my money is non-negotiable.
73. As a user, I want progress reports for savings and debt, so that I can see long-term outcomes.
74. As a user, I want notification preferences, so that I can choose how Odin contacts me.
75. As a user, I want privacy settings, so that I can manage consent and data usage.
76. As a user, I want to export or review my data, so that I retain access to my own financial records.
77. As a user, I want to delete my account and data, so that I can exercise control over sensitive information.
78. As a mobile user, I want transaction entry to work well on a small screen, so that I can log expenses immediately.
79. As a mobile user, I want the dashboard to be glanceable, so that I can check finances quickly.
80. As a mobile user with intermittent connectivity, I want draft or offline-tolerant transaction entry, so that a poor connection does not prevent logging.
81. As a web user, I want wider reports and analytics views, so that I can review finances more comfortably on a larger screen.
82. As a thesis evaluator, I want the app's modules to be testable through functional scenarios, so that the system can be evaluated rigorously.
83. As a thesis evaluator, I want model outputs to be measurable with defined metrics, so that the intelligent modules can be assessed separately from the UI.
84. As a thesis evaluator, I want usability evaluation through SUS, so that user experience can be measured consistently.
85. As a thesis evaluator, I want ISO 25010 quality characteristics mapped to app behavior, so that functional suitability, usability, performance efficiency, security, reliability, and portability can be evaluated.

86. As a user, I want to download and install Odin via Android Package Kit, so that I can run the app on my Android device.
87. As a mobile web visitor, I want to be redirected to the app installation link, so that I can install the native application.
88. As a gig economy worker, I want my employment type recognized during onboarding, so that Odin accurately reflects my work situation.
89. As a user, I want to create pre-filled transaction templates, so that I can log frequent expenses faster without re-entering all fields.
90. As a user, I want to manage financial accounts with individual balances, so that I understand my cash position across wallets and bank accounts.
91. As a user, I want expense items classified under subcategories, categories, and expense groups based on PSA PCOICOP, so that classification follows the Philippine standard.
92. As a user, I want to create custom categories and subcategories assigned to an expense group, so that my tracking matches my personal spending language.
93. As a user, I want each expense item to belong to exactly one expense group via its category chain, so that forecasting and budget classification remain unambiguous.
94. As a user, I want to set restriction levels on categories — Free, Protected, or Locked — so that I control which budgets are flexible and which are fixed.
95. As a user, I want to set floor and ceiling amounts on categories, so that I define minimum and maximum spending per period.
96. As a user, I want to select a named budget strategy (50/30/20 or Savings-First), so that my budget follows a recognized allocation framework.
97. As a user, I want to create a custom budget strategy with my own ratios and hierarchy, so that my budget matches my personal priorities.
98. As a user, I want a budget health indicator, so that I can quickly assess whether my spending is on track for the period.
99. As a user facing budget infeasibility, I want a sensitive explanation and recommended reductions in a defined order, so that protected and essential categories are preserved first.
100. As a new user with no transaction history, I want a cold-start budget recommendation based on my profile, so that the app is useful immediately.
101. As a user, I want to review and act on flagged anomalous transactions, so that I can correct or explain unexpected spending.
102. As a user with debt accounts, I want to declare hardship circumstances, so that the system adjusts projections appropriately.
103. As a user, I want all core features except LSTM forecasting to work offline, so that I can use Odin without a constant internet connection.
104. As a user, I want to export my financial data before deleting my account, so that I retain a copy of my records.
105. As a user, I want a clear account offboarding flow, so that I understand what personal data will be deleted.
106. As a user, I want to sort transaction history, so that I can find records quickly.
107. As a mobile user, I want a simple installation guide from the download link to first successful launch, so that I can set up Odin without guessing the steps.
108. As a user, I want anomaly detection to handle cold-start periods gracefully, so that the app can still flag risky behavior before enough personal history exists.

## Implementation Decisions

- Build Odin as a mobile-first application with web access. Mobile is the primary UX target; web should support the same core workflows with more room for analysis and reporting.
- Core user flows shall work on mobile screens at 375 density-independent pixels or less, and the layout shall adapt to widths between 320 and 450 dp without horizontal scrolling.
- The desktop version shall use a centered container with a maximum width of 1200 pixels.
- The mobile application shall be distributed as an Android Package Kit. The mobile web version shall redirect users to the app installation link.
- The mobile web version shall lead to the Google Play link or installation link for the native application.
- All core features except LSTM-based forecasting shall be available offline. Forecasting requires a server connection because the LSTM model is hosted server-side.
- Treat Filipino working young adults aged 20 to 40 in Metro Manila as the canonical target demographic.
- Onboarding employment status options follow the Specification v4.0 hierarchy: Regular Employees (Full-time, Part-time), Independent Contractors (Self-employed, Freelancer, Business Owner, Entrepreneur), and Fixed-Term and Project Employees (Contractual/project-based, Business owner/entrepreneur, Gig economy worker). Employment type carries less weight in profile classification than transaction-derived features like income sources, income amount, and income frequency.
- Income stability should use only two options for profile classification: Stable and Variable. Mixed income should not be treated as a separate classification value.
- The financial behavioral profile labels are fixed as Stable-Flexible, Stable-Obligated, Variable-Flexible, and Variable-Obligated.
- Profile classification shall support manual selection, questionnaire-based classification, cold-start fallback classification, and standard reclassification.
- Treat the confirmed screens as the first route map for the full app.
- Use a shared domain model across mobile and web so transaction, budget, forecast, profile, alert, savings, and debt concepts do not diverge between platforms.
- Create a financial account structure module. Each user may have multiple financial accounts (wallets, bank accounts, e-wallets). Each account tracks its own balance, supports positive and negative balances, and records the flow of money in and out. The sum of all account balances represents the user's total cash position.
- Transaction templates shall be supported as pre-filled transaction records (income, expense, or transfer) that the user can instantiate for faster repeated logging. Templates may have some or all fields pre-filled.
- Create a transaction ledger module as a deep module. It should expose a simple interface for income, expense, transfer, recurring transactions, templates, edits, deletes, category assignment, and date-range queries while hiding ledger invariants.
- Transaction history shall support searching, sorting, and filtering. Retention shall follow the officially cited guideline used in the thesis; the PRD does not prescribe a duration here.
- Create a category taxonomy module as a deep module. It should define a four-tier hierarchy: Items → Subcategories → Categories → Expense Groups (Essentials, Obligatory, Discretionary, Financial Allocation). Subcategories and categories shall be based on the PSA PCOICOP standard. Filipino-specific categories include family support, remittances, paluwagan, church or religious donations, barangay or community collections, government contributions, debt payments, insurance, emergency fund, savings, and investments.
- Users may create custom categories and subcategories, but must assign them to an existing expense group. Users cannot create custom expense groups.
- Each expense item must fall under exactly one expense group via its category chain. If an item spans multiple groups, the user must split its cost.
- Expense restrictions operate at three levels: Free (user-defined floor and ceiling), Protected (floor is locked, cannot be reduced below a minimum), and Locked (both floor and ceiling are fixed at a set amount). Categories that are sensitive for Filipino users — such as debt repayment, insurance, and emergency fund — default to Protected or Locked.
- Create a financial behavioral profile module as a deep module. It should classify users into one of four profiles, store explanation data, support reassessment, and handle user confirmation before profile changes.
- Create a budget recommendation module as a deep module using a Linear Programming recommender. It should consume current balance, profile, protected categories, goals, obligations, and forecast outputs, then return explainable category allocations.
- Named budget strategies (50/30/20 and Savings-First) shall be provided as configuration presets. Users may also define custom budget strategies with their own allocation ratios, hierarchy, and restriction rules.
- A budget health indicator shall be displayed to show whether the user is overspending, underspending, or on track relative to the current budget period.
- Budget surplus handling shall be supported, and one valid policy may allocate surplus to the highest-priority active savings goal consistent with a zero-based budget approach.
- Budget infeasibility occurs when total budget size exceeds current balance plus foreseeable income. The system shall recommend reductions in a defined order: Discretionary first, then Financial Allocation, then Obligatory. Essential and Protected categories shall not be reduced unless the user explicitly overrides. The system shall communicate infeasibility with sensitivity to avoid causing user distress.
- Cold-start budget recommendations shall be generated from the user's profile and population baselines when no transaction history exists.
- Create a forecasting module as a deep module. It should support cold-start forecasts, personalized forecasts, total forecasts, per-category forecasts, and metadata explaining whether the result is personalized or fallback-based.
- The primary forecast visualization should include a next-month multi-line graph for Essentials, Discretionary, Financial Allocation, and Obligatory spending.
- Create an anomaly and overspending detection module as a deep module using an Isolation Forest detector for statistical anomalies and rule-based logic for overspending. It should detect unusual transaction behavior, budget-risk conditions, culturally expected exceptions, and user-whitelisted intentional outliers. Users may take remedial action on flagged anomalies (e.g., confirming as intentional, correcting the transaction, or adjusting the category).
- Anomaly detection shall support a cold-start mode that still produces useful statistical alerts when personal transaction history is sparse.
- Create a savings goal module as a deep module. It should manage goals, contributions, progress states, prioritization, Snowball and Avalanche allocation strategies, and projected achievement dates.
- The savings goal module should provide a priority setting table that lists all active savings goals with their priority rank, target amount, saved amount, remaining amount, target date, progress state, and selected allocation strategy inputs.
- Each savings goal should be linked to a Financial Allocation subcategory used for contribution transactions, budget allocation, reporting, and forecast aggregation. The savings goal record remains the source of truth for target amount, saved amount, progress state, priority, and strategy logic.
- Savings goal Snowball and Avalanche should follow the same allocation principles as the debt module. Snowball prioritizes the savings goal with the smallest remaining amount first. Avalanche prioritizes the highest-ranked or highest-impact savings goal first according to the goal ranking field defined in the system specification.
- When a budget strategy includes a Financial Allocation portion, such as the 20 percent in a 50/30/20 budget, Odin should distribute that portion across active savings goals according to the selected savings goal allocation strategy.
- Create a debt management module as a deep module. It should manage debt accounts and compute Avalanche and Snowball repayment projections. Debt hardship circumstances shall be supported, allowing users to declare temporary difficulty meeting minimum payments for adjusted projections.
- Debt repayment projections should be generated on demand when the user opens the debt strategy or projection screen and no current projection exists, switches payoff strategy, changes extra payment amount, edits a debt account balance, interest rate, or minimum payment, records a debt payment that changes the current balance, or when a report or dashboard needs debt progress and the existing projection is stale.
- Create an alerts and notifications module as a deep module. It should centralize alert generation, acknowledgement, notification preferences, cooldown behavior, and alert fatigue controls.
- Create a reporting module as a deep module. It should produce date-range summaries, category breakdowns, budget-vs-actual reports, forecast-vs-actual comparisons, savings progress, debt progress, and obligation/protected-category summaries.
- Profile classification, forecasting, anomaly detection, and recommendation outputs must include explanation fields suitable for user-facing display.
- The data model must store detailed raw transactions first, then derive model-specific datasets from raw transaction history.
- Broad forecast categories should include Essentials, Obligatory, Discretionary, and Financial Allocation.
- Detailed categories should support Filipino-context categories, including family support, remittances, paluwagan, church or religious donations, barangay or community collections, government contributions, debt payments, insurance, emergency fund, savings, and investments.
- Protected categories must be supported. Defaults should include essentials, debt and loan repayments, insurance, and emergency fund contributions, while allowing user-declared protected categories.
- Budget recommendation must not suggest reducing protected categories unless the user explicitly changes protection settings.
- The app must distinguish advisory guidance from financial advice through clear in-app disclaimers.
- No bank or e-wallet integration will be required for the first full-app PRD. All transaction capture is manual or recurring-template based.
- No OCR receipt scanning will be required for the first full-app PRD.
- No investment portfolio tracking will be required for the first full-app PRD.
- No multi-currency support will be required for the first full-app PRD.
- Authentication, consent, account management, and privacy controls are part of the app, even though they are not the thesis's main research contribution.
- The system should support RA 10173-aligned privacy expectations: consent, data minimization, secure handling, access, correction, and deletion.
- Offboarding shall provide a clear flow for data export and account deletion. Users shall be informed exactly what data will be deleted and what (if anything) will be retained.
- The implementation should preserve separation between user-facing UI, domain logic, persistence, and model-serving boundaries.
- The model architecture is definitive per Specification v4.0: Random Forest for financial behavioral profile classification, LSTM for spending forecasting, Isolation Forest for anomaly detection, and Linear Programming for budget recommendation. All four algorithms are in scope.

## Testing Decisions

- Tests should verify external behavior and user-visible outcomes, not internal implementation details.
- Transaction history tests should cover retention policy presence and the expected handling of retained records according to the thesis guideline.
- Transaction ledger tests should cover creating, editing, deleting, filtering, recurring generation, transfer handling, and balance effects.
- Category taxonomy tests should cover the four-tier hierarchy (Items → Subcategories → Categories → Expense Groups), PSA PCOICOP mappings, custom categories, expense group exclusivity, Free/Protected/Locked restriction levels, protected-category defaults, Filipino-context categories, and category validation.
- Profile module tests should cover the four fixed profile labels, initial classification, explanation generation, manual classification, questionnaire classification, cold-start classification, standard reclassification, periodic reclassification triggers, and user confirmation behavior.
- Budget recommendation tests should cover protected categories, profile-specific allocations, named budget strategies (50/30/20, Savings-First), custom strategies, surplus behavior, deficit behavior, infeasibility handling, budget health indicator, cold-start recommendations, recommendation explanations, and user overrides.
- Forecasting tests should cover cold-start fallback, personalized-forecast availability, forecast metadata, per-category outputs, total outputs, and forecast consumption by dashboard and budget modules.
- Forecasting UI tests should verify that the next-month graph renders all four broad-category lines and remains readable on mobile.
- Anomaly detection tests should cover high category deviation, high income-ratio spending, recurring-payment suppression, user whitelisting, culturally expected exception behavior, and alert explanation output.
- Anomaly detection tests should also cover cold-start behavior when history is sparse.
- Savings goal tests should cover goal creation, linked Financial Allocation subcategories, contribution recording, priority table behavior, progress states, target-date projections, Snowball allocation order, Avalanche allocation order, prioritization, and completion behavior.
- Debt management tests should cover debt account creation, minimum payments, Avalanche order, Snowball order, projected payoff dates, and strategy switching.
- Alerts tests should cover alert creation, acknowledgement, cooldowns, notification preferences, grouped alerts, and suppression rules.
- Reporting tests should cover budget-vs-actual, forecast-vs-actual, category summaries, date filters, savings progress, and debt progress.
- Authentication and privacy tests should cover login, logout, protected routes, consent state, account deletion flow, and sensitive-data access rules.
- Mobile-first UI tests should cover core workflows on narrow viewports: onboarding, add transaction, dashboard, budget recommendation, forecast, alerts, savings, debt, and settings.
- Mobile-first UI tests should verify operation at 375 dp and below, and no horizontal scrolling across 320 to 450 dp widths.
- Desktop UI tests should verify the centered container and 1200 px maximum width.
- Web UI tests should cover dashboard, reports, transactions, budget, forecast, savings, debt, and settings on larger viewports.
- Installation tests should verify that the mobile web path leads users to the installation link and that the onboarding path gets a user from download to first launch.
- Integration tests should cover the main data flow: onboarding to profile, profile to transaction logging, transactions to forecasts, forecasts to budget recommendation, transactions to anomaly alerts, and alerts to user feedback.
- Model evaluation should be separate from UI tests. Profile classification (Random Forest) should be evaluated using classification metrics (accuracy ≥ 0.85 target). Forecasting (LSTM) should be evaluated using time-series-appropriate metrics such as sMAPE (< 25% / 30% per category target), MAE, and RMSE. Anomaly detection (Isolation Forest) should be evaluated using precision, recall, and F1-score (≥ 0.675 target). Budget recommendation (Linear Programming) should be evaluated using budget adherence (≥ 70% target).
- Usability evaluation should use SUS for the complete user-facing app.
- Software quality evaluation should map ISO 25010 characteristics to concrete testable criteria.

## Out of Scope

- Bank API integration.
- E-wallet API integration.
- OCR or receipt scanning.
- Automatic transaction import.
- External CSV or spreadsheet transaction import.
- Investment portfolio management.
- Multi-currency support.
- Licensed financial advice, investment advice, retirement planning, or legal/tax advice.
- Automated bill payment.
- Credit score monitoring.
- Tax computation or tax preparation.
- Dedicated paluwagan module.
- Credit card account management.
- Compound interest modeling for revolving debt.
- Users outside the Filipino working young adult target demographic aged 20 to 40.
- Geographic generalization beyond Metro Manila for the thesis scope.
- Full production-grade fraud detection.
- Merchant-level enrichment from third-party providers.
- Social or gamified features unless separately approved.
- Admin dashboards for banks, institutions, or financial advisers.
- Public marketplace deployment requirements beyond what is needed for thesis evaluation.

## Further Notes

- The PRD is based on the full-app scope confirmed by the repository materials and the accepted screen list.
- The app should be framed as a personal budget management system and decision-support tool.
- The strongest product thesis is that Odin is not merely a tracker: it turns consistent manual logging into forecasted, profile-aware, culturally grounded budget guidance.
- The algorithm scope is settled per Specification v4.0: Random Forest for profile classification, LSTM for forecasting, Isolation Forest for anomaly detection, and Linear Programming for budget recommendation.
- The strongest UX risk is manual logging fatigue. The app must make transaction entry fast, visible, and rewarding through immediate dashboard, forecast, alert, and recommendation value.
- The strongest trust risk is sensitive financial data. The app must explain data usage, protect data, and make intelligent outputs understandable.
