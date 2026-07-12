import type { SupabaseClient } from "@supabase/supabase-js";

export type Operation = {
  operation_id: string;
  entity: string;
  record_id: string;
  operation_type: "create" | "update" | "delete";
  base_version: number | null;
  changed_fields: string[];
  payload: Record<string, unknown>;
};

export type PreparedOperation = Operation;

const SYNCED_ENTITIES = new Set(["categories", "subcategories"]);

const SERVER_COLUMNS = new Set([
  "id",
  "user_id",
  "version",
  "deleted",
  "created_at",
  "updated_at",
  "last_synced_at",
  "is_system",
  "is_protected_default",
]);

const CATEGORY_CREATE_FIELDS = new Set([
  "category_group_id",
  "slug",
  "label",
  "short_label",
  "description",
  "is_filipino_context",
  "sort_order",
]);

const CATEGORY_UPDATE_FIELDS = new Set([
  "label",
  "short_label",
  "description",
  "is_filipino_context",
  "sort_order",
  "is_active",
]);

const SUBCATEGORY_CREATE_FIELDS = new Set([
  "category_id",
  "slug",
  "kind",
  "label",
  "short_label",
  "description",
  "is_filipino_context",
  "is_protected",
  "sort_order",
]);

const SUBCATEGORY_UPDATE_FIELDS = new Set([
  "label",
  "short_label",
  "description",
  "is_filipino_context",
  "is_protected",
  "is_active",
]);

export async function prepareOperation(
  supabase: SupabaseClient,
  userId: string,
  op: Operation,
): Promise<PreparedOperation> {
  if (!SYNCED_ENTITIES.has(op.entity)) {
    throw new Error(`entity '${op.entity}' is not in the sync allowlist`);
  }

  switch (op.operation_type) {
    case "create":
      return {
        ...op,
        payload: await validateCreatePayload(supabase, userId, op.entity, op.payload),
      };
    case "update":
      return {
        ...op,
        payload: validateUpdatePayload(op.entity, filterPayloadFields(op.payload, op.changed_fields)),
      };
    case "delete":
      return op;
    default:
      throw new Error(`Unknown operation_type: ${op.operation_type}`);
  }
}

function sanitizePayload(
  payload: Record<string, unknown>,
  allowedFields: Set<string>,
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (!SERVER_COLUMNS.has(key) && allowedFields.has(key)) {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

async function validateCreatePayload(
  supabase: SupabaseClient,
  userId: string,
  entity: string,
  payload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  if (entity === "categories") {
    assertOnlyAllowed(payload, CATEGORY_CREATE_FIELDS);
    const sanitized = sanitizePayload(payload, CATEGORY_CREATE_FIELDS);
    requireString(sanitized, "category_group_id");
    requireString(sanitized, "slug");
    requireString(sanitized, "label");
    requireString(sanitized, "description");
    optionalString(sanitized, "short_label");
    optionalBoolean(sanitized, "is_filipino_context");
    optionalNumber(sanitized, "sort_order");

    const { data: group, error } = await supabase
      .from("category_groups")
      .select("id")
      .eq("id", sanitized.category_group_id as string)
      .eq("is_active", true)
      .maybeSingle();
    if (error) throw new Error(`category_group_id validation failed: ${error.message}`);
    if (!group) throw new Error("category_group_id does not reference an active category group");
    return sanitized;
  }

  assertOnlyAllowed(payload, SUBCATEGORY_CREATE_FIELDS);
  const sanitized = sanitizePayload(payload, SUBCATEGORY_CREATE_FIELDS);
  requireString(sanitized, "kind");
  if (!["income", "expense", "transfer_adjustment"].includes(sanitized.kind as string)) {
    throw new Error("kind must be income, expense, or transfer_adjustment");
  }
  requireString(sanitized, "slug");
  requireString(sanitized, "label");
  requireString(sanitized, "description");
  optionalString(sanitized, "short_label");
  optionalBoolean(sanitized, "is_filipino_context");
  optionalBoolean(sanitized, "is_protected");
  optionalNumber(sanitized, "sort_order");

  if (sanitized.kind === "expense") {
    requireString(sanitized, "category_id");
    const { data: category, error } = await supabase
      .from("categories")
      .select("id")
      .eq("id", sanitized.category_id as string)
      .eq("deleted", false)
      .eq("is_active", true)
      .or(`user_id.is.null,user_id.eq.${userId}`)
      .maybeSingle();
    if (error) throw new Error(`category_id validation failed: ${error.message}`);
    if (!category) throw new Error("category_id does not reference an accessible active category");
  } else if (sanitized.category_id !== undefined && sanitized.category_id !== null) {
    throw new Error("category_id must not be set for non-expense subcategories");
  }

  sanitized.category_id = sanitized.kind === "expense" ? sanitized.category_id : null;
  return sanitized;
}

function validateUpdatePayload(entity: string, payload: Record<string, unknown>): Record<string, unknown> {
  const allowedFields = entity === "categories" ? CATEGORY_UPDATE_FIELDS : SUBCATEGORY_UPDATE_FIELDS;
  assertOnlyAllowed(payload, allowedFields);
  const sanitized = sanitizePayload(payload, allowedFields);

  for (const [key, value] of Object.entries(sanitized)) {
    if (key === "label" || key === "description") {
      if (typeof value !== "string") throw new Error(`${key} must be a string`);
      continue;
    }

    if (key === "short_label") {
      if (value !== null && typeof value !== "string") {
        throw new Error("short_label must be a string or null");
      }
      continue;
    }

    if (key === "sort_order") {
      if (typeof value !== "number") throw new Error("sort_order must be a number");
      continue;
    }

    if (typeof value !== "boolean") throw new Error(`${key} must be a boolean`);
  }

  return sanitized;
}

function assertOnlyAllowed(payload: Record<string, unknown>, allowedFields: Set<string>): void {
  for (const key of Object.keys(payload)) {
    if (!SERVER_COLUMNS.has(key) && !allowedFields.has(key)) {
      throw new Error(`${key} is not syncable`);
    }
  }
}

function requireString(payload: Record<string, unknown>, field: string): void {
  if (!payload[field] || typeof payload[field] !== "string") throw new Error(`${field} is required`);
}

function optionalString(payload: Record<string, unknown>, field: string): void {
  if (payload[field] !== undefined && payload[field] !== null && typeof payload[field] !== "string") {
    throw new Error(`${field} must be a string or null`);
  }
}

function optionalBoolean(payload: Record<string, unknown>, field: string): void {
  if (payload[field] !== undefined && typeof payload[field] !== "boolean") {
    throw new Error(`${field} must be a boolean`);
  }
}

function optionalNumber(payload: Record<string, unknown>, field: string): void {
  if (payload[field] !== undefined && typeof payload[field] !== "number") {
    throw new Error(`${field} must be a number`);
  }
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
