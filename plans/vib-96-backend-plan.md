# VIB-96 Backend Plan

## Goal

Implement the backend slice for `VIB-96 - Phase 2a: Taxonomy`.

Scope only:

- category group reads
- accessible category reads
- user-owned category CRUD for non-system rows
- accessible subcategory reads
- user-owned subcategory CRUD for non-system rows
- category and subcategory restriction reads and upserts

Route source: `plans/odin-api-backend-implementation-plan.md:1129-1277`
Schema source: `schema/draft-schema-priority-modules-v3.sql:939-1166`

## Grounding From Backend Plan

This ticket is the `feat/taxonomy` branch from the backend implementation plan.

Reference: `plans/odin-api-backend-implementation-plan.md:293-297`

Why it matters:

- Ledger, budgets, forecasts, alerts, savings, and debt depend on stable taxonomy data.
- `GET /odin/api/categories` must return actual `categories` rows, not top-level category groups.
- `GET /odin/api/category-groups` owns the four broad buckets: `essentials`, `obligatory`, `discretionary`, and `financial_allocation`.
- Protected and locked restriction amounts must be persisted now so budget logic can consume them later.

## Routes To Cover

1. `GET /odin/api/category-groups`
   Reference: `plans/odin-api-backend-implementation-plan.md:1133-1157`
2. `GET /odin/api/categories`
   Reference: `plans/odin-api-backend-implementation-plan.md:1160-1162`
3. `POST /odin/api/categories`
   Reference: `plans/odin-api-backend-implementation-plan.md:470`
4. `PATCH /odin/api/categories/:id`
   Reference: `plans/odin-api-backend-implementation-plan.md:470`
5. `DELETE /odin/api/categories/:id`
   Reference: `plans/odin-api-backend-implementation-plan.md:470`
6. `GET /odin/api/subcategories`
   Reference: `plans/odin-api-backend-implementation-plan.md:1164-1191`
7. `POST /odin/api/subcategories`
   Reference: `plans/odin-api-backend-implementation-plan.md:1202-1230`
8. `PATCH /odin/api/subcategories/:id`
   Reference: `plans/odin-api-backend-implementation-plan.md:1232-1255`
9. `DELETE /odin/api/subcategories/:id`
   Reference: `plans/odin-api-backend-implementation-plan.md:1258-1277`
10. `GET /odin/api/category-restrictions`
    Reference: `plans/odin-api-backend-implementation-plan.md:1194-1196`
11. `PUT /odin/api/category-restrictions/:categoryId`
    Reference: `plans/odin-api-backend-implementation-plan.md:1194-1196`
12. `GET /odin/api/subcategory-restrictions`
    Reference: `plans/odin-api-backend-implementation-plan.md:1198-1200`
13. `PUT /odin/api/subcategory-restrictions/:subcategoryId`
    Reference: `plans/odin-api-backend-implementation-plan.md:1198-1200`

## Tables To Use

1. `category_groups`
   - Seeded top-level buckets live before the `categories` table.
   - Seed values: `essentials`, `obligatory`, `discretionary`, `financial_allocation`.
   - Reference: `schema/draft-schema-priority-modules-v3.sql:930-937`
2. `categories`
   - Fields: `category_group_id`, `user_id`, `slug`, `label`, `short_label`, `description`, `is_system`, `is_filipino_context`, `sort_order`, `is_active`, `metadata`
   - System rows have `user_id IS NULL`; user rows have `user_id = current user`.
   - Reference: `schema/draft-schema-priority-modules-v3.sql:939-1009`
3. `subcategories`
   - Fields: `category_id`, `user_id`, `slug`, `kind`, `label`, `short_label`, `description`, `is_system`, `is_filipino_context`, `is_protected_default`, `is_protected`, `sort_order`, `is_active`, `metadata`
   - Expense rows require `category_id`; non-expense rows require `category_id IS NULL`.
   - Reference: `schema/draft-schema-priority-modules-v3.sql:1011-1062`
4. `user_category_restrictions`
   - Fields: `user_id`, `category_id`, `restriction_level`, `floor_amount_centavos`, `ceiling_amount_centavos`, `effective_from`, `effective_to`, `notes`, `metadata`
   - Active uniqueness: `(user_id, category_id) WHERE effective_to IS NULL`.
   - Reference: `schema/draft-schema-priority-modules-v3.sql:1116-1166`
5. `user_subcategory_restrictions`
   - Fields: `user_id`, `subcategory_id`, `restriction_level`, `floor_amount_centavos`, `ceiling_amount_centavos`, `effective_from`, `effective_to`, `notes`, `metadata`
   - Active uniqueness: `(user_id, subcategory_id) WHERE effective_to IS NULL`.
   - Reference: `schema/draft-schema-priority-modules-v3.sql:1064-1114`

