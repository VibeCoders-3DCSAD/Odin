# Odin Module Gap Report

Source requirements: `odin/docs/requirements-engineering/feature-modules.md`

Scope:

- 1. User Authentication
- 2. Onboarding Questionnaire
- 3. Dashboard, partial
- 4. Financial Accounts
- 5. Income Sources
- 6. Budgeting Module, except optimizer
- 7. Debt Management, partial
- 9. Settings Module, partial
- 10. Categories and Restrictions Module
- 11. Financial Obligations Module, partial
- 12. Transaction Management Module, except savings/obligation linked flows
- 16. Offline Sync and Recovery Module

Overall read: Odin has solid local-first foundations for accounts, income, categories, transactions, budgets, debt, obligations, and sync. The biggest gap is that many finance modules are implemented as local UI plus SQLite plus sync queue support, not as complete product flows with every required state and page. Several dashboard, settings, help, and intelligence pages are still placeholders.

## 1. User Authentication

Status: Mostly implemented.

Implemented:

- Email/password registration, login, password reset, password update, logout, and session bootstrap exist in `apps/api/src/routes/auth.ts`.
- Google auth backend route exists in `apps/api/src/routes/auth.ts`.
- Native Google sign-in path exists in `apps/app/App.native.tsx`.
- Auth UI validation, password rules, field errors, and online guards exist in `apps/app/components/AuthExperience.tsx`.

Partiality and inconsistencies:

- `apps/app/App.tsx` passes `google={{}}`, so the web/default path has no real Google sign-in integration while native does.
- Email verification deep link is treated as a success UI state, but there is no app API route that completes or validates email verification.
- Backend password validation is weaker than frontend validation. Frontend enforces length, uppercase, lowercase, number, and symbol; API only checks that password is non-empty before calling Supabase.
- Auth states are collapsed into generic notices rather than distinct UI states for rate limit, account exists, email unverified, and session expired.

Not implemented submodules/pages:

- Dedicated email verification pending/resend screen.
- Dedicated session-expired recovery screen.

## 2. Onboarding Questionnaire

Status: Partially implemented.

Implemented:

- Guided multi-step onboarding flow exists in `apps/app/features/onboarding/OnboardingFlow.tsx`.
- Save/resume through onboarding sessions exists in `apps/api/src/routes/onboarding.ts`.
- Review step before submission exists in `OnboardingFlow.tsx`.
- Backend session ownership checks exist in `onboarding.ts`.

Partiality and inconsistencies:

- Requirements include multiple-answer, single-answer, text, numeric, date or age, employment, and location inputs. Current steps cover employment and date, but do not include a dedicated location selector beyond Metro Manila presence.
- Required-answer validation exists mostly as step-complete checks, not question-level validation feedback beside each affected question.
- Backend validates selected fields only on submit; raw answers can be saved with arbitrary keys and types before submission.
- Financial profile result exists, but accept, reject, manual change, and reassessment flows are not visible.

Not implemented submodules/pages:

- Financial profile management after onboarding.
- Accept/reject assigned financial profile.
- Manual financial profile change.
- Profile reassessment request.
- Research eligibility detail page separate from app access.
- Full question-level validation error display.

## 3. Dashboard, Partial

Status: Partial.

Implemented:

- Available balance, current-month income, current-month expenses, trends, spending distribution, recent transactions, budget health snapshot, and forecast callout exist in `apps/app/features/dashboard/DashboardScreen.tsx`.
- Empty dashboard state and some empty sections exist.
- Cached/stale labels exist for snapshot-backed budget and forecast sections.

Partiality and inconsistencies:

- Dashboard relies on local computed summary and snapshots. Forecast, alerts, savings, and debt summaries are not fully represented.
- Budget health state names differ from requirements. Code uses `on_track`, `warning`, and `critical`; requirements use Healthy, Warning, and Low.
- Empty states are partial. The screen does not separately prompt for no accounts, no income sources, no savings goals, no debts, no alerts, and no forecast.
- Forecast is a snapshot text callout, not a full dashboard insight module.

Not implemented submodules/pages:

- Savings goal summary.
- Debt summary detail.
- Alerts summary.
- Full spending forecast and insights panel.
- Dedicated stale-data recovery affordance per section.

## 4. Financial Accounts

Status: Mostly implemented with product gaps.

Implemented:

- List, total, add, edit, and delete confirmation exist in `apps/app/features/financial-accounts/FinancialAccountsScreen.tsx`.
- Local create, update, delete, validation, user scoping, and sync enqueue exist in `apps/app/local-db/repositories/financialFoundations.ts`.
- Supported account types match requirements.

Partiality and inconsistencies:

- View financial account details is not a separate page; list cards expose only limited information.
- Opening date exists in repository/schema but is not shown in the account form UI.
- Choose whether an account contributes to dashboard balance exists in repository but not in the account form UI.
- Duplicate-account state is required but not clearly enforced in UI or repository.
- Delete message says the account and transactions will be permanently removed, but repository soft-deletes the account for sync. The UX wording is inconsistent with implementation.

Not implemented submodules/pages:

