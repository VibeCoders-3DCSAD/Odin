# Database Plan — VIB-120

**Based on:** `supabase/migrations/20260616064145_priority_modules_v3.sql` (executed migration)
**Date:** 2026-06-30
**Prototype scope:** Functional MVP validation with a single test user

---

## 1. High-Level ERD (Text)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          AUTH.USERS (Supabase Auth)                         │
└─────────────────────────┬───────────────────────────────────────────────────┘
                          │ 1:1
┌─────────────────────────▼───────────────────────────────────────────────────┐
│                               PROFILES                                       │
│  id (PK), user_id (FK→auth.users UNIQUE), display_name, metro_manila_city,  │
│  lifecycle_status, onboarding_completed_at, last_active_at, metadata          │
└──┬──────────────────────┬──────────────────┬─────────────────┬──────────────┘
   │1:1                   │1:N               │1:N               │1:N
   ▼                      ▼                  ▼                  ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  ┌──────────────┐
│user_privacy_ │  │ user_consents│  │onboarding_       │  │income_sources│
│settings      │  │              │  │sessions          │  │              │
└──────────────┘  └──────────────┘  └──────┬───────────┘  └──────────────┘
                                           │1:N
                                           ▼
                                    ┌──────────────┐
                                    │onboarding_   │
                                    │responses     │
                                    └──────────────┘

                 ┌─────────────────────────────────────────────┐
                 │            CATEGORY_GROUPS                   │
                 │  4 seeded: Essentials/Obligatory/           │
                 │  Discretionary/Financial Allocation         │
                 └──────────┬──────────────────────────────────┘
                            │ 1:N
                 ┌──────────▼──────────────────────────────────┐
                 │               CATEGORIES                     │
                 │  ~19 system + user-created                   │
                 └──────────┬──────────────────────────────────┘
                            │ 1:N
                 ┌──────────▼──────────────────────────────────┐
                 │            SUBCATEGORIES                     │
                 │  ~25 system + user-created                   │
                 │  kind: income | expense | transfer           │
                 └──────────┬──────────────────────────────────┘
                            │ (via restrictions)
                 ┌──────────▼──────────────────────────────────┐
                 │ user_category_restrictions /                 │
                 │ user_subcategory_restrictions                │
                 └─────────────────────────────────────────────┘

┌──────────────────┐   ┌─────────────────────┐
│ financial_accounts│   │ transaction_templates│
│ cash/bank/ewallet/│   │ (quick-entry)       │
│ savings/credit/   │   └─────────────────────┘
│ loan/other        │
└────────┬─────────┘
         │ 1:N
         ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                              TRANSACTIONS                                   │
│  type: income/expense/transfer | status: draft/posted/voided/deleted        │
│  subcategory_id (FK) | source/destination account (FK)                       │
│  recurring_template_id (FK) | merchant_name, notes, client_mutation_id      │
└──┬───────────────────────────┬──────────────────────────┬───────────────────┘
   │1:N                        │1:N                       │1:N
   ▼                           ▼                          ▼
┌──────────────┐     ┌────────────────────┐     ┌────────────────────┐
│transaction   │     │ transaction_events │     │ transaction_drafts │
│line_items    │     │ (audit log)        │     │ (offline)          │
└──────────────┘     └────────────────────┘     └────────────────────┘
         │1:N
         ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                      RECURRING TRANSACTIONS                                 │
