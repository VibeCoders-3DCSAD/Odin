# Recurring Transactions CRUD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a first-class recurring transactions area under Transactions, with offline-first CRUD, shared frequency/day selection, Add Transaction visual parity, delete confirmation, and clear links to obligations and generated transactions.

**Architecture:** Keep the existing offline stack. The repo already has local SQLite tables, repository CRUD, sync queue wiring, pull convergence, and an API trigger for recurring generation; the missing piece is product surface area. Build one new app screen, wire it into the drawer under Transactions, extract the recurring schedule selector into a reusable UI block, and reuse the existing `recurringTransactions` repository instead of inventing a second data path.

**Tech Stack:** Expo React Native, TypeScript, `expo-sqlite`, existing local sync queue, Jest, React Native Testing Library.

## Global Constraints

- Keep frontend work in `odin/apps/app/`.
- Stay offline first: every create, update, delete must go through the local repository and existing sync queue.
- Do not add new dependencies.
- Reuse existing recurring tables and sync entities instead of creating parallel storage.
- Destructive actions must require explicit confirmation.
- Scope all reads and writes by `user_id`.
- Keep the Add Recurring Transaction UI visually close to `features/ledger/NewTransactionScreen.tsx`.
- Use the same schedule/day selector semantics already used by Income Sources frequency and Obligations due-date fields.

---

## Discovery Notes

### Existing tables already available

- Local SQLite: `apps/app/local-db/migrations/012_ledger_tables.ts`
  - `transactions`
  - `transaction_templates`
  - `transaction_drafts`
  - `recurring_transaction_templates`
  - `recurring_transaction_occurrences`
- Local SQLite: `apps/app/local-db/migrations/006_financial_foundations.ts`
  - `income_sources`
  - `financial_obligations` with `recurring_template_id`
- Sync convergence allowlist: `apps/app/local-db/sync/pullConvergence.ts`
  - `recurring_transaction_templates`
  - `recurring_transaction_occurrences`
  - `income_sources`
  - `financial_obligations`
- Server sync/RPC migrations already exist in `supabase/migrations/`
  - `20260717000000_extend_apply_sync_operation_for_templates.sql`
  - `20260717015111_add_income_sources_and_obligations_to_sync_allowlist.sql`
  - `20260717021000_add_recurring_engine_rpc.sql`
  - `20260717022000_populate_next_occurrence_date_and_trigger.sql`
  - `20260717022001_add_obligation_recurring_link_rpc.sql`
  - `20260717022002_permanent_fix_jsonb_object_length.sql`

### Local repositories already available

- `apps/app/local-db/repositories/recurringTransactions.ts`
  - `listRecurringTemplates`
  - `getRecurringTemplate`
  - `createRecurringTemplate`
  - `updateRecurringTemplate`
  - `deleteRecurringTemplate`
  - `generateNextOccurrence`
- `apps/app/local-db/repositories/financialFoundations.ts`
  - `listFinancialObligations`
  - `linkObligationToRecurringTemplate`
  - `automateObligation`
- Adjacent but separate: `apps/app/local-db/repositories/ledgerTemplates.ts`
  - Manual transaction templates, not recurring templates.

### Current linkage facts

- Obligations already link to recurring templates through `financial_obligations.recurring_template_id`.
- Generated transactions already link back through `transactions.recurring_template_id` and `entry_source = 'recurring'`.
- Income Sources do not currently link to recurring templates by foreign key; the only relationship today is behavioral/UI overlap in frequency scheduling, not persisted linkage.

## Task 1: Add Navigation And Page Wiring

**Files:**
- Create: `apps/app/features/recurring-transactions/RecurringTransactionsScreen.tsx`
- Modify: `apps/app/components/MobileShell.tsx`

**Interfaces:**
- Consumes: `listRecurringTemplates(userId)`, `deleteRecurringTemplate(userId, deviceId, id)`
- Produces: new shell page key `recurring-transactions`

- [ ] **Step 1: Add the new page union and drawer child under Transactions**