- Account details page.
- Include/exclude from dashboard balance toggle.
- Opening date input.
- Duplicate-account handling UI.

## 5. Income Sources

Status: Partial to mostly implemented.

Implemented:

- List, total expected monthly income, add, edit, and delete exist in `apps/app/features/income-sources/IncomeSourcesScreen.tsx`.
- Destination account and income category selectors exist.
- Stable/variable type, frequency, expected/min/max amounts, schedule fields, and notes exist.
- Local repository auto-creates/updates recurring templates for income sources in `financialFoundations.ts`.

Partiality and inconsistencies:

- Requirements include viewing automation status and next expected automated income. Repository stores recurring/template-related data, but UI does not show automation status clearly.
- Delete removes the linked recurring template. Requirements distinguish stopping automation from preserving generated income transactions; UI has no explicit pause/stop automation flow.
- Variable income is forced to irregular frequency in the UI, which narrows the requirement for expected income ranges and schedules.
- There is no clear edit-recurring-income-schedule screen from an income source detail view.

Not implemented submodules/pages:

- Income source detail page.
- Automation status/next expected income section.
- Pause/stop automated income generation control.
- Explicit recurring schedule edit flow from income source.

## 6. Budgeting Module, Except Optimizer

Status: Partial.

Implemented:

- Manual budget draft creation, edit, and delete exist in `apps/app/features/budgeting/BudgetingScreen.tsx`.
- Period, dates, total budget, category allocations, and debt envelope exist.
- Budget tracking by planned vs actual category spending and debt payments exists in `apps/app/local-db/repositories/budgets.ts`.
- Local sync support exists for budgets and allocations.

Partiality and inconsistencies:

- Only draft budgets are implemented. Requirements include active, closed, archived, deleted, and lifecycle transitions.
- Only one budget can exist at a time. Requirements imply current budget by selected period, not a global single-budget limitation.
- Savings Envelope is not implemented. Debt envelope exists, but savings allocation is missing.
- Surplus and deficit handling are hardcoded to `LEAVE_UNALLOCATED` and `BLOCK_ACTIVATION`; they are not selectable.
- Restrictions are not respected in allocations. Budget allocations store `OPEN` only.
- There are no activation, close, or archive actions.
- Form placeholders differ from requirements and use example values instead.

Not implemented submodules/pages:

- Active budget lifecycle.
- Close/archive budget flows.
- Savings Envelope allocation.
- Surplus/deficit selector.
- Protected/fixed spending restriction handling.
- Budget health guidance states beyond simple progress display.

## 7. Debt Management, Partial

Status: Partial.

Implemented:

- Debt overview screen with plan summary, strategy selector, priorities, and debt cards exists in `apps/app/features/debt-manager/DebtManagerScreen.tsx`.
- Create debt screen and type presets exist in `apps/app/features/debt-manager/DebtCreateScreen.tsx`.
- Local debt repository includes debts, strategy, priorities, and linked debt-payment transaction creation in `apps/app/local-db/repositories/debts.ts`.
- Debt payments can be initiated from Debt Manager and routed through the transaction form.

Partiality and inconsistencies:

- No visible payment history page/list exists in the debt screen.
- Debt payment form is not a debt-specific form. It reuses the transaction form and captures amount, date, source, category, and notes only.
- Principal and interest fields are not exposed.
- Requirement allows debt payments with or without related transactions. Current create path appears transaction-linked only.
- Credit-card transaction-triggered debt recording is not implemented from normal transaction entry. Selecting a credit card account does not route to Debt Manager.
- Status naming differs: requirements say Finished; code uses `paid_off`.
- Archive exists as status update, but there is no clear archive confirmation flow.

Not implemented submodules/pages:

- Debt detail page.
- Payment history page.
- Manual debt payment without transaction.
- Principal/interest/fee payment fields.
- Transaction-triggered credit card debt recording flow.
- Hardship information UI.
- Debt forecasts/payment trend view.

## 9. Settings Module, Partial

Status: Partial.

Implemented:

- Settings landing screen exists in `apps/app/features/governance/PrivacySettingsScreen.tsx`.
- Privacy toggles, consent status, export data, and account deletion flow exist.
- Offline cached privacy settings exist.
- Sync section is embedded in settings through `apps/app/components/MobileShell.tsx`.

Partiality and inconsistencies:

- Account/profile rows are static. Personal information and Change password rows have no navigation/action.
- Notification preferences are collapsed into Budget & anomaly alerts plus a static Daily frequency row.
- Consent history is shown only as coarse status/version, not as a detailed history page.
- Data-retention preference is not visible.
- Connected auth providers are not manageable.
- Help/About is not implemented as a page.
- Settings form placeholders from requirements are mostly absent because many settings are rows/toggles instead of forms.

Not implemented submodules/pages:

- Editable profile settings.
- Change password settings page.
- Connected providers management.
- Financial profile management/resume onboarding page.
- Detailed consent history page.
- Data retention settings.
- Full notification preferences page.
- Help/About/FAQ/problem report/app version/thesis info/privacy terms pages.

## 10. Categories and Restrictions Module

Status: Partial.

