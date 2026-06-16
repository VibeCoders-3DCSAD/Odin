# Plan: Odin API Backend Implementation

> Source PRD: `Papers/Documents/PRD-Full-Odin-App.md`
>
> Source schema: `App/odin/schema/draft-schema-priority-modules-v3.sql`
>
> Current bootstrap: `App/odin/apps/api/src/index.ts`

## Proposed File Structure

```text
App/odin/apps/api/
  src/
    index.ts
    app.ts
    config/
      env.ts
      supabase.ts
    middleware/
      auth.ts
      error-handler.ts
      request-logger.ts
      validate-request.ts
    routes/
      auth.routes.ts
      me.routes.ts
      privacy.routes.ts
      consent.routes.ts
      onboarding.routes.ts
      profile.routes.ts
      eligibility.routes.ts
      category-groups.routes.ts
      categories.routes.ts
      subcategories.routes.ts
      category-restrictions.routes.ts
      subcategory-restrictions.routes.ts
      accounts.routes.ts
      income-sources.routes.ts
      obligations.routes.ts
      transactions.routes.ts
      transaction-templates.routes.ts
      transaction-drafts.routes.ts
      transaction-retention-settings.routes.ts
      recurring-templates.routes.ts
      recurring-occurrences.routes.ts
      dashboard.routes.ts
      budgets.routes.ts
      budget-allocations.routes.ts
      budget-strategy-configs.routes.ts
      budget-health.routes.ts
      budget-recommendations.routes.ts
      forecasts.routes.ts
      expected-events.routes.ts
      anomaly-evaluations.routes.ts
      overspending-evaluations.routes.ts
      alerts.routes.ts
      alert-notification-preferences.routes.ts
      push-device-tokens.routes.ts
      anomaly-whitelist-rules.routes.ts
      alert-suppression-rules.routes.ts
      savings-goals.routes.ts
      savings-goal-contributions.routes.ts
      savings-goal-allocation-preferences.routes.ts
      savings-goal-priority-table.routes.ts
      debts.routes.ts
      debt-payments.routes.ts
      debt-priorities.routes.ts
      debt-hardship-plans.routes.ts
      debt-strategy-preferences.routes.ts
      debt-projections.routes.ts
      reports.routes.ts
      export-requests.routes.ts
      account-deletion-requests.routes.ts
      support-tickets.routes.ts
    services/
      auth/
        registration.service.ts
        session.service.ts
        password-reset.service.ts
      onboarding/
        onboarding.service.ts
        eligibility.service.ts
        profile-assessment.service.ts
      taxonomy/
        category-groups.service.ts
        categories.service.ts
        subcategories.service.ts
        category-restrictions.service.ts
        subcategory-restrictions.service.ts
      ledger/
        accounts.service.ts
        income-sources.service.ts
        obligations.service.ts
        transactions.service.ts
        transaction-templates.service.ts
        recurring-templates.service.ts
        recurring-occurrences.service.ts
        transaction-drafts.service.ts
        transaction-retention.service.ts
      dashboard/
        dashboard-summary.service.ts
      budgets/
        budget.service.ts
        budget-validation.service.ts
        budget-allocation.service.ts
        budget-strategy-config.service.ts
        budget-health.service.ts
        budget-recommendation.service.ts
      forecasts/
        forecast.service.ts
        expected-events.service.ts
      anomalies/
        anomaly-evaluation.service.ts
        overspending-evaluation.service.ts
        anomaly-whitelist.service.ts
        alert-suppression.service.ts
      alerts/
        alert-inbox.service.ts
        notification-preferences.service.ts
        push-device-token.service.ts
      savings/
        savings-goal.service.ts
        savings-contribution.service.ts
        savings-allocation.service.ts
      debt/
        debt-account.service.ts
        debt-payment.service.ts
        debt-priority.service.ts
        debt-hardship.service.ts
        debt-projection.service.ts
        debt-strategy.service.ts
      reports/
        report.service.ts
        report-export.service.ts
      support/
        support-ticket.service.ts
    actions/
      auth/
        register.action.ts
        exchange-token.action.ts
        logout.action.ts
        request-password-reset.action.ts
      onboarding/
        start-onboarding.action.ts
        save-onboarding-response.action.ts
        submit-onboarding.action.ts
        save-eligibility-profile.action.ts
        confirm-profile.action.ts
        reject-profile.action.ts
        select-profile.action.ts
        reassess-profile.action.ts
      ledger/
        create-transaction.action.ts
        edit-transaction.action.ts
        delete-transaction.action.ts
        create-transaction-template.action.ts
        create-recurring-template.action.ts
        pause-recurring-template.action.ts
        resume-recurring-template.action.ts
        stop-recurring-template.action.ts
        post-recurring-occurrence.action.ts
      budgets/
        create-budget.action.ts
        activate-budget.action.ts
        validate-budget.action.ts
        save-budget-strategy-config.action.ts
        generate-budget-recommendation.action.ts
        accept-budget-recommendation.action.ts
        reject-budget-recommendation.action.ts
      forecasts/
        generate-forecast.action.ts
        refresh-forecast.action.ts
      anomalies/
        evaluate-anomaly.action.ts
        mark-expected.action.ts
        mark-unexpected.action.ts
        snooze-anomaly.action.ts
      alerts/
        acknowledge-alert.action.ts
        dismiss-alert.action.ts
        clear-alert.action.ts
        snooze-alert.action.ts
      savings/
        create-savings-goal.action.ts
        add-savings-contribution.action.ts
        complete-savings-goal.action.ts
        archive-savings-goal.action.ts
      debt/
        create-debt-account.action.ts
        add-debt-payment.action.ts
        save-debt-priority-order.action.ts
        create-debt-hardship-plan.action.ts
        generate-debt-projection.action.ts
        refresh-debt-projection.action.ts
      reports/
        generate-report.action.ts
      governance/
        request-data-export.action.ts
        request-account-deletion.action.ts
        confirm-account-deletion.action.ts
        cancel-account-deletion.action.ts
      support/
        create-support-ticket.action.ts
      models/
        profile.model.ts
        eligibility-profile.model.ts
        onboarding.model.ts
        consent.model.ts
        privacy-settings.model.ts
        category-group.model.ts
        category.model.ts
        subcategory.model.ts
        category-restriction.model.ts
        subcategory-restriction.model.ts
        account.model.ts
        income-source.model.ts
        obligation.model.ts
        transaction.model.ts
        transaction-template.model.ts
        transaction-line-item.model.ts
        recurring-template.model.ts
        recurring-occurrence.model.ts
        transaction-retention-settings.model.ts
        budget.model.ts
        budget-allocation.model.ts
        budget-strategy-config.model.ts
        budget-health.model.ts
        budget-recommendation.model.ts
        forecast.model.ts
        forecast-series.model.ts
        forecast-point.model.ts
        anomaly.model.ts
        overspending-evaluation.model.ts
        alert.model.ts
        push-device-token.model.ts
        savings-goal.model.ts
        savings-contribution.model.ts
        debt-account.model.ts
        debt-priority.model.ts
        debt-hardship-plan.model.ts
        debt-payment.model.ts
        debt-projection.model.ts
        report.model.ts
        support-ticket.model.ts
      validators/
        auth.validator.ts
        onboarding.validator.ts
        profile.validator.ts
        taxonomy.validator.ts
        ledger.validator.ts
        budget.validator.ts
        forecast.validator.ts
        anomaly.validator.ts
        alert.validator.ts
        savings.validator.ts
        debt.validator.ts
        report.validator.ts
        governance.validator.ts
        support.validator.ts
  utils/
      ownership.ts
      money.ts
      dates.ts
      pagination.ts
      explainers.ts
      idempotency.ts
      logger.ts
      result.ts
```

## Branching Plan

Use a linear branch sequence so each merge unlocks the next dependent slice. Keep each branch small enough that a reviewer can understand the route set, service logic, and schema touchpoints without cross-checking unrelated modules.

### Branch Order

1. `feat/api-foundation`
   - Scope: `src/index.ts`, `src/app.ts`, config, auth middleware, validation middleware, error handling, request logging, and shared utilities.
   - Reason: every later branch depends on a stable Express bootstrap, Supabase client setup, and ownership guard.
   - Review size: infrastructure only, no domain logic.

2. `feat/identity-governance`
   - Scope: auth registration, auth session exchange, password reset, logout, `me`, eligibility profile, privacy settings, consents, export requests, account deletion requests, and push device tokens.
   - Reason: onboarding and all user-owned data depend on identity and consent state.
   - Review size: keep account governance separate from onboarding so reviewers do not mix lifecycle rules with profile logic.

3. `feat/onboarding-profile`
   - Scope: onboarding sessions, onboarding responses, submission, profile assessment, profile assignment confirmation/rejection, manual selection, and reassessment.
   - Reason: this branch depends on the identity/governance branch and unlocks profile-aware downstream modules.
   - Review size: keep the onboarding flow and the profile classifier wiring in the same branch because they share the same source data.

4. `feat/taxonomy`
   - Scope: category groups, categories, subcategories, and category/subcategory restrictions.
   - Reason: ledger, budgets, forecasts, alerts, savings, and debt all depend on stable taxonomy data.
   - Review size: keep user-owned taxonomy writes and restriction settings together because protected and locked amounts affect later budget logic.

5. `feat/accounts-obligations`
   - Scope: financial accounts, income sources, financial obligations.
   - Reason: transaction entry and budget planning need account containers and recurring obligation context.
   - Review size: keep accounts and obligations together because they share the same ownership and validation rules.

6. `feat/ledger-transactions`
   - Scope: transactions, transaction line items, transaction templates, transaction drafts, transaction retention settings, recurring templates, recurring occurrences, and ledger audit events.
   - Reason: this is the raw data backbone for forecasts, anomaly detection, budgets, reports, savings contributions, and debt payments.
   - Review size: split only if needed between CRUD and recurring generation, but keep them adjacent in the sequence.

7. `feat/budget-core`
   - Scope: dashboard summary, budgets, budget allocations, budget validation, budget strategy configs, budget health snapshots, and budget recommendation generation/acceptance.
   - Reason: the dashboard and budget solver need transaction history, taxonomy, and profile output already merged.
   - Review size: keep dashboard summary and budget setup close together because they are the same user journey.

8. `feat/forecast-alerts`
   - Scope: forecasts, expected spending events, anomaly evaluations, overspending evaluations, alert inbox, notification preferences, whitelist rules, and suppression rules.
   - Reason: forecast output feeds alerts, and alerts need the same transaction and category context.
   - Review size: keep forecast generation next to alert generation so the explanation and suppression rules stay easy to review.

9. `feat/savings-goals`
   - Scope: savings goals, contributions, allocation preferences, and the savings goal priority table.
   - Reason: savings depends on budget allocation and transaction history, but should remain separate from debt so reviewers can focus on one goal model at a time.
   - Review size: keep goal CRUD next to contribution logging and allocation rules because they share the same source-of-truth record.

10. `feat/debt-management`
    - Scope: debt accounts, debt payments, debt priorities, debt hardship plans, debt strategy preferences, and debt projections.
    - Reason: debt projections depend on ledger history and should be reviewed immediately after the savings goal branch because both consume future allocation logic.
    - Review size: keep account CRUD next to projection generation so the stale-projection rules are visible in one pass.

11. `feat/reports-governance`
    - Scope: reports, metrics, breakdowns, comparisons, snapshots, support tickets, data export completion, and account deletion workflow completion.
    - Reason: reporting depends on nearly every prior branch and should be merged only after the core data flows are stable.
    - Review size: keep report generation and governance completion together because both are read-heavy and audit-sensitive.

### Branching Rules

