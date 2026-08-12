# System Specification

---

## Metadata

```json
{
  "document-type": "system-spec",
  "version": 0.3.0,
  "date": "2026.08.08",
  "authors": [
    "Gabion, Stefanie S.",
    "Guevarra, Joaquin Luis T.",
    "San Jose, Alexa Joanne Paula G.",
    "Togle, Charles Nathaniel B."
  ]
}
```

---

## Acronyms and Abbreviations

| Acronym | Definition |
| :--- | :--- |
| PFM | Personal Finance Management |
| PFMS | Personal Finance Management System |
| PFP | Personal Financial Profile |
| ML | Machine Learning |
| NCR | National Capital Region |
| BSP | Bangko Sentral ng Pilipinas |
| FIES | Family Income and Expenditure Survey (PSA) |
| PSA | Philippine Statistics Authority |
| PUF | Public Use File |
| PUEPS | Public User Expectations and Perception Survey |
| SME | Subject Matter Expert |
| MDD | Model Design Document |
| RA 10173 | Data Privacy Act of 2012 |
| SUS | System Usability Scale |
| ISO | International Organization for Standardization |

---

## 0. Document Control

### 0.1 Change Log

| Version | Date | Author(s) | Summary of Change |
| :--- | :--- | :--- | :--- |
| 0.1.0 | 2026.08.05 | Gabion, Guevarra, San Jose, Togle | Initial skeleton: Metadata, Acronyms, and section placeholders. |
| 0.2.0 | 2026.08.06 | Gabion, Guevarra, San Jose, Togle | First content fill: sections 0–13 and Appendices drafted; section numbering reordered to be sequential; change log added. |
| 0.3.0 | 2026.08.08 | Gabion, Guevarra, San Jose, Togle | Manual correction of content; review comments applied (Budget module added, offline/online split documented, fbp→pfp, links fixed, redundant ML sections trimmed). |

---

## 1. System Overview

### 1.1 Product Perspective

Odin is an **Android-first personal finance management (PFM) application** for Filipino working young adults in the National Capital Region (NCR). It lets users record, review, and act on their finances, while serving as a defensible, testable system for the thesis evaluation of its intelligent finance modules. 

Odin is a **financial decision-support system**. Intelligent outputs (profiles, forecasts, budget recommendations, and anomaly alerts) are designed to be explained in plain language, keep users in control of final decisions, and avoid shame-based financial messaging.

### 1.2 Problem Statement

Odin is a **personal finance management (PFM) application** that helps Filipino working young adults record, review, and act on their money even when the network is unreliable, while serving as a defensible, testable system for thesis evaluation of its intelligent finance modules.

Filipino working young adults manage money under real conditions that generic expense trackers do not serve well:

- **In concept**, conventional PFM apps assume stable, predictable income, rely on generic category labels that do not reflect Filipino financial realities, and focus on recording past expenses rather than supporting forward-looking, profile-aware, obligation-aware budgeting.
- **In application**, they provide limited support for variable income, protected or fixed obligations, family and culturally patterned spending, offline transaction entry, and local-first dashboards; many keep sensitive financial data only on the server and block core features without a connection.

Odin addresses both halves of this problem at once: a useful mobile app and a testable system for research.

### 1.3 Target Users

The thesis target population and model-training target is **Filipino working young adults aged 20 to 40 who live or work in Metro Manila**. The app is usable by anyone, but only data from consenting, qualifying target users is used to train or improve AI models. The system discloses this during onboarding.

### 1.4 Core Capabilities

The primary product areas are:

1. Identity and authenticated app entry
2. Consent, privacy, and governance
3. Onboarding and profile assessment
4. Taxonomy and restriction levels (including open/protected/fixed expense categories)
5. Financial accounts, income sources, and expense obligations
6. Ledger, transactions, templates, and recurring records
7. Dashboard
8. Budgets and allocations
9. Budget recommendations
10. Forecasts and expected events
11. Anomalies and overspending
12. Alerts and notifications
13. Savings goals
14. Debt management
15. Reports and analytics
16. Help and problem reporting
17. Offboarding and account governance
18. Offline sync status, recovery, and discard flows

### 1.5 System Context

```text
                       ┌─────────────────────────────────────────────────┐
                       │                      Odin                       │
                       │                                                 │
   Filipino working    │   ┌──────────────┐   ┌──────────────────────┐   │
   young adults (20–   │   │  Odin mobile │──▶│  Backend services    │   │
   40, NCR)            │   │  app         │◀──│  (auth, sync, API)   │   │
        │              │   └──────┬───────┘   └──────────┬───────────┘   │
        │  records,    │          │                      │               │
        ▼  reviews     │   ┌──────▼───────┐   ┌──────────▼───────────┐   │
   ┌───────────────┐   │   │ Local SQLite │   │  ML subsystem        │   │
   │ External      │   │   │ + sync queue │   │  (PFP Classifier,    │   │
   │ services:     │   │   └──────────────┘   │  Forecaster, Anomaly │   │
    │ Google Auth   │   │                      │  Detector, Budget    │   │
    │ (TBD cloud)   │   │                      │  Optimizer)          │   │
    └───────────────┘   │                      └──────────┬───────────┘   │
   └───────────────┘   │                                 │               │
                       └─────────────────────────────────┼───────────────┘
                                                         │
                       ┌─────────────────────────────────▼───────────────┐
                       │  Data sources (offline, research-only):         │
                       │  PSA FIES 2023 (NCR), BSP Consumer Finance      │
                       │  Report, synthetic personas/transactions, PUEPS │
                       └─────────────────────────────────────────────────┘
```

