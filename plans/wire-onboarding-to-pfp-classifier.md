# Wire Onboarding Questionnaire to the PFP Classifier

## Goal

Add an emergency-runway question to onboarding and use the PFP classifier's
`QUESTIONNAIRE` mode to generate the financial-profile suggestion. The API
falls back to a deterministic questionnaire heuristic only when the classifier
is unavailable. Transaction-based (`STANDARD`) PFP classification is explicitly
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

- Add the required `emergency_runway` onboarding answer and review row.
- Replace the four-value persisted financial-profile label domain with the
  classifier's eight three-dimensional labels.
- Call only `QUESTIONNAIRE` mode during onboarding.
- Preserve the existing heuristic as an availability fallback.
- Record the classifier's prediction, confidence, model name, and model
  version when classification succeeds.

## Non-Goals

- Do not call `STANDARD` mode or send historical transactions.
- Do not change odin-ml's API, rules, schema, or authentication model.
- Do not change forecast, anomaly, budget, local sync, or local DB schema.
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
2. Add and validate the emergency-runway onboarding answer.
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

## 2. Add Emergency-Runway Validation

- **File**: `apps/api/src/lib/constants.ts`
  - Add `VALID_EMERGENCY_RUNWAY`:
    `less_than_1_month`, `1_to_3_months`, `3_to_6_months`, `6_plus_months`.
- **File**: `apps/api/src/routes/onboarding.ts`
  - Add `emergency_runway` to `ONBOARDING_ANSWER_KEYS`, `STRING_ANSWER_KEYS`,
    `ANSWER_OPTIONS`, and the submit handler's required fields.
  - Import and use `VALID_EMERGENCY_RUNWAY`; keep the accepted values
    whitelisted at the API boundary.

## 3. Create The Questionnaire Classifier Client

- **File**: `apps/api/src/lib/mlClient.ts` (new)
- Export a narrow function:
  ```ts
  classifyPfpQuestionnaire(
    userId: string,
    answers: Record<string, unknown>,
  ): Promise<PfpQuestionnaireClassification | null>
  ```
- Build the contract payload using these mappings:
  - `income_variability`: `answers.income_type` (`stable` or `variable`).
  - `obligation_level`: `(monthly_obligations / monthly_income) * 100`:
    `high` at 30% or more, `medium` at 15% or more, otherwise `low`.
  - `emergency_runway`:
    `less_than_1_month -> low`, `1_to_3_months -> medium`,
    `3_to_6_months -> 3`, `6_plus_months -> high`.
- Return a result only after runtime-validating the response:
  - prediction is exactly one of the eight canonical labels.
  - confidence is a finite number from 0 through 1.
  - model name and model version are non-empty strings.
  - strategy is `QUESTIONNAIRE`.
- Return `null` for an unset URL, timeout, network error, non-2xx response,
  malformed JSON, or invalid response. Never log raw answers or the full ML
  response.
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
  - Convert `financial_profile_assessments.proposed_profile_label`,
    `financial_profile_assignments.profile_label`, and every other dependent
    column discovered from the catalog/migration sweep.
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
  - The fallback retains its income and obligation rules, then appends a
    canonical tolerance suffix from the runway answer: `less_than_1_month`
    becomes `AT_RISK`; every other validated runway value becomes `TOLERANT`,
    matching the classifier's current `QUESTIONNAIRE` rule at its decision
    boundary. It must never emit a removed four-value legacy label.
- Keep explanation drivers truthful: income type and obligation load are
  direct drivers; add an emergency-runway driver for classifier results. Do
  not claim a model-derived cause beyond the questionnaire inputs.
- Revoke default public execution, then grant execute only to `service_role`.

## 5. Wire Submission With Availability Fallback

- **File**: `apps/api/src/routes/onboarding.ts`
- After complete-answer validation and before the service-role RPC call:
  1. Call `classifyPfpQuestionnaire(userId, rawAnswers)`.
  2. Always call `submit_onboarding_session_with_classification`.
  3. Pass validated prediction, confidence, `model_name`, and `model_version`
     when available; otherwise pass `NULL` classifier fields so the RPC uses
     the heuristic fallback.
- Keep the existing response shape. Both the assessment and assignment labels
  come from the RPC result.
- Log only safe diagnostic context for classifier fallback, such as user ID,
  session ID, and failure category. Do not make classifier unavailability
  user-visible and do not fail a confirmed onboarding submission because of it.

## 6. Add The Frontend Step And Review Row

- **File**: `apps/app/features/onboarding/types.ts`
  - Insert the `emergency_runway` `card_select` step immediately before
    `review`, using the four API-approved keys and existing card UI.
- **File**: `apps/app/features/onboarding/OnboardingFlow.tsx`
  - Add an Emergency Runway row that resolves its option from `STEPS` and
    navigates to the new step on edit.
  - Do not hard-code new indices if avoidable. Resolve existing review steps
    by `STEPS.find(...)` or centralize their key-to-index lookup so future
    questionnaire changes cannot silently edit the wrong answer.

## 7. Tests And Verification

- **API unit tests**: mock `mlClient.ts`; do not call a live microservice.
  - Complete ML response calls the new RPC with the eight-label prediction,
    confidence, model kind, and model version.
  - Unset URL, timeout, non-2xx, malformed response, and invalid prediction
    call the same RPC with `NULL` classifier fields.
  - Missing and invalid emergency-runway answers return 400.
  - Response shape is identical for classifier and heuristic paths.
- **Fixtures**: create one complete valid onboarding-answer factory, including
  `metro_manila_locality_code`, `income_stability`, and `emergency_runway`.
  Derive each invalid fixture from it. The current submit unit fixture is
  already incomplete, so updating only the new runway field is insufficient.
- **Database integration tests**:
  - Verify all eight classifier labels persist in assessment and assignment
    rows.
  - Verify the four legacy labels migrate to their documented `*_AT_RISK`
    replacements.
  - Verify an unavailable classifier uses the heuristic branch atomically.
- **Frontend tests or Maestro flow**:
  - Complete the new runway step, confirm it appears in review, edit it, and
    submit successfully.
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

- Onboarding requires and reviews an emergency-runway answer.
- The only onboarding classifier request uses `QUESTIONNAIRE` mode and the
  documented service contract.
- Valid classifier predictions persist as one of the eight canonical labels.
- Existing four-label data migrates to the documented conservative values.
- Classifier failure falls back to the existing heuristic without a user error.
- No transaction payload or `STANDARD` request is introduced.
- Unit, integration, build, and migration dry-run verification pass.