- Prefer one phase-aligned branch at a time unless a branch is purely bootstrap or purely read-only.
- Do not mix adjacent phases in the same branch unless the second phase is a direct prerequisite and the added scope remains small.
- Keep route handlers, services, and actions for one branch adjacent in the tree so the review diff is localized.
- When a branch spans multiple routes, group the routes by the same domain object first, then by action order.
- If a branch grows beyond a few related endpoints, split it before merge rather than letting one review cover unrelated systems.
- Merge sequence should follow the route catalog order so later branches never need to guess at missing shared contracts.

## Architectural decisions

- **Base path**: use `/odin/api` for all application routes.
- **Bootstrap routes**: keep `GET /health` and `GET /` as the existing service checks.
- **Auth boundary**: Supabase Auth owns registration, email confirmation, login, and identity. The API should register users through Supabase Auth, accept a Supabase access token, establish the user context through the project's Supabase token-exchange flow (`signInWithToken` in the current repo language), and then scope every request to `auth.uid()`.
- **Ownership rule**: every read, write, and join against user-owned data must verify `profiles.user_id` ownership before use. RLS is the last line of defense, not the only one.
- **Route style**: use plural resource routes, `POST` for create, `PATCH` for partial edit, `DELETE` for soft delete, and explicit action routes for confirmation, approval, rejection, refresh, and archive.
- **Data shape rule**: raw ledger tables are the source of truth. Forecasts, budgets, recommendations, projections, alerts, reports, and health snapshots are derived snapshots that must preserve their input snapshots and explanation fields.
- **Budgeting rule**: protected categories must never be reduced by recommendation logic unless the user explicitly changes protection settings.
- **Alerts rule**: budget overspending alerts must always be stored and visible in-app, even if external notifications are disabled.
- **Debt and savings rule**: debt and savings projections are generated on demand and become stale when the user changes balances, payments, strategy, or contribution assumptions.
- **Eligibility rule**: onboarding cannot be treated as complete until demographic, geography, and primary employment eligibility fields have been captured in the app-owned eligibility profile.
- **Notification rule**: notification preferences and push device registration are separate concerns; alert delivery endpoints should not double as device-token storage.
- **Response style**: keep responses thin and readable. Return the created or requested record, a compact `meta` object, and any explanation or derived artifacts needed by the UI.

## Build Phases

### Phase 1: Identity, Consent, and Onboarding

What to build:

- Supabase session bootstrap.
- Login, registration, logout, and password reset routes.
- `profiles`, eligibility profile, privacy settings, consent history, export requests, deletion requests, and push device token registration.
- Onboarding sessions, onboarding responses, and profile assessment flows.
- Profile assignment confirmation, rejection, manual selection, and reassessment.

Acceptance criteria:

- A new user can register, confirm their email, open Odin from the confirmation link, create a profile row, and continue into onboarding.
- A returning user can sign in and land on the dashboard when onboarding is complete.
- Consent, privacy, and account-governance records are captured as timestamped audit data.
- A user can review a suggested financial profile, confirm it, reject it, manually select a profile, or request another assessment.
- The API captures Filipino, Metro Manila, and employment eligibility fields before onboarding completion is marked done.

### Phase 2: Taxonomy, Accounts, and Ledger

What to build:

- Category-group read routes, category read routes, category CRUD for user-owned categories, and user-created subcategories.
- Category and subcategory restriction routes.
- Income sources, financial accounts, and financial obligations.
- Transaction create, edit, delete, list, detail, line-item, and template routes.
- Transaction drafts for offline-tolerant entry.
- Transaction retention settings routes.
- Recurring transaction templates and occurrences.

Acceptance criteria:

- Transaction logging works for income, expense, and transfer flows.
- Itemized expenses and split-category expenses can be stored without the client inventing hidden persistence rules.
- Transfers stay excluded from income and expense totals.
- Recurring templates can be paused, resumed, stopped, and surfaced in history.
- All ledger writes create audit events and stay idempotent when a client mutation id is supplied.

### Phase 3: Budgets, Dashboard, and Recommendations

What to build:

- Dashboard summary route for the home screen.
- Budget CRUD routes and budget allocation editing.
- Budget strategy config routes and restriction-aware validation rules.
- Budget health read routes for prescribed-versus-actual tracking.
- Recommendation generation, presentation, modification, acceptance, and rejection.
- Budget validation and activation logic.
- Savings allocation distribution inside budget recommendations.

Acceptance criteria:

- A user can create, edit, activate, close, and archive a budget.
- A user can define or select reusable budget strategy configs that match the schema-backed strategy rules.
- Protected allocations are preserved during recommendation generation.
- The dashboard can show current balance, budget status, recent transactions, alerts, goals, and forecast highlights from one read path.

### Phase 4: Forecasts, Expected Events, and Alerts

What to build:

- Forecast generation, lookup, refresh, and display routes.
- Expected spending events for cultural and calendar context.
- Anomaly evaluation records, overspending evaluation read routes, anomaly feedback actions, whitelist rules, and suppression rules.
- Alert inbox, alert actions, notification preferences, and push-delivery registration.

Acceptance criteria:

- Forecasts can return a next-month view with Essentials, Obligatory, Discretionary, and Financial Allocation lines.
- Cold-start forecasts are clearly labeled as fallback-based.
- Alerts capture budget overspending, anomaly detection, forecast advisories, savings milestones, and debt management events.

### Phase 5: Savings Goals and Debt Management

What to build:

- Savings goal CRUD, contribution logging, priority table, and allocation preferences.
- Goal completion and archiving actions.
- Debt account CRUD, payment logging, debt hierarchy ordering, hardship plans, strategy preferences, and projection generation.
- On-demand debt projections and stale-projection refresh logic.

Acceptance criteria:

- Savings goals remain the source of truth for target amount, saved amount, progress state, priority, and allocation strategy.
- Debt repayment projections can be regenerated when strategy, extra payment, balance, or payment history changes.
- Debt priority ordering and hardship records are readable by the UI without reconstructing them from notes or alerts.
- The UI can read a priority table for goals and a projection table for debts without reconstructing the logic client-side.

### Phase 6: Reporting, Support, and Governance Completion

What to build:

- Report run generation and report detail routes.
- Metrics, category breakdowns, budget comparisons, forecast comparisons, savings snapshots, and debt snapshots.
- Support ticket, support event, and support attachment routes.
- Data export and account deletion request completion workflows.

Acceptance criteria:

- Reports can be generated for week, month, and custom periods.
- Help and problem reporting is available from the settings surface with auditable ticket history.
- Export and deletion workflows are auditable.

## Route Alignment Summary

Use this section as the canonical route inventory for the v3 schema. If a detailed example block later in the document conflicts with this summary, this summary wins.

### Add Route Families

- `/odin/api/eligibility-profile`
- `/odin/api/category-groups`
- `/odin/api/categories` user CRUD in addition to read routes
- `/odin/api/category-restrictions`
- `/odin/api/subcategory-restrictions`
- `/odin/api/transaction-templates`
- `/odin/api/transaction-retention-settings`
- `/odin/api/budget-strategy-configs`
- `/odin/api/budgets/:id/health`
- `/odin/api/overspending-evaluations`
- `/odin/api/push-device-tokens`
- `/odin/api/debt-priorities`
- `/odin/api/debt-hardship-plans`
- `/odin/api/support-tickets`

### Rename or Reshape Existing Route Families

- `GET /odin/api/categories` must stop returning category-group rows and instead return actual `categories` rows from the v3 schema.
- Add `GET /odin/api/category-groups` for the four top-level buckets previously exposed through `GET /odin/api/categories`.
- `/odin/api/transactions` create, read, and update payloads must support transaction line items so expense-item splits are first-class.
- `POST /odin/api/data-export-requests/:id/complete` should be treated as an internal job/system transition, not a normal user-facing route.

### Remove Route Families

- `/odin/api/internal/model-evaluations`

## Route Catalog

### Phase 1: Identity, Consent, and Onboarding

#### Identity and Governance

POST /odin/api/auth/register | Register with email and password through Supabase Auth

request:
```json
{
  "payload": {
    "email": "user@example.com", // Email address for the new Supabase account.
    "password": "plain-text-password", // Password that satisfies Supabase Auth requirements.
    "display_name": "Juan Dela Cruz" // Optional bootstrap display name mirrored into the profile row later.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "user": {
      "id": "uuid" // Supabase user id for the new account.
    },
    "session": {
      "access_token": "supabase-access-token", // Client stores this so the confirmation-link open can keep the user authenticated.
      "refresh_token": "supabase-refresh-token" // Client uses this to restore or refresh the session when needed.
    },
    "activation": {
      "email_confirmation_required": true, // Supabase must confirm the email before the account is considered activated.
      "delivery": "email_link" // Confirmation arrives through the Supabase email link.
    }
  }
}
```

POST /odin/api/auth/session | Exchange a Supabase token for an app session

request:
```json
{
  "headers": {
    "authorization": "Bearer <supabase_access_token>" // Supabase access token that identifies the signed-in user.
  },
  "payload": {
    "refresh_token": "<supabase_refresh_token>" // Optional refresh token used when the client needs a fresh session.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "user": {
      "id": "uuid" // Supabase user id that owns the app data.
    },
    "profile": {
      "id": "uuid" // App-owned profile row for the signed-in user.
    },
    "onboarding": {
      "status": "in_progress" // Tells the client whether to continue onboarding or go to the dashboard.
    },
    "privacy_settings": {
      "personalization_enabled": true // Controls profile, forecast, and recommendation personalization.
    }
  }
}
```

POST /odin/api/auth/password-reset | Request a password reset email

request:
```json
{
  "payload": {
    "email": "user@example.com" // Email address used for Supabase account recovery.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "requested": true // Confirms the reset request was accepted without revealing account existence.
  }
}
```

POST /odin/api/auth/logout | End the current session

request:
```json
{
  "payload": {
    "reason": "user_requested" // Optional client hint for analytics and logging.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "logged_out": true // Tells the client to clear local auth state.
  }
}
```

GET /odin/api/me | Read the authenticated user summary

request:
```json
{
  "query": {
    "include": "profile,privacy,consents,assignment" // Optional expansion set for the settings and onboarding screens.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "profile": {
      "display_name": "Juan Dela Cruz" // Human-readable name shown in the app.
      "metro_manila_city": "Quezon City" // User's self-declared Metro Manila location.
    },
    "privacy_settings": {
      "personalization_enabled": true // Whether recommendation and forecast personalization is allowed.
      "notifications_opt_in": true // Whether user allows notification delivery.
    },
    "current_profile": {
      "profile_label": "stable_obligated" // Active financial behavioral profile label.
      "confirmed": true // Whether the user accepted the current profile assignment.
    }
  }
}
```

PATCH /odin/api/me | Update display profile fields

request:
```json
{
  "payload": {
    "display_name": "Juan Dela Cruz" // Optional friendly name for the UI.
    "birth_year": 1996 // Birth year used for profile context and thesis demographics.
    "metro_manila_city": "Quezon City" // Self-declared city used in onboarding and settings.
    "occupation": "Software Engineer" // Free-text occupation for the profile summary.
  }
}
```

GET /odin/api/eligibility-profile | Read the user's eligibility profile

This route owns the Filipino, Metro Manila, and primary employment fields required by the updated specification and stored in `user_eligibility_profiles`.

PATCH /odin/api/eligibility-profile | Create or update the user's eligibility profile

This route captures `date_of_birth`, `is_filipino`, `metro_manila_presence`, `metro_manila_locality_code`, and `primary_employment_classification` before onboarding can be marked complete.

response:
```json
{
  "headers": {},
  "payload": {
    "profile": {
      "id": "uuid" // Updated profile row.
      "updated_at": "2026-06-12T12:00:00Z" // Audit timestamp for the change.
    }
  }
}
```

GET /odin/api/privacy/settings | Read privacy settings

