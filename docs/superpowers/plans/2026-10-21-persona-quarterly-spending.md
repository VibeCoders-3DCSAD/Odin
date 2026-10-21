# Persona Quarterly Spending Implementation Plan

**Goal:** Use local 2025 FIES category anchors and current-price HFCE quarterly weights to target persona spending.

**Architecture:** A portable aggregate fixture avoids a runtime dependency on the sibling ML repository. A pure helper disaggregates annual category anchors and projects the supported flexible categories onto each persona's existing cash envelope. Fixed bills, tuition, repayments, support, savings, and explicit one-off events retain their story constraints. CLI previews distinguish unconstrained quarterly targets from actual generated spending.

**Tech Stack:** Existing TypeScript, JSON, tsx, Jest, pnpm; no new dependencies.

## Constraints

- Preserve existing working changes and default seed behavior.
- Use current-price HFCE within each category and year, never cross-category shares as temporal weights.
- Preserve unmapped FIES expenditure separately; do not invent observed quarters.
- Use complete observed HFCE years; explicitly label fallback seasonal templates for unavailable or partial years.
- Preserve confirmation before replacing database history. Validation uses pure builders and does not access Supabase or a device.

## Tasks

- [x] Export aggregate 2025 anchors for 50 same-size households nearest persona salary, with source SHA-256 hashes and selection metadata, to `apps/api/scripts/fixtures/persona-spending.json`. `export-persona-spending.ts` reproduces the export and removes the documented food/outside-meal overlap before recomputing residuals.
- [x] Add `helpers/persona-spending.ts`: `quarterlyPersonaTargets(persona, year)` allocates integer centavos by `annual * HFCE_quarter / HFCE_annual`; `personaFlexibleSpending(persona, month, items)` normalizes only supported flexible categories onto existing spending shares. Keep unsupported categories visible in targets.
- [x] Update `seed-personas.ts` to use the quarterly flexible mix for daily history and monthly plans. Keep full-month generation before truncating at today.
- [x] Add CLI target-versus-generated quarterly summaries in `seed.ts`; document fallback and exclusions in README.
- [x] Test annual conservation, category-specific seasonality, fallback years, category mapping, generated quarterly flexible proportions, cash nonnegativity, and retained persona obligations. All 42 tests in `pnpm --filter api test:unit -- scripts/__tests__` pass. API build and standalone strict script typecheck pass with Node 24.15.0. The standalone check omits `noUncheckedIndexedAccess` because existing seed scripts are outside the API build and already fail that additional flag. Local graph updated; no database or device operations performed.