Implemented:

- Category group, category, and subcategory hierarchy exists in `apps/app/features/taxonomy/TaxonomyScreen.tsx`.
- Create, edit, and delete custom categories and subcategories exist.
- Filipino-context indicator and protected subcategory toggle exist.
- System/protected delete restrictions exist in UI.
- Local repository and sync support exist for categories/subcategories.

Partiality and inconsistencies:

- Search input exists but is disabled.
- No filters exist for Filipino context, protected items, system/custom items, or category group.
- Category form does not expose spending restriction Open / Protected / Fixed.
- Subcategory form only supports a protected boolean, not Open / Protected / Fixed.
- Custom subcategory creation hardcodes `kind: "expense"`.
- Restrictions are not fully applied to budgeting or recommendations. Budget allocations currently store `OPEN` only.
- Existing records are preserved through soft-delete behavior, but there is no user-facing Records-preserved state.

Not implemented submodules/pages:

- Search/filter behavior.
- Spending restriction selector.
- Income/expense/transfer subcategory kind selector for custom subcategories.
- System vs custom filter.
- Restriction rule integration with budgeting/recommendations.

## 11. Financial Obligations Module, Partial

Status: Partial.

Implemented:

- List, add, edit, and delete obligations exist in `apps/app/features/financial-obligations/FinancialObligationsScreen.tsx`.
- Category selector, amount, frequency, due schedule, and notes exist.
- Obligation automation link/unlink via recurring templates exists in `apps/app/features/financial-obligations/components/AutomateObligationSheet.tsx`.
- Local repository and sync support exist.

Partiality and inconsistencies:

- Form omits family-support, dependent-support, protected-by-default, start date, and end date controls, although repository supports them.
- No obligation payment recording UI exists.
- No obligation payment history exists.
- No paid, partially-paid, or overdue occurrence tracking UI exists.
- Archive is required but UI exposes delete only.
- Delete wording says permanent removal, while repository soft-deletes for sync.
- Automation exists, but payment/contribution and related transaction flows are not visible.

Not implemented submodules/pages:

- Obligation detail page.
- Obligation payment form.
- Payment history.
- Paid/partially-paid/overdue occurrence status.
- Archive flow.
- Family/dependent/protected/start/end fields.
- Transaction-linked obligation payment flow.

## 12. Transaction Management Module, Except Savings/Obligation Linked Flows

Status: Partial to mostly implemented for base transactions.

Implemented:

- Income, expense, and transfer entry exist in `apps/app/features/ledger/NewTransactionScreen.tsx`.
- Account, category, date, merchant/payer, and notes fields exist.
- Transaction history, search, filters, sort, and reset exist in `apps/app/features/ledger/TransactionHistoryScreen.tsx`.
- Edit/delete with balance recalculation and tombstone preservation exists in `apps/app/local-db/repositories/ledger.ts`.
- Recurring transaction option exists during creation and through a separate recurring screen.
- Debt-payment linked transaction path exists from Debt Manager.

Partiality and inconsistencies:

- Savings and obligation linked flows are excluded by this report scope and are not implemented in the transaction form.
- Credit-card selection does not route into Debt Manager from normal transaction entry.
- Only one linked relationship is effectively supported: debt payment through `debtAccountId`; there is no generic relationship selector.
- Transaction form placeholders differ from requirements.
- Date range filter uses quick ranges only, not arbitrary from/to date selection.
- Edit flow protects linked debt payments, but savings/obligation link protection is absent because those links are not implemented.

Not implemented submodules/pages:

- Credit-card transaction routing to Debt Manager.
- Custom date-range filter UI.
- Transaction detail/review page.
- Transaction templates UI, despite repository/sync support.
- Savings/obligation linked flows, intentionally excluded from this report scope.

## 16. Offline Sync and Recovery Module

Status: Partial to mostly implemented foundation.

Implemented:

- Local sync queue, push/pull, cursor state, and retry attempts exist in `apps/app/local-db/sync/runSync.ts`.
- API sync push, pull, and register-device routes exist in `apps/api/src/routes/sync.ts`.
- Sync icon/status exists in top bar and settings.
- Failed sync details modal, pagination, discard, retry, and logout blocking exist in `apps/app/components/MobileShell.tsx`.
- Account safety for logout is implemented by blocking or attempting sync when unsynced changes exist.

Partiality and inconsistencies:

- Sync is embedded in shell/settings, not a dedicated recovery module/page.
- Failed-change history is limited to exhausted failed rows, not a full history of pending, failed, and discarded changes.
- Discarded changes can be counted/cleaned up internally, but there is no user-facing discarded changes page.
- Last successful synchronization is stored in `sync_state.last_sync_at`, but is not visibly displayed.
- Recovery guidance is mostly short toast/error copy, not a guided recovery page.
- Account deletion sync safety exists in requirements, but visible logout handling is stronger than visible account deletion handling.

Not implemented submodules/pages:

- Dedicated Sync & Recovery page.
- Last successful sync display.
- Pending/failed/discarded change tabs.
- Clear bulk retry action.
- Full failed-change history.
- Guided recovery instructions.
