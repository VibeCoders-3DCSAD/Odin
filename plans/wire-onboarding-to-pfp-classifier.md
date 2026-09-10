# Wire Onboarding Questionnaire to the PFP Classifier

## Goal

Replace the current financial-profile questionnaire with three questions that
directly represent the PFP dimensions, while retaining the existing demographic
questions and monthly-income collection. Use the PFP classifier's
`QUESTIONNAIRE` mode to generate the financial-profile suggestion. The API
falls back to the same deterministic mapping only when the classifier is
unavailable. Transaction-based (`STANDARD`) PFP classification is explicitly
out of scope.

The classifier service owns the questionnaire request and response contract:
`../odin-ml/app/api/pfp.py` and `../odin-ml/app/schemas/pfp.py`.

## Classifier Contract

The API sends the authenticated user's opaque UUID to:

```text
POST {ML_SERVICE_URL}/api/v1/pfp/classify
```

```json
{
  "user_id": "<uuid>",
  "classification_mode": "QUESTIONNAIRE",
  "payload": {
    "questionnaire_answers": {
      "income_variability": "stable | variable",
      "obligation_level": "low | medium | high",
      "emergency_runway": "low | medium | 3 | high"
    }
  }
}
```

For a successful response, consume only these validated fields:

```text
classification.prediction                 STABLE|VARIABLE + _ + FLEXIBLE|OBLIGATED + _ + TOLERANT|AT_RISK
classification.confidence                 number in [0, 1]
classification.model_name                 questionnaire_rule
metadata.model_version                    classifier version
metadata.strategy_used                    QUESTIONNAIRE
```

`QUESTIONNAIRE` is currently a deterministic, service-owned cold-start rule,
not trained model inference. User-facing copy, audit data, and `model_kind`
must describe it accurately as `questionnaire_rule`.

## Scope

- Retain existing demographic and monthly-income questions, but replace the
  old income-stability, pay-frequency, fixed-obligation, and
  monthly-obligations profiling inputs with the three dimension-backed answers
  below and their review rows.
- Replace the four-value persisted financial-profile label domain with the
  classifier's eight three-dimensional labels.
- Call only `QUESTIONNAIRE` mode during onboarding.
- Preserve the existing heuristic as an availability fallback.
- Record the classifier's prediction, confidence, model name, and model
  version when classification succeeds.

## Non-Goals

- Do not call `STANDARD` mode or send historical transactions.
- Do not change odin-ml's API, rules, schema, or authentication model.
- Do not change forecast, anomaly, budget, local sync, or local DB schema
  beyond migrating their persisted profile-label columns and updating affected
  label consumers.
- Do not add Node dependencies.

## Important Data Decision

The old profile labels have no tolerance dimension, and historic onboarding
sessions have no emergency-runway answer. During the enum replacement, map
legacy rows conservatively:

```text
stable_flexible    -> STABLE_FLEXIBLE_AT_RISK
stable_obligated   -> STABLE_OBLIGATED_AT_RISK
variable_flexible  -> VARIABLE_FLEXIBLE_AT_RISK
variable_obligated -> VARIABLE_OBLIGATED_AT_RISK
```

This is a data-preservation migration, not a new assessment. Do not
retroactively claim the new classifier evaluated historical users.

## Execution Order

1. Define the canonical eight-label domain across API, database, and UI.
2. Replace the financial-profile questionnaire and validate its answers.
3. Add the contract-validated ML client.
4. Add a forward database migration that replaces the enum and creates the
   classification-aware submit RPC.
5. Wire onboarding submission to the classifier with the heuristic fallback.
6. Add the questionnaire step and review row.
7. Update all profile-label consumers and tests, then verify locally and
   against linked Supabase migration state.

## 1. Replace The Profile-Label Domain

- **Files**: `apps/api/src/lib/constants.ts`, `apps/api/src/routes/profile.ts`,
  `apps/app/features/governance/PrivacySettingsScreen.tsx`
