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
  "income_sources",
  "financial_obligations",
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
  "status",
  "opening_balance_centavos",
  "current_balance_centavos",
  "credit_limit_centavos",
  "include_in_dashboard_balance",
  "institution_name",
  "opened_on",
  "archived_at",
  "sort_order",
]);

const INCOME_SOURCE_CREATE_FIELDS = new Set([
  "name",
  "income_type",
  "frequency",
  "expected_amount_centavos",
  "min_amount_centavos",
  "max_amount_centavos",
  "payday_day_of_month",
  "payday_second_day_of_month",
  "payday_day_of_week",
  "next_expected_date",
  "is_active",
  "notes",
]);

const INCOME_SOURCE_UPDATE_FIELDS = new Set([
  "name",
  "income_type",
  "frequency",
  "expected_amount_centavos",
  "min_amount_centavos",
  "max_amount_centavos",
  "payday_day_of_month",
  "payday_second_day_of_month",
  "payday_day_of_week",
  "next_expected_date",
  "is_active",
  "notes",
]);

const OBLIGATION_CREATE_FIELDS = new Set([
  "subcategory_id",
  "recurring_template_id",
  "name",
  "amount_centavos",
  "frequency",
  "due_day_of_month",
  "is_family_support",
  "is_dependent_support",
  "protected_by_default",
  "starts_on",
  "ends_on",
  "notes",
]);

