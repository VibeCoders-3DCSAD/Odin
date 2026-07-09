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

type TableCursor = { ts: string; id: string };

type PullCursors = Record<string, TableCursor>;

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
    const { data: existing, error: lookupError } = await supabase
      .from("applied_operations")
      .select("operation_id, result, user_id, entity, record_id")
      .eq("operation_id", op.operation_id)
      .maybeSingle();

    if (lookupError) {
      results.push({
        operation_id: op.operation_id,
        status: "rejected",
        reason: `applied_operations lookup failed: ${lookupError.message}`,
      });
      continue;
    }

    if (existing) {
      const existingResult = existing.result as Record<string, unknown> | undefined;
      if (existingResult?.status === "pending") {
        if ((existing as Record<string, unknown>).user_id !== userId) {
          results.push({
            operation_id: op.operation_id,
            status: "rejected",
            reason: "reservation does not belong to current user",
          });
          continue;
        }

        const reservedEntity = (existing as Record<string, unknown>).entity as string;
        const reservedRecordId = (existing as Record<string, unknown>).record_id as string;

        const { data: currentRow } = await supabase
          .from(reservedEntity)
          .select("id, version")
          .eq("id", reservedRecordId)
          .maybeSingle();

        if (currentRow) {
          const version = (currentRow as Record<string, unknown>).version as number;
          const result = { status: "applied", current_version: version };
          await supabase
            .from("applied_operations")
            .update({ result })
            .eq("operation_id", op.operation_id);
          results.push({
            operation_id: op.operation_id,
            status: "applied",
            current_version: version,
          });
          continue;
        }

        await supabase.from("applied_operations").delete().eq("operation_id", op.operation_id);
      } else {
        results.push({
          operation_id: op.operation_id,
          status: "duplicate",
          current_version: typeof existingResult?.current_version === "number"
            ? existingResult.current_version as number
            : undefined,
        });
        continue;
      }
    }

    const { error: reserveError } = await supabase.from("applied_operations").insert({
      operation_id: op.operation_id,
      user_id: userId,
      device_id: deviceId,
      entity: op.entity,
      record_id: op.record_id,
      operation_type: op.operation_type,
      result: { status: "pending" },
    });

    if (reserveError) {
      results.push({
        operation_id: op.operation_id,
        status: "rejected",
        reason: `reservation failed: ${reserveError.message}`,
      });
      continue;
    }

    let mutationApplied = false;

    try {
      const result = await applyOperation(supabase, userId, deviceId, op);
      mutationApplied = true;

      const { error: finalizeError } = await supabase
        .from("applied_operations")
        .update({ result })
        .eq("operation_id", op.operation_id);

      if (finalizeError) {
        throw new Error(`idempotency finalize failed: ${finalizeError.message}`);
      }

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

      if (!mutationApplied) {
        await supabase
          .from("applied_operations")
          .delete()
          .eq("operation_id", op.operation_id);
      }

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
  cursors: PullCursors,
): Promise<{ cursors: PullCursors; changes: PullChanges }> {
  const changes: PullChanges = {};
  const newCursors: PullCursors = {};

  for (const table of SYNCED_TABLES) {
    const query = supabase
      .from(table)
      .select("*")
      .order("updated_at", { ascending: true })
      .order("id", { ascending: true })
      .limit(500);

    if (table === "category_groups") {
      // category_groups has no user_id column — system-wide data
    } else {
      // categories and subcategories: include system rows (user_id IS NULL)
      // and user-owned rows
      query.or(`user_id.is.null,user_id.eq.${userId}`);
    }

    const tableCursor = cursors[table];
    if (tableCursor) {
      query.or(
        `updated_at.gt.${tableCursor.ts},and(updated_at.eq.${tableCursor.ts},id.gt.${tableCursor.id})`,
      );
    }

    const { data, error } = await query;

    if (error) {
      console.error("sync pull error for table", table, error);
      newCursors[table] = tableCursor ?? { ts: new Date(0).toISOString(), id: "" };
      continue;
    }

    if (data && data.length > 0) {
      changes[table] = data;

      const lastRow = data[data.length - 1] as Record<string, unknown>;
      newCursors[table] = {
        ts: (lastRow.updated_at as string) ?? tableCursor?.ts ?? new Date(0).toISOString(),
        id: lastRow.id as string,
      };
    } else {
      newCursors[table] = tableCursor ?? { ts: new Date(0).toISOString(), id: "" };
    }
  }

  return { cursors: newCursors, changes };
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