│  recurring_transaction_templates ──1:N──► recurring_transaction_occurrences │
│  financial_obligations (hard obligations, protected)                        │
│  expected_spending_events (known future: holidays, paydays)                 │
└────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────────┐
│                               BUDGETS                                       │
│  budget_strategy_configs ──1:N──► budget_strategy_rules                     │
│  budgets ──1:N──► budget_allocations ──1:N──► budget_events                │
│  budgets ──1:N──► budget_health_snapshots                                   │
└────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────────┐
│                           SAVINGS GOALS                                     │
│  savings_goals ──1:N──► savings_goal_contributions                          │
│  savings_goals ──1:N──► savings_goal_progress_snapshots                     │
│  savings_goal_allocation_preferences (1:1 per user)                         │
│  budget_allocations ──M:N──► savings_goals (via savings_goal_budget_alloc.) │
└────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────────┐
│                           DEBT MANAGEMENT                                    │
│  debt_accounts ──1:N──► debt_payments                                       │
│  debt_accounts ──1:N──► user_debt_priorities                                │
│  debt_strategy_preferences (1:1 per user)                                   │
│  debt_repayment_projection_runs ──1:N──► projection_items ──1:N──► points  │
│  debt_hardship_plans ──1:N──► debt_hardship_plan_events                     │
└────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────────┐
│                          FORECASTING                                        │
│  forecast_runs ──1:N──► forecast_series ──1:N──► forecast_points            │
│  forecast_series ──1:N──► forecast_explanation_drivers                      │
└────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────────┐
│                     BUDGET RECOMMENDATIONS                                   │
│  budget_recommendations ──1:N──► budget_recommendation_allocations          │
│  budget_recommendations ──1:N──► budget_recommendation_constraints          │
│  budget_recommendations ──1:N──► budget_recommendation_events               │
│  budget_recommendation_allocations ──1:N──► savings_goal_rec_allocations   │
└────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────────┐
│                     ANOMALY DETECTION                                       │
│  anomaly_evaluations ──1:N──► anomaly_evaluation_features                   │
│  overspending_evaluations                                                   │
└────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────────┐
│                     ALERTS & NOTIFICATIONS                                   │
│  alerts ──1:N──► alert_related_entities                                     │
│  alerts ──1:N──► alert_events                                               │
│  alert_notification_preferences (1 row per category per user)               │
│  anomaly_whitelist_rules (merchant-level suppression)                       │
│  alert_suppression_rules (general suppression)                              │
│  push_device_tokens                                                         │
└────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────────┐
│                     REPORTS                                                  │
│  report_runs ──1:N──► report_metrics                                        │
│  report_runs ──1:N──► report_category_breakdowns                            │
│  report_runs ──1:N──► report_budget_comparisons                             │
│  report_runs ──1:N──► report_forecast_comparisons                           │
│  report_runs ──1:N──► report_savings_goal_snapshots                         │
│  report_runs ──1:N──► report_debt_account_snapshots                        │
└────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────────┐
│                     SUPPORT                                                  │
│  support_tickets ──1:N──► support_ticket_events                             │
│  support_tickets ──1:N──► support_ticket_attachments (→ storage bucket)    │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Core Entities and Relationships

### 2.1 Entity Count

| Layer | Tables | Description |
|---|---|---|
| User & Governance | 7 | profiles, privacy, consents, export, deletion, eligibility, metro localities |
| Onboarding & Financial Profile | 7 | sessions, responses, assessments, drivers, assignments, events, schedules |
| Category Taxonomy | 5 | groups, categories, subcategories, cat restrictions, subcat restrictions |
| Income & Accounts | 2 | income_sources, financial_accounts |
| Transactions | 7 | transactions, templates, line_items, events, drafts, retention settings, retention events |
| Recurring & Obligations | 4 | recurring templates, occurrences, obligations, expected events |
| Budgets | 6 | strategy configs, strategy rules, budgets, allocations, events, health |
| Savings Goals | 5 | goals, allocation prefs, contributions, progress snapshots, budget allocations |
| Debt Management | 9 | debt accounts, payments, strategy prefs, priorities, projection runs, projection items, projection points, hardship plans, hardship events |
| Forecasting | 4 | forecast runs, series, points, explanation drivers |
| Budget Recommendations | 6 | recommendations, allocations, savings rec allocations, constraints, events |
| Anomaly Detection | 2 | anomaly evaluations, evaluation features |
| Overspending | 1 | overspending evaluations |
| Alerts & Notifications | 7 | alerts, related entities, events, notification prefs, whitelist rules, suppression rules, push tokens |
| Reports | 7 | report runs, metrics, category breakdowns, budget comparisons, forecast comparisons, savings goal snapshots, debt snapshots |
| Support | 3 | tickets, events, attachments |
| **Total** | **72 tables** | (excl. `auth.users` — Supabase managed) |

