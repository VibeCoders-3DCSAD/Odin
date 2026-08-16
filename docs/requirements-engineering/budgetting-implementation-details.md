# Budgeting Product Requirements Document

## Metadata

```json
{
  "document-type": "prd",
  "scope": "budgeting",
  "version": "1.0.0",
  "date": "2026-08-12",
  "status": "ready-for-implementation",
  "authors": [
    "Gabion, Stefanie S.",
    "Guevarra, Joaquin Luis T.",
    "San Jose, Alexa Joanne Paula G.",
    "Togle, Charles Nathaniel B."
  ]
}
```

## 1. Product Summary

Odin Budgeting helps a single user plan available money for a defined income
cycle, protect obligations from inappropriate reductions, track spending
against allocations, and review explainable recommendations before applying
them.

Budgeting is offline-first. The local SQLite repository is the UI source of
truth. Budget writes are immediately visible locally and are later synchronized
through the existing user CRUD sync process. Recommendations are server-side
decision support and are never applied automatically.

This PRD is limited to budgets, allocations, budget health, surplus/deficit
handling, and budget recommendations. It does not redefine accounts,
transactions, forecasts, taxonomy, savings goals, or debt management; it
defines the budgeting contracts that consume those modules.

## 2. Problem Statement

Generic budgeting tools commonly assume a predictable monthly income and treat
all spending as equally reducible. Odin's target users may have variable pay,
irregular income cycles, family support obligations, debt payments, culturally
necessary spending, and unreliable connectivity. They need a budget that can be
created and understood offline, aligns to how they are paid, distinguishes
non-negotiable spending from flexible spending, and provides recommendations
without taking control away from them.

## 3. Goals

1. Let users create, edit, activate, close, archive, and delete budgets offline.
2. Align a budget horizon to a weekly, monthly, custom, or income-cycle period.
3. Validate allocations against total funds and restriction constraints before
   activation or recommendation acceptance.
4. Track total and category-level planned versus actual spending with a clear,
   deterministic health status.
5. Handle surplus and deficit explicitly, including rollover and protected
   balances.
6. Generate explainable recommendations using obligations, restrictions,
   history, profile data, and forecast data when available.
7. Keep users in control: recommendations require explicit accept, modify, or
   reject actions.
8. Preserve correctness under offline sync, ownership checks, tombstones, and
   conflict resolution.

## 4. Non-Goals

- Automatic bank or e-wallet imports.
- Automatic bill payment.
- Multi-user, household, organization, or shared budgets.
- Licensed financial, investment, tax, legal, or debt advice.
- Automatic application of recommendations.
- A separate budgeting currency or multi-currency budgeting model.
- On-device ML inference.
- A new sync protocol or manual conflict-resolution UI.

## 5. Users and Primary Flows

### 5.1 Create a budget manually

1. The user chooses a period type and date range.
2. Odin suggests the user's known income-cycle details, but the user confirms
   the actual start date, end date, and budget amount.
3. The user selects an allocation method and enters category allocations.
4. Odin shows total allocated, unallocated, surplus/deficit, protected/fixed
   minimums, and validation errors.
5. The user saves a draft or activates a valid budget.

### 5.2 Create a budget from a recommendation

1. The user requests a recommendation while online.
2. Odin generates and stores a recommendation snapshot with its inputs,
   constraints, explanations, and freshness metadata.
3. The user reviews, modifies, accepts, or rejects the recommendation.
4. Acceptance creates a new budget draft populated from the accepted snapshot;
   it does not silently replace an existing active budget.
5. The user validates and activates the resulting budget.

### 5.3 Track a budget

1. The user opens the active budget from local data.
2. Odin aggregates posted expense transactions within the budget period.
3. Odin displays total and category planned, actual, variance, adherence,
   remaining amount, restriction level, and health status.
4. New local transactions update the budget view immediately.

### 5.4 Close or carry forward

1. At or after the period end, Odin shows final actuals and unresolved surplus
   or deficit.
2. The user chooses the configured surplus action or confirms the default.
3. Odin closes the budget and records a budget event.
4. A new budget may use an explicit rollover amount; rollover is never inferred
   from an unmarked account balance.

## 6. Product Decisions

### 6.1 Budget period kinds

The supported `period_kind` enum is:

| Value | Meaning |
| --- | --- |
| `WEEKLY` | Seven calendar days beginning on the selected start date. |
| `MONTHLY` | The calendar month containing the selected start date; end date is the last calendar day of that month. |
| `CUSTOM` | An inclusive user-selected date range of 1 to 366 days. |
| `INCOME_CYCLE` | A user-selected date range representing one expected pay cycle; the range is not changed automatically when income varies. |