The mobile app is the primary product surface. Research data sources are consumed during dataset construction (training/evaluation) and are not queried at runtime.

---

## 2. Glossary

| Term | Definition |
| :--- | :--- |
| Financial stability | The consistency of a user's inflow, measured by the coefficient of variation of income; one of the three PFP classifying dimensions. |
| Financial weight | The proportion of total expenses consumed by essential and obligatory spending; one of the three PFP classifying dimensions. |
| Financial tolerance | A user's capacity to absorb shocks, measured by emergency runway (months of expenses covered by savings); one of the three PFP classifying dimensions. |
| PFP Class / Octant | One of eight profile categories produced by combining the three binary dimensions. |
| Newcomer | The condition of a new user with little or no transaction history, served by questionnaire-based defaults (PFP). |
| Archetype | A named, parameterized segment of the target population used to generate personas. |
| Persona | An individual synthetic user generated from an archetype, with a ground-truth PFP and a transaction history. |
| Walk-forward validation | Time-series validation that trains on expanding windows and evaluates one step ahead, avoiding information leakage. |

---

## 3. System Architecture

### 3.1 High-Level Architecture

Odin has three subsystems:

1. **Mobile client** — an Expo/React Native application (Android-first, React Native Web for development/wider-layout review). Business data is stored locally in SQLite; the UI reads from local repositories and writes through them.

2. **Backend services** — an Express API and Supabase-backed data layer providing authentication, server-side validation, sync endpoints, and online-only operations (registration, login, password flows, data export, account deletion, push token registration).

3. **ML subsystem** — a set of FastAPI microservices serving the PFP Classifier, Forecaster, Anomaly Detector, and Budget Optimizer, wired to the backend through an API gateway and event bus.

### 3.2 Offline-First Sync Model

The implementation model is:

```text
UI -> local repository -> SQLite table -> sync_queue -> runSync() -> /odin/api/sync/push
   -> apply_sync_operation() -> /odin/api/sync/pull -> SQLite convergence
```

- The UI reads from local SQLite and writes through feature repositories; network sync is background convergence, not the primary interaction path.
- The sync queue stores domain operations (e.g., "create transaction", "update category"), not stored HTTP requests.
- Conflict resolution is automatic: delete wins, then per-field last-write-wins for concurrent edits.
- Duplicate operations are idempotent through operation IDs and applied-operation tracking; losing/rejected operations are logged for audit/recovery.
- Synced user-owned rows preserve `user_id`, versioning, deletion state (tombstones), timestamps, and last-sync metadata; deletes for synced entities are tombstones, not hard deletes.
- All user-owned data is scoped to the authenticated user, locally and remotely; foreign keys and related record references are validated against the user's ownership boundary before local persistence and before remote sync application.

#### Offline/Online Assignment per Module

Intelligent-module execution is server-side per the PRD, with results cached locally for offline display. The assignment is chosen per module on the basis of **model size, inference latency, and the urgency/staleness tolerance of the output**:

| Module | Execution | Offline behavior | Rationale |
| :--- | :--- | :--- | :--- |
| PFP Classifier | Server-side | Cached profile + explanation; deterministic `QUESTIONNAIRE` newcomer mapping | Learned tiers grow in complexity; the output is low-urgency |
| Budget Optimizer | Server-side | Cached recommendations | Refresh is periodic; server-side calculation keeps the mobile build light |
| Forecaster | Server-side | Cached forecast runs, series, points, explanations, metadata | Learned models are too heavy for on-device inference today |
| Anomaly Detector | Server-side | Cached alerts and explanations | Per-user baselines and inference run on the server |

A future move of any module on-device would be justified by the same criteria (e.g., a small rule-based classifier or optimizer meeting the size and latency budgets); until then, server-side execution with local caching is the confirmed model.

### 3.3 Application Modules

The application modules follow the topical outline (§3.3):

| Module | Sub-modules |
| :--- | :--- |
| Login module | — |
| Registration module | — |
| Questionnaire module | — |
| User module | User account module, Financial profile module |
| Financial account module | — |
| Dashboard module | — |
| Transaction management module | Transaction entry, Transaction template, Transaction history |
| Budget management module | Budget planning, Budget tracking and health, Budget report and analysis |
| Financial intelligence module | Financial forecasting, Anomaly detection |
| Reports and statistics module | — |

