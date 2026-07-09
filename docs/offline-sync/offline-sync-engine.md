# ADR-001: Offline-First Sync Engine for Odin PFM

**Status:** Proposed (Revised)
**Date:** 2026-07-09
**Deciders:** Charles (Thesis Author)
**Context:** Odin PFM — Thesis Project (PostgreSQL / Supabase, React Native / Expo)
**Revision note:** Manual/flagged review for high-stakes field conflicts
(originally in Section 2, item 7) has been superseded by a fully automatic
"delete wins, per-field Last-Write-Wins" policy, adopted from IBM Informix
Enterprise Replication and independently corroborated by the Yjs CRDT
library's conflict-resolution model. See Sections 3.6 and 3.7 for rationale.

---

## 1. Context

Odin PFM is a personal finance management app targeting the Filipino market. Users
need to record and review transactions with zero perceived latency, including in
low-connectivity conditions (a primary constraint for the target market). The app
must therefore treat the local device as the primary read/write surface, while a
central Postgres/Supabase backend remains the durable, cross-device source of
truth.

Because financial data carries real consequences for the user (wrong balances,
lost transactions, duplicated entries), the sync design must prioritize
**correctness and auditability over cleverness**. Silent data loss or silent
data resurrection are both unacceptable failure modes.

### Constraints
- Backend: PostgreSQL via Supabase.
- Client: React Native / Expo, local SQLite as the on-device store.
- Network is assumed to be unreliable and intermittent, not "mostly available."
- Authentication (login, registration, password reset, logout) requires
  connectivity; all other app functionality must not.
- Thesis timeline imposes a scope ceiling — the design must be defensible in
  complexity, not maximal in generality.

---

## 2. Decision

We will implement an **offline-first, queue-based sync engine** with the
following core mechanics:

1. **Local SQLite is the source of truth for the UI.** All reads and writes go
   through SQLite directly. The UI never blocks on network I/O.
2. **Every mutation is queued**, not sent immediately. Each queued operation
   carries a client-generated `operation_id` (UUID, idempotency key),
   `user_id`, `record_id`, operation type, payload, and `base_version`
   (the version the client believed the record was at when it made the change).
3. **Soft deletes only (tombstones).** No client or server ever issues a hard
   `DELETE` on synced tables. Deletion sets `deleted = true` and bumps
   `version`, so deletes remain version-comparable like any other mutation.
4. **A background sync worker** runs on connectivity and:
   - Authenticates (fails soft — pauses sync, does not touch local data/queue).
   - Pushes queued operations in batches to `/sync/push`.
   - Pulls server-side changes since the device's last cursor via
     `/sync/pull` and applies them locally.
5. **The backend is the sole cross-device authority.** Devices never
   communicate peer-to-peer; all convergence happens through Postgres.
6. **Idempotency is resolved before conflict detection.** The server checks
   `operation_id` against an `applied_operations` log first; if already
   processed, it returns the cached result without reapplying anything.
   Only genuinely new operations proceed to version comparison.