request:
```json
{
  "query": {}
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "personalization_enabled": true // Allows personalization in forecasts and recommendations.
    "model_training_opt_in": false // Controls whether data can be used for model training.
    "research_evaluation_opt_in": false // Controls thesis/evaluation participation.
    "notifications_opt_in": true // Controls whether alerts may be delivered.
    "data_retention_days": 365 // Optional retention window for app-managed data.
  }
}
```

PATCH /odin/api/privacy/settings | Update privacy settings

request:
```json
{
  "payload": {
    "personalization_enabled": true // Enables or disables user-specific guidance.
    "model_training_opt_in": false // Consent for model training use.
    "research_evaluation_opt_in": false // Consent for research evaluation use.
    "notifications_opt_in": true // Consent for alert delivery.
    "data_retention_days": 365 // Optional retention policy in days.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "privacy_settings": {
      "updated_at": "2026-06-12T12:00:00Z" // Timestamp of the persisted change.
    }
  }
}
```

GET /odin/api/consents | List consent history

request:
```json
{
  "query": {
    "consent_kind": "personalization" // Optional filter for a single consent type.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "items": [
      {
        "consent_kind": "terms" // The consent category that was recorded.
        "status": "granted" // Current status for this consent record.
        "version": "2026-06" // Version string tied to the consent text.
        "recorded_at": "2026-06-12T12:00:00Z" // Audit timestamp for the record.
      }
    ]
  }
}
```

POST /odin/api/consents | Record a consent decision

request:
```json
{
  "payload": {
    "consent_kind": "personalization" // The type of consent being recorded.
    "status": "granted" // The user's decision for this consent.
    "version": "2026-06" // Consent text version used at the time of capture.
    "source": "onboarding" // Where the consent was collected.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "consent": {
      "id": "uuid" // Audit record identifier.
      "status": "granted" // Persisted consent outcome.
    }
  }
}
```

POST /odin/api/data-export-requests | Request a data export

request:
```json
{
  "payload": {
    "format": "json" // Export format used for the user download.
    "reason": "user_request" // Optional explanation for audit logs.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "request": {
      "id": "uuid" // Export request id.
      "status": "requested" // Export workflow state.
    }
  }
}
```

POST /odin/api/account-deletion-requests | Request account deletion

request:
```json
{
  "payload": {
    "reason": "privacy_concern" // Optional user explanation for the deletion request.
    "scheduled_delete_at": "2026-07-12T12:00:00Z" // Optional delayed deletion time.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "request": {
      "id": "uuid" // Deletion request id.
      "status": "requested" // Workflow state for the deletion lifecycle.
    }
  }
}
```

POST /odin/api/account-deletion-requests/:id/confirm | Confirm a deletion request

request:
```json
{
  "payload": {
    "confirmation": true // Explicit user confirmation required before deletion can proceed.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "request": {
      "status": "processing" // Indicates the deletion workflow is now active.
    }
  }
}
```

POST /odin/api/account-deletion-requests/:id/cancel | Cancel a deletion request

request:
```json
{
  "payload": {
    "cancel_reason": "changed_my_mind" // Optional reason for audit history.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "request": {
      "status": "cancelled" // The deletion request is no longer active.
    }
  }
}
```

#### Onboarding and Profile

POST /odin/api/onboarding/sessions | Start an onboarding session

request:
```json
{
  "payload": {
    "current_step_key": "employment" // First onboarding step the user is on.
    "income_type": "stable" // Stable or variable income classification.
    "income_frequency": "semi_monthly" // Pay cycle used for budgeting and forecasts.
    "declared_monthly_income_centavos": 4500000 // Optional self-reported monthly income in centavos.
    "fixed_obligations_centavos": 1200000 // Optional fixed obligation estimate in centavos.
    "has_dependents": true // Whether the user supports dependents or family.
    "dependent_count": 2 // Number of dependents if known.
    "family_support_centavos": 500000 // Estimated monthly family support or remittance amount.
    "selected_budget_period_kind": "semi_monthly" // Budget period the user prefers.
    "raw_answers": {} // Full onboarding questionnaire payload for later replay.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "session": {
      "id": "uuid" // Onboarding session id.
      "status": "in_progress" // Session lifecycle state.
    }
  }
}
```

PATCH /odin/api/onboarding/sessions/:id | Update onboarding answers

request:
```json
{
  "payload": {
    "income_type": "variable" // Updated income type if the user changes their answer.
    "income_frequency": "monthly" // Updated income frequency.
    "fixed_obligations_centavos": 1500000 // Revised obligation estimate.
    "has_dependents": true // Updated dependent flag.
    "raw_answers": {} // Full answer snapshot for the updated step.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "session": {
      "id": "uuid" // Same onboarding session id.
      "status": "in_progress" // Still editable until submit.
    }
  }
}
```

POST /odin/api/onboarding/sessions/:id/responses | Save one onboarding answer

request:
```json
{
  "payload": {
    "question_key": "income_stability" // Stable key for the onboarding question.
    "answer": {
      "value": "variable" // The selected answer or free-text payload.
    }
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "response": {
      "id": "uuid" // Upserted onboarding response id.
      "updated_at": "2026-06-12T12:00:00Z" // Last write timestamp.
    }
  }
}
```

POST /odin/api/onboarding/sessions/:id/submit | Submit onboarding for assessment

request:
```json
{
  "payload": {
    "confirm_data_use": true // Explicit submit confirmation before profile assessment.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "assessment": {
      "id": "uuid" // Profile assessment id.
      "status": "suggested" // Result state after running the classifier.
      "proposed_profile_label": "stable_obligated" // Suggested financial behavioral profile.
      "confidence_score": 0.9123 // Confidence used to explain the result.
    },
    "assignment": {
      "id": "uuid" // Assignment row created from the assessment.
      "confirmation_required": true // The user still needs to confirm the suggested profile.
    }
  }
}
```

GET /odin/api/onboarding/sessions/current | Read the active onboarding session

request:
```json
{
  "query": {}
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "session": {
      "id": "uuid" // Active onboarding session id.
      "status": "in_progress" // Current onboarding state.
      "current_step_key": "income" // The step the UI should resume.
    }
  }
}
```

POST /odin/api/profile/reassess | Request a profile reassessment

request:
```json
{
  "payload": {
    "reason": "behavior_changed" // Why the user or system wants a reassessment.
    "use_recent_transactions": true // Whether recent ledger activity should be part of the assessment.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "assessment": {
      "id": "uuid" // New assessment run id.
      "status": "queued" // Queue state if assessment is asynchronous.
    }
  }
}
```

GET /odin/api/profile/assignment/current | Read the active profile assignment

request:
```json
{
  "query": {}
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "assignment": {
      "profile_label": "variable_flexible" // Current active profile label.
      "confirmed_at": "2026-06-12T12:00:00Z" // When the user confirmed or accepted it.
      "explanation": "Variable income and low obligation load..." // User-facing explanation text.
    },
    "drivers": [
      {
        "driver_key": "income_type" // Rule or feature that influenced the profile.
        "impact_label": "high" // Human-readable impact label.
        "explanation": "Income was marked variable." // Short explanation for the UI.
      }
    ]
  }
}
```

POST /odin/api/profile/assignment/confirm | Confirm the suggested profile

request:
```json
{
  "payload": {
    "assignment_id": "uuid" // Suggested assignment that the user accepts.
    "confirmation": true // Explicit acceptance of the current label.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "assignment": {
      "status": "confirmed" // The profile is now active.
      "confirmation_required": false // No further confirmation needed.
    }
  }
}
```

POST /odin/api/profile/assignment/reject | Reject the suggested profile

request:
```json
{
  "payload": {
    "assignment_id": "uuid" // Suggested assignment being rejected.
    "override_reason": "my_income_is_stable" // Why the label is not correct.
  }
}
```

POST /odin/api/profile/assignment/select | Manually select a financial profile

This route supports manual classification and profile reassignment when the user chooses a profile directly instead of accepting a generated assignment.

response:
```json
{
  "headers": {},
  "payload": {
    "assignment": {
      "status": "rejected" // The suggested profile will not be activated.
    }
  }
}
```

### Phase 2: Taxonomy, Accounts, and Ledger

#### Taxonomy

GET /odin/api/category-groups | List broad category buckets

request:
```json
{
  "query": {
    "include_subcategories": true // Optional expansion for dashboard and setup screens.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "items": [
      {
        "slug": "essentials" // Broad bucket used by budget and forecast screens.
        "label": "Essentials" // Display label for the bucket.
        "description": "Basic needs and necessary day-to-day spending." // User-facing bucket explanation.
      }
    ]
  }
}
```

GET /odin/api/categories | List accessible categories

This route returns actual `categories` rows from the v3 schema. User-owned category CRUD is allowed for non-system rows, and the older broad-bucket behavior now belongs to `GET /odin/api/category-groups`.

GET /odin/api/subcategories | List accessible subcategories

request:
```json
{
  "query": {
    "kind": "expense" // Optional filter for income, expense, or transfer_adjustment.
    "category_slug": "obligatory" // Optional broad category filter.
    "include_system": true // Include seeded system rows.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "items": [
      {
        "slug": "obligatory_family_support" // Stable subcategory slug.
        "label": "Family Support" // Display label for the UI.
        "category_slug": "obligatory" // Broad category that owns the subcategory.
        "is_protected_default": true // Default protection behavior for recommendations.
      }
    ]
  }
}
```

GET /odin/api/category-restrictions | List user category restrictions

PUT /odin/api/category-restrictions/:categoryId | Upsert one category restriction

GET /odin/api/subcategory-restrictions | List user subcategory restrictions

PUT /odin/api/subcategory-restrictions/:subcategoryId | Upsert one subcategory restriction

POST /odin/api/subcategories | Create a user-defined subcategory

request:
```json
{
  "payload": {
    "slug": "personal_subscriptions" // Stable slug for the user-defined row.
    "kind": "expense" // Type of subcategory being created.
    "category_id": "uuid" // Broad category that owns the row when kind is expense.
    "label": "Subscriptions" // Display label.
    "description": "Streaming and software subscriptions." // User-facing description.
    "is_filipino_context": false // Optional context flag for the taxonomy.
    "is_active": true // Whether the user can still pick this row.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "subcategory": {
      "id": "uuid" // Newly created subcategory id.
      "slug": "personal_subscriptions" // Stable identifier for future requests.
    }
  }
}
```

PATCH /odin/api/subcategories/:id | Update a user-defined subcategory

request:
```json
{
  "payload": {
    "label": "Monthly Subscriptions" // Updated display label.
    "description": "Streaming, software, and online services." // Updated description text.
    "is_active": true // Whether the row remains selectable.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "subcategory": {
      "id": "uuid" // Updated row id.
      "updated_at": "2026-06-12T12:00:00Z" // Audit timestamp.
    }
  }
}
```

DELETE /odin/api/subcategories/:id | Delete a user-defined subcategory

request:
```json
{
  "payload": {
    "reason": "merged_into_another_category" // Optional audit reason.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "deleted": true // Confirms the row was soft-deleted or archived.
  }
}
```

#### Accounts, Income, and Obligations

GET /odin/api/accounts | List financial accounts

request:
```json
{
  "query": {
    "status": "active" // Optional filter for active, archived, or deleted rows.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "items": [
      {
        "id": "uuid" // Account id.
        "name": "BPI Savings" // Account label shown in the UI.
        "kind": "bank" // Cash, bank, e-wallet, savings, credit_card, loan, or other.
        "current_balance_centavos": 1523400 // Stored balance used by dashboard and budget logic.
      }
    ]
  }
}
```

POST /odin/api/accounts | Create a financial account