These map to the 18 product areas in §1.4 and the 24 screens in the screen descriptions.

### 3.4 Technology Stack

| Layer | Technology |
| :--- | :--- |
| Mobile frontend | Expo SDK 55, React Native 0.83, React Native Web 0.21, React Native Paper, NativeWind/Tailwind CSS 4, `@expo/vector-icons` |
| Main backend | Node.js 24 LTS, Express 5.1, Supabase (`@supabase/supabase-js`) |
| Local storage | SQLite (local-first source of truth for offline-capable modules) |
| ML service | Python 3.14, FastAPI, PyTorch, scikit-learn |
| Package/tooling | pnpm (Node), Python virtual environment (ML) |
| Deployment | Docker containers; cloud provider TBD |

### 3.5 Deployment Architecture

The ML modules and supporting services run as independent Docker containers (see `deployment-architecture.md` v1.0; the `budget-optimizer` row is pending its Odin-ML definition):

| Container | Port | Purpose |
| :--- | :--- | :--- |
| api-gateway | 8000 | Route and aggregate ML requests |
| pfp-classifier | 8001 | PFP classification |
| forecaster | 8002 | Forecasting |
| anomaly-detector | 8003 | Anomalous transaction detection |
| transaction-service | 8004 | Transaction ingestion and event publishing |
| budget-optimizer | 8005 | Budget optimization (definition pending in Odin-ML) |

Separate containers give independent scaling, independent deployment, and fault isolation. Model artifacts are stored in versioned object storage with metadata (training data hash, performance metrics, dependency versions). Each module exposes `/health`, `/ready`, and `/metrics` endpoints.

### 3.6 Integration Architecture

Following `module-integration.md` v1.0:

```text
[User App] -> [API Gateway] -> [Transaction Service]
                                    ↓
                            [Event Bus (Kafka/RabbitMQ)]
                                    ↓
                    ┌───────────────┬───────────────┬───────────────┐
                    ↓               ↓               ↓               ↓
            [PFP Classifier] [Forecaster]  [Anomaly Detector] [Budget Optimizer]
                    ↓               ↓               ↓               ↓
                    └───────────────┴───────────────┴───────────────┘
                                    ↓
                            [Response Aggregator]
                                    ↓
                            [User App (Response)]
```

The Budget Optimizer is shown ahead of `module-integration.md` v1.0; it will be defined in a later version (v1.1).

Integration principles: loose coupling (API-based, no shared state), event-driven (modules react to transaction events), fail-safe (module failures degrade gracefully without crashing the system), and composable (outputs can be combined or used independently).

---

## 4. User Roles, Archetypes, and Personas

### 4.1 User Roles

Odin is a **single-user-account application**. Product and research roles:

| Role | Description |
| :--- | :--- |
| End user (general) | Any user of the app; records transactions, manages budgets/goals/debts, uses dashboards, reports, and sync recovery. |
| Thesis participant | A target-population user (20–40, working, Metro Manila) who gives or withholds consent for data use in model training/evaluation; eligible research data is subject to consent. |
| Thesis evaluator | Evaluates the system through SUS, ISO 25010 mapping, and model evaluation separate from UI evaluation. |
| Development team | Consumes problem reports and maintains the app and models. No admin/agent roles exist for problem reporting. |

### 4.2 Archetypes

Archetype segmentation is informed by the **BSP Consumer Finance Report**; granular income/expense parameters are drawn from **PSA FIES 2023 NCR microdata**. Archetype definitions and the full 12-archetype table live in Odin-ML (`Odin-ML/training/synth/archetype_summary.json`); see the Odin-ML synthetic-data documentation for generation parameters and persona-validation lists.

---

## 5. Personal Financial Profile (PFP) Specification

### 5.1 Classifying Dimensions

A user's PFP is defined by three binary dimensions:

| Dimension | Split | Operational measure |
| :--- | :--- | :--- |
| Financial stability | Stable / Variable | Coefficient of variation of income, `CV = σ(income) / μ(income)` |
| Financial weight | Flexible / Obligated | `obligation_ratio = (essential + obligatory expenses) / total expenses` |
| Financial tolerance | Tolerant / At-Risk | Emergency runway: months of expenses covered by savings |

<!-- Section 5.2 (SME-Draft Thresholds) is gated: it enters the spec once `docs/rrl/literature-matrix.md` and `docs/rrl/benchmarks.md` are completed (at least v0.1.0). -->

<!-- ### 5.2 SME-Draft Thresholds

Thresholds are **researcher-defined and SME-validated**. The comprehensive literature review found no PFMS study that formally defines these thresholds, so the researchers define them and validate them with the SME (see `../archive/Notes.md`). Current SME-draft thresholds (provisional, pending the SME validation protocol):