The user always confirms the actual dates. Income frequency is a hint, not a
hidden source of truth. Payday prediction and automatic horizon shifting are
out of scope for this release.

### 6.2 Restriction levels

Every budget allocation stores a snapshot of the category restriction at budget
creation time. The supported `restriction_level` enum is:

| Value | Meaning | Recommendation rule |
| --- | --- | --- |
| `OPEN` | Flexible spending. | May be reduced or increased within normal validation rules. |
| `PROTECTED` | Important or necessary spending with a user-defined floor. | Never recommend an amount below the stored floor. |
| `FIXED` | A hard obligation or non-negotiable amount. | Never reduce or remove; allocation must meet the fixed amount. |

Restriction data supports `minimum_amount`, optional `maximum_amount`,
`effective_start`, `effective_end`, and `notes`. Amounts are non-negative,
minimum cannot exceed maximum, and effective dates must be valid. If a category
is marked protected without a floor, its current allocation is used as the
minimum for that budget snapshot. Existing budget snapshots do not change when
the user's current category restriction changes.

### 6.3 Allocation feasibility

All monetary values use the app's existing integer minor-unit convention and
must be non-negative.

For a budget with total `T` and allocations `A`:

`allocated = sum(A)`

`unallocated = T - allocated`

An allocation is valid for activation when:

- `T > 0`;
- every allocation has a valid user-owned category or subcategory;
- every `FIXED` allocation is at least its fixed amount;
- every `PROTECTED` allocation is at least its protected floor;
- every allocation is within its maximum, when one exists; and
- `allocated <= T`, unless deficit planning is explicitly enabled.

An underallocated budget is valid and displays an unallocated surplus. An
overallocated budget is invalid by default. If the user enables deficit
planning, the budget may be activated only when the deficit amount is within
the user-confirmed deficit limit and every fixed/protected constraint remains
valid. Deficit planning never permits a negative allocation.

### 6.4 Surplus and deficit handling

The supported `surplus_handling` values are:

- `CARRY_FORWARD`: carry the remaining amount into the next budget as an
  explicit rollover amount;
- `SAVE`: record the amount as a savings-directed surplus instruction;
- `REALLOCATE`: assign the amount to selected open categories or goals; and
- `LEAVE_UNALLOCATED`: keep the amount unassigned.

The supported `deficit_handling` values are:

- `WARN_ONLY`: allow a configured deficit plan but show a persistent warning;
- `REDUCE_OPEN`: require the user to reduce open allocations before activation;
- `USE_ROLLOVER`: cover the deficit with an explicit rollover amount; and
- `BLOCK_ACTIVATION`: do not activate while the budget is overallocated.

Default behavior is `LEAVE_UNALLOCATED` for surplus and `BLOCK_ACTIVATION` for
deficit. Protected balances are separate from ordinary surplus and cannot be
spent, carried, or reallocated unless the user explicitly changes the balance
instruction in a new action. The app must never treat an account's remaining
balance as protected merely because it exists.

### 6.5 Allocation methods

The supported `allocation_method` enum is:

- `MANUAL`: the user enters every allocation;
- `RECOMMENDED`: allocations come from an accepted recommendation snapshot;
- `PERCENTAGE`: the user assigns percentages that Odin converts to amounts;
- `HISTORICAL_BASELINE`: Odin proposes amounts from the user's historical
  spending, which the user reviews before saving.

All methods produce ordinary editable budget allocations. The method is
metadata and does not bypass validation. No unapproved ratio such as a fixed
50/30/20 rule is required.

### 6.6 Budget lifecycle and editing

The supported lifecycle is `DRAFT`, `ACTIVE`, `CLOSED`, and `ARCHIVED`.

- `DRAFT`: fully editable and deletable through a tombstone.
- `ACTIVE`: dates and allocations may be edited in place; edits affect future
  tracking from the edit timestamp onward. Posted historical transactions and
  prior calculated health snapshots are not rewritten.
- `CLOSED`: immutable for ordinary users. It can be reopened only through an
  explicit product action approved outside this release.
- `ARCHIVED`: hidden from default active views and reversible to `CLOSED`.

Editing an active budget does not create a new budget record or revision tree.
Each mutation creates a `budget_event` containing the action, timestamp,
changed fields, actor/user ID, and resulting version. This keeps the model
small while preserving an audit trail.

Only one active budget may overlap a given date range for a user. Drafts may
overlap. Activation must reject an overlapping active budget unless the user
first closes it.

### 6.7 Budget health

Health is calculated from posted expense transactions only. Forecasts may appear
as a separate advisory projection but do not alter actual health.

For each budget and allocation:

`variance_amount = allocated_amount - actual_amount`

