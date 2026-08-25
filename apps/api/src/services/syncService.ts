import type { SupabaseClient } from "@supabase/supabase-js";
import { prepareOperation } from "./syncApplyOperation.js";

type PushOperation = {
  operation_id: string;
  entity: string;
  record_id: string;
  operation_type: "create" | "update" | "delete";
  base_version: number | null;
  changed_fields: string[];
  payload: Record<string, unknown>;
};

type PushResult = {
  operation_id: string;
  status: "applied" | "rejected" | "conflict" | "duplicate";
  reason?: string;
  current_version?: number;
  conflicted_fields?: string[];
};

type RpcApplyResult = {
  status: PushResult["status"] | "conflict";
  reason: string | null;
  current_version: number | null;
  conflicted_fields: string[] | null;
};

type PullChanges = Record<string, Record<string, unknown>[]>;

type TableCursor = { ts: string; id: string };

type PullCursors = Record<string, TableCursor>;

const CLIENT_SYNC_FAILURE_REASON = "Sync operation rejected";
const EDIT_HISTORY_FAILURE_REASON = "sync_operation_rejected";

const SYNCED_TABLES = [
  "category_groups",
  "categories",
  "subcategories",
  "financial_accounts",
  "transactions",
  "transaction_line_items",
  "income_sources",
  "financial_obligations",
  "transaction_templates",
  "transaction_drafts",
  "recurring_transaction_templates",
  "recurring_transaction_occurrences",
  "budgets",
  "budget_allocations",
  "debt_accounts",
  "debt_payments",
  "user_debt_priorities",
  "debt_strategy_preferences",
] as const;

export async function pushOperations(
  supabase: SupabaseClient,
  userId: string,
  deviceId: string,
  operations: PushOperation[],
): Promise<PushResult[]> {
  assertDeviceId(deviceId);
  const results: PushResult[] = [];

  for (const op of operations) {
    let auditPayload: Record<string, unknown> = { redacted: true, fields: Object.keys(op.payload) };
    try {
      const prepared = await prepareOperation(supabase, userId, op);
      auditPayload = { redacted: true, fields: Object.keys(prepared.payload) };
      const rpcName = prepared.entity === "budgets"
        ? "apply_budget_sync_operation_v2"
        : ["debt_accounts", "debt_payments", "user_debt_priorities", "debt_strategy_preferences"].includes(prepared.entity)
          ? "apply_debt_sync_operation"
          : "apply_sync_operation";
      const { data, error } = await supabase.rpc(rpcName, {
        p_operation_id: prepared.operation_id,
        p_device_id: deviceId,
        p_entity: prepared.entity,
        p_record_id: prepared.record_id,
        p_operation_type: prepared.operation_type,
        p_base_version: prepared.base_version,
        p_changed_fields: prepared.changed_fields,
        p_payload: prepared.payload,
      });

      if (error) {
        throw new Error(`sync apply failed: ${error.message}`);
      }

      const result = Array.isArray(data) ? data[0] as RpcApplyResult | undefined : undefined;

      if (!result) throw new Error("sync apply returned no result");

        const isConflict = result.status === "conflict" || (result.status === "rejected" && result.reason?.includes("version changed"));
        const status = isConflict ? "conflict" : result.status;

       if (status === "rejected" || status === "conflict") {
        console.error("[sync/push] rejected", {
          userId,
          deviceId,
          operation_id: op.operation_id,
          entity: op.entity,
          record_id: op.record_id,
          operation_type: op.operation_type,
          reason: result.reason ?? "unknown",
        });
      }

      results.push({
        operation_id: op.operation_id,
         status,
          reason: status === "rejected" || status === "conflict" ? result.reason ?? CLIENT_SYNC_FAILURE_REASON : undefined,
          current_version: typeof result.current_version === "number" ? result.current_version : undefined,
          conflicted_fields: result.conflicted_fields ?? undefined,
      });
    } catch (error) {
      const activeBudgetConflict = op.entity === "budgets"
        && op.operation_type === "create"
        && error instanceof Error
        && error.message === "only one budget can exist at a time";
      console.error("[sync/push] rejected", {
        userId,
        deviceId,
        operation_id: op.operation_id,
        entity: op.entity,
        record_id: op.record_id,
        operation_type: op.operation_type,
          error,
      });

      await supabase.from("edit_history").insert({
        user_id: userId,
        operation_id: op.operation_id,
        entity: op.entity,
        record_id: op.record_id,
         reason: EDIT_HISTORY_FAILURE_REASON,
        payload: auditPayload,
      });

      results.push({
        operation_id: op.operation_id,
        status: activeBudgetConflict ? "conflict" : "rejected",
        reason: activeBudgetConflict ? "active_budget_exists" : CLIENT_SYNC_FAILURE_REASON,
      });
    }
  }

  return results;
}