| Dimension | Threshold | Rationale (SME draft) |
| :--- | :--- | :--- |
| Financial stability | `CV < 0.5` → Stable | Moderate income-consistency cutoff |
| Financial weight | `ratio > 0.6` → Obligated | Essential obligations exceed 60% of expenses |
| Financial tolerance | `runway ≥ 3 months` → Tolerant | 3-month buffer before depletion |

These thresholds are calibrated on the training persona set (ROC-based cutoff selection) rather than fixed a priori, so the rule-based candidate is compared fairly against learned candidates. -->


### 5.3 Label Space

Combining the three dimensions yields eight PFP classes:

| Class | Financial Stability | Financial Weight | Financial Tolerance |
| :--- | :--- | :--- | :--- |
| Stable/Flexible/Tolerant | Stable | Flexible | Tolerant |
| Stable/Flexible/At-Risk | Stable | Flexible | At-Risk |
| Stable/Obligated/Tolerant | Stable | Obligated | Tolerant |
| Stable/Obligated/At-Risk | Stable | Obligated | At-Risk |
| Variable/Flexible/Tolerant | Variable | Flexible | Tolerant |
| Variable/Flexible/At-Risk | Variable | Flexible | At-Risk |
| Variable/Obligated/Tolerant | Variable | Obligated | Tolerant |
| Variable/Obligated/At-Risk | Variable | Obligated | At-Risk |

### 5.4 Classification Modes

The PFP module accepts two input modes (see PFP MDD v1.3):

| Mode | Payload | Purpose |
| :--- | :--- | :--- |
| `STANDARD` | `payload.historical_transactions` (list) | Profile from available transaction history, including partial, short-window, or inconsistent self-logged data. |
| `QUESTIONNAIRE` | `payload.questionnaire_answers` (dict) | Deterministic newcomer mapping from onboarding answers to an initial PFP when no transaction history exists. |

### 5.5 Module Output Contract

The module returns, at minimum: `prediction` (one of the eight PFP classes), `financial_stability_score`, `financial_weight_score`, `financial_tolerance_score` (each calibrated 0–1), `confidence` (0–1), and `status` (`SUCCESS`, `FAILURE`, or `FALLBACK`). The module must never throw an unhandled exception; it always returns the structured contract with fallback values if the model fails.

### 5.6 How a User's PFP Is Derived

1. A new user completes onboarding, producing an initial PFP via `QUESTIONNAIRE` mode (§5.4).
2. As transaction history accumulates, `STANDARD` mode produces a behavioral classification; the user can review, accept, reject, or manually change the assigned profile and request reassessment later (see OB-03).
3. The current assignment and its explanation are cached locally for offline display.

---

## 6. Functional Requirements

The authoritative, full requirement statements are in the Requirements Engineering document (`reqs-eng.md`), cited by ID below. This section summarizes each module.

### 6.0 Cross-cutting: Offline Sync Behavior

All offline-capable modules inherit the sync behavior of §3.2: local-first writes, queued domain operations, idempotent push, delete-wins conflict resolution, tombstone deletes, user-ownership validation before persistence and before remote application, and audited rejected/losing operations. Online-only flows (registration, login, logout, password reset/update, account deletion, data export, push token registration) are excluded from offline behavior.

### 6.1 Identity and Authenticated App Entry

| ID | Component | Requirement summary |
| :--- | :--- | :--- |
| ID-01 | Registration | Create account with email + password; block invalid/empty submissions; require email verification before access. |
| ID-02 | Login | Email/password or Google Authentication; deny until credentials valid; detect network failure and show a network-required message. |
| ID-03 | Session Management | Preserve local financial records and sync queue rows on login/network failure; never store credentials, passwords, or tokens in local business tables. |

### 6.2 Consent, Privacy, and Governance

| ID | Component | Requirement summary |
| :--- | :--- | :--- |
| CP-01 | Thesis Disclosure | Inform users during onboarding the app is a thesis project for Filipino working young adults 20–40 in Metro Manila; clarify the app is open to all users. |
| CP-02 | Consent Management | Allow give/withhold of data consent for training/evaluation; review, accept, reject, or change consent at any time; never use non-target-user data without explicit consent. |
| CP-03 | Privacy Settings | Display privacy/data-use settings accessibly; distinguish app access from research eligibility; cache privacy settings for offline display. |

### 6.3 Onboarding and Profile Assessment

| ID | Component | Requirement summary |
| :--- | :--- | :--- |
| OB-01 | Guided Onboarding | Guided flow capturing financial situation before recommendations; resume partially completed onboarding. |
| OB-02 | Eligibility Capture | Capture target-population eligibility fields (age, work/residence location); execute server-side profile classification during onboarding. |
| OB-03 | Profile Assignment | Assign and explain a behavioral profile; allow review/accept/reject/manual change; support later reassessment; cache profile + explanation offline. |

### 6.4 Taxonomy and Restriction Levels

