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

const SYNCED_ENTITIES = new Set([
  "categories",
  "subcategories",
  "financial_accounts",
  "transactions",
  "transaction_templates",
  "transaction_drafts",
  "recurring_transaction_templates",
  "recurring_transaction_occurrences",
]);

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
  "slug",
  "short_label",
  "description",
  "is_filipino_context",
  "is_protected",
  "is_active",
]);

const FINANCIAL_ACCOUNT_CREATE_FIELDS = new Set([
  "name",
  "kind",
  "opening_balance_centavos",
  "credit_limit_centavos",
  "include_in_dashboard_balance",
  "institution_name",
  "opened_on",
  "sort_order",
]);

const FINANCIAL_ACCOUNT_UPDATE_FIELDS = new Set([
  "name",
  "opening_balance_centavos",
  "credit_limit_centavos",
  "include_in_dashboard_balance",
  "institution_name",
  "opened_on",
  "sort_order",
]);

const TRANSACTION_CREATE_FIELDS = new Set([
  "transaction_type",
  "transaction_date",
  "amount_centavos",
  "subcategory_id",
  "source_account_id",
  "destination_account_id",
  "merchant_name",
  "counterparty_name",
  "notes",
]);

const TRANSACTION_UPDATE_FIELDS = new Set([
  "amount_centavos",
  "subcategory_id",
  "source_account_id",
  "destination_account_id",
  "transaction_date",
  "merchant_name",
  "counterparty_name",
  "notes",
]);

const VALID_ACCOUNT_KINDS = ["cash", "bank", "e_wallet", "savings", "credit_card", "loan", "other"];
const VALID_TRANSACTION_TYPES = ["income", "expense", "transfer"];

const TEMPLATE_FIELDS = new Set([
  "transaction_type", "name", "amount_centavos", "subcategory_id",
  "source_account_id", "destination_account_id", "merchant_name", "counterparty_name", "notes",
]);

const DRAFT_FIELDS = new Set(["client_draft_id", "payload", "captured_offline_at"]);

const RECURRING_TEMPLATE_FIELDS = new Set([
  "transaction_type", "name", "amount_centavos", "frequency", "interval_count",
  "day_of_month", "second_day_of_month", "day_of_week",
  "starts_on", "ends_on", "subcategory_id", "source_account_id", "destination_account_id", "notes",
]);