request:
```json
{
  "payload": {
    "name": "BPI Savings" // Friendly name for the account.
    "kind": "bank" // Account type.
    "opening_balance_centavos": 1500000 // Starting balance in centavos.
    "current_balance_centavos": 1500000 // Initial current balance.
    "credit_limit_centavos": null // Optional credit limit for credit cards.
    "include_in_dashboard_balance": true // Whether this account contributes to the home screen balance.
    "institution_name": "BPI" // Optional financial institution label.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "account": {
      "id": "uuid" // Created account id.
      "status": "active" // Account lifecycle state.
    }
  }
}
```

PATCH /odin/api/accounts/:id | Update a financial account

request:
```json
{
  "payload": {
    "name": "BPI Emergency Fund" // Updated account label.
    "current_balance_centavos": 1600000 // Corrected balance after reconciliation.
    "include_in_dashboard_balance": true // Whether the balance still appears on the home screen.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "account": {
      "id": "uuid" // Updated account id.
      "updated_at": "2026-06-12T12:00:00Z" // Audit timestamp.
    }
  }
}
```

DELETE /odin/api/accounts/:id | Archive or delete an account

request:
```json
{
  "payload": {
    "mode": "archive" // Prefer archive for historical safety; delete only when the data model allows it.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "deleted": true // Confirms the account is no longer active.
  }
}
```

GET /odin/api/income-sources | List income sources

request:
```json
{
  "query": {
    "is_active": true // Optional filter for active income sources.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "items": [
      {
        "id": "uuid" // Income source id.
        "name": "Monthly Salary" // Friendly source name.
        "income_type": "stable" // Stable or variable income.
        "frequency": "semi_monthly" // Pay cadence used by forecasts and budget setup.
      }
    ]
  }
}
```

POST /odin/api/income-sources | Create an income source

request:
```json
{
  "payload": {
    "name": "Monthly Salary" // Friendly name for the income stream.
    "income_type": "stable" // Stable or variable income classification.
    "frequency": "semi_monthly" // Repeat cadence for expected payments.
    "expected_amount_centavos": 4500000 // Optional expected amount.
    "min_amount_centavos": null // Optional lower bound for variable income.
    "max_amount_centavos": null // Optional upper bound for variable income.
    "payday_day_of_month": 15 // Optional first payday day.
    "payday_second_day_of_month": 30 // Optional second payday day.
    "payday_day_of_week": null // Optional weekday for weekly pay.
    "notes": "Main employment income" // Optional user note.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "income_source": {
      "id": "uuid" // Created income source id.
      "next_expected_date": "2026-06-30" // Next predicted income date.
    }
  }
}
```

PATCH /odin/api/income-sources/:id | Update an income source

request:
```json
{
  "payload": {
    "expected_amount_centavos": 5000000 // Updated expected amount.
    "next_expected_date": "2026-06-30" // Updated next payment date.
    "is_active": true // Keep the source available for forecasts.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "income_source": {
      "id": "uuid" // Updated income source id.
      "updated_at": "2026-06-12T12:00:00Z" // Audit timestamp.
    }
  }
}
```

DELETE /odin/api/income-sources/:id | Deactivate an income source

request:
```json
{
  "payload": {
    "reason": "job_changed" // Optional reason for the history.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "deleted": true // Confirms the source is inactive or archived.
  }
}
```

GET /odin/api/obligations | List financial obligations

request:
```json
{
  "query": {
    "status": "active" // Optional filter for active obligations.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "items": [
      {
        "id": "uuid" // Obligation id.
        "name": "Family Support" // Human-readable obligation name.
        "amount_centavos": 500000 // Recurring obligation amount.
        "frequency": "monthly" // Repeat cadence.
        "protected_by_default": true // Whether budgeting should protect this line by default.
      }
    ]
  }
}
```

POST /odin/api/obligations | Create a financial obligation

request:
```json
{
  "payload": {
    "subcategory_id": "uuid" // Subcategory that the obligation maps to.
    "recurring_template_id": null // Optional template link if generated from a recurring transaction.
    "name": "Family Support" // Name shown in the UI and reports.
    "amount_centavos": 500000 // Amount per cycle.
    "frequency": "monthly" // How often the obligation repeats.
    "due_day_of_month": 15 // Optional payment day.
    "is_family_support": true // Marks Filipino family support obligations explicitly.
    "is_dependent_support": false // Marks support for dependents.
    "protected_by_default": true // Controls budget recommendation protection.
    "starts_on": "2026-06-01" // Optional start date.
    "ends_on": null // Optional end date.
    "notes": "Send every 15th" // Optional note.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "obligation": {
      "id": "uuid" // Created obligation id.
      "status": "active" // Lifecycle state.
    }
  }
}
```

PATCH /odin/api/obligations/:id | Update a financial obligation

request:
```json
{
  "payload": {
    "amount_centavos": 600000 // Updated recurring amount.
    "frequency": "monthly" // Updated frequency.
    "protected_by_default": true // Keep protection turned on.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "obligation": {
      "id": "uuid" // Updated obligation id.
      "updated_at": "2026-06-12T12:00:00Z" // Audit timestamp.
    }
  }
}
```

DELETE /odin/api/obligations/:id | End a financial obligation

request:
```json
{
  "payload": {
    "reason": "obligation_removed" // Optional audit note.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "deleted": true // Confirms the obligation is no longer active.
  }
}
```

#### Transactions and Recurring Ledger

GET /odin/api/transactions | List transactions

request:
```json
{
  "query": {
    "date_from": "2026-06-01" // Inclusive start of the review window.
    "date_to": "2026-06-30" // Inclusive end of the review window.
    "transaction_type": "expense" // Optional filter for income, expense, or transfer.
    "category_id": null // Optional broad category filter.
    "subcategory_id": null // Optional detailed category filter.
    "search": "groceries" // Optional note, merchant, or counterparty search string.
    "min_amount_centavos": null // Optional lower amount filter.
    "max_amount_centavos": null // Optional upper amount filter.
    "recurring_only": false // Optional filter for recurring-generated rows.
    "cursor": null // Opaque pagination cursor.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "items": [
      {
        "id": "uuid" // Transaction id.
        "transaction_type": "expense" // Income, expense, or transfer.
        "transaction_date": "2026-06-12" // Ledger date used by totals and reports.
        "amount_centavos": 25000 // Transaction amount in centavos.
        "subcategory_id": "uuid" // Detailed category selected by the user.
        "status": "posted" // Ledger status.
      }
    ],
    "summary": {
      "total_income_centavos": 0 // Income total for the selected range.
      "total_expense_centavos": 25000 // Expense total for the selected range.
      "transfer_count": 0 // Transfer rows excluded from income and expense totals.
    },
    "page": {
      "next_cursor": null // Opaque cursor for the next page.
    }
  }
}
```

POST /odin/api/transactions | Create a transaction

request:
```json
{
  "payload": {
    "client_mutation_id": "mobile-uuid-1" // Idempotency key for retry-safe writes.
    "transaction_type": "expense" // Income, expense, or transfer.
    "transaction_date": "2026-06-12" // Posting date for the ledger entry.
    "amount_centavos": 25000 // Money value in centavos.
    "subcategory_id": "uuid" // Detailed category; required for income and expense.
    "source_account_id": "uuid" // Required for expense and transfer transactions.
    "destination_account_id": null // Required for income and transfer transactions.
    "merchant_name": "SM Supermarket" // Optional merchant or payee.
    "counterparty_name": null // Optional name for a person or institution.
    "notes": "Weekly groceries" // Optional note shown in history.
    "recurring_template_id": null // Optional link to the recurring source template.
    "linked_savings_goal_id": null // Optional savings goal link when the transaction funds a goal.
    "linked_debt_account_id": null // Optional debt account link when the transaction is a debt payment.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "transaction": {
      "id": "uuid" // Created ledger row.
      "status": "posted" // Posted state after validation succeeds.
    },
    "linked_savings_contribution": {
      "id": "uuid" // Optional savings contribution record.
      "savings_goal_id": "uuid" // Goal that received the contribution.
    },
    "linked_debt_payment": {
      "id": "uuid" // Optional debt payment record.
      "debt_account_id": "uuid" // Debt account that received the payment.
    },
    "warnings": [
      "category is protected" // User-facing warnings that do not block the write.
    ]
  }
}
```

GET /odin/api/transactions/:id | Read one transaction

request:
```json
{
  "query": {
    "include": "events,links" // Optional expansion for detail screens.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "transaction": {
      "id": "uuid" // Transaction id.
      "transaction_type": "expense" // Transaction type.
      "amount_centavos": 25000 // Stored amount.
      "notes": "Weekly groceries" // User note.
    },
    "events": [
      {
        "action": "created" // Audit action.
        "created_at": "2026-06-12T12:00:00Z" // Event timestamp.
      }
    ]
  }
}
```

PATCH /odin/api/transactions/:id | Edit a transaction

request:
```json
{
  "payload": {
    "transaction_date": "2026-06-13" // Revised date.
    "amount_centavos": 26000 // Revised amount.
    "subcategory_id": "uuid" // Updated category.
    "merchant_name": "SM Supermarket" // Updated merchant label.
    "notes": "Corrected amount" // Updated note.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "transaction": {
      "id": "uuid" // Updated transaction id.
      "updated_at": "2026-06-12T12:00:00Z" // Audit timestamp.
    }
  }
}
```

DELETE /odin/api/transactions/:id | Delete a transaction

request:
```json
{
  "payload": {
    "reason": "duplicate_entry" // Optional delete reason for audit logs.
  }
}
```

Route note: transaction create, read, and update payloads must support `line_items` so a single transaction can persist multiple expense items or category splits through `transaction_line_items`.

GET /odin/api/transaction-templates | List reusable transaction templates

POST /odin/api/transaction-templates | Create a reusable transaction template

PATCH /odin/api/transaction-templates/:id | Update a reusable transaction template

DELETE /odin/api/transaction-templates/:id | Archive a reusable transaction template

response:
```json
{
  "headers": {},
  "payload": {
    "deleted": true // Confirms the transaction was soft-deleted.
  }
}
```

POST /odin/api/transaction-drafts | Save a transaction draft

request:
```json
{
  "payload": {
    "client_draft_id": "draft-uuid-1" // Stable client-side id for offline sync.
    "payload": {
      "transaction_type": "expense" // Drafted transaction type.
      "amount_centavos": 25000 // Drafted amount.
      "transaction_date": "2026-06-12" // Drafted date.
    },
    "captured_offline_at": "2026-06-12T11:59:00Z" // Optional offline timestamp.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "draft": {
      "id": "uuid" // Draft row id.
      "status": "pending" // Draft sync state.
    }
  }
}
```

GET /odin/api/transaction-drafts | List transaction drafts

request:
```json
{
  "query": {
    "status": "pending" // Optional draft status filter.
  }
}
```

GET /odin/api/transaction-retention-settings | Read transaction retention settings

PATCH /odin/api/transaction-retention-settings | Update transaction retention settings

response:
```json
{
  "headers": {},
  "payload": {
    "items": [
      {
        "client_draft_id": "draft-uuid-1" // Stable draft identifier.
        "status": "pending" // Sync state.
        "last_error": null // Last sync error, if any.
      }
    ]
  }
}
```

POST /odin/api/recurring-templates | Create a recurring transaction template

request:
```json
{
  "payload": {
    "transaction_type": "expense" // Recurring income, expense, or transfer template.
    "name": "Rent" // Display label for the template.
    "amount_centavos": 1200000 // Recurring amount.
    "subcategory_id": "uuid" // Required for income and expense templates.
    "source_account_id": "uuid" // Required for expense and transfer templates.
    "destination_account_id": null // Required for income and transfer templates.
    "frequency": "monthly" // Repeat cadence.
    "interval_count": 1 // Repeat interval multiplier.
    "day_of_month": 5 // Optional day-of-month schedule.
    "second_day_of_month": null // Optional second monthly payday.
    "day_of_week": null // Optional weekly schedule.
    "starts_on": "2026-07-01" // Template start date.
    "ends_on": null // Optional end date.
    "reminder_enabled": true // Whether reminder notifications should be generated.
    "reminder_days_before": 3 // How many days before the occurrence to remind.
    "notes": "Due every 5th" // Optional note.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "template": {
      "id": "uuid" // Recurring template id.
      "status": "active" // Template lifecycle state.
      "next_occurrence_date": "2026-07-05" // Next scheduled occurrence.
    }
  }
}
```