| ID | Component | Requirement summary |
| :--- | :--- | :--- |
| TX-01 | Category Groups | Provide spending/income category groups reflecting Filipino financial realities; deliver system taxonomy as pull-only catalog data. |
| TX-02 | User Categories | Allow custom categories/subcategories; sync via user CRUD sync. |
| TX-03 | Restriction Levels | Allow marking expenses protected or fixed so non-negotiable spending is not recommended for reduction; validate restriction data downstream; sync via user CRUD sync. |

### 6.5 Financial Accounts, Income Sources, and Obligations

| ID | Component | Requirement summary |
| :--- | :--- | :--- |
| FA-01 | Financial Accounts | Create/view/edit/delete accounts offline; display local balance; scope to authenticated user; sync via user CRUD sync. |
| FA-02 | Income Sources | Record income sources with amount, frequency, and associated account; sync via user CRUD sync. |
| FA-03 | Obligations | Record obligations with amount, due date, frequency, and category; sync via user CRUD sync. |
| FA-04 | Ownership and Sync | Validate FK references against the user's ownership boundary before persistence and sync application; use tombstone deletes. |

### 6.6 Ledger, Transactions, Templates, and Recurring Records

| ID | Component | Requirement summary |
| :--- | :--- | :--- |
| LG-01 | Transaction Entry | Record income, expense, and transfer transactions with amount, date, category, account, notes; record offline with immediate local SQLite writes. |
| LG-02 | Templates | Create templates from existing/new transactions; apply a template to record a transaction quickly. |
| LG-03 | Recurring Records | Set recurring income/expense records with frequency and end conditions; generate and queue recurring entries automatically. |
| LG-04 | Transaction Management | Edit, delete, search, sort, and filter transactions; reflect local balance effects immediately; sync via user CRUD sync. |

### 6.7 Dashboard

| ID | Component | Requirement summary |
| :--- | :--- | :--- |
| DA-01 | Financial Overview | Show balance, recent activity, budget status, alerts, savings goals, debts, and forecasts; render from local SQLite, not server-only endpoints; update immediately after local writes. |
| DA-02 | Dashboard Degradation | Show stale/cached labels when downstream data is unavailable; degrade gracefully without blocking the dashboard. |

### 6.8 Budgets and Allocations

| ID | Component | Requirement summary |
| :--- | :--- | :--- |
| BU-01 | Budget CRUD | Create/view/edit/delete budgets offline; set amounts, date ranges, and allocation methods; sync via user CRUD sync. |
| BU-02 | Budget Actions | Activate, close, or archive budgets; show budget health indicators from spending against allocations. |
| BU-03 | Restriction-Aware Validation | Validate allocations against protected/fixed restrictions; never recommend reductions to protected categories. |

### 6.9 Budget Recommendations

| ID | Component | Requirement summary |
| :--- | :--- | :--- |
| BR-01 | Recommendation Generation | Generate budget recommendations via server-side calculation; cache results locally for offline display. |
| BR-02 | Recommendation Display | Explain the reasoning; indicate which categories are protected from cuts. |
| BR-03 | Recommendation Actions | Allow accept, modify, or reject per recommendation; never apply without explicit acceptance. |

### 6.10 Forecasts and Expected Events

| ID | Component | Requirement summary |
| :--- | :--- | :--- |
| FO-01 | Forecast Generation | Generate/refresh forecasts through online execution; cache runs, series, points, explanations, and metadata for offline display. |
| FO-02 | Forecast Display | Show total and category-level forecasts; label as personalized, fallback, or newcomer; show a four-line next-month category-group graph. |
| FO-03 | Expected Events | Show expected recurring events within forecast periods; incorporate into forecast display. |

### 6.11 Anomalies and Overspending

| ID | Component | Requirement summary |
| :--- | :--- | :--- |
| AN-01 | Anomaly Detection | Detect unusual spending/overspending risks (Isolation Forest executed on the server); cache results for offline display. |
| AN-02 | Anomaly Display | Explain the unusual pattern; allow users to mark intentional spending as expected. |
| AN-03 | Suppression Rules | Allow whitelist rules to suppress repeated warnings; sync approved rules via user CRUD sync; account for culturally expected spending patterns. |

### 6.12 Alerts and Notifications

| ID | Component | Requirement summary |
| :--- | :--- | :--- |
| AL-01 | Alert Inbox | Show cached alerts in-app; allow acknowledge, dismiss, snooze, and clear-all. |
| AL-02 | Notification Preferences | Configure preferences per alert category; sync via user CRUD sync. |
| AL-03 | Overspending Visibility | Show in-app overspending alerts prominently; allow marking as expected to suppress repeated warnings. |

### 6.13 Savings Goals

