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
  "notes",
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
  "notes",
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
  "payday_second_day_of_week",
  "next_expected_date",
  "estimated_interval_days",
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
  "payday_second_day_of_week",
  "next_expected_date",
  "estimated_interval_days",
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
  "due_second_day_of_month",
  "due_day_of_week",
  "due_second_day_of_week",
  "due_month",
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
  "due_second_day_of_month",
  "due_day_of_week",
  "due_second_day_of_week",
  "due_month",
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
    optionalString(sanitized, "notes");
    validateNonNegative(sanitized, ["credit_limit_centavos"]);
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
    optionalNumber(sanitized, "payday_second_day_of_week");
    optionalString(sanitized, "next_expected_date");
    optionalNumber(sanitized, "estimated_interval_days");
    optionalBoolean(sanitized, "is_active");
    optionalString(sanitized, "notes");
    validateNonNegative(sanitized, ["expected_amount_centavos", "min_amount_centavos", "max_amount_centavos"]);
    validateMinMaxOrdering(sanitized, "min_amount_centavos", "max_amount_centavos");
    validateDayRange(sanitized, "payday_day_of_month", 1, 31);
    validateDayRange(sanitized, "payday_second_day_of_month", 1, 31);
    validateDayRange(sanitized, "payday_day_of_week", 0, 6);
    validateDayRange(sanitized, "payday_second_day_of_week", 0, 6);
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
    optionalNumber(sanitized, "due_second_day_of_month");
    optionalNumber(sanitized, "due_day_of_week");
    optionalNumber(sanitized, "due_second_day_of_week");
    optionalNumber(sanitized, "due_month");
    optionalString(sanitized, "recurring_template_id");
    optionalBoolean(sanitized, "is_family_support");
    optionalBoolean(sanitized, "is_dependent_support");
    optionalBoolean(sanitized, "protected_by_default");
    optionalString(sanitized, "starts_on");
    optionalString(sanitized, "ends_on");
    optionalString(sanitized, "notes");
    validateNonNegative(sanitized, ["amount_centavos"]);
    validateDayRange(sanitized, "due_day_of_month", 1, 31);
    validateDayRange(sanitized, "due_second_day_of_month", 1, 31);
    validateDayRange(sanitized, "due_day_of_week", 0, 6);
    validateDayRange(sanitized, "due_second_day_of_week", 0, 6);
    validateDayRange(sanitized, "due_month", 1, 12);
    validateDateOrdering(sanitized, "starts_on", "ends_on");

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
    if (entity === "financial_accounts") {
      if (key === "name" || key === "institution_name" || key === "opened_on" || key === "archived_at" || key === "notes") {
        if (value !== null && typeof value !== "string") throw new Error(`${key} must be a string or null`);
        continue;
      }
      if (key === "status") {
        if (typeof value !== "string") throw new Error("status must be a string");
        if (value === "deleted") throw new Error("status 'deleted' must use the delete operation");
        if (!["active", "archived"].includes(value)) throw new Error("status must be active or archived");
        continue;
      }
      if (key === "opening_balance_centavos" || key === "current_balance_centavos" || key === "credit_limit_centavos") {
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

    if (key === "slug" || key === "subcategory_id") {
      if (typeof value !== "string") throw new Error(`${key} must be a string`);
      continue;
    }

    if (key === "recurring_template_id") {
      if (value !== null && typeof value !== "string") throw new Error("recurring_template_id must be a string or null");
      continue;
    }

    if (key === "payday_day_of_month" || key === "payday_second_day_of_month" || key === "payday_day_of_week" || key === "payday_second_day_of_week" || key === "estimated_interval_days") {
      if (value !== null && typeof value !== "number") throw new Error(`${key} must be a number or null`);
      continue;
    }

    if (key === "sort_order") {
      if (typeof value !== "number") throw new Error(`${key} must be a number`);
      continue;
    }

    if (key === "due_day_of_month" || key === "due_second_day_of_month" || key === "due_day_of_week" || key === "due_second_day_of_week" || key === "due_month") {
      if (value !== null && typeof value !== "number") throw new Error(`${key} must be a number or null`);
      continue;
    }

    if (key === "opening_balance_centavos" || key === "current_balance_centavos" || key === "amount_centavos") {
      if (typeof value !== "number") throw new Error(`${key} must be a number`);
      continue;
    }

    if (key === "expected_amount_centavos" || key === "min_amount_centavos" || key === "max_amount_centavos" || key === "credit_limit_centavos") {
      if (value !== null && typeof value !== "number") throw new Error(`${key} must be a number or null`);
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
      if (value === "deleted") throw new Error("status 'deleted' must use the delete operation");
      continue;
    }

    if (key === "frequency") {
      if (typeof value !== "string") throw new Error("frequency must be a string");
      if (entity === "income_sources") {
        if (!["weekly", "biweekly", "semi_monthly", "monthly", "irregular", "custom"].includes(value as string)) {
          throw new Error("frequency must be a valid income frequency");
        }
      } else if (entity === "financial_obligations") {
        if (!["weekly", "biweekly", "semi_monthly", "monthly", "quarterly", "yearly", "custom"].includes(value as string)) {
          throw new Error("frequency must be a valid obligation frequency");
        }
      }
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

  if (entity === "financial_accounts") {
    if (sanitized.status && typeof sanitized.status === "string" && !["active", "archived"].includes(sanitized.status as string)) {
      throw new Error("status must be active or archived");
    }
    const centsFields = ["credit_limit_centavos"] as const;
    for (const f of centsFields) {
      if (typeof sanitized[f] === "number" && (sanitized[f] as number) < 0) {
        throw new Error(`${f} must be >= 0`);
      }
    }
  } else if (entity === "income_sources") {
    const centsFields = ["expected_amount_centavos", "min_amount_centavos", "max_amount_centavos"] as const;
    for (const f of centsFields) {
      if (typeof sanitized[f] === "number" && (sanitized[f] as number) < 0) {
        throw new Error(`${f} must be >= 0`);
      }
    }
    const minVal = sanitized.min_amount_centavos as number | undefined;
    const maxVal = sanitized.max_amount_centavos as number | undefined;
    if (minVal !== undefined && maxVal !== undefined && minVal > maxVal) {
      throw new Error("min_amount_centavos must be <= max_amount_centavos");
    }
    const dayFields = ["payday_day_of_month", "payday_second_day_of_month"] as const;
    for (const f of dayFields) {
      if (typeof sanitized[f] === "number" && ((sanitized[f] as number) < 1 || (sanitized[f] as number) > 31)) {
        throw new Error(`${f} must be between 1 and 31`);
      }
    }
    if (typeof sanitized.payday_day_of_week === "number" && ((sanitized.payday_day_of_week as number) < 0 || (sanitized.payday_day_of_week as number) > 6)) {
      throw new Error("payday_day_of_week must be between 0 and 6");
    }
    if (typeof sanitized.payday_second_day_of_week === "number" && ((sanitized.payday_second_day_of_week as number) < 0 || (sanitized.payday_second_day_of_week as number) > 6)) {
      throw new Error("payday_second_day_of_week must be between 0 and 6");
    }
  } else if (entity === "financial_obligations") {
    if (typeof sanitized.amount_centavos === "number" && (sanitized.amount_centavos as number) < 0) {
      throw new Error("amount_centavos must be >= 0");
    }
    if (typeof sanitized.due_day_of_month === "number" && ((sanitized.due_day_of_month as number) < 1 || (sanitized.due_day_of_month as number) > 31)) {
      throw new Error("due_day_of_month must be between 1 and 31");
    }
    if (typeof sanitized.due_second_day_of_month === "number" && ((sanitized.due_second_day_of_month as number) < 1 || (sanitized.due_second_day_of_month as number) > 31)) {
      throw new Error("due_second_day_of_month must be between 1 and 31");
    }
    if (typeof sanitized.due_day_of_week === "number" && ((sanitized.due_day_of_week as number) < 0 || (sanitized.due_day_of_week as number) > 6)) {
      throw new Error("due_day_of_week must be between 0 and 6");
    }
    if (typeof sanitized.due_second_day_of_week === "number" && ((sanitized.due_second_day_of_week as number) < 0 || (sanitized.due_second_day_of_week as number) > 6)) {
      throw new Error("due_second_day_of_week must be between 0 and 6");
    }
    if (typeof sanitized.due_month === "number" && ((sanitized.due_month as number) < 1 || (sanitized.due_month as number) > 12)) {
      throw new Error("due_month must be between 1 and 12");
    }
    const starts = sanitized.starts_on as string | undefined;
    const ends = sanitized.ends_on as string | undefined;
    if (starts !== undefined && ends !== undefined && starts > ends) {
      throw new Error("starts_on must be <= ends_on");
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
  if (payload[field] !== undefined && payload[field] !== null && typeof payload[field] !== "boolean") {
    throw new Error(`${field} must be a boolean or null`);
  }
}

function optionalNumber(payload: Record<string, unknown>, field: string): void {
  if (payload[field] !== undefined && payload[field] !== null && typeof payload[field] !== "number") {
    throw new Error(`${field} must be a number or null`);
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

function validateNonNegative(payload: Record<string, unknown>, fields: string[]): void {
  for (const field of fields) {
    const val = payload[field];
    if (val !== undefined && val !== null && typeof val === "number" && val < 0) {
      throw new Error(`${field} must be >= 0`);
    }
  }
}

function validateMinMaxOrdering(payload: Record<string, unknown>, minField: string, maxField: string): void {
  const minVal = payload[minField] as number | undefined;
  const maxVal = payload[maxField] as number | undefined;
  if (minVal !== undefined && minVal !== null && maxVal !== undefined && maxVal !== null && minVal > maxVal) {
    throw new Error(`${minField} must be <= ${maxField}`);
  }
}

function validateDayRange(payload: Record<string, unknown>, field: string, lo: number, hi: number): void {
  const val = payload[field];
  if (val !== undefined && val !== null && typeof val === "number") {
    if (val < lo || val > hi) throw new Error(`${field} must be between ${lo} and ${hi}`);
  }
}

function validateDateOrdering(payload: Record<string, unknown>, startField: string, endField: string): void {
  const starts = payload[startField] as string | undefined;
  const ends = payload[endField] as string | undefined;
  if (starts !== undefined && starts !== null && ends !== undefined && ends !== null && starts > ends) {
    throw new Error(`${startField} must be <= ${endField}`);
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