GET /odin/api/recurring-templates | List recurring templates

request:
```json
{
  "query": {
    "status": "active" // Optional filter for active, paused, stopped, or deleted templates.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "items": [
      {
        "id": "uuid" // Template id.
        "name": "Rent" // Template label.
        "next_occurrence_date": "2026-07-05" // Next run date.
        "reminder_enabled": true // Whether reminders are enabled.
      }
    ]
  }
}
```

PATCH /odin/api/recurring-templates/:id | Update a recurring template

request:
```json
{
  "payload": {
    "amount_centavos": 1250000 // Updated recurring amount.
    "day_of_month": 5 // Updated schedule rule.
    "reminder_days_before": 2 // Updated reminder lead time.
    "notes": "Updated rent amount" // Updated note.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "template": {
      "id": "uuid" // Updated template id.
      "updated_at": "2026-06-12T12:00:00Z" // Audit timestamp.
    }
  }
}
```

POST /odin/api/recurring-templates/:id/pause | Pause a recurring template

request:
```json
{
  "payload": {
    "reason": "temporary_stop" // Optional reason for the pause.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "template": {
      "status": "paused" // Template no longer generates occurrences while paused.
    }
  }
}
```

POST /odin/api/recurring-templates/:id/resume | Resume a paused recurring template

request:
```json
{
  "payload": {
    "reason": "resume_schedule" // Optional reason for the resume.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "template": {
      "status": "active" // Template starts generating occurrences again.
    }
  }
}
```

POST /odin/api/recurring-templates/:id/stop | Stop a recurring template

request:
```json
{
  "payload": {
    "reason": "no_longer_needed" // Optional reason for stopping the series.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "template": {
      "status": "stopped" // Template will not generate future occurrences.
    }
  }
}
```

GET /odin/api/recurring-occurrences | List recurring occurrences

request:
```json
{
  "query": {
    "status": "scheduled" // Optional filter for scheduled, posted, skipped, failed, or cancelled occurrences.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "items": [
      {
        "id": "uuid" // Occurrence id.
        "scheduled_date": "2026-07-05" // Scheduled date for the posting.
        "status": "scheduled" // Occurrence lifecycle state.
      }
    ]
  }
}
```

POST /odin/api/recurring-occurrences/:id/post | Post a recurring occurrence

request:
```json
{
  "payload": {
    "client_mutation_id": "occurrence-post-1" // Idempotency key for retry-safe posting.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "occurrence": {
      "status": "posted" // Occurrence was converted into a transaction.
      "generated_transaction_id": "uuid" // The posted transaction id.
    }
  }
}
```

POST /odin/api/recurring-occurrences/:id/skip | Skip a recurring occurrence

request:
```json
{
  "payload": {
    "reason": "not_needed_this_month" // Optional skip reason.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "occurrence": {
      "status": "skipped" // The occurrence will not post.
    }
  }
}
```

### Phase 3: Budgets, Dashboard, and Recommendations

#### Dashboard, Budgets, and Recommendations

GET /odin/api/dashboard/summary | Read the home screen summary

request:
```json
{
  "query": {
    "range": "current_period" // Optional dashboard window hint.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "current_balance_centavos": 2350000 // Current tracked balance across included accounts.
    "active_budget": {
      "id": "uuid" // Current active budget id.
      "status": "active" // Budget lifecycle state.
      "spent_amount_centavos": 850000 // Current spend against the active budget.
    },
    "recent_transactions": [
      {
        "id": "uuid" // Transaction id.
        "transaction_type": "expense" // Transaction type.
        "amount_centavos": 25000 // Transaction amount.
      }
    ],
    "alerts": {
      "unread_count": 2 // Count used by the badge on the home screen.
      "top_items": [] // A small list of the most urgent alerts.
    },
    "forecast_highlights": {
      "status": "available" // Forecast freshness and availability state.
      "next_month_total_centavos": 1200000 // Main headline forecast value.
    },
    "goal_highlights": {
      "active_goal_count": 3 // Number of active savings goals.
      "overdue_goal_count": 1 // Count of goals behind schedule.
    },
    "debt_highlights": {
      "active_debt_count": 2 // Number of active debt accounts.
      "next_due_date": "2026-06-15" // Next debt due date shown on the dashboard.
    }
  }
}
```

GET /odin/api/budgets | List budgets

request:
```json
{
  "query": {
    "status": "active" // Optional budget status filter.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "items": [
      {
        "id": "uuid" // Budget id.
        "status": "active" // Draft, active, closed, archived, or deleted.
        "period_start": "2026-06-01" // Budget period start.
        "period_end": "2026-06-15" // Budget period end.
        "total_amount_centavos": 5000000 // Total budgeted amount.
      }
    ]
  }
}
```

POST /odin/api/budgets | Create a budget

request:
```json
{
  "payload": {
    "period_kind": "semi_monthly" // Budget cadence used by the user.
    "period_start": "2026-06-01" // Inclusive start date.
    "period_end": "2026-06-15" // Exclusive end date.
    "budget_period_days": 14 // Number of days in the budget period.
    "total_amount_centavos": 5000000 // Total amount that can be allocated.
    "starting_balance_centavos": 2350000 // Optional balance at the start of the budget.
    "strategy": "zero_based" // Budget strategy used by the solver or planner.
    "surplus_handling": "carry_forward" // What should happen with leftover money.
    "deficit_handling": "warn_only" // What should happen when allocations exceed the budget.
    "allow_deficit_planning": false // Whether the user intentionally wants a deficit budget.
    "allocations": [
      {
        "allocation_scope": "category" // Category or subcategory line.
        "category_id": "uuid" // Category line target.
        "subcategory_id": null // Present only for subcategory-scoped lines.
        "allocated_amount_centavos": 1200000 // Allocation amount.
        "is_protected_snapshot": true // Snapshot of whether the line is protected.
        "priority_weight": 5 // Optional importance weight.
      }
    ]
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "budget": {
      "id": "uuid" // Budget header id.
      "status": "draft" // Budget starts as draft unless explicitly activated.
    },
    "allocations": [
      {
        "id": "uuid" // Allocation row id.
        "category_id": "uuid" // Category or subcategory target.
        "allocated_amount_centavos": 1200000 // Persisted allocation amount.
      }
    ]
  }
}
```

GET /odin/api/budgets/:id | Read one budget

request:
```json
{
  "query": {
    "include": "allocations,events" // Optional expansion for detail screens.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "budget": {
      "id": "uuid" // Budget id.
      "status": "active" // Budget lifecycle state.
      "total_amount_centavos": 5000000 // Budget total.
      "surplus_handling": "carry_forward" // Surplus policy.
      "deficit_handling": "warn_only" // Deficit policy.
    },
    "allocations": [] // Persisted allocation rows for the budget.
  }
}
```

PATCH /odin/api/budgets/:id | Update a budget

request:
```json
{
  "payload": {
    "total_amount_centavos": 5200000 // Revised budget total.
    "surplus_handling": "reallocate_to_goals" // Updated surplus handling behavior.
    "deficit_handling": "warn_only" // Updated deficit handling behavior.
    "allow_deficit_planning": false // Whether deficit planning stays disabled.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "budget": {
      "id": "uuid" // Updated budget id.
      "updated_at": "2026-06-12T12:00:00Z" // Audit timestamp.
    }
  }
}
```

POST /odin/api/budgets/:id/activate | Activate a budget

request:
```json
{
  "payload": {
    "confirm_deficit": false // Explicit confirmation if the budget is overallocated.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "budget": {
      "status": "active" // Budget is now the active plan.
      "activated_at": "2026-06-12T12:00:00Z" // Activation timestamp.
    }
  }
}
```

POST /odin/api/budgets/:id/close | Close a budget

request:
```json
{
  "payload": {
    "reason": "period_ended" // Optional closure reason.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "budget": {
      "status": "closed" // Budget is no longer active.
    }
  }
}
```

POST /odin/api/budgets/:id/archive | Archive a budget

request:
```json
{
  "payload": {
    "reason": "replaced_by_new_plan" // Optional archival reason.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "budget": {
      "status": "archived" // Budget remains readable but not active.
    }
  }
}
```

POST /odin/api/budgets/:id/allocations | Add a budget allocation line

request:
```json
{
  "payload": {
    "allocation_scope": "subcategory" // Category or subcategory line.
    "category_id": "uuid" // Parent broad category.
    "subcategory_id": "uuid" // Detailed category when the allocation scope is subcategory.
    "allocated_amount_centavos": 300000 // Amount assigned to the line.
    "priority_weight": 3 // Optional priority weight.
    "notes": "Commute and fuel" // Optional note.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "allocation": {
      "id": "uuid" // Created allocation id.
      "budget_id": "uuid" // Parent budget id.
    }
  }
}
```

PATCH /odin/api/budget-allocations/:id | Update a budget allocation line

request:
```json
{
  "payload": {
    "allocated_amount_centavos": 320000 // Revised line amount.
    "priority_weight": 4 // Revised priority weight.
    "notes": "Raised for fare changes" // Optional note.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "allocation": {
      "id": "uuid" // Updated allocation row id.
      "updated_at": "2026-06-12T12:00:00Z" // Audit timestamp.
    }
  }
}
```

DELETE /odin/api/budget-allocations/:id | Remove a budget allocation line

request:
```json
{
  "payload": {
    "reason": "merged_into_essentials" // Optional audit note.
  }
}
```

GET /odin/api/budget-strategy-configs | List reusable budget strategy configs

POST /odin/api/budget-strategy-configs | Create a reusable budget strategy config

GET /odin/api/budget-strategy-configs/:id/rules | Read one strategy config's rules

PUT /odin/api/budget-strategy-configs/:id/rules | Replace one strategy config's rules

GET /odin/api/budgets/:id/health | Read budget health snapshots

This route exposes prescribed-versus-actual tracking from `budget_health_snapshots` for the budget health feature in the updated specification.

response:
```json
{
  "headers": {},
  "payload": {
    "deleted": true // Confirms the allocation line is removed.
  }
}
```

POST /odin/api/budgets/:id/validate | Validate a budget plan

request:
```json
{
  "payload": {
    "include_forecast_checks": true // Whether the validation should compare against the latest forecast.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "valid": false // Whether the plan passes hard validation checks.
    "warnings": [
      "allocations exceed total budget" // User-facing warning text.
    ]
  }
}
```

POST /odin/api/budget-recommendations | Generate a budget recommendation

request:
```json
{
  "payload": {
    "period_start": "2026-06-01" // Recommendation period start.
    "period_end": "2026-06-15" // Recommendation period end.
    "budget_period_days": 14 // Period length in days.
    "strategy": "fifty_thirty_twenty" // Budget strategy to solve.
    "forecast_run_id": "uuid" // Forecast snapshot used as the input.
    "target_savings_rate_bps": 2000 // Optional savings target in basis points.
    "surplus_handling": "save_to_priority_goal" // Surplus behavior to apply.
    "deficit_handling": "warn_only" // Deficit behavior to apply.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "recommendation": {
      "id": "uuid" // Generated recommendation id.
      "status": "draft" // Recommendation lifecycle state.
      "explanation_summary": "The user has strong obligations..." // Short user-facing summary.
    },
    "allocations": [
      {
        "id": "uuid" // Allocation row id.
        "recommended_amount_centavos": 1200000 // Suggested amount.
        "is_protected": true // Whether the solver treated the line as protected.
      }
    ],
    "constraints": [
      {
        "constraint_type": "protected_subcategory_floor" // Why the recommendation has this shape.
        "explanation": "Family support remains protected." // Plain-language explanation.
      }
    ],
    "savings_goal_allocations": [
      {
        "goal_id": "uuid" // Savings goal receiving the financial allocation portion.
        "allocation_strategy": "avalanche" // Snowball or avalanche.
        "recommended_amount_centavos": 50000 // Suggested contribution amount.
      }
    ]
  }
}
```