- Replace, do not append to, `FINANCIAL_PROFILE_LABELS` with:
  ```text
  STABLE_FLEXIBLE_TOLERANT
  STABLE_FLEXIBLE_AT_RISK
  STABLE_OBLIGATED_TOLERANT
  STABLE_OBLIGATED_AT_RISK
  VARIABLE_FLEXIBLE_TOLERANT
  VARIABLE_FLEXIBLE_AT_RISK
  VARIABLE_OBLIGATED_TOLERANT
  VARIABLE_OBLIGATED_AT_RISK
  ```
- Update profile-selection validation, manual-selection UI, error messages,
  fixtures, and any label formatting so all consumers use the same canonical
  uppercase values.
- Sweep the repository for the four legacy values and update executable code
  and tests. Schema-draft files may be updated only if they are maintained
  references; do not rewrite historical migrations.

## 2. Replace The Financial-Profile Questionnaire

- **File**: `apps/api/src/lib/constants.ts`
  - Add canonical option lists for `income_pattern`, `obligation_load`, and
    `emergency_runway`. Do not derive a profile dimension by dividing one raw
    answer by another.
- **File**: `apps/api/src/routes/onboarding.ts`
  - Replace the legacy profiling answer keys in `ONBOARDING_ANSWER_KEYS`,
    `STRING_ANSWER_KEYS`, `ANSWER_OPTIONS`, and required-field validation with
    these whitelisted answers. Remove `monthly_obligations` from required-field
    and numeric validation because the replacement question supplies the
    obligation dimension directly:
    - **Income pattern / Financial Stability**: `no_current_income`,
      `predictable_income`, `variable_income`. Map the first and third values
      to ML `variable`; map `predictable_income` to ML `stable`.
    - **Obligation load / Financial Weight**: `no_income_with_obligations`,
      `no_income_without_obligations`, `low`, `medium`, `high`. Map the first
      and `high` to ML `high`; map `medium` to ML `medium`; map the remaining
      values to ML `low`.
    - **Emergency runway / Financial Tolerance**: `less_than_1_month`,
      `1_to_3_months`, `3_to_6_months`, `6_plus_months`. Map these to ML
      `low`, `medium`, `3`, and `high`, respectively.
  - Keep `monthly_income` as a required non-negative whole number, but make
    its zero value explicit and consistent: `monthly_income = 0` requires
    `income_pattern = no_current_income`; a positive income rejects that
    answer. Thus zero income always maps to `VARIABLE`.
  - The two no-income obligation answers define the full zero-income rule:
    `no_income_with_obligations` maps to `OBLIGATED`;
    `no_income_without_obligations` maps to `FLEXIBLE`. Both the ML payload
    builder and database fallback must use these mappings, never
    `monthly_obligations / monthly_income`.

## 3. Create The Questionnaire Classifier Client

- **File**: `apps/api/src/lib/mlClient.ts` (new)
- Export a narrow function:
  ```ts
  classifyPfpQuestionnaire(
    userId: string,
    answers: Record<string, unknown>,
  ): Promise<PfpQuestionnaireResult>
  ```
- Build the contract payload using these mappings:
  - `income_variability` from `income_pattern`.
  - `obligation_level` from `obligation_load`.
  - `emergency_runway` from `emergency_runway`.
- Return a result only after runtime-validating the response:
  - prediction is exactly one of the eight canonical labels.
  - confidence is a finite number from 0 through 1.
  - model name and model version are non-empty strings.
  - strategy is `QUESTIONNAIRE`.
- Return a discriminated result, not `null`:
  ` { ok: true, classification }` or `{ ok: false, reason }`. `reason` is a
  safe enum such as `not_configured`, `timeout`, `network_error`,
  `http_error`, or `invalid_response`; it must not contain raw answers, URLs,
  response bodies, or exception messages.
- Use native `fetch` with an `AbortController` timeout of five seconds.
- **File**: `apps/api/.env.example`
  - Document optional `ML_SERVICE_URL` as a private, trusted service URL. The
    current microservice has no authentication, so it must not be Internet
    exposed from this integration.

## 4. Add The Forward Supabase Migration

- **File**: a unique, current migration timestamp such as
  `supabase/migrations/YYYYMMDDHHMMSS_submit_onboarding_questionnaire_classifier.sql`.
  Do not use `20260907000000`: it already exists.