## Route To Table Mapping

### `GET /odin/api/category-groups`

- Return only active top-level buckets ordered by `sort_order`.
- Optional `include_subcategories=true` may include active accessible categories and subcategories below each group.
- Tables: `category_groups`, optional `categories`, optional `subcategories`

### `GET /odin/api/categories`

- Return active system categories plus active categories owned by the authenticated user.
- Support bounded filters: `category_group_slug`, `include_system`, and `is_active` if the existing route style supports them.
- Do not return `category_groups` rows from this endpoint.
- Tables: `categories`, optional `category_groups`

### `POST /odin/api/categories`

- Create a non-system category with `user_id = current user` and `is_system = false`.
- Validate `category_group_id`, `slug`, `label`, `description`, and optional display fields.
- Verify `category_group_id` exists before insert.
- Tables: `categories`, `category_groups`

### `PATCH /odin/api/categories/:id`

- Update only a user-owned non-system category.
- Allow display and active-state fields only; do not allow changing ownership or `is_system`.
- Return `403` for authenticated users trying to mutate system or other-user categories.
- Tables: `categories`

### `DELETE /odin/api/categories/:id`

- Soft-delete by setting `is_active = false` for user-owned non-system categories.
- Do not physically delete rows used by existing ledger/budget records.
- Return `403` for system or other-user categories.
- Tables: `categories`

### `GET /odin/api/subcategories`

- Return active system subcategories plus active subcategories owned by the authenticated user.
- Support bounded filters: `kind`, `category_slug`, `category_id`, `include_system`, and `is_active` if the existing route style supports them.
- Tables: `subcategories`, optional `categories`

### `POST /odin/api/subcategories`

- Create a non-system subcategory with `user_id = current user` and `is_system = false`.
- Validate `kind`, `slug`, `label`, `description`, and optional context/display fields.
- For `kind = expense`, verify `category_id` references an accessible category.
- For non-expense kinds, reject `category_id`.
- Do not let user-created rows set `is_protected_default = true`.
- Tables: `subcategories`, `categories`

### `PATCH /odin/api/subcategories/:id`

- Update only a user-owned non-system subcategory.
- Allow display fields, `description`, `is_filipino_context`, `is_protected`, and `is_active`.
- Do not allow changing ownership, `is_system`, or `is_protected_default`.
- Tables: `subcategories`

### `DELETE /odin/api/subcategories/:id`

- Soft-delete by setting `is_active = false` for user-owned non-system subcategories.
- Do not physically delete rows referenced by ledger/budget records.
- Return `403` for system or other-user subcategories.
- Tables: `subcategories`

### `GET /odin/api/category-restrictions`

- List the current user's active category restrictions.
- Include category identity fields if existing API style already joins lookup data.
- Keep the result bounded and user-scoped.
- Tables: `user_category_restrictions`, optional `categories`

### `PUT /odin/api/category-restrictions/:categoryId`

- Verify `categoryId` references an accessible active category.
- Upsert the current user's active restriction for that category.
- Validate money invariants before write:
- `free`: `ceiling_amount_centavos` must be null.
- `protected`: `floor_amount_centavos` is required.
- `locked`: `floor_amount_centavos` and `ceiling_amount_centavos` are required and equal.
- Tables: `user_category_restrictions`, `categories`

### `GET /odin/api/subcategory-restrictions`

- List the current user's active subcategory restrictions.
- Include subcategory identity fields if existing API style already joins lookup data.
- Keep the result bounded and user-scoped.
- Tables: `user_subcategory_restrictions`, optional `subcategories`

### `PUT /odin/api/subcategory-restrictions/:subcategoryId`

- Verify `subcategoryId` references an accessible active subcategory.
- Upsert the current user's active restriction for that subcategory.
- Use the same `free`, `protected`, and `locked` money rules as category restrictions.
- Tables: `user_subcategory_restrictions`, `subcategories`

## Files To Add Or Edit

Expected backend files, adjusted to match existing naming in `apps/api/src`:

1. `apps/api/src/routes/category-groups.ts`
2. `apps/api/src/routes/categories.ts`
3. `apps/api/src/routes/subcategories.ts`
4. `apps/api/src/routes/category-restrictions.ts`
5. `apps/api/src/routes/subcategory-restrictions.ts`
6. `apps/api/src/app.ts`
7. `apps/api/src/lib/constants.ts` if taxonomy enum constants already live there
8. `apps/api/src/__tests__/routes/category-groups.test.ts`
9. `apps/api/src/__tests__/routes/categories.test.ts`
10. `apps/api/src/__tests__/routes/subcategories.test.ts`
11. `apps/api/src/__tests__/routes/category-restrictions.test.ts`
12. `apps/api/src/__tests__/routes/subcategory-restrictions.test.ts`