### 2.2 Ownership Model

Every user-owned table uses the same pattern:
- `user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE`
- Row-level security policy: `user_id = auth.uid()`
- Composite FK `(id, user_id)` enforces cross-table ownership
- System lookup tables (`category_groups`, `metro_manila_localities`) are readable by all authenticated users

### 2.3 Key Relationships

| Parent | Child | Type | Key |
|---|---|---|---|
| `profiles` | All user-owned tables | 1:N | `user_id` |
| `auth.users` | `profiles` | 1:1 | `user_id` (Supabase managed, bootstrap trigger) |
| `category_groups` | `categories` | 1:N | `category_group_id` |
| `categories` | `subcategories` | 1:N | `category_id` (expense only) |
| `financial_accounts` | `transactions` | 1:N | `source_account_id`, `destination_account_id` |
| `budgets` | `budget_allocations` | 1:N | `budget_id` |
| `budgets` | `budget_recommendations` | 1:1 | `accepted_budget_id` |
| `forecast_runs` | `budget_recommendations` | 1:N | `forecast_run_id` |
| `recurring_transaction_templates` | `recurring_transaction_occurrences` | 1:N | `recurring_template_id` |
| `transactions` | `transaction_line_items` | 1:N | `transaction_id` |
| `savings_goals` | `savings_goal_contributions` | 1:N | `savings_goal_id` |
| `debt_accounts` | `debt_payments` | 1:N | `debt_account_id` |
| `alerts` | `alert_events` | 1:N | `alert_id` |

---

## 3. Prototype Data Scope

### 3.1 Seeded Reference Data (already exists in migration)

- **4 category groups**: Essentials, Obligatory, Discretionary, Financial Allocation
- **19 system categories** across all 4 groups
- **25+ system subcategories** across all categories, including income subcategories
- **17 Metro Manila localities** with sort orders
- **Budget strategies** (seeded later via API or app)
- **Forecast disclaimer text** (hardcoded default)

### 3.2 Test Data Strategy

| Entity | Data Source | Volume |
|---|---|---|
| Profiles | Auto-created via auth bootstrap trigger | 1 test user |
| Categories/Subcategories | Seeded in migration (system) | ~44 rows total |
| Income Sources | Manual test entry | 1-3 sources |
| Financial Accounts | Manual test entry | 3-5 accounts |
| Transactions | Manual + recurring generator | 50-200 transactions |
| Recurring Templates | Manual test entry | 3-5 templates |
| Obligations | Manual test entry | 3-5 obligations |
| Budgets | Manual + recommendation accept | 2-4 budget periods |
| Savings Goals | Manual test entry | 2-3 goals |
| Debt Accounts | Manual test entry | 2-3 accounts |
| Debt Payments | Manual + transaction-linked | 5-10 payments |

### 3.3 Data Retention

- `retain_until` on transactions (default 2555 days ≈ 7 years)
- No auto-archive or purge in prototype

---

## 4. Tables Required for MVP Validation

These 33 tables form the minimum viable set. A prototype can be validated without the rest.

### Tier 1 — Core CRUD (must have)

| # | Table | Why |
|---|---|---|
| 1 | `profiles` | Auth bootstrap already implemented |
| 2 | `income_sources` | User configures income |
| 3 | `financial_accounts` | Accounts hold money |
| 4 | `transactions` | Core financial record |
| 5 | `subcategories` | Transaction categorization |
| 6 | `categories` | Parent of subcategories |
| 7 | `category_groups` | Parent of categories (4 groups) |
| 8 | `recurring_transaction_templates` | Auto-generates transactions |
| 9 | `recurring_transaction_occurrences` | Tracks each generated occurrence |
| 10 | `financial_obligations` | Hard obligations (rent, debt min, family) |