- Before writing it, run `supabase migration list --linked` and choose a
  timestamp later than all existing local migrations.
- Replace `odin_financial_profile_label`; do not extend it:
  - Rename the old enum, create the eight-value replacement with the original
    type name, and convert every dependent column using an explicit `CASE`
    legacy mapping.
  - Convert all four known dependent columns using the documented `CASE`
    mapping: `financial_profile_assessments.proposed_profile_label`,
    `financial_profile_assignments.profile_label`,
    `budget_recommendations.profile_label`, and
    `anomaly_evaluations.profile_label`. Confirm no additional dependent
    columns with a catalog query before dropping the renamed enum.
  - Drop and restore affected defaults, constraints, functions, and RPCs as
    needed by the type replacement.
  - Drop the renamed legacy enum only after no dependency remains.
- Create `submit_onboarding_session_with_classification` with:
  ```sql
  p_session_id uuid,
  p_user_id uuid,
  p_profile_label odin_financial_profile_label DEFAULT NULL,
  p_confidence_score numeric DEFAULT NULL,
  p_model_kind text DEFAULT NULL,
  p_model_version text DEFAULT NULL
  ```
- Retain the current RPC's ownership-scoped session lock and transactional
  writes. When classifier values are supplied, store the profile label,
  confidence, model kind, model version, and classifier data in output or
  metadata snapshots. When the label is `NULL`, execute the existing heuristic
  branch and identify it as `heuristic_v1`.
  - The fallback maps the same normalized `income_pattern`,
    `obligation_load`, and `emergency_runway` values as the client. It emits
    `VARIABLE` for `no_current_income`, `OBLIGATED` for
    `no_income_with_obligations`, and `FLEXIBLE` for
    `no_income_without_obligations`. Its tolerance boundary must match the
    service exactly: `less_than_1_month` and `1_to_3_months` are `AT_RISK`;
    `3_to_6_months` and `6_plus_months` are `TOLERANT`. It must never emit a
    removed four-value legacy label.
- Keep explanation drivers truthful: income type and obligation load are
  direct drivers; add an emergency-runway driver for classifier results. Do
  not claim a model-derived cause beyond the questionnaire inputs.
- Revoke default public execution, then grant execute only to `service_role`.
- Replace `select_profile_assignment(uuid, text, boolean)` in the same forward
  migration. Its allowlist must accept exactly the eight canonical labels and
  retain its existing user-scoped active-assignment lock, deactivation, events,
  and service-role-only grant. This RPC remains callable after onboarding.
- Update `apps/api/src/services/alerts/alertRepository.ts` so anomaly writes
  fetch the current active `financial_profile_assignments.profile_label` scoped
  to `this.userId`; do not replace `stable_flexible` with a new global default.
  If no active assignment exists, fail the evaluation rather than persisting a
  fabricated profile label.

## 5. Wire Submission With Availability Fallback

- **File**: `apps/api/src/routes/onboarding.ts`
- After complete-answer validation and before the service-role RPC call:
1. Call `classifyPfpQuestionnaire(userId, rawAnswers)`.
2. Always call `submit_onboarding_session_with_classification`.
3. Pass validated prediction, confidence, `model_name`, and `model_version`
      when `ok` is true; otherwise pass `NULL` classifier fields so the RPC
      uses the heuristic fallback.
- Keep the existing response shape. Both the assessment and assignment labels
  come from the RPC result.
- Log only the discriminated result's safe failure category with user ID and
  session ID. Do not make classifier unavailability user-visible and do not
  fail a confirmed onboarding submission because of it.

## 6. Replace The Frontend Questionnaire And Review Rows