Do not add service layers unless the existing API code already uses them for route logic. Keep the diff small.

## Git Worktree And Stack Strategy

Use one parent feature branch for the whole Linear ticket, then stack 4 short branches on top of it.

Parent feature branch:

```bash
git switch main
git pull
git switch -c feat/vib-96-taxonomy
git worktree add ../odin-vib-96-taxonomy feat/vib-96-taxonomy
```

Work inside the worktree:

```bash
cd ../odin-vib-96-taxonomy
```

Stack feedback loop:

1. Create a stack branch from the updated parent feature branch.
2. Implement one vertical slice.
3. Push/open PR from stack branch into `feat/vib-96-taxonomy`.
4. User audits/reviews the stack PR exclusively.
5. After approval, merge the stack PR into `feat/vib-96-taxonomy`.
6. Update local `feat/vib-96-taxonomy`.
7. Create the next stack branch from the updated feature branch.
8. Repeat until every slice is merged into the parent feature branch.

Do not branch stack slices from `main` after the parent exists. Do not merge directly to `main` until the parent feature branch has all reviewed slices.

## Stacked PR Plan

Keep each PR focused on one route family and its tests.

1. `feat/vib-96-taxonomy-reads`
   - Base: `feat/vib-96-taxonomy`
   - Scope: `GET /odin/api/category-groups`, `GET /odin/api/categories`, `GET /odin/api/subcategories`, app wiring, read-route tests.
   - Acceptance: categories return actual `categories` rows; category groups return the four buckets.
2. `feat/vib-96-category-crud`
   - Base: updated `feat/vib-96-taxonomy`
   - Scope: `POST /odin/api/categories`, `PATCH /odin/api/categories/:id`, `DELETE /odin/api/categories/:id`, category mutation tests.
   - Acceptance: only user-owned non-system categories can be created, updated, or soft-deleted.
3. `feat/vib-96-subcategory-crud`
   - Base: updated `feat/vib-96-taxonomy`
   - Scope: `POST /odin/api/subcategories`, `PATCH /odin/api/subcategories/:id`, `DELETE /odin/api/subcategories/:id`, subcategory mutation tests.
   - Acceptance: only user-owned non-system subcategories can be created, updated, or soft-deleted.
4. `feat/vib-96-taxonomy-restrictions`
   - Base: updated `feat/vib-96-taxonomy`
   - Scope: category restriction list/upsert, subcategory restriction list/upsert, restriction tests.
   - Acceptance: protected and locked amounts persist with schema-valid money rules for downstream budget logic.

Final parent branch review only needs integration, conflict, test, and smoke checks if each stack branch passed the user's audit.

## Implementation Order

1. Inspect existing `apps/api/src` route, auth, Supabase, and test patterns before editing.
2. Implement taxonomy read routes first because later CRUD and restrictions reuse accessible taxonomy lookups.
3. Add category CRUD with user ownership and non-system guards.
4. Add subcategory CRUD with accessible-category validation.
5. Add restriction routes using shared validation only if duplication appears inside the same PR.
6. Run the smallest available API test target after each stack branch.
7. Run the API build before opening the parent feature branch PR.

## Implementation Notes

- Scope every user-owned read and write by authenticated `user_id`.
- Accessible taxonomy means system rows plus rows owned by the current user.
- Use `403` for authenticated users trying to mutate system rows or another user's rows.
- Use soft deletes through `is_active = false`; do not physically delete taxonomy rows.
- Validate all route params, query params, and payload fields at the backend boundary.
- Whitelist `kind` and `restriction_level` values; do not pass raw client strings into filters unchecked.
- Keep dropdown/list reads bounded and ordered by `sort_order`, then label.
- Do not implement budget recommendation behavior in this ticket; only persist restriction state for later consumers.
- Do not add new database tables or migrations unless implementation proves the v3 migration is missing a required constraint.

## Done Criteria

- All 13 taxonomy routes exist and are wired under `/odin/api`.
- `GET /odin/api/category-groups` returns the four top-level category buckets.
- `GET /odin/api/categories` returns `categories` rows, not category-group rows.
- System and current-user taxonomy rows are readable by the authenticated user.
- User-owned non-system categories and subcategories can be created, updated, and soft-deleted.
- System taxonomy rows cannot be mutated by user CRUD endpoints.
- Category and subcategory restrictions can be listed and upserted per authenticated user.
- Restriction payloads enforce `free`, `protected`, and `locked` money rules before persistence.
- Route tests cover success, validation failures, auth failure, ownership failures, and system-row mutation denial.
