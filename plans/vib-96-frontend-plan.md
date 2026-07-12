# VIB-96 Frontend Plan

## Goal

Build the React Native frontend for the Phase 2a Taxonomy feature, consuming the 13 backend API routes already implemented on `feat/vib-96-taxonomy`.

Design references: `odin/docs/designs/design_v1.html` and `odin/docs/designs/components_v1.html`.

## Current State

- **Backend**: 13 taxonomy routes live on `feat/vib-96-taxonomy` (pushed to origin). All six backend branches exist and have PRs merged.
- **Frontend**: The `odin/apps/app/` codebase has no taxonomy code yet. The existing pattern for feature modules is `features/governance/` — this will be mirrored as `features/taxonomy/`.
- **Navigation**: `MobileShell` uses a `useState<Page>` with a `Page` union type. Taxonomy will add `"taxonomy"` to the `Page` type, a drawer entry, and a bottom-tab entry.

## Step 0: Worktree & Branch Setup

1. Delete the old backend worktree:
   ```bash
   git -C odin worktree remove ../odin-vib-96-taxonomy --force
   ```
2. Create a fresh worktree from `main`:
   ```bash
   git -C odin worktree add ../odin-vib-96-taxonomy main
   ```
   *(Worktree is based on main so it's a clean slate. The backend routes on `feat/vib-96-taxonomy` are on origin — the API can be run from the main worktree or the backend branch worktree separately.)*
3. Create the frontend parent feature branch (stacked on the backend branch to inherit its routes):
   ```bash
   cd ../odin-vib-96-taxonomy
   git fetch origin feat/vib-96-taxonomy
   git checkout -b feat/vib-96-taxonomy-frontend origin/feat/vib-96-taxonomy
   ```
4. Create stack branches targeting `feat/vib-96-taxonomy-frontend`.

## Stacked PR Strategy

All frontend stack branches target `feat/vib-96-taxonomy-frontend` (not main). Each slice is a separate Linear ticket with a Linear issue linked in its PR.

```
feat/vib-96-taxonomy (backend, from origin)
  └── feat/vib-96-taxonomy-frontend (frontend parent)
        ├── feat/vib-96-frontend-reads
        ├── feat/vib-96-frontend-category-crud
        ├── feat/vib-96-frontend-subcategory-crud
        └── feat/vib-96-frontend-restrictions
```

## Feature Module Layout

```
odin/apps/app/
├── features/
│   └── taxonomy/
│       ├── api.ts                   — all taxonomy API calls
│       ├── types.ts                 — TS types for all taxonomy entities
│       ├── constants.ts             — restriction levels, subcategory kinds, labels
│       ├── helpers.ts               — formatting (centavos → pesos), validation
│       ├── TaxonomyScreen.tsx       — master browse/hierarchy screen
│       ├── CategoryFormScreen.tsx   — create + edit category (modal/sheet)
│       ├── SubcategoryFormScreen.tsx— create + edit subcategory (modal/sheet)
│       ├── RestrictionFormScreen.tsx— upsert restriction for category or subcategory
│       └── components/
│           ├── GroupCard.tsx        — expandable category group card
│           ├── CategoryRow.tsx      — single category row with badge + actions
│           ├── SubcategoryRow.tsx   — single subcategory row with badge + actions
│           └── RestrictionBadge.tsx — free/protected/locked pill
```

## Slice 1: Taxonomy Read & Browse (`feat/vib-96-frontend-reads`)

**Linear ticket**: New issue under VIB-96 (or new VIB issue) — "VIB-96 Frontend Slice 1: Taxonomy Read & Browse"

**Scope**:
- `features/taxonomy/api.ts` — `getCategoryGroups(options)`, `getCategories(...)`, `getSubcategories(...)` functions
- `features/taxonomy/types.ts` — `CategoryGroup`, `Category`, `Subcategory`, `RestrictionLevel`, `SubcategoryKind` types
- `features/taxonomy/constants.ts` — `RESTRICTION_LEVELS`, `SUBCATEGORY_KINDS`, human-readable labels
- `features/taxonomy/TaxonomyScreen.tsx` — main browse screen showing the hierarchy:
  - Loads `GET /odin/api/category-groups?include_subcategories=true`
  - Expandable accordion for each category group
  - Categories listed under each group, subcategories nested under categories
  - System vs user-owned visual distinction (e.g. lock icon, badge)
  - Loading skeleton, empty state, error state
- `MobileShell.tsx` changes:
  - Add `"taxonomy"` to `Page` union type
  - Add `"taxonomy"` to `pageMeta`
  - Add drawer entry: Overview section → `{ page: "taxonomy", icon: "tag-outline", label: "Categories" }`
  - Add bottom tab entry if design calls for it
  - Wire `"taxonomy"` page to `<TaxonomyScreen>` in `renderPage()`

**API endpoints consumed**:
- `GET /odin/api/category-groups?include_subcategories=true`
- `GET /odin/api/categories`
- `GET /odin/api/subcategories`

**Acceptance**: 
- User sees the full category hierarchy organized by group
- System categories are visually distinct from user-created ones
- Tapping a group expands/collapses its categories
- Loading, empty, and error states all work

---

## Slice 2: Category CRUD (`feat/vib-96-frontend-category-crud`)

**Linear ticket**: "VIB-96 Frontend Slice 2: Category CRUD"

**Base**: Updated `feat/vib-96-taxonomy-frontend` (after Slice 1 merged)

**Scope**:
- `features/taxonomy/api.ts` additions — `createCategory(...)`, `updateCategory(id, ...)`, `deleteCategory(id)`
- `features/taxonomy/CategoryFormScreen.tsx`:
  - Create mode: empty form with `category_group_id` picker, slug, label, description, optional fields
  - Edit mode: pre-populated from existing category data
  - Both modes: form validation, submit loading, error display
  - Rendered as a modal/sheet from TaxonomyScreen
- `TaxonomyScreen.tsx` additions:
  - Add "+" button for creating new categories
  - Add edit/delete action buttons on user-owned category rows
  - Delete confirmation dialog
  - Item-scoped mutation pending states (per AGENTS.md rules)
  - Refresh list on create/edit/delete success

**API endpoints consumed**:
- `POST /odin/api/categories`
- `PATCH /odin/api/categories/:id`
- `DELETE /odin/api/categories/:id`

**Acceptance**:
- User can create a non-system category (assigned to a category group)
- User can edit their own categories (label, description, etc.)
- User can soft-delete their own categories (with confirmation)
- System categories show no edit/delete actions
- Form validation catches required fields before submit
- Item-scoped loading states (only the row being acted on shows spinner)

---

## Slice 3: Subcategory CRUD (`feat/vib-96-frontend-subcategory-crud`)

**Linear ticket**: "VIB-96 Frontend Slice 3: Subcategory CRUD"

**Base**: Updated `feat/vib-96-taxonomy-frontend` (after Slice 2 merged)

**Scope**:
- `features/taxonomy/api.ts` additions — `createSubcategory(...)`, `updateSubcategory(id, ...)`, `deleteSubcategory(id)`
- `features/taxonomy/SubcategoryFormScreen.tsx`:
  - Create mode: kind selector (expense/income/transfer_adjustment), category picker (only for expense), slug, label, description
  - Income/transfer subcategories: no category_id field
  - Edit mode: pre-populated, same rules
  - Modal/sheet pattern matching CategoryFormScreen
- `TaxonomyScreen.tsx` additions:
  - Add "+" button for creating subcategories (contextual to a category)
  - Edit/delete action buttons on user-owned subcategory rows
  - Delete confirmation

**API endpoints consumed**:
- `POST /odin/api/subcategories`
- `PATCH /odin/api/subcategories/:id`
- `DELETE /odin/api/subcategories/:id`

**Acceptance**:
- User can create expense subcategories (requires category parent)
- User can create income/transfer subcategories (no category parent)
- Category picker only shows accessible active categories
- User can edit/soft-delete their own subcategories
- System subcategories show no edit/delete actions

---

## Slice 4: Category & Subcategory Restrictions (`feat/vib-96-frontend-restrictions`)

**Linear ticket**: "VIB-96 Frontend Slice 4: Category & Subcategory Restrictions"

**Base**: Updated `feat/vib-96-taxonomy-frontend` (after Slice 3 merged)

**Scope**:
- `features/taxonomy/api.ts` additions — `getCategoryRestrictions()`, `upsertCategoryRestriction(id, ...)`, `getSubcategoryRestrictions()`, `upsertSubcategoryRestriction(id, ...)`
- `features/taxonomy/RestrictionFormScreen.tsx`:
  - Reusable form for both category and subcategory restrictions
  - Restriction level picker: free / protected / locked
  - `free`: only level
  - `protected`: floor amount required
  - `locked`: floor + ceiling required, must be equal
  - Peso amount input (format from centavos on save)
  - Entity picker (which category/subcategory to restrict)
- `TaxonomyScreen.tsx` additions:
  - Restriction badge on each category/subcategory row (free/protected/locked pill)
  - Tap badge or row action to open restriction form
  - Show active restriction details inline
- `features/taxonomy/helpers.ts` — centavos-to-peso formatting, amount validation

**API endpoints consumed**:
- `GET /odin/api/category-restrictions`
- `PUT /odin/api/category-restrictions/:categoryId`
- `GET /odin/api/subcategory-restrictions`
- `PUT /odin/api/subcategory-restrictions/:subcategoryId`

**Acceptance**:
- User can view active restrictions per category/subcategory
- User can upsert a restriction with free/protected/locked level
- Money rules enforced: free=no amounts, protected=floor required, locked=floor+ceiling equal
- Amounts displayed in pesos (not centavos)
- Restriction badges visible on taxonomy rows

---

## Patterns to Follow

### API calls (from `features/governance/api.ts`)
- `fetch` + `AbortController` with `REQUEST_TIMEOUT_MS`
- `Authorization: Bearer ${accessToken}` header
- Request body wrapped in `{ payload: ... }`
- Response shape: `{ payload: { ... } }` or `{ error: "...", message: "..." }`

### UI (from existing governance screens + MobileShell)
- React Native primitives (`View`, `Text`, `Pressable`, `ScrollView`, `TextInput`)
- NativeWind classes (`className="..."`) for most styling
- Inline `style={{}}` for animation/edge cases
- `palette` constant per file (can eventually extract to shared theme)
- Manrope font via inline `fontFamily`
- `@expo/vector-icons` MaterialCommunityIcons for icons
- `phosphor-react-native` for tab bar icons

### Navigation (from MobileShell)
- Add to `Page` union type
- Add to `pageMeta` record
- Add drawer entry in `drawerSections`
- Add bottom tab entry if needed
- Wire in `renderPage()` switch

### Feature module (from `features/governance/`)
- `api.ts` — typed fetch helpers
- `types.ts` — TypeScript interfaces
- `constants.ts` — enum-like constants
- `helpers.ts` — shared pure functions
- Screen components — one per screen/flow
- `components/` — shared presentational pieces

## Files to Touch

| File | Action | Slice |
|---|---|---|
| `features/taxonomy/api.ts` | Create | 1 |
| `features/taxonomy/types.ts` | Create | 1 |
| `features/taxonomy/constants.ts` | Create | 1 |
| `features/taxonomy/helpers.ts` | Create/Extend | 4 |
| `features/taxonomy/TaxonomyScreen.tsx` | Create | 1 |
| `features/taxonomy/CategoryFormScreen.tsx` | Create | 2 |
| `features/taxonomy/SubcategoryFormScreen.tsx` | Create | 3 |
| `features/taxonomy/RestrictionFormScreen.tsx` | Create | 4 |
| `features/taxonomy/components/GroupCard.tsx` | Create | 1 |
| `features/taxonomy/components/CategoryRow.tsx` | Create | 1 |
| `features/taxonomy/components/SubcategoryRow.tsx` | Create | 1 |
| `features/taxonomy/components/RestrictionBadge.tsx` | Create | 4 |
| `components/MobileShell.tsx` | Edit | 1, 2, 3, 4 |

## Implementation Order

1. **Slice 1** (reads) first — everything else depends on seeing the taxonomy
2. **Slice 2** (category CRUD) — natural next step after browsing
3. **Slice 3** (subcategory CRUD) — follows same pattern as categories
4. **Slice 4** (restrictions) — last, since it decorates existing taxonomy rows

## Done Criteria

- User navigates to Taxonomy screen from drawer and/or bottom tabs
- Full category hierarchy is browsable and expandable
- User can create, edit, and soft-delete their own categories and subcategories
- System taxonomy rows are read-only with visual distinction
- Restrictions can be set per category/subcategory with free/protected/locked levels
- All mutation states are item-scoped (per AGENTS.md rules)
- Loading, empty, error, and edge-case states handled for every screen
- No new dependencies added unless an existing dependency already covers the need