GET /odin/api/budget-recommendations | List budget recommendations

request:
```json
{
  "query": {
    "status": "draft" // Optional filter for draft, presented, modified, accepted, rejected, or expired.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "items": [
      {
        "id": "uuid" // Recommendation id.
        "status": "draft" // Recommendation state.
        "strategy": "zero_based" // Strategy used to produce the plan.
      }
    ]
  }
}
```

GET /odin/api/budget-recommendations/:id | Read one recommendation

request:
```json
{
  "query": {
    "include": "allocations,constraints,savings_goal_allocations" // Optional detail expansion.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "recommendation": {
      "id": "uuid" // Recommendation id.
      "status": "presented" // Current state.
      "solver_status": "complete" // Whether the solver finished successfully.
    },
    "allocations": [],
    "constraints": []
  }
}
```

PATCH /odin/api/budget-recommendations/:id | Modify a recommendation

request:
```json
{
  "payload": {
    "allocations": [
      {
        "allocation_id": "uuid" // Existing allocation row to edit.
        "adjusted_amount_centavos": 1250000 // User-edited amount.
      }
    ],
    "notes": "Move more money into essentials" // Optional edit note.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "recommendation": {
      "status": "modified" // Recommendation has been edited by the user.
    }
  }
}
```

POST /odin/api/budget-recommendations/:id/present | Mark a recommendation as presented

request:
```json
{
  "payload": {
    "screen": "budget_setup" // Where the recommendation was shown.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "recommendation": {
      "status": "presented" // Presentation state for audit history.
    }
  }
}
```

POST /odin/api/budget-recommendations/:id/accept | Accept a recommendation and create a budget

request:
```json
{
  "payload": {
    "create_budget": true // Explicitly copy the recommendation into the budgets table.
    "budget_name": "Semi-monthly June Budget" // Optional user-facing label.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "recommendation": {
      "status": "accepted" // Recommendation was accepted by the user.
      "accepted_budget_id": "uuid" // Budget created from the recommendation.
    }
  }
}
```

POST /odin/api/budget-recommendations/:id/reject | Reject a recommendation

request:
```json
{
  "payload": {
    "reason": "too_aggressive" // Optional rejection reason for future tuning.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "recommendation": {
      "status": "rejected" // Recommendation is not applied.
    }
  }
}
```

### Phase 4: Forecasts, Expected Events, and Alerts

#### Forecasts, Expected Events, and Model Outputs

POST /odin/api/forecasts | Generate a forecast

request:
```json
{
  "payload": {
    "granularity": "monthly" // Forecast grain used by the solver.
    "horizon_days": 30 // Forecast length in days.
    "forecast_start": "2026-07-01" // Forecast start date.
    "forecast_end": "2026-07-31" // Forecast end date.
    "targets": [
      "total_spending" // Requested series target.
      "category_spending" // Broad-category line series.
    ],
    "force_refresh": false // Whether to reuse a fresh forecast run if one exists.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "forecast_run": {
      "id": "uuid" // Forecast run id.
      "status": "available" // Forecast lifecycle state.
      "model_kind": "blended" // Cold-start or personalized model kind.
      "disclaimer_text": "Forecasts are inferential..." // User-facing disclaimer.
    },
    "series": [
      {
        "target": "category_spending" // Series target type.
        "label": "Essentials" // Display label for the graph.
        "confidence_label": "medium" // Confidence label used by the UI.
        "points": [
          {
            "period_start": "2026-07-01" // Period start date.
            "period_end": "2026-07-02" // Period end date.
            "predicted_amount_centavos": 120000 // Predicted amount for the period.
            "lower_amount_centavos": 100000 // Optional lower band.
            "upper_amount_centavos": 140000 // Optional upper band.
          }
        ]
      }
    ],
    "explanations": [
      {
        "series_label": "Essentials" // Which line the explanation belongs to.
        "explanation": "Higher grocery spend is expected after payday." // Plain-language explanation.
      }
    ]
  }
}
```

GET /odin/api/forecasts | List forecast runs

request:
```json
{
  "query": {
    "status": "available" // Optional filter for queued, running, available, failed, or expired runs.
    "latest_only": true // Optional shortcut for the newest run.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "items": [
      {
        "id": "uuid" // Forecast run id.
        "status": "available" // Forecast state.
        "forecast_start": "2026-07-01" // Forecast window start.
        "forecast_end": "2026-07-31" // Forecast window end.
      }
    ]
  }
}
```

GET /odin/api/forecasts/:id | Read one forecast run

request:
```json
{
  "query": {
    "include": "series,points,drivers" // Optional expansion for the forecast dashboard.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "forecast_run": {
      "id": "uuid" // Forecast run id.
      "model_kind": "population_fallback" // Shows whether the result is fallback-based or personalized.
      "history_days": 0 // History length used for the run.
    },
    "series": [],
    "drivers": []
  }
}
```

POST /odin/api/forecasts/:id/refresh | Refresh an existing forecast

request:
```json
{
  "payload": {
    "reason": "new_transactions_posted" // Why the forecast should be regenerated.
    "force": true // Whether to ignore the current freshness window.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "forecast_run": {
      "id": "uuid" // New or replaced forecast run id.
      "status": "available" // Refresh result state.
    }
  }
}
```

GET /odin/api/expected-events | List expected spending events

request:
```json
{
  "query": {
    "status": "active" // Optional filter for active, inactive, or deleted rows.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "items": [
      {
        "id": "uuid" // Expected event id.
        "event_kind": "christmas" // Canonical expected event type.
        "title": "Christmas Shopping" // User-facing title.
        "starts_on": "2026-12-01" // Event window start.
        "ends_on": "2026-12-25" // Event window end.
      }
    ]
  }
}
```

POST /odin/api/expected-events | Create an expected spending event

request:
```json
{
  "payload": {
    "subcategory_id": "uuid" // Optional detailed category link.
    "category_id": "uuid" // Optional broad category link.
    "event_kind": "holiday" // Expected event type.
    "title": "Christmas Shopping" // Human-readable label.
    "expected_amount_centavos": 1000000 // Optional expected amount.
    "starts_on": "2026-12-01" // Event start date.
    "ends_on": "2026-12-25" // Event end date.
    "repeats_yearly": true // Whether the event should recur each year.
    "affects_forecast": true // Whether the event should influence forecasts.
    "affects_anomaly_suppression": true // Whether the event should suppress anomaly alerts.
    "notes": "Gift buying season" // Optional note.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "event": {
      "id": "uuid" // Created event id.
      "status": "active" // Lifecycle state.
    }
  }
}
```

PATCH /odin/api/expected-events/:id | Update an expected spending event

request:
```json
{
  "payload": {
    "title": "Christmas and Family Gifts" // Updated title.
    "expected_amount_centavos": 1200000 // Revised expected amount.
    "affects_forecast": true // Keep the event active in forecast logic.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "event": {
      "id": "uuid" // Updated event id.
      "updated_at": "2026-06-12T12:00:00Z" // Audit timestamp.
    }
  }
}
```

DELETE /odin/api/expected-events/:id | Delete an expected spending event

request:
```json
{
  "payload": {
    "reason": "no_longer_expected" // Optional reason for the delete.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "deleted": true // Confirms the event is removed or archived.
  }
}
```

#### Anomalies and Alerts

POST /odin/api/anomaly-evaluations | Evaluate a transaction for anomaly detection

request:
```json
{
  "payload": {
    "transaction_id": "uuid" // Transaction being evaluated.
    "force": false // Whether to re-run even if an evaluation already exists.
    "model_version": "isolation-forest-v1" // Optional model label for evaluation tracking.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "evaluation": {
      "id": "uuid" // Anomaly evaluation id.
      "is_anomaly": false // Whether the transaction is considered anomalous.
      "should_alert_user": true // Whether the result should create a user-facing alert.
      "review_status": "pending_review" // Current review state.
    },
    "features": [
      {
        "feature_key": "amount_deviation" // Feature used in the explanation.
        "deviation_value": 1.84 // Standardized deviation score.
        "explanation": "Amount is much higher than the user's baseline." // Plain-language explanation.
      }
    ]
  }
}
```

GET /odin/api/anomaly-evaluations | List anomaly evaluations

request:
```json
{
  "query": {
    "review_status": "pending_review" // Optional review filter.
    "transaction_id": "uuid" // Optional transaction filter.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "items": [
      {
        "id": "uuid" // Evaluation id.
        "transaction_id": "uuid" // Evaluated transaction id.
        "is_anomaly": true // Whether the transaction was flagged.
        "should_alert_user": true // Whether the user should see an alert.
      }
    ]
  }
}
```

GET /odin/api/anomaly-evaluations/:id | Read one anomaly evaluation

request:
```json
{
  "query": {
    "include": "features,alerts" // Optional expansion for alert review screens.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "evaluation": {
      "id": "uuid" // Evaluation id.
      "suppression_reason": "cultural_occasion" // Optional suppression reason.
      "explanation": "This looks high because of holiday spending." // User-facing explanation.
    },
    "features": [],
    "alerts": []
  }
}
```

POST /odin/api/anomaly-evaluations/:id/mark-expected | Mark an anomaly as expected

request:
```json
{
  "payload": {
    "reason": "christmas_spending" // User explanation for the intentional outlier.
    "create_whitelist": true // Whether the backend should create a whitelist rule.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "evaluation": {
      "review_status": "expected" // The transaction is intentional.
    }
  }
}
```

POST /odin/api/anomaly-evaluations/:id/mark-unexpected | Mark an anomaly as unexpected

request:
```json
{
  "payload": {
    "reason": "unknown_charge" // User reason for the unexpected flag.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "evaluation": {
      "review_status": "unexpected" // The anomaly remains actionable.
    }
  }
}
```

POST /odin/api/anomaly-evaluations/:id/remind-later | Snooze an anomaly evaluation

request:
```json
{
  "payload": {
    "remind_at": "2026-06-13T12:00:00Z" // Time when the alert should be surfaced again.
  }
}
```

GET /odin/api/overspending-evaluations | List budget overspending evaluations

GET /odin/api/overspending-evaluations/:id | Read one budget overspending evaluation

response:
```json
{
  "headers": {},
  "payload": {
    "evaluation": {
      "review_status": "remind_later" // Alert is temporarily snoozed.
    }
  }
}
```

GET /odin/api/alerts | List alerts

request:
```json
{
  "query": {
    "status": "unread" // Optional filter for alert inbox state.
    "category": "anomaly_detection" // Optional category filter.
    "severity": "warning" // Optional severity filter.
    "cursor": null // Optional pagination cursor.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "items": [
      {
        "id": "uuid" // Alert id.
        "category": "budget_overspending" // Alert type.
        "severity": "critical" // Alert severity.
        "status": "unread" // Inbox state.
        "title": "Budget is close to its limit" // Short title shown in the inbox.
        "body": "You have used 90% of your essentials budget." // Short descriptive body.
      }
    ],
    "unread_count": 2 // Badge count for the app shell.
  }
}
```

GET /odin/api/alerts/:id | Read one alert

