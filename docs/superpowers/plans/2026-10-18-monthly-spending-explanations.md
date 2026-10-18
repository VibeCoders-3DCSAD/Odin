# Monthly Spending Explanations Implementation Plan

**Goal:** Apply the supplied Philippine monthly reference to supported category explanations without changing forecasts or allocations.

**Architecture:** Maintain a reference catalog and a pure selection helper. Select category/month-specific reported patterns, preserve missing evidence as unknown, and distinguish recorded scheduled-payment reservations from category budgets. Render protected notices consistently before optional AI interpretations.

**Constraints:** Preserve existing workspace edits. Use canonical HFCE slugs; never infer a purchase from its season, locality, or household membership. Variable dates and completed events require recorded dated evidence. Spending comparisons use the existing usual-category-spending baseline, never a previous budget limit.

- [x] Add the 12-month reference catalog, category mapping, evidence requirements, and pure selection tests.
- [x] Extend explanation evidence and bounded request parsing with explicit plan month, category slug, confirmed scheduled payments, comparison basis, and actual reservation totals.
- [x] Integrate the selector into seasonal reasons and mismatch notices, and add objective budget-constraint notices and the no-reason fallback.
- [x] Keep protected category explanations consistent when AI results arrive; suppress unsupported model-generated causal claims.
- [x] Verify recommendation-path amounts remain unchanged and run affected API tests/build.
- [x] Document catalog provenance, unsupported evidence conditions, baseline semantics, and validation results.

## Validation

- 142 targeted API tests passed across nine test files, including financial-plan sync validation.
- API TypeScript build and `git diff --check` passed.
- Recommendation-path tests preserve optimizer inputs, forecast amounts, allocations, scheduled-payment reservations, and accepted-plan explanation evidence.
- Selection tests cover overlapping November events, category boundaries, missing household/event evidence, month/year matching, direction, duplicate payments, budget constraints, no-reason fallback, and safe AI rendering.
- Excluded unselected categories from category explanation evidence so unrelated forecasts cannot produce misleading zero-budget or funding notices.
- Variable holidays, local weather effects, and completed events remain inactive without dedicated verified records. The catalog documents the required evidence rather than fabricating those facts.