`adherence = actual_amount / allocated_amount` when allocation is greater than
zero. When allocation is zero, adherence is `1` if actual is zero and `null`
otherwise.

The overall health status is determined by period-to-date actual spending and
the elapsed fraction of the budget period:

| Status | Rule |
| --- | --- |
| `HEALTHY` | Actual spending is at or below 90% of the time-adjusted allocation and no category is over allocation. |
| `WARNING` | Actual spending is above 90% of the time-adjusted allocation, or any category is at least 90% used. |
| `OVER_BUDGET` | Actual spending exceeds total allocation, or any category exceeds its allocation. |
| `NOT_STARTED` | No posted expense exists and the period has not started. |
| `CLOSED` | The budget lifecycle is closed. |

Time-adjusted allocation is `allocated_amount * elapsed_days / budget_period_days`,
clamped to the full allocation. A zero-allocation category with spending is
always `OVER_BUDGET`. Protected and fixed categories use the same health rules;
their restriction badge and floor/ceiling status are displayed separately.

## 7. Recommendation Requirements

### 7.1 Inputs

The server-side optimizer may use:

- user-confirmed budget total and horizon;
- active income sources and expected income for the horizon;
- obligations and recurring expenses;
- current category restriction snapshots;
- transaction history and historical category aggregates;
- current budget and explicit rollover amount;
- savings-goal and debt inputs when available;
- forecast output when available; and
- the selected allocation method and user priorities.

Missing or stale optional inputs must be listed in the recommendation metadata.
The optimizer must not invent an income, obligation, category, or restriction.

### 7.2 Hard constraints

The optimizer must satisfy these constraints before returning a recommendation:

1. Total allocation is within the confirmed budget total, unless the user
   explicitly enabled deficit planning.
2. Fixed allocations meet their minimum amounts.
3. Protected allocations meet their stored floors.
4. No protected or fixed allocation is reduced relative to its required floor or
   fixed amount.
5. Allocations respect category ceilings.
6. All referenced records belong to the authenticated user.
7. The recommendation includes a feasible/infeasible result and validation
   messages.

If no feasible solution exists, the optimizer returns `INFEASIBLE` with the
conflicting constraints and does not produce cut recommendations. It may suggest
that the user increase the total, reduce open allocations, or review a
restriction, but it must not alter restrictions itself.

### 7.3 Recommendation output

Every recommendation contains:

- stable recommendation ID and creation timestamp;
- input budget/horizon identifiers and data freshness metadata;
- proposed total and per-category allocations;
- allocation method;
- surplus/deficit result;
- protected and fixed categories with floors and ceilings;
- explanation for each material allocation change;
- forecast/profile usage labels: `PERSONALIZED`, `FALLBACK`, `COLD_START`, or
  `NOT_AVAILABLE`;
- constraint validation result;
- advisory disclaimer; and
- status: `AVAILABLE`, `MODIFIED`, `ACCEPTED`, or `REJECTED`.

The client caches the latest recommendation for offline review. A cached
recommendation is visibly stale when its input budget, restrictions, or
transactions changed after generation. Stale recommendations may be viewed but
cannot be accepted without revalidation.

### 7.4 Recommendation actions

- `ACCEPT` creates a new draft budget from the exact recommendation snapshot.
- `MODIFY` opens an editable copy; the modified copy must pass the same
  feasibility rules before acceptance.
- `REJECT` records the rejection reason when supplied and changes no budget.

No recommendation action changes the active budget directly. Acceptance and
activation are separate user confirmations.

## 8. Data and Sync Contract

The budgeting domain includes `budgets`, `budget_allocations`,
`budget_events`, `budget_recommendations`, and explicit rollover instructions.
Required budget fields are: user ID, total amount, period kind, start/end
dates, period days, allocation method, lifecycle status, surplus handling,
deficit handling, deficit-planning flag, version, created/updated timestamps,
and deletion/tombstone metadata.

Required allocation fields are: user ID, budget ID, category/subcategory ID,
allocated amount, restriction snapshot, minimum/maximum amounts, actual amount,
variance, adherence, health status, version, timestamps, and tombstone metadata.

All local reads and writes are scoped to the authenticated user. Category,
subcategory, obligation, income, transaction, goal, debt, and rollover
references must be validated against that user's accessible records before
local persistence and remote sync application.

Budget CRUD and actions use the existing domain-operation sync queue. Deletes
are tombstones. Conflicts use delete-wins followed by per-field last-write-wins.
Operations are idempotent by operation ID. Losing or rejected operations are
retained in the existing audit/recovery path. Budget events are append-only
audit records and are user-scoped.

## 9. Acceptance Criteria

### Budget setup and lifecycle