request:
```json
{
  "query": {
    "include": "related_entities,events" // Optional detail expansion.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "alert": {
      "id": "uuid" // Alert id.
      "category": "anomaly_detection" // Alert category.
      "source_type": "isolation_forest" // Alert source.
      "explanation": "Amount is much higher than your usual spend." // Explanation text for the detail screen.
    },
    "related_entities": [],
    "events": []
  }
}
```

POST /odin/api/alerts/:id/acknowledge | Acknowledge an alert

request:
```json
{
  "payload": {
    "notes": "I see this." // Optional user acknowledgement note.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "alert": {
      "status": "acknowledged" // Alert is still stored but marked reviewed.
    }
  }
}
```

POST /odin/api/alerts/:id/dismiss | Dismiss an alert

request:
```json
{
  "payload": {
    "reason": "not_relevant" // Optional dismissal reason.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "alert": {
      "status": "dismissed" // Alert is removed from the active inbox.
    }
  }
}
```

POST /odin/api/alerts/:id/clear | Clear an alert

request:
```json
{
  "payload": {
    "notes": "Issue resolved" // Optional resolution note.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "alert": {
      "status": "cleared" // Alert is resolved and archived from the inbox.
    }
  }
}
```

POST /odin/api/alerts/:id/remind-later | Snooze an alert

request:
```json
{
  "payload": {
    "remind_at": "2026-06-13T12:00:00Z" // When the alert should reappear.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "alert": {
      "status": "unread" // The alert stays active but is temporarily snoozed.
      "remind_at": "2026-06-13T12:00:00Z" // Snooze timestamp.
    }
  }
}
```

GET /odin/api/alert-notification-preferences | Read alert notification preferences

request:
```json
{
  "query": {}
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "items": [
      {
        "category": "budget_overspending" // Alert category.
        "mode": "enabled" // enabled, disabled, or informational_only.
        "in_app_enabled": true // Budget alerts must stay visible in-app.
        "push_enabled": false // Optional push delivery flag.
        "duplicate_cooldown_hours": 24 // Duplicate suppression window.
      }
    ]
  }
}
```

PATCH /odin/api/alert-notification-preferences | Update alert notification preferences

request:
```json
{
  "payload": {
    "category": "forecast_advisory" // The category being updated.
    "mode": "informational_only" // Delivery mode for this category.
    "in_app_enabled": true // Whether the alert appears in-app.
    "push_enabled": false // Whether the alert can push to the device.
    "duplicate_cooldown_hours": 24 // Duplicate cooldown window in hours.
    "snoozed_until": null // Optional snooze timestamp.
  }
}
```

POST /odin/api/push-device-tokens | Register a push notification device token

DELETE /odin/api/push-device-tokens/:id | Deactivate a push notification device token

response:
```json
{
  "headers": {},
  "payload": {
    "preference": {
      "category": "forecast_advisory" // Updated category.
      "updated_at": "2026-06-12T12:00:00Z" // Audit timestamp.
    }
  }
}
```

POST /odin/api/anomaly-whitelist-rules | Create an anomaly whitelist rule

request:
```json
{
  "payload": {
    "merchant_name": "SM Supermarket" // Merchant name to suppress in future.
    "subcategory_id": "uuid" // Detailed category that the rule applies to.
    "base_amount_centavos": 25000 // Baseline amount used for tolerance checks.
    "tolerance_bps": 2000 // Allowed amount range around the baseline.
    "allow_any_amount": false // Whether any amount at this merchant should be allowed.
    "notes": "Weekly groceries" // Optional explanation for the rule.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "rule": {
      "id": "uuid" // Whitelist rule id.
      "status": "active" // Rule lifecycle state.
    }
  }
}
```

PATCH /odin/api/anomaly-whitelist-rules/:id | Update an anomaly whitelist rule

request:
```json
{
  "payload": {
    "allow_any_amount": true // Allow the merchant regardless of the amount.
    "notes": "Always expected" // Optional note.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "rule": {
      "id": "uuid" // Updated rule id.
      "updated_at": "2026-06-12T12:00:00Z" // Audit timestamp.
    }
  }
}
```

DELETE /odin/api/anomaly-whitelist-rules/:id | Disable or delete a whitelist rule

request:
```json
{
  "payload": {
    "reason": "no_longer_needed" // Optional audit note.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "deleted": true // Confirms the rule is removed or disabled.
  }
}
```

POST /odin/api/alert-suppression-rules | Create an alert suppression rule

request:
```json
{
  "payload": {
    "category": "forecast_advisory" // Alert category to suppress.
    "source_type": "forecast_advisory_rule" // Optional source restriction.
    "merchant_name": null // Optional merchant filter.
    "subcategory_id": null // Optional subcategory filter.
    "category_id": null // Optional broad category filter.
    "amount_center_centavos": null // Optional amount filter.
    "amount_tolerance_bps": null // Optional amount tolerance.
    "starts_at": "2026-06-12T12:00:00Z" // Suppression start timestamp.
    "ends_at": "2026-06-19T12:00:00Z" // Optional suppression end timestamp.
    "reason": "snooze_week" // Why the suppression exists.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "rule": {
      "id": "uuid" // Suppression rule id.
      "status": "active" // Rule lifecycle state.
    }
  }
}
```

PATCH /odin/api/alert-suppression-rules/:id | Update an alert suppression rule

request:
```json
{
  "payload": {
    "ends_at": "2026-06-30T12:00:00Z" // New end date for the suppression.
    "reason": "extended_snooze" // Updated reason text.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "rule": {
      "id": "uuid" // Updated rule id.
      "updated_at": "2026-06-12T12:00:00Z" // Audit timestamp.
    }
  }
}
```

DELETE /odin/api/alert-suppression-rules/:id | Disable or delete an alert suppression rule

request:
```json
{
  "payload": {
    "reason": "snooze_over" // Optional audit note.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "deleted": true // Confirms the rule is removed or disabled.
  }
}
```

### Phase 5: Savings Goals and Debt Management

#### Savings Goals

GET /odin/api/savings-goals | List savings goals

request:
```json
{
  "query": {
    "status": "active" // Optional filter for active, achieved, archived, or deleted goals.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "items": [
      {
        "id": "uuid" // Savings goal id.
        "name": "Emergency Fund" // Goal name.
        "target_amount_centavos": 10000000 // Goal target.
        "current_amount_centavos": 2500000 // Saved amount so far.
        "progress_state": "on_track" // On track, behind, achieved, or projection unavailable.
      }
    ]
  }
}
```

POST /odin/api/savings-goals | Create a savings goal

request:
```json
{
  "payload": {
    "name": "Emergency Fund" // Savings goal label.
    "linked_account_id": "uuid" // Optional account linked to the goal.
    "linked_subcategory_id": "uuid" // Financial Allocation subcategory for this goal.
    "target_amount_centavos": 10000000 // Goal target in centavos.
    "current_amount_centavos": 0 // Starting saved amount.
    "target_date": "2027-06-12" // Goal target date.
    "priority_rank": 1 // Goal priority for snowball or avalanche.
    "notes": "6 months of expenses" // Optional note.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "goal": {
      "id": "uuid" // Created goal id.
      "status": "active" // Goal lifecycle state.
      "progress_state": "projection_unavailable" // Initial state until a projection exists.
    }
  }
}
```

GET /odin/api/savings-goals/:id | Read one savings goal

request:
```json
{
  "query": {
    "include": "contributions,budget_allocations" // Optional detail expansion.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "goal": {
      "id": "uuid" // Goal id.
      "target_amount_centavos": 10000000 // Target amount.
      "current_amount_centavos": 2500000 // Saved amount.
      "projected_completion_date": "2027-01-15" // Projected completion date.
    },
    "contributions": [],
    "budget_allocations": []
  }
}
```

PATCH /odin/api/savings-goals/:id | Update a savings goal

request:
```json
{
  "payload": {
    "name": "Emergency Fund" // Updated name.
    "target_amount_centavos": 12000000 // Revised target amount.
    "target_date": "2027-12-31" // Revised target date.
    "priority_rank": 1 // Updated priority rank.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "goal": {
      "id": "uuid" // Updated goal id.
      "updated_at": "2026-06-12T12:00:00Z" // Audit timestamp.
    }
  }
}
```

POST /odin/api/savings-goals/:id/contributions | Add a savings goal contribution

request:
```json
{
  "payload": {
    "transaction_id": "uuid" // Optional link to a posted transaction.
    "source": "manual" // Contribution source.
    "contribution_date": "2026-06-12" // Date the contribution was made.
    "amount_centavos": 50000 // Contribution amount.
    "notes": "Extra savings" // Optional note.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "contribution": {
      "id": "uuid" // Contribution id.
      "savings_goal_id": "uuid" // Goal receiving the contribution.
    },
    "goal": {
      "current_amount_centavos": 2550000 // Updated goal balance after the contribution.
      "progress_state": "on_track" // Updated progress state.
    }
  }
}
```

GET /odin/api/savings-goals/:id/contributions | List contributions for one goal

request:
```json
{
  "query": {
    "date_from": "2026-01-01" // Optional lower date bound.
    "date_to": "2026-12-31" // Optional upper date bound.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "items": [
      {
        "id": "uuid" // Contribution id.
        "amount_centavos": 50000 // Contribution amount.
        "source": "manual" // Manual, transaction, or system adjustment.
      }
    ]
  }
}
```

POST /odin/api/savings-goals/:id/complete | Mark a goal complete

request:
```json
{
  "payload": {
    "reason": "target_met" // Why the goal is being marked complete.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "goal": {
      "status": "achieved" // Goal is now complete.
      "progress_state": "achieved" // Progress state after completion.
    }
  }
}
```

POST /odin/api/savings-goals/:id/archive | Archive a goal

request:
```json
{
  "payload": {
    "reason": "no_longer_relevant" // Optional archive note.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "goal": {
      "status": "archived" // Archived goal stays available for reports.
    }
  }
}
```

GET /odin/api/savings-goals/priority-table | Read the savings goal priority table

request:
```json
{
  "query": {
    "strategy": "avalanche" // Optional strategy hint for the table.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "items": [
      {
        "goal_id": "uuid" // Savings goal id.
        "priority_rank": 1 // Goal ranking used by the solver.
        "target_amount_centavos": 10000000 // Goal target.
        "saved_amount_centavos": 2500000 // Current saved amount.
        "remaining_amount_centavos": 7500000 // Amount still required.
        "target_date": "2027-06-12" // Goal deadline.
        "progress_state": "on_track" // On track, behind, achieved, or projection unavailable.
        "allocation_strategy": "avalanche" // Snowball or avalanche selection.
      }
    ]
  }
}
```

GET /odin/api/savings-goal-allocation-preferences | Read savings allocation preferences

request:
```json
{
  "query": {}
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "strategy": "avalanche" // Snowball or avalanche strategy for savings goals.
    "planned_contribution_centavos": 50000 // Planned contribution amount.
    "updated_at": "2026-06-12T12:00:00Z" // Audit timestamp.
  }
}
```

PATCH /odin/api/savings-goal-allocation-preferences | Update savings allocation preferences

request:
```json
{
  "payload": {
    "strategy": "snowball" // Snowball or avalanche.
    "planned_contribution_centavos": 75000 // Amount to distribute across active goals.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "preferences": {
      "strategy": "snowball" // Persisted strategy.
      "updated_at": "2026-06-12T12:00:00Z" // Audit timestamp.
    }
  }
}
```

#### Debt Management

GET /odin/api/debt-priorities | Read the user's debt hierarchy order

PUT /odin/api/debt-priorities | Replace the user's debt hierarchy order

GET /odin/api/debt-hardship-plans | List debt hardship plans

POST /odin/api/debt-hardship-plans | Create a debt hardship plan

PATCH /odin/api/debt-hardship-plans/:id | Update a debt hardship plan draft

POST /odin/api/debt-hardship-plans/:id/activate | Activate a debt hardship plan

