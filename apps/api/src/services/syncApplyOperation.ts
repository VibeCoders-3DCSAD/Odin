import type { SupabaseClient } from "@supabase/supabase-js";

type Operation = {
  operation_id: string;
  entity: string;
  record_id: string;
  operation_type: "create" | "update" | "delete";
  base_version: number | null;
  changed_fields: string[];
  payload: Record<string, unknown>;
};

type ApplyResult = Record<string, unknown>;

const SYNCED_ENTITIES = new Set(["category_groups", "categories", "subcategories"]);

const SERVER_COLUMNS = new Set([
  "id",
  "user_id",
  "version",
  "deleted",
  "created_at",
  "updated_at",
  "last_synced_at",
]);

function sanitizePayload(payload: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (!SERVER_COLUMNS.has(key)) {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

export async function applyOperation(
  supabase: SupabaseClient,
  userId: string,
  deviceId: string,
  op: Operation,
): Promise<ApplyResult> {
  if (!SYNCED_ENTITIES.has(op.entity)) {
    throw new Error(`entity '${op.entity}' is not in the sync allowlist`);
  }

  switch (op.operation_type) {
    case "create":
      return applyCreate(supabase, userId, op);
    case "update":
      return applyUpdate(supabase, userId, op);
    case "delete":
      return applyDelete(supabase, userId, op);
    default:
      throw new Error(`Unknown operation_type: ${op.operation_type}`);
  }
}

async function applyCreate(
  supabase: SupabaseClient,
  userId: string,
  op: Operation,
): Promise<ApplyResult> {
  const sanitized = sanitizePayload(op.payload);

  const row = {
    ...sanitized,
    id: op.record_id,
    user_id: userId,
    version: 1,
    deleted: false,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from(op.entity).insert(row);

  if (error) {
    throw new Error(`create failed: ${error.message}`);
  }

  return { status: "applied", current_version: 1 };
}

async function applyUpdate(
  supabase: SupabaseClient,
  userId: string,
  op: Operation,
): Promise<ApplyResult> {
  const { data: current, error: fetchError } = await supabase
    .from(op.entity)
    .select("*")
    .eq("id", op.record_id)
    .eq("user_id", userId)
    .maybeSingle();

  if (fetchError) {
    throw new Error(`fetch failed: ${fetchError.message}`);
  }

  if (!current) {
    throw new Error("record not found");
  }

  const currentRecord = current as Record<string, unknown>;
  const currentVersion = (currentRecord.version as number) ?? 0;

  if (op.base_version !== null && op.base_version !== currentVersion) {
    return applyConflictingUpdate(
      supabase,
      userId,
      op,
      currentRecord,
      currentVersion,
    );
  }

  const sanitized = sanitizePayload(
    filterPayloadFields(op.payload, op.changed_fields),
  );

  const updates: Record<string, unknown> = {
    ...sanitized,
    version: currentVersion + 1,
    updated_at: new Date().toISOString(),
  };

  const { error: updateError } = await supabase
    .from(op.entity)
    .update(updates)
    .eq("id", op.record_id)
    .eq("user_id", userId);

  if (updateError) {
    throw new Error(`update failed: ${updateError.message}`);
  }

  await supabase.from("edit_history").insert({
    user_id: userId,
    operation_id: op.operation_id,
    entity: op.entity,
    record_id: op.record_id,
    reason: "applied",
    payload: {
      base_version: op.base_version,
      new_version: currentVersion + 1,
      fields: op.changed_fields,
    },
  });

  return { status: "applied", current_version: currentVersion + 1 };
}

async function applyConflictingUpdate(
  supabase: SupabaseClient,
  userId: string,
  op: Operation,
  currentRecord: Record<string, unknown>,
  currentVersion: number,
): Promise<ApplyResult> {
  const sanitized = sanitizePayload(
    filterPayloadFields(op.payload, op.changed_fields),
  );

  const { data: edits } = await supabase
    .from("edit_history")
    .select("payload")
    .eq("user_id", userId)
    .eq("entity", op.entity)
    .eq("record_id", op.record_id)
    .eq("reason", "applied")
    .order("created_at", { ascending: true })
    .limit(100);

  const serverChangedFields = new Set<string>();
  if (edits) {
    for (const edit of edits) {
      const p = edit.payload as Record<string, unknown> | undefined;
      if (!p) continue;

      const editNewVersion = p.new_version as number | undefined;
      const editFields = p.fields as string[] | undefined;

      if (editNewVersion && op.base_version !== null && editNewVersion <= op.base_version) {
        continue;
      }

      if (editFields) {
        for (const f of editFields) {
          serverChangedFields.add(f);
        }
      }
    }
  }

  const conflicted: string[] = [];
  const nonConflicting: Record<string, unknown> = {};

  for (const field of op.changed_fields) {
    if (!(field in sanitized)) continue;

    if (serverChangedFields.has(field)) {
      conflicted.push(field);
    } else {
      nonConflicting[field] = sanitized[field];
    }
  }

  if (Object.keys(nonConflicting).length === 0) {
    return {
      status: "rejected",
      reason: conflicted.length > 0
        ? `all fields conflicted: ${conflicted.join(", ")}`
        : "no fields to apply",
      current_version: currentVersion,
    };
  }

  const updates: Record<string, unknown> = {
    ...nonConflicting,
    version: currentVersion + 1,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from(op.entity)
    .update(updates)
    .eq("id", op.record_id)
    .eq("user_id", userId);

  if (error) {
    throw new Error(`conflicting update failed: ${error.message}`);
  }

  if (conflicted.length > 0) {
    await supabase.from("edit_history").insert({
      user_id: userId,
      operation_id: op.operation_id,
      entity: op.entity,
      record_id: op.record_id,
      reason: `conflicted fields dropped: ${conflicted.join(", ")}`,
      payload: {
        client_payload: sanitized,
        server_values: Object.fromEntries(
          conflicted.map((f) => [f, currentRecord[f]]),
        ),
      },
    });
  }

  await supabase.from("edit_history").insert({
    user_id: userId,
    operation_id: op.operation_id,
    entity: op.entity,
    record_id: op.record_id,
    reason: "partially_applied",
    payload: {
      base_version: op.base_version,
      new_version: currentVersion + 1,
      fields: Object.keys(nonConflicting),
    },
  });

  return {
    status: "applied",
    current_version: currentVersion + 1,
    conflicted_fields: conflicted,
  };
}

async function applyDelete(
  supabase: SupabaseClient,
  userId: string,
  op: Operation,
): Promise<ApplyResult> {
  const { data: current, error: fetchError } = await supabase
    .from(op.entity)
    .select("id, version, deleted")
    .eq("id", op.record_id)
    .eq("user_id", userId)
    .maybeSingle();

  if (fetchError) {
    throw new Error(`fetch failed: ${fetchError.message}`);
  }

  if (!current) {
    throw new Error("record not found");
  }

  const currentVersion = (current as Record<string, unknown>).version as number;

  const { error: updateError } = await supabase
    .from(op.entity)
    .update({
      deleted: true,
      is_active: false,
      version: currentVersion + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", op.record_id)
    .eq("user_id", userId);

  if (updateError) {
    throw new Error(`delete failed: ${updateError.message}`);
  }

  return { status: "applied", current_version: currentVersion + 1 };
}

function filterPayloadFields(
  payload: Record<string, unknown>,
  changedFields: string[],
): Record<string, unknown> {
  const filtered: Record<string, unknown> = {};
  for (const field of changedFields) {
    if (field in payload) {
      filtered[field] = payload[field];
    }
  }
  return filtered;
}