- A signed-in user can create a draft budget without network access.
- The user can select all four supported period kinds and confirm dates.
- The setup view shows total, allocated, unallocated, surplus/deficit, and all
  restriction floors/ceilings before activation.
- Invalid amounts, dates, ownership references, overlaps, and constraint
  violations prevent activation with actionable messages.
- The user can activate, edit, close, archive, and tombstone-delete budgets
  according to lifecycle rules.
- Active budget edits update future tracking and create budget events without
  rewriting posted transactions.

### Health and tracking

- Posted expense transactions update category and overall actuals immediately
  in local views.
- The displayed variance, adherence, and health status match the formulas and
  thresholds in this document.
- The UI distinguishes actual health from forecast advisory output.
- A zero-allocation category with spending is shown as over budget.
- Closed budgets remain available for historical reporting.

### Recommendations

- An online user can request a server-side recommendation and see its inputs,
  freshness, explanations, restrictions, and feasibility result.
- Recommendations never reduce a protected floor or fixed amount.
- Infeasible recommendations return reasons and no unsafe allocation.
- Offline users can view cached recommendations with a stale label.
- Users can modify, accept, or reject recommendations.
- Accepted recommendations create drafts only; no recommendation is applied
  automatically.

### Sync and safety

- Offline budget changes enqueue domain operations and converge after reconnect.
- Repeated push operations do not duplicate budgets, allocations, or events.
- Delete-wins, ownership checks, tombstones, and failed-operation recovery work
  consistently with the system sync contract.
- Destructive delete, close, archive, and discard actions require explicit
  confirmation where applicable.

## 10. Testing Decisions

Tests verify user-visible behavior and domain outcomes rather than implementation
details. The minimum test set is:

- Period validation for weekly, monthly, custom, and income-cycle budgets.
- Allocation feasibility for balanced, underallocated, overallocated, fixed,
  protected-floor, ceiling, and deficit-planning cases.
- Restriction snapshot behavior when a current category restriction changes.
- Health formulas, time adjustment, thresholds, zero allocations, and closed
  budgets.
- Lifecycle permissions, overlap prevention, active edits, and budget events.
- Surplus/deficit handling and explicit rollover behavior.
- Recommendation hard constraints, infeasible output, stale cache behavior,
  explanations, and accept/modify/reject boundaries.
- Local-first CRUD, immediate read-model updates, queued operations, idempotent
  push, pull convergence, ownership rejection, tombstone deletes, delete-wins,
  and audit recovery.
- Mobile UI flows for setup, overview, recommendation review, and narrow-width
  validation/error states.

Model quality is tested separately from the budgeting UI. Budget optimizer
evaluation must report constraint satisfaction rate, budget utilization rate,
and deviation from user preferences, as identified in the thesis research
scope.

## 11. Dependencies

- Authentication and current-user context.
- User-owned category and restriction records.
- Income sources and obligations.
- Posted transactions and category aggregation.
- Optional forecasts, savings goals, and debt projections.
- Existing local SQLite repositories and sync queue.
- Server-side Budget Optimizer service.

Optional dependencies degrade safely. A recommendation may be generated with
fallback or cold-start metadata, but a missing required input must produce a
clear infeasible or unavailable result rather than guessed values.

## 12. References

1. [Odin System Specification](./system-spec.md), especially §§3.2, 6.8,
   6.9, 9, 11, and 12.2.
2. [Odin Requirements Engineering](./reqs-eng.md), budgeting requirements
   `BU-01` through `BU-03` and recommendation requirements `BR-01` through
   `BR-03`.
3. [Budget Setup screen description](../../../../Papers/docs/design-architecture/screen-descriptions/09-budget-setup.md).
4. [Budget Recommendation screen description](../../../../Papers/docs/design-architecture/screen-descriptions/10-budget-recommendation.md).
5. [Budget Overview / Categories screen description](../../../../Papers/docs/design-architecture/screen-descriptions/20-budget-overview-categories.md).
6. [Onboarding Questionnaire screen description](../../../../Papers/docs/design-architecture/screen-descriptions/02-onboarding-questionnaire.md).
7. [Budgeting discussion transcript](../../../../Papers/docs/planning-management/transcripts/4-24-meeting.md).
8. [Odin papers index](../../../../Papers/INDEX.md), including the budget screen
   inventory and literature topic mapping.
9. [Requirements engineering guidance](./reqs-eng.md).

## 13. Out-of-Scope Decisions Deferred

- Automatic payday detection and automatic horizon shifting.
- A separate revision entity or full user-facing budget history diff viewer.
- Dynamic learned restriction thresholds for protected categories.
- Automatic surplus transfers between financial accounts.
- Automatic debt repayment or savings transfers.
- Final optimizer algorithm selection and model hyperparameters; those belong
  in the Budget Optimizer model design document.