export async function pullChanges(
  supabase: SupabaseClient,
  userId: string,
  cursors: PullCursors,
): Promise<{ cursors: PullCursors; changes: PullChanges; has_more: Record<string, boolean>; successful: boolean }> {
  const changes: PullChanges = {};
  const newCursors: PullCursors = {};
  const hasMore: Record<string, boolean> = {};
  let successful = true;

  for (const table of SYNCED_TABLES) {
    const cursorColumn = table === "debt_strategy_preferences" ? "user_id" : "id";
    const query = supabase
      .from(table)
      .select("*")
      .order("updated_at", { ascending: true })
      .order(cursorColumn, { ascending: true })
      .limit(500);

    if (table === "category_groups") {
      // category_groups has no user_id column — system-wide data
    } else if (
      table === "financial_accounts" ||
      table === "transactions" ||
      table === "transaction_line_items" ||
      table === "income_sources" ||
      table === "financial_obligations" ||
      table === "transaction_templates" ||
      table === "transaction_drafts" ||
      table === "recurring_transaction_templates" ||
      table === "recurring_transaction_occurrences"
      || table === "budgets"
      || table === "budget_allocations"
      || table === "debt_accounts"
      || table === "debt_payments"
      || table === "user_debt_priorities"
      || table === "debt_strategy_preferences"
    ) {
      // user-scoped only — no system rows
      query.eq("user_id", userId);
    } else {
      // categories and subcategories: include system rows (user_id IS NULL)
      // and user-owned rows
      query.or(`user_id.is.null,user_id.eq.${userId}`);
    }

    const tableCursor = cursors[table];
    if (tableCursor && tableCursor.id) {
      query.or(
        `updated_at.gt.${tableCursor.ts},and(updated_at.eq.${tableCursor.ts},${cursorColumn}.gt.${tableCursor.id})`,
      );
    }

    const { data, error } = await query;

    if (error) {
      successful = false;
      console.error("[sync/pull] table failed", {
        userId,
        table,
        cursor: tableCursor ?? null,
        error,
      });
      newCursors[table] = tableCursor ?? { ts: new Date(0).toISOString(), id: "" };
      hasMore[table] = false;
      continue;
    }

    if (data && data.length > 0) {
      changes[table] = data;
      hasMore[table] = data.length === 500;

      const lastRow = data[data.length - 1] as Record<string, unknown>;
      newCursors[table] = {
        ts: (lastRow.updated_at as string) ?? tableCursor?.ts ?? new Date(0).toISOString(),
        id: lastRow[cursorColumn] as string,
      };
    } else {
      newCursors[table] = tableCursor ?? { ts: new Date(0).toISOString(), id: "" };
      hasMore[table] = false;
    }
  }

  return { cursors: newCursors, changes, has_more: hasMore, successful };
}

export async function registerDevice(
  supabase: SupabaseClient,
  userId: string,
  deviceId: string,
): Promise<void> {
  assertDeviceId(deviceId);
  const { data: existing } = await supabase
    .from("user_devices")
    .select("id")
    .eq("user_id", userId)
    .eq("device_id", deviceId)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("user_devices")
      .update({ last_seen_at: new Date().toISOString(), is_active: true })
      .eq("user_id", userId)
      .eq("device_id", deviceId);
  } else {
    await supabase.from("user_devices").insert({
      user_id: userId,
      device_id: deviceId,
    });
  }
}

function assertDeviceId(deviceId: string): void {
  if (!deviceId || deviceId.length > 128 || !/^[a-zA-Z0-9._:-]+$/.test(deviceId)) throw new Error("invalid device id");
}

export async function isDeviceActive(
  supabase: SupabaseClient,
  userId: string,
  deviceId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("user_devices")
    .select("is_active")
    .eq("user_id", userId)
    .eq("device_id", deviceId)
    .maybeSingle();

  return data?.is_active === true;
}