### Tier 2 — Budgeting (must have)

| # | Table | Why |
|---|---|---|
| 11 | `budgets` | Period-based budget |
| 12 | `budget_allocations` | Per-category/subcategory allocation |
| 13 | `budget_events` | Audit log for budget actions |

### Tier 3 — Savings (must have)

| # | Table | Why |
|---|---|---|
| 14 | `savings_goals` | Goal definitions |
| 15 | `savings_goal_contributions` | Contribution tracking |
| 16 | `savings_goal_allocation_preferences` | Strategy preference (avalanche/snowball) |

### Tier 4 — Debt (must have)

| # | Table | Why |
|---|---|---|
| 17 | `debt_accounts` | Debt tracking |
| 18 | `debt_payments` | Payment history |
| 19 | `debt_strategy_preferences` | Avalanche/snowball |
| 20 | `user_debt_priorities` | Payoff ordering |

### Tier 5 — Supporting / Simplified

| # | Table | Why |
|---|---|---|
| 21 | `transaction_templates` | Quick-entry templates |
| 22 | `transaction_line_items` | Split transactions (simplified) |
| 23 | `transaction_events` | Audit log (simplified CRUD events) |
| 24 | `expected_spending_events` | Known future events for budget awareness |
| 25 | `user_category_restrictions` | Free/protected/locked per category |
| 26 | `user_subcategory_restrictions` | Free/protected/locked per subcategory |

### Tier 6 — Budget Strategy Core

| # | Table | Why |
|---|---|---|
| 27 | `budget_strategy_configs` | Predefined strategy (50/30/20, etc.) |
| 28 | `budget_strategy_rules` | Per-category rule within strategy |

### Tier 7 — Budget Health (nice to have)

| # | Table | Why |
|---|---|---|
| 29 | `budget_health_snapshots` | Health tracking during active budget |

### Tier 8 — Savings Enhancements

| # | Table | Why |
|---|---|---|
| 30 | `savings_goal_progress_snapshots` | Progress tracking (can compute from contributions) |
| 31 | `savings_goal_budget_allocations` | Savings allocation within budget |

### Tier 9 — Debt Enhancements

| # | Table | Why |
|---|---|---|
| 32 | `debt_repayment_projection_runs` | Projection scenario |
| 33 | `debt_repayment_projection_items` | Per-debt projection |
| 34 | `debt_repayment_projection_points` | Period-by-period projection |

---

## 5. Tables That Can Be Deferred

These tables are not needed for MVP validation and should be built in later phases.

### Phase 2 — Financial Profile & Onboarding

| Table | Reason Deferred |
|---|---|
| `onboarding_sessions` | Onboarding wizard; prototype user can be pre-configured |
| `onboarding_responses` | Questionnaire answers; not needed for core CRUD |
| `financial_profile_assessments` | ML assessment; no ML model in prototype |
| `financial_profile_explanation_drivers` | Assessment explanation; defer |
| `financial_profile_assignments` | Active profile assignment; prototype uses hardcoded default |
| `financial_profile_events` | Assessment audit; defer |
| `financial_profile_reclassification_schedules` | Periodic reclassification; defer |

### Phase 2 — Forecasting & Recommendations

| Table | Reason Deferred |
|---|---|
| `forecast_runs` | LSTM model not built yet |
| `forecast_series` | Per-target forecast lines |
| `forecast_points` | Period-by-period values |
| `forecast_explanation_drivers` | Forecast explanations |
| `budget_recommendations` | LP solver not built yet |
| `budget_recommendation_allocations` | Per-category recommendations |
| `savings_goal_recommendation_allocations` | Savings within recommendations |
| `budget_recommendation_constraints` | Constraint explanations |
| `budget_recommendation_events` | Accept/modify/reject audit |

### Phase 2 — Anomaly Detection

| Table | Reason Deferred |
|---|---|
| `anomaly_evaluations` | Isolation Forest model not built yet |
| `anomaly_evaluation_features` | Per-feature breakdown |