| ID | Component | Requirement summary |
| :--- | :--- | :--- |
| SG-01 | Goal CRUD | Create/view/edit/delete goals (target amount, progress, target date, category/type, contribution history, priority); sync via user CRUD sync. |
| SG-02 | Contributions | Contribute to goals with immediate local progress; show cached projections offline. |
| SG-03 | Goal Categories | Support Filipino savings categories once validated through RRL, interviews, and SME; emergency fund as a likely high-priority category subject to final validation. |
| SG-04 | Reallocation | Require explicit approval before recommending fund reallocation; create replenishment reminders for reduced lower-priority goals. |

### 6.14 Debt Management

| ID | Component | Requirement summary |
| :--- | :--- | :--- |
| DM-01 | Debt CRUD | Create/view/edit/delete debt records (lender, type, balance, schedule, interest, minimum payment, due date, payment history, priority, hardship state); sync via user CRUD sync. |
| DM-02 | Debt Payments | Log payments with immediate balance/progress updates; group debts by category/type. |
| DM-03 | Repayment Strategies | Choose per-group strategy (Snowball or Avalanche where validated); show cached projections offline. |
| DM-04 | Forecast Integration | Incorporate debt payments and payoff projections into savings forecasts, reflecting freed cash flow after payoff. |

### 6.15 Reports and Analytics

| ID | Component | Requirement summary |
| :--- | :--- | :--- |
| RA-01 | Report Generation | Generate weekly, monthly, and custom date-range reports from local aggregate data; show cached comparison labels. |
| RA-02 | Report Contents | Include spending summaries, budget-vs-actual, forecast summaries, savings progress, and debt summaries; support category-level views. |
| RA-03 | Report Layout | Usable across mobile and desktop viewports. |

### 6.16 Help and Problem Reporting

| ID | Component | Requirement summary |
| :--- | :--- | :--- |
| HP-01 | FAQ and Help | Display locally bundled static FAQ/help content. |
| HP-02 | Problem Reporting | Submit problem reports (subject, message body, registered email reply-to) via online-only email dispatch using the internal user ID; show network-required message offline; no ticketing/agent/admin workflow. |

### 6.17 Offboarding and Account Governance

| ID | Component | Requirement summary |
| :--- | :--- | :--- |
| OG-01 | Data Export | Export financial data as a downloadable file with explicit confirmation; requires connectivity. |
| OG-02 | Account Deletion | Request deletion with explicit confirmation of consequences; protect unsynced local changes before logout/deletion; attempt a final sync before destructive actions. |

### 6.18 Offline Sync Status, Recovery, and Discard Flows

| ID | Component | Requirement summary |
| :--- | :--- | :--- |
| SY-01 | Sync Status Display | Show pending and failed sync counts accessibly; allow viewing the specific operations. |
| SY-02 | Manual Retry and Recovery | Trigger manual retry; show an exhausted-failure recovery sheet with friendly, non-technical messages; paginate failed operations. |
| SY-03 | Discard Flows | Require explicit confirmation before discarding failed local changes; mark discarded rows and retain them temporarily before cleanup; use safe, user-facing copy. |

---

## 7. Machine Learning Model Specifications

The ML modules are specified in Odin-ML, not repeated here:

- **PFP Classifier** — PFP MDD v1.3 (`Odin-ML/training/docs/1_problem-statement/module-design-document.md`) and `feature-set.md` v1.0; §5 of this document defines the classifying dimensions, label space, and classification modes.
- **Forecaster** — Forecaster MDD v2.3 (same directory) and Phase-6 training documentation (`Odin-ML/training/docs/6_model-training/forecaster-training.md`).
- **Anomaly Detector** — Anomaly Detector MDD (same directory) and Phase-6 training documentation (`Odin-ML/training/docs/6_model-training/anomaly-training.md`).
- **Budget Optimizer** — pending definition in Odin-ML (see §3.5, §3.6).

Candidate algorithms per model, feature sets, evaluation protocols, and KPIs are authoritative in those documents. Reported Phase-6 training results (e.g., Random Forest winning the forecaster tier comparison, One-Class SVM winning the anomaly tier comparison) are **preliminary initial-training outcomes, not final model selections**; the pre-registered selection rule (highest primary metric within the latency budget, favoring the simpler/more interpretable candidate within a pre-registered margin against any higher tier) governs final selection.

---

## 8. Data Specification

### 8.1 Data Sources

| Source | Use | Role |
| :--- | :--- | :--- |
| PSA 2023 FIES (NCR microdata, Public Use File) | Income/expense totals, family size, per-capita income, decile ranking, urban/rural | Primary statistical basis for persona parameterization. |
| BSP 2021 Consumer Finance Report | Archetype segmentation | Primary basis for archetype definitions. |
| PSA 2026 Consumer Price Index | Average unit prices for transaction generation | Input to transaction synthesis. |
| PUEPS Pre-Survey | User expectations | Informs NFRs. |

### 8.2 Key Data Limitation