POST /odin/api/debt-hardship-plans/:id/resolve | Resolve a debt hardship plan

POST /odin/api/debt-hardship-plans/:id/cancel | Cancel a debt hardship plan

GET /odin/api/debts | List debt accounts

request:
```json
{
  "query": {
    "status": "active" // Optional filter for active, paid_off, archived, or deleted debts.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "items": [
      {
        "id": "uuid" // Debt account id.
        "name": "Credit Card" // Debt label.
        "current_balance_centavos": 5000000 // Current principal balance.
        "annual_interest_rate_bps": 3600 // Interest rate in basis points.
        "minimum_payment_centavos": 150000 // Minimum required payment.
      }
    ]
  }
}
```

POST /odin/api/debts | Create a debt account

request:
```json
{
  "payload": {
    "linked_account_id": "uuid" // Optional linked financial account.
    "name": "Credit Card" // Debt label.
    "lender_name": "BPI" // Optional lender name.
    "status": "active" // Lifecycle state.
    "original_balance_centavos": 5000000 // Original balance.
    "current_balance_centavos": 5000000 // Current balance.
    "annual_interest_rate_bps": 3600 // Interest rate in basis points.
    "minimum_payment_centavos": 150000 // Minimum monthly payment.
    "due_day_of_month": 15 // Optional due day.
    "opened_on": "2026-01-01" // Optional opening date.
    "notes": "Balance transfer card" // Optional note.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "debt": {
      "id": "uuid" // Created debt id.
      "status": "active" // Debt lifecycle state.
    }
  }
}
```

GET /odin/api/debts/:id | Read one debt account

request:
```json
{
  "query": {
    "include": "payments,projection" // Optional detail expansion.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "debt": {
      "id": "uuid" // Debt account id.
      "current_balance_centavos": 5000000 // Current balance.
      "minimum_payment_centavos": 150000 // Minimum payment.
      "projected_payoff_date": "2027-01-01" // Optional payoff projection date.
    },
    "payments": [],
    "projection": {}
  }
}
```

PATCH /odin/api/debts/:id | Update a debt account

request:
```json
{
  "payload": {
    "current_balance_centavos": 4800000 // Revised balance.
    "annual_interest_rate_bps": 3600 // Revised rate.
    "minimum_payment_centavos": 150000 // Revised minimum payment.
    "due_day_of_month": 15 // Revised due day.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "debt": {
      "id": "uuid" // Updated debt id.
      "updated_at": "2026-06-12T12:00:00Z" // Audit timestamp.
    }
  }
}
```

DELETE /odin/api/debts/:id | Archive or delete a debt account

request:
```json
{
  "payload": {
    "reason": "paid_off" // Optional archive reason.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "deleted": true // Confirms the debt is removed or archived.
  }
}
```

POST /odin/api/debts/:id/payments | Record a debt payment

request:
```json
{
  "payload": {
    "transaction_id": "uuid" // Optional link to a posted transaction.
    "source": "manual" // Payment source.
    "payment_date": "2026-06-12" // Payment date.
    "amount_centavos": 150000 // Total payment amount.
    "principal_centavos": 140000 // Optional principal portion.
    "interest_centavos": 10000 // Optional interest portion.
    "notes": "Extra payment" // Optional note.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "payment": {
      "id": "uuid" // Payment record id.
      "debt_account_id": "uuid" // Debt account that received the payment.
    },
    "debt": {
      "current_balance_centavos": 4650000 // Updated current balance after payment.
    }
  }
}
```

GET /odin/api/debts/:id/payments | List payments for one debt account

request:
```json
{
  "query": {
    "date_from": "2026-01-01" // Optional lower date bound.
    "date_to": "2026-12-31" // Optional upper date bound.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "items": [
      {
        "id": "uuid" // Payment id.
        "amount_centavos": 150000 // Payment amount.
        "payment_date": "2026-06-12" // Payment date.
      }
    ]
  }
}
```

GET /odin/api/debt-strategy-preferences | Read debt strategy preferences

request:
```json
{
  "query": {}
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "strategy": "avalanche" // Avalanche or snowball.
    "extra_payment_centavos": 0 // Optional extra payment above minimums.
    "updated_at": "2026-06-12T12:00:00Z" // Audit timestamp.
  }
}
```

PATCH /odin/api/debt-strategy-preferences | Update debt strategy preferences

request:
```json
{
  "payload": {
    "strategy": "snowball" // Avalanche or snowball.
    "extra_payment_centavos": 50000 // Extra payment to include in projections.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "preferences": {
      "strategy": "snowball" // Persisted strategy.
      "updated_at": "2026-06-12T12:00:00Z" // Audit timestamp.
    }
  }
}
```

POST /odin/api/debt-projections | Generate or refresh a debt projection

request:
```json
{
  "payload": {
    "strategy": "avalanche" // Requested payoff strategy.
    "horizon_months": 60 // Projection horizon.
    "extra_payment_centavos": 50000 // Extra payment above minimums.
    "force_refresh": true // Whether to regenerate even if a recent run exists.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "projection_run": {
      "id": "uuid" // Projection run id.
      "strategy": "avalanche" // Strategy used for the run.
      "projected_debt_free_date": "2027-12-31" // Debt-free date estimate.
    },
    "items": [
      {
        "debt_account_id": "uuid" // Debt account id.
        "payoff_order": 1 // Repayment order used by the solver.
        "projected_payoff_date": "2027-03-01" // Account payoff estimate.
      }
    ]
  }
}
```

GET /odin/api/debt-projections | List debt projections

request:
```json
{
  "query": {
    "strategy": "avalanche" // Optional filter for strategy.
    "latest_only": true // Optional newest-only shortcut.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "items": [
      {
        "id": "uuid" // Projection run id.
        "strategy": "avalanche" // Projection strategy.
        "projected_debt_free_date": "2027-12-31" // Debt-free estimate.
      }
    ]
  }
}
```

GET /odin/api/debt-projections/:id | Read one debt projection

request:
```json
{
  "query": {
    "include": "items,points" // Optional expansion for the debt screen.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "projection_run": {
      "id": "uuid" // Projection run id.
      "total_interest_centavos": 125000 // Total interest across the run.
      "total_paid_centavos": 5125000 // Total paid across the run.
    },
    "items": [],
    "points": []
  }
}
```

POST /odin/api/debt-projections/:id/refresh | Refresh a stale debt projection

request:
```json
{
  "payload": {
    "reason": "balance_changed" // Why the stale run should be replaced.
    "force": true // Whether to force a new run.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "projection_run": {
      "id": "uuid" // New or refreshed projection run id.
      "status": "available" // Result state.
    }
  }
}
```

### Phase 6: Reports, Exports, and Evaluation

#### Reports and Evaluation

POST /odin/api/reports | Generate a report

request:
```json
{
  "payload": {
    "kind": "monthly" // Weekly, monthly, or custom report.
    "period_start": "2026-06-01" // Report start date.
    "period_end": "2026-06-30" // Report end date.
    "filters": {
      "category_id": null // Optional category filter.
      "subcategory_id": null // Optional subcategory filter.
      "budget_id": null // Optional budget filter.
    }
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "report": {
      "id": "uuid" // Report run id.
      "status": "queued" // Report lifecycle state.
    }
  }
}
```

GET /odin/api/reports | List report runs

request:
```json
{
  "query": {
    "kind": "monthly" // Optional report kind filter.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "items": [
      {
        "id": "uuid" // Report id.
        "kind": "monthly" // Weekly, monthly, or custom.
        "status": "available" // Report lifecycle state.
        "period_start": "2026-06-01" // Report window start.
        "period_end": "2026-06-30" // Report window end.
      }
    ]
  }
}
```

GET /odin/api/reports/:id | Read one report

request:
```json
{
  "query": {
    "include": "metrics,breakdowns,comparisons,snapshots" // Optional detail expansion.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "report": {
      "id": "uuid" // Report id.
      "kind": "monthly" // Report kind.
      "status": "available" // Report state.
    },
    "metrics": [],
    "breakdowns": [],
    "comparisons": [],
    "snapshots": []
  }
}
```

GET /odin/api/reports/:id/metrics | Read report metrics

request:
```json
{
  "query": {}
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "items": [
      {
        "metric_key": "total_spend" // Stable metric key.
        "metric_label": "Total Spend" // User-facing label.
        "amount_centavos": 2500000 // Amount-based metric when applicable.
        "numeric_value": 0.42 // Numeric metric when amount is not enough.
      }
    ]
  }
}
```

GET /odin/api/reports/:id/breakdowns | Read report category breakdowns

request:
```json
{
  "query": {}
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "items": [
      {
        "category_id": "uuid" // Broad category id.
        "subcategory_id": "uuid" // Detailed category id when available.
        "actual_amount_centavos": 2500000 // Actual spend.
        "budgeted_amount_centavos": 2000000 // Budgeted amount when available.
        "forecasted_amount_centavos": 2300000 // Forecast amount when available.
        "transaction_count": 25 // Number of transactions in the bucket.
      }
    ]
  }
}
```

GET /odin/api/reports/:id/comparisons | Read report comparisons

request:
```json
{
  "query": {}
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "items": [
      {
        "budget_id": "uuid" // Optional budget id.
        "forecast_run_id": "uuid" // Optional forecast id.
        "allocated_amount_centavos": 2000000 // Planned amount.
        "actual_amount_centavos": 2500000 // Actual amount.
        "variance_amount_centavos": 500000 // Difference between planned and actual.
      }
    ]
  }
}
```

GET /odin/api/reports/:id/snapshots | Read report snapshots

request:
```json
{
  "query": {
    "kind": "savings" // Optional snapshot kind hint.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "savings": [
      {
        "savings_goal_id": "uuid" // Goal snapshot source.
        "target_amount_centavos": 10000000 // Goal target.
        "current_amount_centavos": 2500000 // Saved amount at report time.
        "progress_state": "on_track" // Report-time progress state.
      }
    ],
    "debt": [
      {
        "debt_account_id": "uuid" // Debt snapshot source.
        "current_balance_centavos": 5000000 // Debt balance at report time.
        "projected_payoff_date": "2027-12-31" // Payoff estimate at report time.
      }
    ]
  }
}
```

POST /odin/api/data-export-requests/:id/complete | Mark an export request complete

This route is intended for an internal export worker or system job after the generated file has been written. Do not expose it as a normal client-facing settings action.

request:
```json
{
  "payload": {
    "export_storage_path": "exports/user-uuid/report.json" // Where the generated file was stored.
  }
}
```

response:
```json
{
  "headers": {},
  "payload": {
    "request": {
      "status": "available" // Export is ready to download.
    }
  }
}
```

GET /odin/api/support-tickets | List support tickets

POST /odin/api/support-tickets | Create a support ticket

GET /odin/api/support-tickets/:id | Read one support ticket

POST /odin/api/support-tickets/:id/attachments | Add a support ticket attachment

These routes back the Help & Problem Reporting screen and map to `support_tickets`, `support_ticket_events`, and `support_ticket_attachments` in the v3 schema.

## Notes for Implementation

- The first backend pass should keep route handlers thin and move business rules into modules that mirror the durable domain boundaries above.
- Use the schema tables as the persistence contract, but do not let route shape mirror table shape one-to-one when a smaller API payload is clearer.
- Keep transaction creation idempotent with `client_mutation_id`.
- Keep derived artifacts explainable. If a route returns a forecast, recommendation, alert, projection, or report, it must also return the explanation text or enough metadata for the client to render the explanation.
- Keep hard delete to a minimum. For user-owned history, prefer soft delete, status transitions, or archive states so the report and evaluation modules remain stable.
- Budgeting, forecast, anomaly, savings, and debt routes should be designed so they can be recomputed from ledger state without the client reconstructing hidden rules.