### Phase 2 — Overspending Evaluations

| Table | Reason Deferred |
|---|---|
| `overspending_evaluations` | Budget overspend check; can compute inline in prototype |

### Phase 3 — Alerts & Notifications

| Table | Reason Deferred |
|---|---|
| `alerts` | Central alert inbox; not MVP |
| `alert_related_entities` | Related entities for alerts |
| `alert_events` | Alert state changes |
| `alert_notification_preferences` | Per-category preferences |
| `anomaly_whitelist_rules` | Merchant whitelist suppression |
| `alert_suppression_rules` | General suppression rules |
| `push_device_tokens` | Push notifications (backend Phase 1a already has route scaffold, but push itself deferred) |

### Phase 3 — Reports

| Table | Reason Deferred |
|---|---|
| `report_runs` | Report generation; data can be queried directly in prototype |
| `report_metrics` | KPI metrics |
| `report_category_breakdowns` | Category breakdowns |
| `report_budget_comparisons` | Budget vs actual |
| `report_forecast_comparisons` | Forecast vs actual |
| `report_savings_goal_snapshots` | Goal status |
| `report_debt_account_snapshots` | Debt status |

### Phase 3 — Support

| Table | Reason Deferred |
|---|---|
| `support_tickets` | Help desk |
| `support_ticket_events` | Ticket activity |
| `support_ticket_attachments` | File attachments |

### Phase 3 — Data Governance

| Table | Reason Deferred |
|---|---|
| `data_export_requests` | GDPR-like export |
| `account_deletion_requests` | Account deletion flow |
| `user_consents` | Consent management (has defaults) |
| `user_privacy_settings` | Auto-created with profile, defer UI |
| `user_eligibility_profiles` | Target demographic check |
| `user_transaction_retention_settings` | Data lifecycle (has default) |
| `transaction_retention_events` | Retention audit |
| `transaction_drafts` | Offline sync |

### Phase 3 — Debt Hardship

| Table | Reason Deferred |
|---|---|
| `debt_hardship_plans` | Hardship plan management |
| `debt_hardship_plan_events` | Hardship actions audit |

---

## 6. MVP Validation Checklist

The following user stories can be validated with Tier 1-4 tables only:

1. **User can create and manage accounts** → `financial_accounts`
2. **User can record income/expense/transfer** → `transactions` + `subcategories`
3. **User can categorize transactions** → `subcategories` → `categories` → `category_groups`
4. **User can set up recurring transactions** → `recurring_transaction_templates` + `financial_obligations`
5. **User can create a budget period** → `budgets` + `budget_allocations`
6. **User can track spending against budget** → `budget_allocations.spent_amount_snapshot_centavos` + `budget_health_snapshots` (Tier 7)
7. **User can set savings goals and track progress** → `savings_goals` + `savings_goal_contributions`
8. **User can track debt accounts and payments** → `debt_accounts` + `debt_payments`
9. **User can set debt payoff priorities** → `user_debt_priorities` + `debt_strategy_preferences`
10. **User can view transaction history** → `transactions` with date range query
11. **User can create quick-entry templates** → `transaction_templates`
12. **User can split transactions** → `transaction_line_items`

---

## 7. Implementation Order (Phased)

```
Phase 1a (Done)         Phase 1b (Current)          Phase 2               Phase 3
─────────────────       ──────────────────          ──────────            ──────────
profiles                transactions                onboarding           alerts
user_privacy_settings   subcategories               fin. profile         reports
push_device_tokens      categories                  forecasting          support
user_eligibility_prof.  category_groups             recommendations      data governance
                        income_sources              anomaly detection    debt hardship
                        financial_accounts
                        budgets + allocations
                        recurring templates
                        financial_obligations
                        savings_goals
                        debt_accounts
```

---

*This document is an architectural planning artifact only. Do not modify the schema. All 72 tables already exist in the executed migration `20260616064145_priority_modules_v3.sql`.*