7. **Conflict detection via optimistic versioning, resolved by a "delete
   wins" policy** (adopted from IBM Informix Enterprise Replication's
   conflict resolution model, and independently corroborated by the
   conflict-resolution mechanics of the Yjs CRDT library — see Sections
   3.6 and 3.7). The canonical policy, stated plainly:

   > **Deletes always win.** If one client deletes a row, any future
   > updates to that row are ignored. The row may be created again
   > (as a new record) with the same ID.
   >
   > **For concurrent updates, the last update to each individual field
   > wins** — not the last update to the whole row. Non-overlapping field
   > changes from different devices both survive; only genuinely
   > overlapping field writes pick a winner.

   All conflicts resolve **fully automatically, server-side, with no
   blocking user decision**:
   - **Delete vs. edit → tombstone always wins**, unconditionally, with no
     timestamp comparison. The losing edit is rejected outright. A later
     explicit create operation with the same ID is permitted and treated
     as a new record, not an upsert of the tombstoned row.
   - **Update vs. missing row → rejected, not upserted.** If an update
     arrives for a `record_id` the server has no row for (e.g. its create
     op hasn't synced yet, or the row was already purged), the operation is
     discarded rather than silently converted into an insert. This prevents
     referential-integrity corruption from out-of-order operation arrival.
   - **Edit vs. edit, disjoint fields → both writes survive** (field-level
     merge; not a real conflict since different columns are touched).
   - **Edit vs. edit, same field → Last-Write-Wins on that field**, using
     server-assigned arrival/version order as the primary signal. If two
     operations arrive with identical `updated_at` (a `timestamptz`,
     already UTC-normalized by Postgres — see Section 3.6), a deterministic
     tiebreaker (`device_id` lexicographic order) decides, mirroring both
     Informix's tiebreaker-column approach and Yjs's client-ID-based
     tiebreak for identical Lamport clocks.
8. **All conflict outcomes are logged, never silently discarded.** Every
   overridden operation — losing edits, rejected updates, LWW losers — is
   written to `edit_history` with its full original payload. Resolution is
   never gated on the user; the log exists purely so the user can
   optionally review or reverse a resolution after the fact (e.g. "restore
   this value," "recreate this transaction"). There is no blocking
   "pending review" state anywhere in the sync path.
9. **Multiple active devices are allowed.** Each device has a stable
   `device_id` for operation attribution, deterministic tiebreaking, and
   audit trails, but registering a new device does not deactivate existing
   devices. The conflict-resolution rules above are therefore part of the v1
   operating model, not only future-proofing.

---

## 3. Alternatives Considered

### 3.1 Naive Last-Write-Wins on `updated_at` (client timestamp)
Rejected. Client clocks are not trustworthy for ordering (clock skew, no
NTP guarantee on mobile), and blind LWW on a financial `amount` field risks
silently discarding a user's correction with no record it happened.

### 3.2 Hard deletes with a separate "tombstone log"
Considered maintaining tombstones in a side table rather than a `deleted`
flag on the row itself. Rejected: it reintroduces the exact problem
tombstoning was meant to solve — an update arriving after a hard delete has
nothing to version-check against in the main table, forcing every write path
to also consult the side table. A `deleted` flag keeps versioning uniform
across create/update/delete.

### 3.3 CRDTs (Conflict-free Replicated Data Types)
Rejected for v1. CRDTs would remove the need for server-adjudicated conflicts
entirely, but the engineering cost (custom merge semantics per field type,
tombstone garbage collection, larger payloads) is disproportionate to a
thesis-scope PFM app with a small number of concurrent devices per user.
Optimistic versioning with a defined policy set achieves equivalent
correctness for this problem size at a fraction of the complexity.

### 3.4 Always-manual conflict resolution (user resolves everything)
Rejected. Interrupting the user for every conflict — including
non-overlapping-field edits, which aren't meaningfully in conflict — creates
friction disproportionate to the actual risk. Manual resolution is reserved
for the narrow set of cases where an automatic policy could plausibly be
wrong in a way that matters financially.

### 3.5 Single active device restriction
Rejected. A single-device rule reduces the conflict surface, but it also makes
normal phone + web or phone replacement flows feel like forced logout. Since the
sync design already includes idempotency, tombstones, delete-wins, per-field
LWW, and edit-history auditability, v1 will allow multiple active devices and
keep the conflict path exercised rather than hiding it behind a session policy.

### 3.6 Manual/flagged review for high-stakes field conflicts (superseded)
An earlier iteration of this ADR flagged same-field conflicts on financially
sensitive columns (`amount`, `category`) for manual user review rather than
auto-resolving them. This is **superseded** in favor of a fully automatic
"delete wins" policy, adopted directly from IBM Informix Enterprise
Replication's built-in conflict resolution rule set
([IBM Informix documentation](https://www.ibm.com/docs/en/informix-servers/14.10.0?topic=rule-delete-wins-conflict-resolution)).

Informix's delete-wins rule ensures DELETE and INSERT operations win over
UPDATE operations, with remaining (non-delete) conflicts resolved by
comparing timestamps — a two-tier structure identical to what this ADR
already specified, minus the manual-review carve-out. Adopting it as
precedent rather than a bespoke policy gives the design:

- **A named, externally validated rule** rather than an ad hoc heuristic —
  useful both for implementation confidence and for defending the design
  choice in the thesis.
- **An explicit rationale for why delete must win unconditionally**:
  Informix's documentation notes the rule specifically prevents an UPDATE
  from being converted into an incorrect INSERT when the target row is
  missing because it was deleted first — i.e., it exists to stop exactly
  the "silent resurrection" failure mode this ADR was already designed to
  avoid, confirming that failure mode is a recognized class of replication
  bug, not a hypothetical edge case.
- **An additional edge case this ADR had not yet covered**: an UPDATE
  arriving for a row that does not exist on the server at all (not merely
  deleted) must also be rejected rather than silently upserted, per the
  same source. This has been added to the Decision (Section 2, item 7).
- **A concrete tiebreaker mechanism** for the rare case of identical
  timestamps, mirrored from Informix's approach of using a designated
  tiebreaker value when timestamps match exactly.

Informix's rule depends on GMT-normalized timestamps across replication
servers to make its timestamp comparisons valid. This ADR's equivalent
dependency is satisfied by design: **all timestamp columns in this schema
are `timestamptz`**, which Postgres always stores normalized to UTC
internally regardless of session or client timezone. This means the
timestamp-based tiebreaker is safe to use as-is, with no additional
clock-synchronization work required — a point in favor of adopting this
rule rather than inventing a custom one, since the operational precondition
it assumes is already met by this project's existing schema conventions.

### 3.7 Corroborating precedent: Yjs CRDT conflict resolution
[Yjs](https://github.com/yjs/yjs) is a widely used CRDT (Conflict-free
Replicated Data Type) library for real-time collaborative editing, used in
production by tools such as JupyterLab, Linear, and GitBook. It was
reviewed not as a candidate for adoption — this ADR already declined full
CRDTs in Section 3.3, and that conclusion is unchanged, since CRDTs solve a
harder problem (leaderless, arbitrary-topology merge) than this project has
(a single Postgres backend that is always the final authority) — but as an
independent check on whether the "delete wins, per-field LWW" policy is a
sound pattern.

Yjs's shared types (`Y.Map`, `Y.Array`, `Y.Text`) resolve concurrent writes
using Lamport-clock-style struct identifiers (`{client, clock}`). Two
properties of that model are structurally identical to the policy adopted
in this ADR, despite the two systems solving different problems (real-time
multi-cursor text editing vs. offline transaction sync):

- **Per-field, not per-row, resolution.** A `Y.Map` resolves each key
  independently; a concurrent write to one key does not discard a
  concurrent write to a different key on the same map. This matches this
  ADR's "last update to each individual field wins" rule directly, as
  opposed to a coarser whole-row Last-Write-Wins.
- **Deletion is terminal.** Once a struct is deleted, it is converted to a
  tombstone (a `GC` struct in Yjs's internal model) and cannot be silently
  reinstated by a later concurrent update — the same intent as this ADR's
  unconditional "deletes always win" rule.
- **Deterministic tiebreaking.** Ties between structs are resolved using
  client ID ordering, the same role this ADR's `device_id` tiebreaker
  plays for identical `updated_at` values.

The practical conclusion drawn from this comparison: the same two rules
("deletes win unconditionally" and "concurrent writes resolve per-field,
not per-row, using a deterministic clock plus ID tiebreak") appear
independently in an enterprise RDBMS replication engine (Section 3.6) and
in a leaderless CRDT library built for a completely different domain. That
convergence is treated as reasonable evidence the policy is a sound,
general pattern for this class of problem, rather than an ad hoc choice
specific to this project.

The consequence of superseding manual review is captured in the updated
Section 2 and Section 4: all conflict resolution is now automatic, and the
`conflicts` table is replaced by an `edit_history` audit log (see Section 2,
item 8) that supports optional, non-blocking user recovery instead of
mandatory review.

---

## 4. Consequences

### Positive
- UI is always responsive; no user-facing wait on network state.
- Retries are safe by construction (`operation_id` idempotency), so flaky
  connectivity cannot cause duplicate transactions.
- Conflict handling is deterministic, fully automatic, and auditable —
  every override is logged via `applied_operations`, and every losing
  operation's full payload is preserved in `edit_history`, so no state
  change is silent even though none require user intervention to proceed.
- No merge UI, review queue, or blocking "pending conflict" state needs to
  be designed, built, or tested — the entire manual-resolution surface
  area from the original design is eliminated.
- Schema (`version`, `updated_at`, idempotency keys, `device_id`) supports
  multi-device convergence from v1 without a later session-model migration.

### Negative / Accepted Tradeoffs
- Added schema complexity relative to a naive "just PATCH the row" design
  (tombstones, `applied_operations`, `conflicts` tables).
- Soft-delete tombstones require a periodic cleanup job (proposed: purge
  tombstones older than 90 days, gated on confirming no device is still
  behind that sync cursor).
- Field-level auto-merge requires the backend to diff payloads per operation
  rather than doing a blind row overwrite — more logic in the sync function,
  but contained to one place (`sync_apply_operations`).
- Multi-device support means the conflict-resolution branch is real v1
  behavior, not just a future compatibility path; it needs tests and clear
  audit output before relying on it for financial data.

---

## 5. Related Decision: Multiple Active Devices (Scoped for v1)

The app allows more than one active device session for the same user. Device
registration records device identity for sync attribution and auditability, not
for forced session migration:

- `user_devices` table tracks `user_id`, `device_id`, and last-seen metadata.
- Registering a new device does not deactivate existing devices.
- `/sync/push` still authenticates the user and verifies the operation belongs
  to that user's sync boundary.
- The conflict-resolution design in Section 2 is active v1 behavior because two
  devices can legitimately hold and later sync offline writes.

This keeps the product behavior closer to user expectations for phone + web or
replacement-device usage, at the cost of requiring the sync conflict path to be
correct and tested from the initial release.

---

## 6. Open Questions
- Tombstone retention window (proposed 90 days — needs validation against
  expected max offline duration for target users).
- Exact UI treatment for `edit_history` (dedicated "recent changes" screen
  vs. per-transaction history vs. a lightweight toast-only notification with
  no persistent screen at all) — needs validation against thesis scope and
  remaining timeline.
- Whether `device_id` is a stable enough tiebreaker value in practice
  (e.g. behavior on app reinstall generating a new device_id) or whether a
  server-assigned monotonic sequence number should be used instead for the
  tiebreak.
