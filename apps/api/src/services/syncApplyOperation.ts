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
  const row = {
    id: op.record_id,
    user_id: userId,
    version: 1,
    deleted: false,
    updated_at: new Date().toISOString(),
    ...op.payload,
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

  const currentVersion = (current as Record<string, unknown>).version as number ?? 0;

  if (
    op.base_version !== null &&
    op.base_version !== currentVersion
  ) {
    throw new Error(
      `version mismatch: expected ${op.base_version}, current is ${currentVersion}`,
    );
  }

  const updates: Record<string, unknown> = {
    version: currentVersion + 1,
    updated_at: new Date().toISOString(),
    ...filterPayloadFields(op.payload, op.changed_fields),
  };

  const { error: updateError } = await supabase
    .from(op.entity)
    .update(updates)
    .eq("id", op.record_id)
    .eq("user_id", userId);

  if (updateError) {
    throw new Error(`update failed: ${updateError.message}`);
  }

  return { status: "applied", current_version: currentVersion + 1 };
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