const RECURRING_OCCURRENCE_FIELDS = new Set([
  "recurring_template_id", "scheduled_date", "transaction_id",
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
        payload: await validateUpdatePayload(supabase, userId, op.entity, op.record_id, filterPayloadFields(op.payload, op.changed_fields)),
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

  if (entity === "financial_accounts") {
    assertOnlyAllowed(payload, FINANCIAL_ACCOUNT_CREATE_FIELDS);
    const sanitized = sanitizePayload(payload, FINANCIAL_ACCOUNT_CREATE_FIELDS);
    requireString(sanitized, "name");
    requireString(sanitized, "kind");
    if (!VALID_ACCOUNT_KINDS.includes(sanitized.kind as string)) {
      throw new Error(`kind must be one of: ${VALID_ACCOUNT_KINDS.join(", ")}`);
    }
    optionalFiniteInteger(sanitized, "opening_balance_centavos");
    optionalFiniteInteger(sanitized, "credit_limit_centavos");
    if (sanitized.credit_limit_centavos != null && (sanitized.credit_limit_centavos as number) < 0) {
      throw new Error("credit_limit_centavos must be >= 0");
    }
    optionalBoolean(sanitized, "include_in_dashboard_balance");
    optionalString(sanitized, "institution_name");
    optionalString(sanitized, "opened_on");
    optionalNumber(sanitized, "sort_order");
    return sanitized;
  }

  if (entity === "transactions") {
    assertOnlyAllowed(payload, TRANSACTION_CREATE_FIELDS);
    const sanitized = sanitizePayload(payload, TRANSACTION_CREATE_FIELDS);
    requireString(sanitized, "transaction_type");
    if (!VALID_TRANSACTION_TYPES.includes(sanitized.transaction_type as string)) {
      throw new Error(`transaction_type must be one of: ${VALID_TRANSACTION_TYPES.join(", ")}`);
    }
    requireString(sanitized, "transaction_date");
    requirePositiveInteger(sanitized, "amount_centavos");

    const txType = sanitized.transaction_type as string;

    if (txType === "income") {
      requireString(sanitized, "destination_account_id");
      requireString(sanitized, "subcategory_id");
      if (sanitized.source_account_id != null) throw new Error("source_account_id must not be set for income");
      await verifyAccountOwnership(supabase, userId, sanitized.destination_account_id as string);
      await verifySubcategoryOwnership(supabase, userId, sanitized.subcategory_id as string, "income");
      sanitized.source_account_id = null;
    } else if (txType === "expense") {
      requireString(sanitized, "source_account_id");
      requireString(sanitized, "subcategory_id");
      if (sanitized.destination_account_id != null) throw new Error("destination_account_id must not be set for expense");
      await verifyAccountOwnership(supabase, userId, sanitized.source_account_id as string);
      await verifySubcategoryOwnership(supabase, userId, sanitized.subcategory_id as string, "expense");
      sanitized.destination_account_id = null;
    } else {
      requireString(sanitized, "source_account_id");
      requireString(sanitized, "destination_account_id");
      if (sanitized.source_account_id === sanitized.destination_account_id) {
        throw new Error("source and destination accounts must differ");
      }
      if (sanitized.subcategory_id != null) throw new Error("subcategory_id must not be set for transfer");
      await verifyAccountOwnership(supabase, userId, sanitized.source_account_id as string);
      await verifyAccountOwnership(supabase, userId, sanitized.destination_account_id as string);
      sanitized.subcategory_id = null;
    }

    optionalString(sanitized, "merchant_name");
    optionalString(sanitized, "counterparty_name");
    optionalString(sanitized, "notes");
    return sanitized;
  }

  if (entity === "subcategories") {
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

  // ponytail: basic allowlist validation for template/draft/recurring entities
  if (entity === "transaction_templates") {
    assertOnlyAllowed(payload, TEMPLATE_FIELDS);
    return sanitizePayload(payload, TEMPLATE_FIELDS);
  }
  if (entity === "transaction_drafts") {
    assertOnlyAllowed(payload, DRAFT_FIELDS);
    return sanitizePayload(payload, DRAFT_FIELDS);
  }
  if (entity === "recurring_transaction_templates") {
    assertOnlyAllowed(payload, RECURRING_TEMPLATE_FIELDS);
    return sanitizePayload(payload, RECURRING_TEMPLATE_FIELDS);
  }
  if (entity === "recurring_transaction_occurrences") {
    assertOnlyAllowed(payload, RECURRING_OCCURRENCE_FIELDS);
    return sanitizePayload(payload, RECURRING_OCCURRENCE_FIELDS);
  }

  throw new Error(`Unknown entity for create: ${entity}`);
}

async function validateUpdatePayload(
  supabase: SupabaseClient,
  userId: string,
  entity: string,
  recordId: string,
  payload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  let allowedFields: Set<string>;
  if (entity === "categories") {
    allowedFields = CATEGORY_UPDATE_FIELDS;
  } else if (entity === "subcategories") {
    allowedFields = SUBCATEGORY_UPDATE_FIELDS;
  } else if (entity === "financial_accounts") {
    allowedFields = FINANCIAL_ACCOUNT_UPDATE_FIELDS;
  } else if (entity === "transactions") {
    allowedFields = TRANSACTION_UPDATE_FIELDS;
  } else if (entity === "transaction_templates") {
    allowedFields = TEMPLATE_FIELDS;
  } else if (entity === "transaction_drafts") {
    allowedFields = DRAFT_FIELDS;
  } else if (entity === "recurring_transaction_templates") {
    allowedFields = RECURRING_TEMPLATE_FIELDS;
  } else if (entity === "recurring_transaction_occurrences") {
    allowedFields = RECURRING_OCCURRENCE_FIELDS;
  } else {
    throw new Error(`Unknown entity for update: ${entity}`);
  }

  assertOnlyAllowed(payload, allowedFields);
  const sanitized = sanitizePayload(payload, allowedFields);

  for (const [key, value] of Object.entries(sanitized)) {
    if (entity === "financial_accounts") {
      if (key === "name" || key === "institution_name" || key === "opened_on") {
        if (value !== null && typeof value !== "string") throw new Error(`${key} must be a string or null`);
        continue;
      }
      if (key === "opening_balance_centavos" || key === "credit_limit_centavos") {
        if (value != null) {
          if (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value)) {
            throw new Error(`${key} must be a finite integer or null`);
          }
          if (key === "credit_limit_centavos" && value < 0) throw new Error("credit_limit_centavos must be >= 0");
        }
        continue;
      }
      if (key === "sort_order") {
        if (typeof value !== "number") throw new Error("sort_order must be a number");
        continue;
      }
      if (typeof value !== "boolean") throw new Error(`${key} must be a boolean`);
      continue;
    }

    if (entity === "transactions") {
      if (key === "amount_centavos") {
        if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
          throw new Error("amount_centavos must be a positive integer");
        }
        continue;
      }
      if (key === "subcategory_id" || key === "source_account_id" || key === "destination_account_id") {
        if (value !== null && typeof value !== "string") throw new Error(`${key} must be a string or null`);
        continue;
      }
      if (key === "transaction_date" || key === "merchant_name" || key === "counterparty_name" || key === "notes") {
        if (value !== null && typeof value !== "string") throw new Error(`${key} must be a string or null`);
        continue;
      }
      continue;
    }

    // taxonomy entities
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

  if (entity === "transactions") {
    const { data: current, error } = await supabase
      .from("transactions")
      .select("id, transaction_type")
      .eq("id", recordId)
      .eq("user_id", userId)
      .eq("deleted", false)
      .maybeSingle();
    if (error) throw new Error(`transaction lookup failed: ${error.message}`);
    if (!current) throw new Error("transaction not found or inaccessible");

    const txType = current.transaction_type as string;
    const src = sanitized.source_account_id ?? undefined;
    const dst = sanitized.destination_account_id ?? undefined;
    const sub = sanitized.subcategory_id ?? undefined;

    if (txType === "income" || txType === "expense") {
      if (sub && typeof sub === "string") {
        await verifySubcategoryOwnership(supabase, userId, sub, txType);
      }
    }
    if (src && typeof src === "string") {
      await verifyAccountOwnership(supabase, userId, src);
    }
    if (dst && typeof dst === "string") {
      await verifyAccountOwnership(supabase, userId, dst);
    }
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

function requirePositiveInteger(payload: Record<string, unknown>, field: string): void {
  const v = payload[field];
  if (typeof v !== "number" || !Number.isInteger(v) || v <= 0) {
    throw new Error(`${field} must be a positive integer`);
  }
}

function optionalFiniteInteger(payload: Record<string, unknown>, field: string): void {
  const v = payload[field];
  if (v !== undefined && v !== null) {
    if (typeof v !== "number" || !Number.isFinite(v) || !Number.isInteger(v)) {
      throw new Error(`${field} must be a finite integer or null`);
    }
  }
}

async function verifyAccountOwnership(
  supabase: SupabaseClient,
  userId: string,
  accountId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from("financial_accounts")
    .select("id")
    .eq("id", accountId)
    .eq("user_id", userId)
    .eq("deleted", false)
    .maybeSingle();
  if (error) throw new Error(`account validation failed: ${error.message}`);
  if (!data) throw new Error("account not found or inaccessible");
}

async function verifySubcategoryOwnership(
  supabase: SupabaseClient,
  userId: string,
  subcategoryId: string,
  kind?: string,
): Promise<void> {
  let query = supabase
    .from("subcategories")
    .select("id")
    .eq("id", subcategoryId)
    .eq("deleted", false)
    .eq("is_active", true)
    .or(`user_id.is.null,user_id.eq.${userId}`);

  if (kind) {
    query = query.eq("kind", kind);
  }

  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(`subcategory validation failed: ${error.message}`);
  if (!data) throw new Error("subcategory not found or inaccessible");
}
