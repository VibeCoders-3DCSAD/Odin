import * as SQLite from "expo-sqlite";

type PullRow = Record<string, unknown>;

const TAXONOMY_TABLES = new Set(["category_groups", "categories", "subcategories"]);
export interface PullDb {
  getFirstAsync<T>(sql: string, ...params: SQLite.SQLiteBindValue[]): Promise<T | null>;
  runAsync(sql: string, ...params: SQLite.SQLiteBindValue[]): Promise<SQLite.SQLiteRunResult>;
}

export const SYNCED_TABLES = [
  "category_groups",
  "categories",
  "subcategories",
  "financial_accounts",
  "credit_card_details",
  "transactions",
  "transaction_line_items",
  "transaction_templates",
  "transaction_drafts",
  "recurring_transaction_templates",
  "recurring_transaction_occurrences",
  "income_sources",
  "financial_obligations",
  "budgets",
  "budget_allocations",
  "credit_card_cycles",
  "credit_card_installments",
  "credit_card_transactions",
  "credit_card_statements",
  "debt_accounts",
] as const;

const LOCAL_COLUMNS: Record<string, Set<string>> = {
  category_groups: new Set([
    "id", "user_id", "slug", "label", "short_label", "description",
    "sort_order", "is_active", "metadata", "version", "deleted",
    "created_at", "updated_at", "last_synced_at",
  ]),
  categories: new Set([
    "id", "user_id", "category_group_id", "slug", "label", "short_label",
    "description", "is_system", "is_filipino_context", "sort_order",
    "is_active", "metadata", "version", "deleted",
    "created_at", "updated_at", "last_synced_at",
  ]),
  subcategories: new Set([
    "id", "user_id", "category_id", "slug", "kind", "label", "short_label",
    "description", "is_system", "is_filipino_context", "is_protected",
    "sort_order", "is_active", "metadata", "version", "deleted",
    "created_at", "updated_at", "last_synced_at",
  ]),
  financial_accounts: new Set([
    "id", "user_id", "name", "kind", "status", "opening_balance_centavos",
    "current_balance_centavos",
    "include_in_dashboard_balance", "institution_name", "opened_on",
    "archived_at", "deleted_at", "sort_order", "metadata", "version",
    "deleted", "created_at", "updated_at", "last_synced_at",
  ]),
  credit_card_details: new Set([
    "account_id", "user_id", "issuer", "credit_limit_centavos", "available_credit_centavos",
    "cutoff_day", "statement_day", "notes", "billing_cycle_days", "alert_threshold_percent",
    "version", "deleted", "created_at", "updated_at", "last_synced_at",
  ]),
  income_sources: new Set([
    "id", "user_id", "name", "income_type", "frequency",
    "expected_amount_centavos", "min_amount_centavos", "max_amount_centavos",
    "payday_day_of_month", "payday_second_day_of_month", "payday_day_of_week",
    "payday_second_day_of_week", "next_expected_date", "estimated_interval_days",
    "destination_account_id", "subcategory_id", "recurring_template_id",
    "is_active", "notes", "metadata", "version",
    "deleted", "created_at", "updated_at", "last_synced_at",
  ]),
  financial_obligations: new Set([
    "id", "user_id", "subcategory_id", "recurring_template_id", "name",
    "status", "amount_centavos", "frequency", "due_day_of_month",
    "due_second_day_of_month", "due_day_of_week", "due_second_day_of_week",
    "due_month",
    "is_family_support", "is_dependent_support", "protected_by_default",
    "starts_on", "ends_on", "notes", "metadata", "version", "deleted",
    "created_at", "updated_at", "last_synced_at",
  ]),
  transactions: new Set([
    "id", "user_id", "transaction_type", "status", "entry_source",
    "transaction_date", "posted_at", "credit_card_posting_date", "amount_centavos",
    "subcategory_id", "source_account_id", "destination_account_id",
    "recurring_template_id", "merchant_name", "counterparty_name",
    "notes", "client_mutation_id", "metadata", "version", "deleted",
    "created_at", "updated_at", "last_synced_at",
  ]),
  transaction_line_items: new Set([
    "id", "transaction_id", "user_id", "subcategory_id", "item_label", "quantity",
    "amount_centavos", "notes", "sort_order", "metadata", "version", "deleted",
    "created_at", "updated_at", "last_synced_at",
  ]),
  transaction_templates: new Set([
    "id", "user_id", "transaction_type", "status", "name",
    "amount_centavos", "subcategory_id", "source_account_id",
    "destination_account_id", "merchant_name", "counterparty_name",
    "notes", "use_count", "last_used_at", "metadata",
    "version", "deleted", "created_at", "updated_at", "last_synced_at",
  ]),
  transaction_drafts: new Set([
    "id", "user_id", "client_draft_id", "status", "payload",
    "captured_offline_at", "synced_transaction_id", "last_error",
    "metadata", "version", "deleted", "created_at", "updated_at", "last_synced_at",
  ]),
  recurring_transaction_templates: new Set([
    "id", "user_id", "transaction_type", "status", "name",
    "amount_centavos", "frequency", "interval_count",
    "day_of_month", "second_day_of_month", "day_of_week",
    "custom_rule", "starts_on", "ends_on", "next_occurrence_date",
    "last_generated_date", "subcategory_id", "source_account_id",
    "destination_account_id", "reminder_enabled", "reminder_days_before", "notes",
    "metadata", "version", "deleted", "created_at", "updated_at", "last_synced_at",
  ]),
  recurring_transaction_occurrences: new Set([
    "id", "user_id", "recurring_template_id", "scheduled_date", "status",
    "generated_transaction_id", "reminder_sent_at", "posted_at",
    "skipped_at", "failure_reason", "metadata",
    "version", "deleted", "created_at", "updated_at", "last_synced_at",
  ]),
  budgets: new Set([
    "id", "user_id", "status", "allocation_method", "period_kind", "period_start", "period_end",
    "budget_period_days", "total_amount_minor", "surplus_handling", "deficit_handling",
    "allow_deficit_planning", "version", "deleted", "created_at", "updated_at", "last_synced_at",
  ]),
  budget_allocations: new Set([
    "id", "user_id", "budget_id", "category_id", "subcategory_id", "allocated_amount_minor",
    "restriction_level", "version", "deleted", "created_at", "updated_at",
  ]),
  credit_card_cycles: new Set([
    "id", "user_id", "account_id", "cycle_start_date", "cutoff_date", "statement_date",
    "version", "deleted", "created_at", "updated_at", "last_synced_at",
  ]),
  credit_card_installments: new Set([
    "id", "user_id", "account_id", "transaction_id", "description", "original_principal_centavos",
    "remaining_principal_centavos", "term_months", "remaining_months", "monthly_amortization_centavos",
    "interest_rate_bps", "interest_type", "settlement_status", "version", "deleted", "created_at", "updated_at", "last_synced_at",
  ]),
  credit_card_transactions: new Set([
    "transaction_id", "user_id", "account_id", "cycle_id", "purchase_type", "installment_id",
    "client_mutation_id", "applied_credit_centavos", "version", "deleted", "created_at", "updated_at", "last_synced_at",
  ]),
  credit_card_statements: new Set([
    "id", "user_id", "cycle_id", "statement_date", "statement_balance_centavos", "minimum_due_centavos",
    "finance_charge_centavos", "due_date", "authoritative", "version", "deleted", "created_at", "updated_at", "last_synced_at",
  ]),
  debt_accounts: new Set([
    "id", "user_id", "linked_account_id", "name", "lender_name", "preset_key", "status",
    "original_balance_centavos", "current_balance_centavos", "annual_interest_rate_bps",
    "minimum_payment_centavos", "payment_frequency", "next_due_date", "maturity_date",
    "target_payoff_date", "interest_period", "interest_method", "preset_data", "payment_schedule",
    "notes", "paid_off_at", "archived_at", "version", "deleted", "created_at", "updated_at",
    "last_synced_at",
  ]),
};