```ts
type Page =
  | "dashboard"
  | "transactions"
  | "recurring-transactions"
  | "history"
  // ...existing pages

const drawerSections: DrawerSection[] = [
  {
    label: "Overview",
    items: [
      { page: "transactions", icon: "swap-horizontal-bold", label: "Transactions" },
      { page: "recurring-transactions", icon: "repeat", label: "Recurring Transactions" },
    ],
  },
];
```

- [ ] **Step 2: Add page metadata and render branch**

```tsx
"recurring-transactions": {
  title: "Recurring Transactions",
  subtitle: "Manage recurring templates",
},

if (currentPage === "recurring-transactions") {
  return (
    <RecurringTransactionsScreen
      userId={userId}
      deviceId={deviceId}
      accessToken={accessToken}
      onBack={() => setCurrentPage("transactions")}
      onSyncRequested={handleSync}
    />
  );
}
```

- [ ] **Step 3: Stub the new screen with loading, empty, list, and add button shell**

```tsx
export default function RecurringTransactionsScreen(props: Props) {
  return (
    <View>
      <Text>Recurring Transactions</Text>
    </View>
  );
}
```

- [ ] **Step 4: Run app tests for shell wiring**

Run: `pnpm --filter app test -- MobileShell`
Expected: existing shell tests pass, or no matching test file if coverage does not exist yet.

- [ ] **Step 5: Commit**

```bash
git add apps/app/components/MobileShell.tsx apps/app/features/recurring-transactions/RecurringTransactionsScreen.tsx
git commit -m "feat(frontend): add recurring transactions navigation"
```

## Task 2: Extract Shared Schedule Selector

**Files:**
- Create: `apps/app/features/recurring-transactions/components/RecurringScheduleFields.tsx`
- Modify: `apps/app/features/income-sources/IncomeSourcesScreen.tsx`
- Modify: `apps/app/features/financial-obligations/FinancialObligationsScreen.tsx`
- Modify: `apps/app/features/ledger/NewTransactionScreen.tsx`

**Interfaces:**
- Produces:
  - `RecurringScheduleFields(props)`
  - `type RecurringScheduleValue = { frequency: string; intervalCount: string; dayOfMonth: string; secondDayOfMonth: string; dayOfWeek: number | null; secondDayOfWeek: number | null; monthOfYear: number | null; estimatedIntervalDays: string }`

- [ ] **Step 1: Extract the shared selector shape from Income Sources and Obligations first**

```tsx
type RecurringScheduleValue = {
  frequency: string;
  intervalCount: string;
  dayOfMonth: string;
  secondDayOfMonth: string;
  dayOfWeek: number | null;
  secondDayOfWeek: number | null;
  monthOfYear: number | null;
  estimatedIntervalDays: string;
};

type RecurringScheduleFieldsProps = {
  label: string;
  frequencies: readonly string[];
  value: RecurringScheduleValue;
  onChange: (next: RecurringScheduleValue) => void;
  mode: "income" | "obligation" | "transaction";
};
```

- [ ] **Step 2: Move frequency chips, day-of-month, day-of-week, semi-monthly, yearly month, and irregular interval UI into that component**

```tsx
{value.frequency === "semi_monthly" ? (
  <>
    <DayOfMonthInput label="1st day" value={value.dayOfMonth} />
    <DayOfMonthInput label="2nd day" value={value.secondDayOfMonth} />
  </>
) : null}
```

- [ ] **Step 3: Rewire Income Sources to use the shared selector without changing current behavior**

```tsx
<RecurringScheduleFields
  label="Frequency"
  frequencies={FREQUENCIES}
  mode="income"
  value={schedule}
  onChange={setSchedule}
/>
```

- [ ] **Step 4: Rewire Obligations to use the same selector semantics**

```tsx
<RecurringScheduleFields
  label="Frequency"
  frequencies={FREQUENCIES}
  mode="obligation"
  value={schedule}
  onChange={setSchedule}
/>
```

- [ ] **Step 5: Replace the mini recurring block inside `NewTransactionScreen` with the shared selector**