FIES PUFs are anonymized per RA 10173 and PSA disclosure policy and contain only aggregate/geographic fields. There is no available Filipino dataset pairing household totals with granular behavioral transaction data, so **behavioral features must be synthetically injected**. Consequently, the dataset represents the **general population of the NCR** (no age/employment linkage); this is an explicit limitation of the thesis.

Detailed data-pipeline, feature-set, split, and schema documentation lives in Odin-ML (`Odin-ML/training/docs/`, `Odin-ML/training/synth/`); this specification keeps only the data overview.

---

## 9. Non-Functional Requirements

Non-functional requirements are organized by ISO 25010 quality characteristics (see `prd.md`, Testing Decisions; `../archive/topic-outline (OLD).md` §12.A for the evaluation framing).

| ISO 25010 characteristic | Requirement |
| :--- | :--- |
| Functional suitability | Offline-capable modules must work without network; online-only flows must clearly signal connectivity requirements. Model quality is evaluated separately from UI quality. |
| Performance efficiency | Dashboard and reports read from local aggregates (no server-only reads for offline modules); ML P95 latency targets: PFP < 500 ms, Forecast < 1 s; mobile layouts usable on narrow phone widths without horizontal scrolling. |
| Usability | Manual entry friction minimized (templates, recurring records, immediate dashboard updates); intelligent outputs explained in plain language; no shame-based messaging; destructive actions require explicit confirmation. Evaluated via SUS. |
| Reliability | Offline-first sync must be idempotent, delete-wins, tombstone-based, and audited; failed operations recoverable without data loss; module failures degrade gracefully (stale/cached labels). |
| Security | Auth credentials, passwords, access tokens, and refresh tokens never stored in local business tables; all user-owned data scoped to the authenticated user; ownership checks on every read and write; TLS 1.3 in transit, AES-256 at rest; no raw exception messages or technical errors shown to users; no PII in client-side storage keys. |
| Maintainability | Modules loosely coupled via APIs and events; model artifacts versioned with training-data hashes and metadata; drift monitoring (PSI, ADWIN/CUSUM) and retraining triggers defined. |
| Portability | Android-first with web review flows; ML service deployable as Docker containers; model artifacts portable (`.joblib`, `.pth`). |
| Privacy | Consent management per RA 10173; thesis disclosure during onboarding; research eligibility distinct from app access; privacy settings cached locally; data export available; account deletion with explicit confirmation and final-sync safeguard. |

---

## 10. External Interfaces

### 10.1 Sync API

- `POST /odin/api/sync/push` — push queued domain operations (idempotent; applied-operation tracking; ownership validation).
- `POST /odin/api/sync/pull` — pull remote changes and tombstones for convergence.

### 10.2 ML Service API (via API Gateway)

| Endpoint | Service |
| :--- | :--- |
| `POST /api/v1/pfp/classify` (+ `/batch`, `/user/{id}/history`, `/user/{id}/latest`) | PFP Classifier |
| `POST /api/v1/forecast/predict` (+ `/batch`, `/user/{id}/history`) | Forecaster |
| `POST /api/v1/anomaly/detect` (+ `/batch`, `/user/{id}/alerts`, `/user/{id}/baseline`) | Anomaly Detector |
| `POST /api/v1/analyze`, `GET /api/v1/user/{id}`, `POST /api/v1/classify`, `POST /api/v1/forecast` | Gateway convenience/aggregation |

Each service exposes `/health`, `/ready`, and `/metrics`.

### 10.3 Authentication

Google Authentication (OAuth) for login, in addition to email/password with email verification.

### 10.4 Data Formats

- Transaction event and request/response payloads use JSON (schemas in `module-integration.md` v1.0).
- Model artifacts: `.joblib` (scikit-learn), `.pkl`/`.joblib` (preprocessing pipelines), `.pth` (PyTorch weights).
- Data export: downloadable file of the user's financial data (requires connectivity and explicit confirmation).

### 10.5 Device and Platform

- Android is the primary supported platform; iOS development/testing/distribution is out of scope.
- Web access may exist for development or wider-layout review flows; mobile remains the primary product experience.
- ML services run as Docker containers on a cloud provider to be determined.

---

## 11. Constraints and Assumptions

### 11.1 Scope Boundaries (Out of Scope)

- iOS-specific development, testing, or distribution.
- Bank API, e-wallet API integration, or automatic transaction import.
- OCR/receipt scanning or external CSV/spreadsheet import (unless separately approved).
- Licensed financial, investment, retirement, legal, or tax advice; automated bill payment; credit-score monitoring.
- Full production-grade fraud detection or third-party merchant enrichment.
- Public marketplace deployment beyond thesis needs.
- Multi-tenant/organization/workspace architecture (single-user-account model).
- Admin dashboards, agent roles, or ticketing workflows for problem reporting.

### 11.2 Constraints

