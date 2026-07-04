# Runbook: New User Consent Kind

## When To Use This

Use this when researchers, thesis reviewers, or product stakeholders need Odin to capture a new explicit user consent category beyond the current enum values.

Current consent kinds live in `supabase/migrations/20260616064145_priority_modules_v3.sql`:

```sql
'data_collection'
'personalization'
'model_training'
'research_evaluation'
'notifications'
'terms'
'advisory_disclaimer'
```

## Rule

Do not seed `user_consents` rows. Consent records are append-only audit events created by user action through `POST /odin/api/consents`.

## Quick Checks

- Confirm the requested consent is not already covered by an existing `odin_consent_kind`.
- Confirm the request needs user-level consent, not privacy settings, research metadata, or policy text only.
- Confirm the consent copy has a stable version string, for example `policy-v2.4` or `research-2026-07`.
- Confirm whether withdrawal must be allowed and how the UI should explain the effect.

## Resolution Steps

1. Create or update the Linear ticket with the requested consent purpose, owner, policy/version string, and user-facing copy.
2. Add a Supabase migration that extends `odin_consent_kind` with the new enum value.
3. Update backend validation constants in `apps/api/src/lib/constants.ts`.
4. Update `POST /odin/api/consents` validation so only known consent kinds can be recorded.
5. Update `GET /odin/api/consents` filtering so the new kind can be queried.
6. Add or update API tests for recording and listing the new consent kind.
7. Update any frontend consent UI so the user sees clear copy before granting or withdrawing consent.
8. Update product/research documentation that explains what the consent means and what data it covers.

## Naming Rules

- Use lowercase snake_case enum values.
- Name the consent by user-facing purpose, not by internal project name.
- Prefer narrow names such as `research_evaluation` over broad names such as `research`.
- Do not rename existing consent kinds unless a separate data migration and compatibility plan exists.

## Verification

- Run `pnpm --filter api test`.
- Run `pnpm --filter api build`.
- Manually verify that `POST /odin/api/consents` creates a new audit row with the new kind.
- Manually verify that `GET /odin/api/consents?consent_kind=<new_kind>` returns only matching rows.
- Confirm no production seed inserts fake consent rows.

## Escalation

Escalate to the research lead or project owner before implementation if:

- the consent wording is unclear,
- the requested consent overlaps with an existing kind,
- the consent affects deletion, export, anonymization, or model-training guarantees,
- the request requires retroactive consent for existing users.

## Related Docs

- `plans/vib-93-backend-plan.md`
- `plans/odin-api-backend-implementation-plan.md`
- `docs/PRD-Full-Odin-App.md`