```tsx
{isRecurring ? (
  <RecurringScheduleFields
    label="Recurring"
    frequencies={["daily", "weekly", "biweekly", "semi_monthly", "monthly", "quarterly", "yearly"]}
    mode="transaction"
    value={schedule}
    onChange={setSchedule}
  />
) : null}
```

- [ ] **Step 6: Run app tests for the shared selector consumers**

Run: `pnpm --filter app test -- recurring`
Expected: selector/repository tests pass.

- [ ] **Step 7: Commit**

```bash
git add apps/app/features/recurring-transactions/components/RecurringScheduleFields.tsx apps/app/features/income-sources/IncomeSourcesScreen.tsx apps/app/features/financial-obligations/FinancialObligationsScreen.tsx apps/app/features/ledger/NewTransactionScreen.tsx
git commit -m "refactor(frontend): share recurring schedule fields"
```

## Task 3: Build Offline-First Recurring Transactions CRUD Screen

**Files:**
- Modify: `apps/app/features/recurring-transactions/RecurringTransactionsScreen.tsx`
- Modify: `apps/app/local-db/repositories/recurringTransactions.ts`
- Create: `apps/app/features/recurring-transactions/components/RecurringTransactionFormSheet.tsx`
- Create: `apps/app/features/recurring-transactions/components/RecurringTemplateCard.tsx`

**Interfaces:**
- Consumes:
  - `listRecurringTemplates(userId)`
  - `createRecurringTemplate(userId, deviceId, input)`
  - `updateRecurringTemplate(userId, deviceId, id, input)`
  - `deleteRecurringTemplate(userId, deviceId, id)`
- Produces:
  - list screen with add/edit/delete
  - form sheet that maps shared selector values into `CreateRecurringInput` and `UpdateRecurringInput`

- [ ] **Step 1: Expand the repository list function only if the UI needs more rows than active/paused**

```ts
export async function listRecurringTemplates(
  userId: string,
  options?: { includeCompleted?: boolean },
): Promise<RecurringTemplate[]> {
  const statusFilter = options?.includeCompleted
    ? "status IN ('active', 'paused', 'completed')"
    : "status IN ('active', 'paused')";

  const rows = await db.getAllAsync<RecurringTemplateRow>(
    `SELECT * FROM recurring_transaction_templates WHERE user_id = ? AND deleted = 0 AND ${statusFilter} ORDER BY next_occurrence_date, updated_at DESC`,
    userId,
  );
  return rows.map(mapRecurringTemplate);
}
```

- [ ] **Step 2: Build the list screen from repository data with clear template cards**

```tsx
const [templates, setTemplates] = useState<RecurringTemplate[]>([]);

async function load() {
  setTemplates(await listRecurringTemplates(userId, { includeCompleted: true }));
}
```

- [ ] **Step 3: Build the form sheet to mirror Add Transaction layout**

```tsx
await createRecurringTemplate(userId, deviceId, {
  transaction_type: txType,
  name: description.trim(),
  amount_centavos: centavos,
  frequency: normalized.frequency,
  interval_count: normalized.intervalCount,
  day_of_month: normalized.dayOfMonth,
  second_day_of_month: normalized.secondDayOfMonth,
  day_of_week: normalized.dayOfWeek,
  starts_on: startDate,
  ends_on: endDate || undefined,
  subcategory_id: effectiveSubcategoryId || undefined,
  source_account_id: sourceAccountId || undefined,
  destination_account_id: destinationAccountId || undefined,
  notes: notes.trim() || undefined,
});
```

- [ ] **Step 4: Use the same account/category pickers and typography cues as `NewTransactionScreen` instead of inventing a second visual language**

```tsx
renderFieldLabel("ACCOUNT");
renderFieldLabel("CATEGORY");
renderFieldLabel("NOTES");
```

- [ ] **Step 5: Add delete confirmation before calling the repository delete**

```tsx
Alert.alert(
  `Delete ${template.name}?`,
  "This recurring transaction template will be permanently removed.",
  [
    { text: "Cancel", style: "cancel" },
    { text: "Delete", style: "destructive", onPress: confirmDelete },
  ],
);
```

