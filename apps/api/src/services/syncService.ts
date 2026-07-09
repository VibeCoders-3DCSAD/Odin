import type { SupabaseClient } from "@supabase/supabase-js";
import { applyOperation } from "./syncApplyOperation.js";

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
  status: "applied" | "rejected" | "duplicate";
  reason?: string;
  current_version?: number;
};

type PullChanges = Record<string, Record<string, unknown>[]>;

const SYNCED_TABLES = [
  "category_groups",
  "categories",
  "subcategories",
] as const;

export async function pushOperations(
  supabase: SupabaseClient,
  userId: string,
  deviceId: string,
  operations: PushOperation[],
): Promise<PushResult[]> {
  const results: PushResult[] = [];

  for (const op of operations) {
    const { data: existing } = await supabase
      .from("applied_operations")
      .select("operation_id")
      .eq("operation_id", op.operation_id)
      .maybeSingle();

    if (existing) {
      results.push({
        operation_id: op.operation_id,
        status: "duplicate",
        reason: "Operation already applied",
      });
      continue;
    }

    try {
      const result = await applyOperation(supabase, userId, deviceId, op);

      await supabase.from("applied_operations").insert({
        operation_id: op.operation_id,
        user_id: userId,
        device_id: deviceId,
        entity: op.entity,
        record_id: op.record_id,
        operation_type: op.operation_type,
        result: result,
      });

      results.push({
        operation_id: op.operation_id,
        status: "applied",
        current_version: typeof result.current_version === "number" ? result.current_version : undefined,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";

      await supabase.from("edit_history").insert({
        user_id: userId,
        operation_id: op.operation_id,
        entity: op.entity,
        record_id: op.record_id,
        reason: message,
        payload: op.payload,
      });

      results.push({
        operation_id: op.operation_id,
        status: "rejected",
        reason: message,
      });
    }
  }

  return results;
}

export async function pullChanges(
  supabase: SupabaseClient,
  userId: string,
  cursor: string | null,
): Promise<{ cursor: string; changes: PullChanges }> {
  const changes: PullChanges = {};
  let maxUpdatedAt = cursor ?? new Date(0).toISOString();

  for (const table of SYNCED_TABLES) {
    const query = supabase
      .from(table)
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: true })
      .limit(500);

    if (cursor) {
      query.gt("updated_at", cursor);
    }

    const { data, error } = await query;

    if (error) {
      console.error("sync pull error for table", table, error);
      continue;
    }

    if (data && data.length > 0) {
      changes[table] = data;

      // ponytail: cursor is max updated_at of returned rows.
      // Rows with identical updated_at at a page boundary may be
      // skipped. Acceptable until per-table cursors are warranted.
      const lastRow = data[data.length - 1] as Record<string, unknown>;
      const lastUpdatedAt = lastRow.updated_at as string;
      if (lastUpdatedAt > maxUpdatedAt) {
        maxUpdatedAt = lastUpdatedAt;
      }
    }
  }

  if (Object.keys(changes).length === 0) {
    maxUpdatedAt = new Date().toISOString();
  }

  return { cursor: maxUpdatedAt, changes };
}

export async function registerDevice(
  supabase: SupabaseClient,
  userId: string,
  deviceId: string,
): Promise<void> {
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
