# Budgeting Implementation Questions

Questions for validating the budgeting implementation details before
development begins.

## 1. Restrictions and Category Setup

### 1.1 Protected category floors

How is the floor of a `PROTECTED` category set?

- Is the floor entered by the user?
- Is it suggested from historical spending, obligations, or another source?
- Can the floor be changed while creating or editing a budget?
- What is the expected behavior when a protected category has no explicit
  floor? The current document says that its current allocation becomes the
  minimum for that budget snapshot. Please confirm.

How are floors handled for `FIXED` categories? Is the fixed amount always
defined by the user, or can it come from an obligation or recurring expense?

### 1.2 Default protected categories

Some categories are already marked as `PROTECTED` by default. Must every
default protected category be included in each budget?

- Is a budget invalid if a default protected category has no allocation?
- Can a user intentionally exclude a default protected category from a budget?
- If it is excluded, does the category's protected floor still need to be
  satisfied elsewhere, or does the category simply not apply to that budget?

## 2. Surplus and Deficit Handling

### 2.1 Surplus handling values

The schema currently supports these surplus-handling values:

- `CARRY_FORWARD`
- `SAVE`
- `REALLOCATE`
- `LEAVE_UNALLOCATED`

Are these values correct and complete?

Please confirm whether the intended meanings are:

- `CARRY_FORWARD`: carry the surplus into the next budget.
- `SAVE`: direct the surplus to savings.
- `REALLOCATE`: assign the surplus to open categories, savings goals, or debt,
  provided the destination is not `FIXED`.
- `LEAVE_UNALLOCATED`: leave the surplus unassigned.

Are these destinations and restrictions valid?

### 2.2 Who performs `REALLOCATE`?

Is `REALLOCATE` performed manually by the user on selected categories or
savings goals?

- Does the system merely present eligible destinations and amounts?
- Does the user need to confirm each destination?
- Can the optimizer recommend a reallocation without applying it?

### 2.3 Reallocation and the next period

Does a `REALLOCATE` action carry over into the next budgeting period?

- If yes, is it copied as a new allocation, a rollover amount, or a user
  preference?
- If no, should the next budget start from the original allocation values?
- How should the system treat a reallocation that changes a protected or fixed
  category?

### 2.4 Reusing the previous budget

Is there a function that lets the user reuse last month's budget for the
current month?

If so, please confirm whether this means:

- copying the previous budget as a new draft;
- copying allocations while recalculating dates and totals;
- carrying forward actual unspent amounts; or
- applying the previous budget as a historical baseline recommendation.

### 2.5 Deficit handling values

The schema currently supports these deficit-handling values:

- `WARN_ONLY`: allow the deficit plan but show a persistent warning.
- `REDUCE_OPEN`: require open allocations to be reduced before activation.
- `USE_ROLLOVER`: cover the deficit using an explicit rollover amount.
- `BLOCK_ACTIVATION`: prevent activation while the budget is overallocated.

Are these values appropriate and complete?

### 2.6 Default deficit handling

The default deficit-handling behavior is `BLOCK_ACTIVATION`. Please confirm
that this is the desired default.

### 2.7 Access to deficit-handling options

When can the user access the different deficit-handling options?

- Are all options available by user choice when creating or editing a budget?
- Are some options available only when deficit planning is explicitly enabled?
- Should the app recommend an option based on the user's situation?
- Should any option require additional confirmation because it can affect a
  future budget or rollover balance?

### 2.8 Meaning of `REDUCE_OPEN`

Is `REDUCE_OPEN` only a suggestion, or can the system actually reduce open
allocations?

- If the system can apply it, does it require explicit user confirmation?
- If the system can only suggest it, when should the suggestion appear?
- How should the system choose which open categories to reduce?
- Should the system show the proposed reductions, the reason for each one,
  and the resulting feasible budget before the user confirms?

## 3. Allocation Methods

The schema currently supports:

- `MANUAL`: the user enters each allocation directly.
- `RECOMMENDED`: allocations come from an accepted optimizer
  recommendation.
- `PERCENTAGE`: the user assigns percentages that Odin converts into
  allocation amounts.
- `HISTORICAL_BASELINE`: Odin proposes allocations based on the user's
  historical spending for review.

Are these allocation methods correct and sufficient?

Why are other budgeting methods not represented explicitly, such as:

- the 50/30/20 rule;
- zero-based budgeting;
- envelope budgeting; and
- pay-yourself-first?

Should these be supported as named methods, configured strategies, templates,
or recommendation presets? The current document says that no unapproved ratio
such as a fixed 50/30/20 rule is required. Please confirm whether this is a
scope decision or a temporary omission.

## 4. Budget Lifecycle and Editing

### 4.1 Budget states

The schema supports these budget states:

- `DRAFT`: editable budget that has not been activated.
- `ACTIVE`: currently used for tracking spending during its budget period.
- `CLOSED`: completed budget that is immutable for ordinary users.
- `ARCHIVED`: closed budget hidden from default active views.

Is this lifecycle acceptable and complete?

### 4.2 Immutability during the budget period

Should a budget be treated as immutable during its budget period?

If users can edit an active budget, please confirm the intended behavior:

- Can they change the total amount, dates, allocations, restrictions, and
  handling rules?
- Does editing affect budget health for the entire period or only from the edit
  timestamp onward?