const PULL_IDENTITY_COLUMNS: Record<string, string> = {
  credit_card_details: "account_id",
  credit_card_transactions: "transaction_id",
};

export function normalizePullRow(
  table: string,
  row: PullRow,
  userId: string,
): PullRow {
  const columns = LOCAL_COLUMNS[table];
  if (!columns) return row;

  const now = new Date().toISOString();
  const normalized: PullRow = {};

  for (const col of columns) {
    if (col === "user_id") {
      normalized[col] = (row[col] as string | null) ?? userId;
    } else if (col === "created_at") {
      normalized[col] = (row[col] as string | undefined) ?? (row.updated_at as string) ?? now;
    } else if (col === "last_synced_at") {
      normalized[col] = (row[col] as string | undefined) ?? now;
    } else if (col === "is_protected") {
      const isProtectedDefault = (row.is_protected_default as boolean) === true;
      const isProtected = (row.is_protected as boolean) === true;
      normalized[col] = isProtectedDefault || isProtected ? 1 : 0;
    } else if (col === "metadata" || col === "preset_data" || col === "payment_schedule") {
      const val = row[col];
      normalized[col] = typeof val === "object" && val !== null ? JSON.stringify(val) : (val ?? "{}");
    } else if (table === "budgets" && col === "period_kind") {
      normalized[col] = String(row[col] ?? "").toUpperCase();
    } else if (table === "budgets" && col === "allocation_method") {
      normalized[col] = "MANUAL";
    } else if (table === "budgets" && col === "total_amount_minor") {
      normalized[col] = row.total_amount_centavos;
    } else if (table === "budgets" && col === "surplus_handling") {
      normalized[col] = "LEAVE_UNALLOCATED";
    } else if (table === "budgets" && col === "deficit_handling") {
      normalized[col] = "BLOCK_ACTIVATION";
    } else if (table === "budget_allocations" && col === "allocated_amount_minor") {
      normalized[col] = row.allocated_amount_centavos;
    } else if (table === "budget_allocations" && col === "restriction_level") {
      normalized[col] = "OPEN";
    } else {
      const val = row[col];
      normalized[col] = typeof val === "boolean" ? (val ? 1 : 0) : val;
    }
  }

  if (table === "budget_allocations" && normalized.category_id == null && normalized.subcategory_id != null) {
    normalized.category_id = row.category_id ?? null;
  }

  return normalized;
}

