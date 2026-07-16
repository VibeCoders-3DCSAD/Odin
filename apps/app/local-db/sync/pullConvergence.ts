import * as SQLite from "expo-sqlite";

type PullRow = Record<string, unknown>;

export interface PullDb {
  getFirstAsync<T>(sql: string, ...params: SQLite.SQLiteBindValue[]): Promise<T | null>;
  runAsync(sql: string, ...params: SQLite.SQLiteBindValue[]): Promise<SQLite.SQLiteRunResult>;
}

export const SYNCED_TABLES = [
  "category_groups",
  "categories",
  "subcategories",
  "financial_accounts",
  "transactions",
  "transaction_templates",
  "transaction_drafts",
  "recurring_transaction_templates",
  "recurring_transaction_occurrences",
  "income_sources",
  "financial_obligations",
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
    "current_balance_centavos", "credit_limit_centavos",
    "include_in_dashboard_balance", "institution_name", "opened_on",
    "archived_at", "deleted_at", "sort_order", "notes", "metadata", "version",
    "deleted", "created_at", "updated_at", "last_synced_at",
  ]),
  income_sources: new Set([
    "id", "user_id", "name", "income_type", "frequency",
    "expected_amount_centavos", "min_amount_centavos", "max_amount_centavos",
    "payday_day_of_month", "payday_second_day_of_month", "payday_day_of_week",
    "payday_second_day_of_week", "next_expected_date", "estimated_interval_days",
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
    "transaction_date", "posted_at", "amount_centavos",
    "subcategory_id", "source_account_id", "destination_account_id",
    "recurring_template_id", "merchant_name", "counterparty_name",
    "notes", "client_mutation_id", "metadata", "version", "deleted",
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
    } else if (col === "metadata") {
      const val = row[col];
      normalized[col] = typeof val === "object" && val !== null ? JSON.stringify(val) : (val ?? "{}");
    } else {
      const val = row[col];
      normalized[col] = typeof val === "boolean" ? (val ? 1 : 0) : val;
    }
  }

  return normalized;
}

export async function applyPullRow(
  db: PullDb,
  table: string,
  row: PullRow,
): Promise<void> {
  const recordId = row.id as string;
  const rowVersion = (row.version as number) ?? 1;
  const rowDeleted = row.deleted === true || (row.deleted as number) === 1;
  const now = new Date().toISOString();

  const existing = await db.getFirstAsync<{ version: number }>(
    `SELECT version FROM "${table}" WHERE id = ?`,
    recordId,
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

  if (rowVersion <= existing.version) return;

  if (rowDeleted) {
    if (
      table === "financial_accounts" ||
      table === "financial_obligations" ||
      table === "transactions" ||
      table === "transaction_templates" ||
      table === "recurring_transaction_templates" ||
      table === "recurring_transaction_occurrences"
    ) {
      await db.runAsync(
        `UPDATE "${table}" SET deleted = 1, status = 'deleted', version = ?,
         updated_at = ? WHERE id = ?`,
        rowVersion,
        now,
        recordId,
      );
    } else if (table === "transaction_drafts") {
      await db.runAsync(
        `UPDATE "${table}" SET deleted = 1, status = 'discarded', version = ?,
         updated_at = ? WHERE id = ?`,
        rowVersion,
        now,
        recordId,
      );
    } else {
      await db.runAsync(
        `UPDATE "${table}" SET deleted = 1, is_active = 0, version = ?,
         updated_at = ? WHERE id = ?`,
        rowVersion,
        now,
        recordId,
      );
    }
    return;
  }

  const columns = Object.keys(row);
  const setClauses = columns.map((c) => `"${c}" = ?`).join(", ");

  await db.runAsync(
    `UPDATE "${table}" SET ${setClauses} WHERE id = ?`,
    ...columns.map((c) => row[c] as SQLite.SQLiteBindValue),
    recordId,
  );
}