- Should previously reported health values remain unchanged?
- Should the app show that health was calculated under different allocation
  versions?

The current document says that active budgets are editable in place, that edits
affect future tracking from the edit timestamp onward, and that prior health
snapshots are not rewritten. Please validate this model.

### 4.3 Effects of changing allocations

If a user edits an active budget, they may increase, decrease, remove, or add
an allocation. How should the system react to each change?

- Should existing actual spending remain attached to the original category?
- How should variance and adherence be calculated after an allocation is
  changed?
- Should changes create a new budget event only, or also a new allocation
  version?
- What happens if a savings goal or debt allocation is changed?
- Can a user remove or reduce an allocation connected to a savings goal or debt
  when it is marked `PROTECTED` or `FIXED`?
- If such changes are not allowed, should the UI prevent them or require an
  explicit restriction change in a new action?

## 5. Budget Health Validation

### 5.1 Formula and status validation

Please validate whether the following budget-health formulas, statuses, and
rules are correct. If possible, please provide references or sources supporting
the chosen thresholds and calculations.

```text
variance_amount = allocated_amount - actual_amount

adherence = actual_amount / allocated_amount
when allocated_amount > 0

when allocated_amount = 0:
  adherence = 1 if actual_amount = 0
  adherence = null otherwise
```

The current status rules are:

| Status | Rule |
| --- | --- |
| `HEALTHY` | Actual spending is at or below 90% of the time-adjusted allocation and no category is over allocation. |
| `WARNING` | Actual spending is above 90% of the time-adjusted allocation, or any category is at least 90% used. |
| `OVER_BUDGET` | Actual spending exceeds total allocation, or any category exceeds its allocation. |
| `NOT_STARTED` | No posted expense exists and the period has not started. |
| `CLOSED` | The budget lifecycle is closed. |

Time-adjusted allocation is defined as:

```text
allocated_amount * elapsed_days / budget_period_days
```

The value is clamped to the full allocation. A zero-allocation category with
spending is always `OVER_BUDGET`. Protected and fixed categories use the same
health rules, with restriction and floor/ceiling status displayed separately.

Questions:

- Are the 90% thresholds appropriate?
- Should `WARNING` take precedence over `HEALTHY` when a category reaches 90%,
  even if total spending is within the time-adjusted allocation?
- How should a budget be classified before its start date if it already has
  posted transactions dated in the period?
- Should `CLOSED` always take precedence over all spending-based statuses?
- Should adherence be capped at 1, or should it remain greater than 1 when
  spending exceeds allocation?
- Should refunds, reversals, pending transactions, and transfers affect
  `actual_amount`?
- Are there references that validate this formula and status model?

## 6. Budget Optimizer

The requirements mention a server-side budget optimizer. Could you elaborate on
its intended role and scope?

- Is it a deterministic constraint solver, a recommendation model, or a hybrid?
- What inputs are required versus optional?
- What user priorities should it optimize for after protected and fixed
  constraints are satisfied?
- How should it rank competing feasible allocations?
- What does “optimal” mean for this product: highest feasibility, lowest
  deviation from history, highest savings, lowest discretionary reduction, or
  something else?
- How are explanations generated and validated?
- What should happen when no feasible budget exists?
- What are the expected latency, availability, and offline behavior?
- How will constraint satisfaction, budget utilization, and deviation from user
  preferences be measured?
- Please provide references or research supporting the proposed optimizer
  behavior and evaluation metrics.

## 7. Recommendation Requirements Validation

### 7.1 Hard constraints from section 7.2

Please validate whether each of the following hard constraints is correct and
feasible for the budget optimizer:

1. Total allocation is within the confirmed budget total, unless the user
   explicitly enabled deficit planning.
2. Fixed allocations meet their minimum amounts.
3. Protected allocations meet their stored floors.
4. No protected or fixed allocation is reduced relative to its required floor
   or fixed amount.
5. Allocations respect category ceilings.
6. All referenced records belong to the authenticated user.
7. The recommendation includes a feasible/infeasible result and validation
   messages.

Additional questions:

- Are these constraints sufficient to define feasibility?
- Are any constraints redundant or contradictory?
- Is deficit planning an optimizer constraint, a budget-validation rule, or
  both?
- Should the optimizer be allowed to leave funds unallocated?
- Should it optimize across savings goals and debt after all category floors
  are satisfied?
- Are there performance or data-availability concerns that make any constraint
  impractical?

### 7.2 Recommendation output from section 7.3

Please validate whether every recommendation should contain the following:

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

Questions:

- Are all of these output fields necessary for the first implementation?
- Are the statuses complete and mutually exclusive?
- Should `MODIFIED` represent a user-edited recommendation before acceptance?
- Should an accepted recommendation remain immutable as a snapshot?
- Are the freshness labels and explanation requirements appropriate?
- What references should guide the recommendation explanation and disclaimer
  requirements?

### 7.3 Recommendation actions from section 7.4

Please validate whether these recommendation actions are appropriate:

- `ACCEPT` creates a new draft budget from the exact recommendation snapshot.
- `MODIFY` opens an editable copy; the modified copy must pass the same
  feasibility rules before acceptance.
- `REJECT` records the rejection reason when supplied and changes no budget.

The current requirement is that no recommendation action changes the active
budget directly, and that acceptance and activation are separate user
confirmations. Please confirm this workflow and provide references if there is
an established product or safety pattern we should follow.