export async function applyPullRow(
  db: PullDb,
  table: string,
  row: PullRow,
): Promise<void> {
  const identityColumn = PULL_IDENTITY_COLUMNS[table] ?? "id";
  const userScoped = !TAXONOMY_TABLES.has(table);
  const recordId = row[identityColumn] as string;
  const identityWhere = `"${identityColumn}" = ?${userScoped ? " AND user_id = ?" : ""}`;
  const identityParams: SQLite.SQLiteBindValue[] = userScoped ? [recordId, row.user_id as string] : [recordId];
  const rowVersion = (row.version as number) ?? 1;
  const rowDeleted = row.deleted === true || (row.deleted as number) === 1;
  const now = new Date().toISOString();

  const existing = await db.getFirstAsync<{ version: number; user_id: string; statement_date?: string | null }>(
    `SELECT version, user_id${table === "credit_card_cycles" ? ", statement_date" : ""} FROM "${table}" WHERE ${identityWhere}`,
    ...identityParams,
  );

  if (!existing) {
    if (rowDeleted) return;

    const columns = Object.keys(row).join(", ");
    const placeholders = Object.keys(row).map(() => "?").join(", ");
    const values = Object.keys(row).map((k) => row[k] as SQLite.SQLiteBindValue);

    await db.runAsync(
      `INSERT INTO "${table}" (${columns}) VALUES (${placeholders})`,
      ...values,
    );
    return;
  }

  // System taxonomy IDs are shared by the server, but local rows are user-scoped.
  // Reassign a reused system row before applying the normal version check.
  if (TAXONOMY_TABLES.has(table) && existing.user_id !== undefined && existing.user_id !== row.user_id) {
    const columns = Object.keys(row);
    const setClauses = columns.map((c) => `"${c}" = ?`).join(", ");
    await db.runAsync(
      `UPDATE "${table}" SET ${setClauses} WHERE id = ?`,
      ...columns.map((c) => row[c] as SQLite.SQLiteBindValue),
      recordId,
    );
    return;
  }

  if (rowVersion <= existing.version) return;

  if (rowDeleted) {
    if (
      table === "financial_accounts" ||
      table === "financial_obligations" ||
       table === "transactions" ||
       table === "debt_accounts" ||
       table === "transaction_templates" ||
      table === "recurring_transaction_templates" ||
       table === "recurring_transaction_occurrences"
    ) {
      await db.runAsync(
       `UPDATE "${table}" SET deleted = 1, status = 'deleted', version = ?,
          updated_at = ? WHERE ${identityWhere}`,
        rowVersion,
        now,
        ...identityParams,
      );
    } else if (table === "transaction_drafts") {
      await db.runAsync(
         `UPDATE "${table}" SET deleted = 1, status = 'discarded', version = ?,
          updated_at = ? WHERE ${identityWhere}`,
        rowVersion,
        now,
        ...identityParams,
      );
    } else if (table === "transaction_line_items") {
      await db.runAsync(
         `UPDATE "${table}" SET deleted = 1, version = ?,
          updated_at = ? WHERE ${identityWhere}`,
        rowVersion,
        now,
        ...identityParams,
      );
    } else if (table === "budgets") {
      await db.runAsync(
         `UPDATE "${table}" SET deleted = 1, status = 'deleted', version = ?,
          updated_at = ? WHERE ${identityWhere}`,
        rowVersion,
        now,
        ...identityParams,
      );
    } else if (table === "budget_allocations") {
      await db.runAsync(
         `UPDATE "${table}" SET deleted = 1, version = ?,
           updated_at = ? WHERE ${identityWhere}`,
        rowVersion,
        now,
        ...identityParams,
      );
    } else if (table === "credit_card_cycles" || table === "credit_card_details") {
      await db.runAsync(
        `UPDATE "${table}" SET deleted = 1, version = ?,
          updated_at = ? WHERE ${identityWhere}`,
        rowVersion,
        now,
        ...identityParams,
      );
    } else {
      await db.runAsync(
        `UPDATE "${table}" SET deleted = 1, is_active = 0, version = ?,
         updated_at = ? WHERE ${identityWhere}`,
        rowVersion,
        now,
        ...identityParams,
      );
    }
    return;
  }

  const columns = table === "credit_card_cycles" && existing.statement_date !== null && existing.statement_date !== undefined
    // SQLite fires UPDATE OF triggers even when the assigned value is unchanged.
    // Recorded cycle dates are immutable, while statement_date remains server-owned.
    ? Object.keys(row).filter((column) => column !== "cycle_start_date" && column !== "cutoff_date")
    : Object.keys(row);
  const setClauses = columns.map((c) => `"${c}" = ?`).join(", ");

  await db.runAsync(
    `UPDATE "${table}" SET ${setClauses} WHERE ${identityWhere}`,
    ...columns.map((c) => row[c] as SQLite.SQLiteBindValue),
    ...identityParams,
  );
}