- **Data representativeness:** the dataset represents the general NCR population because PUFs are anonymized (stripped of age/employment identifiers); training-inference covariate shift is mitigated by calibration weights and sensitivity analysis but remains a limitation.
- **Thresholds:** income-stability and obligation-weight thresholds are researcher-defined (literature gap) and must be validated by the SME.
- **Synthetic-data dependence:** all KPIs are measured on synthetic personas; synthetic-to-real generalization is untested until prototype-user data exists. Injected behavioral features are based on RRL and expert judgment, a documented threat to validity.
- **Offline-first:** business data flows must remain offline-capable; auth and governance flows are online-only.
- **Android-first:** mobile layout is primary; narrow viewports must remain usable.
- **Cloud provider and infrastructure details** (provider, orchestration) are TBD.

### 11.3 Assumptions

- Target users are Filipino working young adults aged 20–40 living or working in Metro Manila.
- All users may use the app, but only consenting, qualifying target-user data is used for model training/evaluation.
- Expense patterns concentrate around paydays and holidays, with essentials largely inelastic (see Odin-ML `synthetic-injection-rules.md`).
- Module outputs are decision support, not licensed financial advice; users keep final control.
- Savings and debt category standards remain provisional until SME/RRL validation.

---

## 12. Dependencies

### 12.1 Service Dependencies

```text
Mobile app
   └── API Gateway ──▶ Transaction Service ──▶ Event Bus
                                                      ├──▶ PFP Classifier
                                                      ├──▶ Forecaster
                                                      ├──▶ Anomaly Detector
                                                      └──▶ Budget Optimizer
Event Bus ──▶ Response Aggregator ──▶ Mobile app
```

- The PFP Classifier, Forecaster, Anomaly Detector, and Budget Optimizer depend on the Transaction Service's transaction events (PFP: 3 months of history; Forecaster: 6 months; Anomaly: per transaction, after a 6-month baseline; Budget: current allocations and obligations).
- The API Gateway aggregates module outputs for combined analysis; a module failure must not block the others (graceful degradation).
- The Forecaster and Budget modules consume each other's outputs; the PFP module consumes onboarding/questionnaire data for cold start; Debt Management feeds freed-cash-flow inputs into savings forecasts.

### 12.2 Data Dependencies

| Module | Depends on |
| :--- | :--- |
| PFP Classifier | Onboarding questionnaire answers (`QUESTIONNAIRE` mode), transaction history (`STANDARD` mode), SME-validated thresholds. |
| Forecaster | Daily aggregated expenses by category, calendar/payday features, user metadata for cold start. |
| Anomaly Detector | Transaction stream and per-user baseline; whitelist/suppression rules and culturally expected spending inputs. |
| Budget Optimizer | Budget allocations, transaction history, protected/fixed restriction levels, forecast outputs. |

### 12.3 Document Dependencies

- This specification depends on the MDDs, PRD, and Requirements Engineering document for authoritative detail (Appendix A).
- Feature sets depend on the shared synthetic data pipeline; module features are triplicated per module at feature engineering.
- The critical path for ML work: shared data phase → triplicated feature engineering → parallel module training (PFP 41 days, Forecaster 44 days, Anomaly 41 days).

---

## 13. Appendices

### A. References

- Odin thesis: *Development of Odin: A Personal Finance Management Application for Filipino Working Young Adults Using Random Forest, LSTM, and Isolation Forest* — topical outline (`../planning-management/topical-outline.md`).
- Odin PRD (`prd.md`).
- Odin Requirements Engineering (`reqs-eng.md`).
- Screen descriptions (`../design-architecture/screen-descriptions/00-index.md`).
- System notes and addenda (`../archive/Notes.md`).
- Public User Expectations and Perception Survey (`../assessment-evaluation/survey/PUEPS.md`).
- Model design documents and training documentation (`Odin-ML/training/docs/`): PFP MDD v1.3, Forecaster MDD v2.3, Anomaly Detector MDD, `feature-set.md` v1.0, `module-integration.md` v1.0, `deployment-architecture.md` v1.0, `dimension-threshold-candidates.md`, Phase-6 training docs (`6_model-training/`), and synthetic data (`training/synth/`).
- Preserved historical reference: `specification (OLD).md` (v4.0) and `topic-outline (OLD).md` under `../archive/`.

### B. Revision History Detail

| Version | Date | Section(s) affected | Change detail |
| :--- | :--- | :--- | :--- |
| 0.1.0 | 2026.08.05 | All | Skeleton created with Metadata, Acronyms, and section placeholders. |
| 0.2.0 | 2026.08.06 | All | Drafted full content for sections 0–13 and Appendices; renumbered sections sequentially (Document Control remains §0); added change log and references; bumped version and date. |
| 0.3.0 | 2026.08.08 | All | Manual correction of content; review comments applied: Budget Optimizer added to architecture, offline/online split documented, `fbp→pfp` naming, glossary trimmed and reordered, §5.2 thresholds gated, §7/§8.3–8.7 reduced to references, links updated. |