- **File**: `apps/app/features/onboarding/types.ts`
  - Keep the existing demographic and monthly-income steps. Replace the old
    financial-profile questions with three `card_select` steps immediately
    before review: Income Pattern, Obligation Load, and Emergency Runway.
  - Use these question prompts and choices:
    - **Which best describes your income right now?**: “I do not currently
      receive income”, “It is about the same each month”, or “It changes from
      month to month”.
    - **How much of your income goes to required monthly payments?**: “I have
      no current income, but I have required payments”, “I have no current
      income or required payments”, “A small amount”, “A moderate amount”, or
      “A large amount”.
    - **If your income stopped today, how long could your savings cover
      essential expenses?**: “Less than 1 month”, “1 to 3 months”, “3 to 6
      months”, or “More than 6 months”.
  - Use the exact API-approved keys and user-facing choices described in step
    2. The zero-income choices must be present in both Income Pattern and
    Obligation Load so the user, client, and fallback agree on the mapping.
- **File**: `apps/app/features/onboarding/OnboardingFlow.tsx`
  - Replace legacy questionnaire rows with Income Pattern, Obligation Load,
    and Emergency Runway review rows that resolve their options from `STEPS`
    and navigate to the matching step on edit.
  - Do not hard-code new indices if avoidable. Resolve existing review steps
    by `STEPS.find(...)` or centralize their key-to-index lookup so future
    questionnaire changes cannot silently edit the wrong answer.

## 7. Tests And Verification

- **API unit tests**: mock `mlClient.ts`; do not call a live microservice.
  - Complete ML response calls the new RPC with the eight-label prediction,
    confidence, model kind, and model version.
  - Each client failure reason calls the same RPC with `NULL` classifier fields
    and produces only the corresponding safe log category.
  - Missing and invalid dimension answers return 400. Verify `monthly_income
    = 0` accepts only `no_current_income`, and that both no-income obligation
    options produce their defined classifier payload and fallback labels.
  - Response shape is identical for classifier and heuristic paths.
- **Fixtures**: create one complete valid onboarding-answer factory, including
  `metro_manila_locality_code`, `income_pattern`, `obligation_load`, and
  `emergency_runway`. Derive each invalid fixture from it. Remove the legacy
  profiling inputs, including `monthly_obligations`, from the complete-answer
  requirement and update the replacement submit RPC so it does not read them.
- **Database integration tests**:
  - Verify all eight classifier labels persist in assessment and assignment
    rows, and are accepted by the replacement `select_profile_assignment` RPC.
  - Add a dedicated migration test script using an isolated disposable local
    Postgres database, not the normal full-schema integration setup. Apply
    migrations in lexical order only through the migration immediately before
    this new migration, seed all four legacy labels into each of
    `financial_profile_assessments`, `financial_profile_assignments`,
    `budget_recommendations`, and `anomaly_evaluations`, then apply only the
    new migration. Assert every seeded row has its documented `*_AT_RISK`
    replacement and the old enum no longer has dependencies. Clean up the
    disposable database after the test.
  - Verify an unavailable classifier uses the heuristic branch atomically,
    including both zero-income obligation mappings.
- **Alert repository tests**: verify anomaly evaluations write the active,
  user-scoped profile label and reject a write when the user has no active
  assignment.
- **Manual-selection tests**: verify the API and replacement RPC accept each
  canonical label, reject each legacy label, and preserve user scoping.
- **Frontend tests or Maestro flow**:
  - Complete all three new dimension questions, confirm each appears in review,
    edit each one, and submit successfully. Cover the no-income path.
- Run:
  ```bash
  pnpm --filter api test:unit
  pnpm --filter api test
  pnpm --filter api build
  supabase migration list --linked
  supabase db push --dry-run
  ```
  Do not deploy the migration without explicit approval.

## Acceptance Criteria

- Onboarding retains demographics and monthly income, and requires and reviews
  the three dimension-backed answers.
- The only onboarding classifier request uses `QUESTIONNAIRE` mode and the
  documented service contract.
- Valid classifier predictions persist as one of the eight canonical labels.
- Existing four-label data migrates to the documented conservative values in
  assessments, assignments, budget recommendations, and anomaly evaluations.
- Manual profile selection accepts the eight new labels and rejects removed
  legacy labels.
- Zero income always maps to `VARIABLE`; its two explicit obligation answers
  map identically in the ML payload and heuristic fallback.
- Classifier failure falls back to the existing heuristic without a user error.
- No transaction payload or `STANDARD` request is introduced.
- Unit, integration, build, and migration dry-run verification pass.