const OBLIGATION_UPDATE_FIELDS = new Set([
  "subcategory_id",
  "recurring_template_id",
  "name",
  "amount_centavos",
  "frequency",
  "due_day_of_month",
  "is_family_support",
  "is_dependent_support",
  "protected_by_default",
  "starts_on",
  "ends_on",
  "notes",
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
  if (entity === "categories" || entity === "subcategories") {
    return validateTaxonomyCreatePayload(supabase, userId, entity, payload);
  }

  if (entity === "financial_accounts") {
    assertOnlyAllowed(payload, FINANCIAL_ACCOUNT_CREATE_FIELDS);
    const sanitized = sanitizePayload(payload, FINANCIAL_ACCOUNT_CREATE_FIELDS);
    requireString(sanitized, "name");
    requireString(sanitized, "kind");
    const validKinds = ["cash", "bank", "e_wallet", "savings", "credit_card", "loan", "other"];
    if (!validKinds.includes(sanitized.kind as string)) {
      throw new Error(`kind must be one of: ${validKinds.join(", ")}`);
    }
    optionalBigInt(sanitized, "opening_balance_centavos");
    optionalBigInt(sanitized, "credit_limit_centavos");
    optionalBoolean(sanitized, "include_in_dashboard_balance");
    optionalString(sanitized, "institution_name");
    optionalString(sanitized, "opened_on");
    optionalNumber(sanitized, "sort_order");
    return Promise.resolve(sanitized);
  }

  if (entity === "income_sources") {
    assertOnlyAllowed(payload, INCOME_SOURCE_CREATE_FIELDS);
    const sanitized = sanitizePayload(payload, INCOME_SOURCE_CREATE_FIELDS);
    requireString(sanitized, "name");
    requireString(sanitized, "income_type");
    requireString(sanitized, "frequency");
    const validTypes = ["stable", "variable"];
    if (!validTypes.includes(sanitized.income_type as string)) {
      throw new Error(`income_type must be one of: ${validTypes.join(", ")}`);
    }
    const validFrequencies = ["weekly", "biweekly", "semi_monthly", "monthly", "irregular", "custom"];
    if (!validFrequencies.includes(sanitized.frequency as string)) {
      throw new Error(`frequency must be one of: ${validFrequencies.join(", ")}`);
    }
    optionalBigInt(sanitized, "expected_amount_centavos");
    optionalBigInt(sanitized, "min_amount_centavos");
    optionalBigInt(sanitized, "max_amount_centavos");
    optionalNumber(sanitized, "payday_day_of_month");
    optionalNumber(sanitized, "payday_second_day_of_month");
    optionalNumber(sanitized, "payday_day_of_week");
    optionalString(sanitized, "next_expected_date");
    optionalBoolean(sanitized, "is_active");
    optionalString(sanitized, "notes");
    return Promise.resolve(sanitized);
  }

  if (entity === "financial_obligations") {
    assertOnlyAllowed(payload, OBLIGATION_CREATE_FIELDS);
    const sanitized = sanitizePayload(payload, OBLIGATION_CREATE_FIELDS);
    requireString(sanitized, "name");
    requireString(sanitized, "subcategory_id");
    requireString(sanitized, "frequency");
    requireBigInt(sanitized, "amount_centavos");
    const val = sanitized.amount_centavos as number;
    if (val < 0) throw new Error("amount_centavos must be >= 0");
    const validFrequencies = ["weekly", "biweekly", "semi_monthly", "monthly", "quarterly", "yearly", "custom"];
    if (!validFrequencies.includes(sanitized.frequency as string)) {
      throw new Error(`frequency must be one of: ${validFrequencies.join(", ")}`);
    }
    optionalNumber(sanitized, "due_day_of_month");
    optionalString(sanitized, "recurring_template_id");
    optionalBoolean(sanitized, "is_family_support");
    optionalBoolean(sanitized, "is_dependent_support");
    optionalBoolean(sanitized, "protected_by_default");
    optionalString(sanitized, "starts_on");
    optionalString(sanitized, "ends_on");
    optionalString(sanitized, "notes");

    const { data: subcategory, error } = await supabase
      .from("subcategories")
      .select("id")
      .eq("id", sanitized.subcategory_id as string)
      .eq("kind", "expense")
      .eq("deleted", false)
      .eq("is_active", true)
      .or(`user_id.is.null,user_id.eq.${userId}`)
      .maybeSingle();
    if (error) throw new Error(`subcategory_id validation failed: ${error.message}`);
    if (!subcategory) throw new Error("subcategory_id does not reference an accessible active expense subcategory");

    if (sanitized.recurring_template_id !== undefined && sanitized.recurring_template_id !== null) {
      const { data: template, error: templateErr } = await supabase
        .from("recurring_transaction_templates")
        .select("id")
        .eq("id", sanitized.recurring_template_id as string)
        .eq("user_id", userId)
        .maybeSingle();
      if (templateErr) throw new Error(`recurring_template_id validation failed: ${templateErr.message}`);
      if (!template) throw new Error("recurring_template_id does not reference an accessible recurring template");
    }

    return sanitized;
  }

  throw new Error(`entity '${entity}' is not in the sync allowlist`);
}

async function validateTaxonomyCreatePayload(
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
  let allowedFields: Set<string>;
  if (entity === "categories") {
    allowedFields = CATEGORY_UPDATE_FIELDS;
  } else if (entity === "subcategories") {
    allowedFields = SUBCATEGORY_UPDATE_FIELDS;
  } else if (entity === "financial_accounts") {
    allowedFields = FINANCIAL_ACCOUNT_UPDATE_FIELDS;
  } else if (entity === "income_sources") {
    allowedFields = INCOME_SOURCE_UPDATE_FIELDS;
  } else if (entity === "financial_obligations") {
    allowedFields = OBLIGATION_UPDATE_FIELDS;
  } else {
    throw new Error(`entity '${entity}' is not in the sync allowlist`);
  }

  assertOnlyAllowed(payload, allowedFields);
  const sanitized = sanitizePayload(payload, allowedFields);

  for (const [key, value] of Object.entries(sanitized)) {
    if (key === "label" || key === "description" || key === "name") {
      if (typeof value !== "string") throw new Error(`${key} must be a string`);
      continue;
    }

    if (key === "notes") {
      if (value !== null && typeof value !== "string") {
        throw new Error("notes must be a string or null");
      }
      continue;
    }

    if (key === "short_label" || key === "institution_name") {
      if (value !== null && typeof value !== "string") {
        throw new Error(`${key} must be a string or null`);
      }
      continue;
    }

    if (key === "slug" || key === "subcategory_id" || key === "recurring_template_id") {
      if (typeof value !== "string") throw new Error(`${key} must be a string`);
      continue;
    }

    if (key === "sort_order" || key === "due_day_of_month" || key === "payday_day_of_month" || key === "payday_second_day_of_month" || key === "payday_day_of_week") {
      if (typeof value !== "number") throw new Error(`${key} must be a number`);
      continue;
    }

    if (key === "opening_balance_centavos" || key === "current_balance_centavos" || key === "credit_limit_centavos" || key === "expected_amount_centavos" || key === "min_amount_centavos" || key === "max_amount_centavos" || key === "amount_centavos") {
      if (typeof value !== "number") throw new Error(`${key} must be a number`);
      continue;
    }

    if (key === "income_type") {
      if (typeof value !== "string") throw new Error("income_type must be a string");
      if (!["stable", "variable"].includes(value as string)) throw new Error(`income_type must be stable or variable`);
      continue;
    }

    if (key === "kind") {
      if (typeof value !== "string") throw new Error("kind must be a string");
      continue;
    }

    if (key === "status") {
      if (typeof value !== "string") throw new Error("status must be a string");
      continue;
    }

    if (key === "frequency") {
      if (typeof value !== "string") throw new Error("frequency must be a string");
      continue;
    }

    if (key === "opened_on" || key === "archived_at" || key === "starts_on" || key === "ends_on" || key === "next_expected_date") {
      if (value !== null && typeof value !== "string") {
        throw new Error(`${key} must be a string or null`);
      }
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

function requireBigInt(payload: Record<string, unknown>, field: string): void {
  if (payload[field] === undefined || payload[field] === null || typeof payload[field] !== "number") {
    throw new Error(`${field} is required and must be a number`);
  }
}

function optionalBigInt(payload: Record<string, unknown>, field: string): void {
  if (payload[field] !== undefined && payload[field] !== null && typeof payload[field] !== "number") {
    throw new Error(`${field} must be a number or null`);
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