- [ ] **Step 6: Trigger sync after successful mutations, but never block local success on network state**

```tsx
await createRecurringTemplate(userId, deviceId, input);
await load();
onSyncRequested?.();
```

- [ ] **Step 7: Add focused tests for repository validation and any new list-filter behavior**

```ts
it("lists completed templates when includeCompleted is true", async () => {
  const rows = await listRecurringTemplates("user-1", { includeCompleted: true });
  expect(rows.some((row) => row.status === "completed")).toBe(true);
});
```

- [ ] **Step 8: Run app tests**

Run: `pnpm --filter app test -- recurringTransactions`
Expected: recurring repository tests pass.

- [ ] **Step 9: Commit**

```bash
git add apps/app/features/recurring-transactions apps/app/local-db/repositories/recurringTransactions.ts
git commit -m "feat(frontend): add recurring transactions crud"
```

## Task 4: Surface Links To Obligations And Generated Transactions

**Files:**
- Modify: `apps/app/features/recurring-transactions/RecurringTransactionsScreen.tsx`
- Modify: `apps/app/features/financial-obligations/FinancialObligationsScreen.tsx`
- Modify: `apps/app/features/ledger/TransactionHistoryScreen.tsx`
- Test: `apps/app/local-db/repositories/__tests__/financialFoundations.test.ts`

**Interfaces:**
- Consumes:
  - `financial_obligations.recurring_template_id`
  - `transactions.recurring_template_id`
  - `transactions.entry_source`

- [ ] **Step 1: Show obligation linkage inside recurring template cards**

```tsx
const linkedObligation = obligations.find((item) => item.recurringTemplateId === template.id) ?? null;
```

- [ ] **Step 2: Keep obligation unlink/delete behavior consistent with the new recurring screen**

```tsx
await linkObligationToRecurringTemplate(userId, deviceId, obligation.id, null);
await deleteRecurringTemplate(userId, deviceId, template.id);
```

- [ ] **Step 3: Badge generated transactions in history using existing fields instead of new schema**

```tsx
const isRecurring = tx.entry_source === "recurring" || !!tx.recurring_template_id;
```

- [ ] **Step 4: Do not add an `income_sources.recurring_template_id` column in this pass**

```ts
// ponytail: income sources share schedule UI with recurring templates,
// but there is no persisted foreign-key relationship yet.
```

- [ ] **Step 5: Add or update tests for obligation-link validation if behavior changes**

Run: `pnpm --filter app test -- financialFoundations`
Expected: obligation linkage tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/app/features/recurring-transactions/RecurringTransactionsScreen.tsx apps/app/features/financial-obligations/FinancialObligationsScreen.tsx apps/app/features/ledger/TransactionHistoryScreen.tsx apps/app/local-db/repositories/__tests__/financialFoundations.test.ts
git commit -m "feat(frontend): surface recurring links across ledger"
```

## Spec Coverage Check

- Sidebar child of Transactions: covered by Task 1.
- Full CRUD for recurring transactions: covered by Task 3.
- Offline first: covered by Task 3 using existing local repository + sync queue.
- List of tables and local repos: covered in Discovery Notes.
- Reuse Income Sources frequency/day selector: covered by Task 2.
- Add Recurring similar to Add Transaction UI: covered by Task 3.
- Delete confirmation: covered by Task 3 and Task 4.
- Check how Obligations and Income link: covered in Discovery Notes and Task 4.

## Open Decisions

- Keep completed recurring templates visible or hide them by default behind a filter.
- Whether the new page should live directly under Transactions visually indented, or simply adjacent with shared labeling in the drawer.
- Whether editing a linked obligation should be allowed to drift away from its linked recurring template, or whether the UI should warn about divergence.

## Verification Commands

- `pnpm --filter app test -- recurringTransactions`
- `pnpm --filter app test -- financialFoundations`
- `pnpm --filter app test -- MobileShell`
- `pnpm --filter app test`

Plan complete and saved to `docs/superpowers/plans/2026-07-27-recurring-transactions-crud.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
