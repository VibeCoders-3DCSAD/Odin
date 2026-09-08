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
  "transaction_templates",
  "transaction_drafts",
  "recurring_transaction_templates",
  "recurring_transaction_occurrences",
  "budgets",
  "credit_card_details",
  "credit_card_cycles",
  "credit_card_installments",
  "credit_card_transactions",
  "credit_card_statements",
  "credit_card_payments",
  "debt_accounts",
  "debt_payments",
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
  "include_in_dashboard_balance",
  "institution_name",
  "opened_on",
  "archived_at",
  "sort_order",
]);

const CREDIT_CARD_CYCLE_CREATE_FIELDS = new Set([
  "account_id", "cycle_start_date", "cutoff_date",
]);

const CREDIT_CARD_CYCLE_FIELDS = new Set([
  "account_id", "cycle_start_date", "cutoff_date", "statement_date",
]);

const CREDIT_CARD_STATEMENT_CREATE_FIELDS = new Set([
  "cycle_id", "statement_date", "statement_balance_centavos", "minimum_due_centavos",
  "finance_charge_centavos", "due_date",
]);

const CREDIT_CARD_STATEMENT_UPDATE_FIELDS = new Set([
  "statement_date", "statement_balance_centavos", "minimum_due_centavos",
  "finance_charge_centavos", "due_date",
]);

const CREDIT_CARD_PAYMENT_CREATE_FIELDS = new Set([
  "cycle_id", "statement_id", "transaction_id", "amount_centavos", "payment_date",
  "source_account_id", "notes", "client_mutation_id",
]);

const CREDIT_CARD_PAYMENT_UPDATE_FIELDS = new Set([
  "amount_centavos", "payment_date", "source_account_id", "notes",
]);

const CREDIT_CARD_DETAILS_CREATE_FIELDS = new Set([
  "account_id", "issuer", "credit_limit_centavos", "available_credit_centavos",
  "cutoff_day", "statement_day", "notes", "billing_cycle_days", "alert_threshold_percent",
]);

const CREDIT_CARD_DETAILS_UPDATE_FIELDS = new Set([
  "account_id", "issuer", "credit_limit_centavos", "cutoff_day", "statement_day",
  "notes", "billing_cycle_days", "alert_threshold_percent",
]);

const TRANSACTION_CREATE_FIELDS = new Set([
  "transaction_type",
  "transaction_date",
  "credit_card_posting_date",
  "amount_centavos",
  "subcategory_id",
  "source_account_id",
  "destination_account_id",
  "merchant_name",
  "counterparty_name",
  "notes",
  "entry_source",
  "recurring_template_id",
  "client_mutation_id",
]);

const TRANSACTION_UPDATE_FIELDS = new Set([
  "amount_centavos",
  "subcategory_id",
  "source_account_id",
  "destination_account_id",
  "transaction_date",
  "credit_card_posting_date",
  "merchant_name",
  "counterparty_name",
  "notes",
]);

const VALID_ACCOUNT_KINDS = ["cash", "bank", "e_wallet", "savings", "credit_card", "other"];
const VALID_TRANSACTION_TYPES = ["income", "expense", "transfer"];

const INCOME_SOURCE_CREATE_FIELDS = new Set([
  "name",
  "income_type",
  "frequency",
  "recurring_template_id",
  "destination_account_id",
  "subcategory_id",
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
  "recurring_template_id",
  "destination_account_id",
  "subcategory_id",
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

const RECURRING_TEMPLATE_UPDATE_FIELDS = new Set(
  [...RECURRING_TEMPLATE_FIELDS].filter((field) => field !== "transaction_type"),
);

const RECURRING_OCCURRENCE_FIELDS = new Set([
  "recurring_template_id", "scheduled_date", "generated_transaction_id",
]);

const BUDGET_CREATE_FIELDS = new Set([
  "status", "periodKind", "periodStart", "periodEnd", "budget_period_days", "totalAmountMinor", "allocations",
  "allocation_method", "surplus_handling", "deficit_handling", "allow_deficit_planning",
]);

const BUDGET_UPDATE_FIELDS = new Set([
  "periodKind", "periodStart", "periodEnd", "budget_period_days", "totalAmountMinor", "allocations",
]);

const CREDIT_CARD_INSTALLMENT_CREATE_FIELDS = new Set([
  "account_id", "transaction_id", "description", "original_principal_centavos",
  "remaining_principal_centavos", "term_months", "remaining_months", "monthly_amortization_centavos",
  "interest_rate_bps", "interest_type", "settlement_status",
]);

const DEBT_ACCOUNT_FIELDS = new Set([
  "linked_account_id", "name", "lender_name", "preset_key", "status",
  "original_balance_centavos", "current_balance_centavos", "annual_interest_rate_bps",
  "minimum_payment_centavos", "payment_frequency", "next_due_date", "maturity_date",
  "target_payoff_date", "interest_period", "interest_method", "preset_data", "notes",
]);
const DEBT_PAYMENT_FIELDS = new Set(["debt_account_id", "transaction_id", "source", "payment_date", "amount_centavos", "principal_centavos", "interest_centavos", "notes", "linked_transaction_type", "linked_source_account_id", "linked_subcategory_id"]);
const DEBT_ACCOUNT_TYPES = ["personal_loan", "salary_loan", "multipurpose_loan", "business_loan", "auto_loan", "custom_debt"];

const CREDIT_CARD_TRANSACTION_FIELDS = new Set([
  "transaction_id", "account_id", "cycle_id", "purchase_type", "installment_id", "client_mutation_id", "applied_credit_centavos",
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
  if (entity === "categories" || entity === "subcategories" || entity === "transactions") {
    return validateTaxonomyCreatePayload(supabase, userId, entity, payload);
  }

  if (entity === "financial_accounts") {
    assertOnlyAllowed(payload, FINANCIAL_ACCOUNT_CREATE_FIELDS);
    const sanitized = sanitizePayload(payload, FINANCIAL_ACCOUNT_CREATE_FIELDS);
    requireString(sanitized, "name");
    requireString(sanitized, "kind");
     const validKinds = ["cash", "bank", "e_wallet", "savings", "credit_card", "other"];
    if (!validKinds.includes(sanitized.kind as string)) {
      throw new Error(`kind must be one of: ${validKinds.join(", ")}`);
    }
    optionalBigInt(sanitized, "opening_balance_centavos");
    optionalBoolean(sanitized, "include_in_dashboard_balance");
    optionalString(sanitized, "institution_name");
    optionalString(sanitized, "opened_on");
    optionalNumber(sanitized, "sort_order");
    return Promise.resolve(sanitized);
  }

  if (entity === "credit_card_cycles") {
    assertOnlyAllowed(payload, CREDIT_CARD_CYCLE_CREATE_FIELDS);
    const sanitized = sanitizePayload(payload, CREDIT_CARD_CYCLE_CREATE_FIELDS);
    requireString(sanitized, "account_id");
    requireString(sanitized, "cycle_start_date");
    requireString(sanitized, "cutoff_date");
    requireDateString(sanitized, "cycle_start_date");
    requireDateString(sanitized, "cutoff_date");
    validateDateOrdering(sanitized, "cycle_start_date", "cutoff_date");
    await verifyAccountOwnership(supabase, userId, sanitized.account_id as string);
    return sanitized;
  }

  if (entity === "credit_card_statements") {
    assertOnlyAllowed(payload, CREDIT_CARD_STATEMENT_CREATE_FIELDS);
    const sanitized = sanitizePayload(payload, CREDIT_CARD_STATEMENT_CREATE_FIELDS);
    requireString(sanitized, "cycle_id");
    requireDateString(sanitized, "statement_date");
    requireDateString(sanitized, "due_date");
    requireBigInt(sanitized, "statement_balance_centavos");
    requireBigInt(sanitized, "minimum_due_centavos");
    if (sanitized.finance_charge_centavos === undefined) sanitized.finance_charge_centavos = 0;
    // jsonb_populate_record inserts NULL for absent fields instead of applying
    // the database default, so authoritative must be supplied server-side.
    sanitized.authoritative = true;
    requireBigInt(sanitized, "finance_charge_centavos");
    for (const field of ["statement_balance_centavos", "minimum_due_centavos", "finance_charge_centavos"]) {
      const value = sanitized[field];
      if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
        throw new Error(`${field} must be a non-negative whole number`);
      }
    }
    if ((sanitized.minimum_due_centavos as number) > (sanitized.statement_balance_centavos as number)) {
      throw new Error("minimum_due_centavos must be <= statement_balance_centavos");
    }
    await verifyStatementCycle(supabase, userId, sanitized.cycle_id as string, sanitized.statement_date as string);
    return sanitized;
  }

  if (entity === "credit_card_payments") {
    assertOnlyAllowed(payload, CREDIT_CARD_PAYMENT_CREATE_FIELDS);
    const sanitized = sanitizePayload(payload, CREDIT_CARD_PAYMENT_CREATE_FIELDS);
    for (const field of ["cycle_id", "statement_id", "transaction_id", "source_account_id", "client_mutation_id"]) requireString(sanitized, field);
    requireDateString(sanitized, "payment_date");
    requirePositiveInteger(sanitized, "amount_centavos");
    optionalString(sanitized, "notes");
    await verifyCreditCardPaymentReferences(supabase, userId, sanitized);
    sanitized.issuer_recognized = false;
    return sanitized;
  }

  if (entity === "credit_card_details") {
    assertOnlyAllowed(payload, CREDIT_CARD_DETAILS_CREATE_FIELDS);
    const sanitized = sanitizePayload(payload, CREDIT_CARD_DETAILS_CREATE_FIELDS);
    requireString(sanitized, "account_id");
    requirePositiveInteger(sanitized, "credit_limit_centavos");
    requireNumberInRange(sanitized, "cutoff_day", 1, 31);
     if (sanitized.statement_day != null) requireNumberInRange(sanitized, "statement_day", 1, 31);
    optionalString(sanitized, "issuer");
    optionalString(sanitized, "notes");
    optionalFiniteInteger(sanitized, "available_credit_centavos");
    optionalFiniteInteger(sanitized, "billing_cycle_days");
    optionalFiniteInteger(sanitized, "alert_threshold_percent");
    validateOptionalRange(sanitized, "billing_cycle_days", 28, 31);
    validateOptionalRange(sanitized, "alert_threshold_percent", 0, 100);
    await verifyAccountOwnership(supabase, userId, sanitized.account_id as string);
    return sanitized;
  }

  if (entity === "credit_card_installments") {
    assertOnlyAllowed(payload, CREDIT_CARD_INSTALLMENT_CREATE_FIELDS);
    const sanitized = sanitizePayload(payload, CREDIT_CARD_INSTALLMENT_CREATE_FIELDS);
    for (const field of ["account_id", "transaction_id", "description", "interest_type", "settlement_status"]) requireString(sanitized, field);
    for (const field of ["original_principal_centavos", "remaining_principal_centavos", "term_months", "remaining_months", "monthly_amortization_centavos"]) requireBigInt(sanitized, field);
    if (sanitized.interest_rate_bps === undefined) sanitized.interest_rate_bps = 0;
    requireBigInt(sanitized, "interest_rate_bps");
    const original = sanitized.original_principal_centavos as number;
    const remaining = sanitized.remaining_principal_centavos as number;
    const term = sanitized.term_months as number;
    const remainingMonths = sanitized.remaining_months as number;
    if (original <= 0 || remaining < 0 || remaining > original || term <= 0 || remainingMonths < 0 || remainingMonths > term || (sanitized.monthly_amortization_centavos as number) <= 0 || (sanitized.interest_rate_bps as number) < 0) throw new Error("credit-card installment amounts are invalid");
    if (!["zero_interest", "interest_bearing"].includes(sanitized.interest_type as string)) throw new Error("interest_type is invalid");
    if (!["active", "early_settlement_requested", "completed"].includes(sanitized.settlement_status as string)) throw new Error("settlement_status is invalid");
    await verifyAccountOwnership(supabase, userId, sanitized.account_id as string);
    const { data: transaction, error: transactionError } = await supabase
      .from("transactions")
      .select("id, transaction_type, source_account_id")
      .eq("id", sanitized.transaction_id as string)
      .eq("user_id", userId)
      .eq("deleted", false)
      .maybeSingle();
    if (transactionError) throw new Error(`installment transaction validation failed: ${transactionError.message}`);
    if (!transaction || transaction.transaction_type !== "expense" || transaction.source_account_id !== sanitized.account_id) {
      throw new Error("installment transaction does not belong to the selected credit card");
    }
    return sanitized;
  }

  if (entity === "debt_accounts") {
    assertOnlyAllowed(payload, DEBT_ACCOUNT_FIELDS);
    const sanitized = sanitizePayload(payload, DEBT_ACCOUNT_FIELDS);
    for (const field of ["name", "preset_key", "status", "payment_frequency", "next_due_date"]) requireString(sanitized, field);
    for (const field of ["original_balance_centavos", "current_balance_centavos", "annual_interest_rate_bps", "minimum_payment_centavos"]) requireBigInt(sanitized, field);
    if (!DEBT_ACCOUNT_TYPES.includes(sanitized.preset_key as string)) throw new Error("preset_key is not a supported non-credit-card debt type");
    if (sanitized.status !== "active") throw new Error("new debt accounts must be active");
    if ((sanitized.current_balance_centavos as number) > (sanitized.original_balance_centavos as number)) throw new Error("current_balance_centavos must not exceed original_balance_centavos");
    if (!sanitized.preset_data || typeof sanitized.preset_data !== "object" || Array.isArray(sanitized.preset_data)) throw new Error("preset_data must be an object");
    for (const field of ["lender_name", "maturity_date", "target_payoff_date", "interest_period", "interest_method", "notes"]) optionalString(sanitized, field);
    if (sanitized.linked_account_id != null) { requireString(sanitized, "linked_account_id"); await verifyAccountOwnership(supabase, userId, sanitized.linked_account_id as string); }
    return sanitized;
  }
  if (entity === "debt_payments") {
    assertOnlyAllowed(payload, DEBT_PAYMENT_FIELDS);
    const sanitized = sanitizePayload(payload, DEBT_PAYMENT_FIELDS);
    for (const field of ["debt_account_id", "transaction_id", "source", "payment_date", "linked_transaction_type", "linked_source_account_id", "linked_subcategory_id"]) requireString(sanitized, field);
    requirePositiveInteger(sanitized, "amount_centavos"); requireBigInt(sanitized, "principal_centavos"); requireBigInt(sanitized, "interest_centavos");
    if (sanitized.source !== "transaction" || sanitized.linked_transaction_type !== "expense") throw new Error("debt payment must link an expense transaction");
    return sanitized;
  }

  if (entity === "credit_card_transactions") {
    assertOnlyAllowed(payload, CREDIT_CARD_TRANSACTION_FIELDS);
    const sanitized = sanitizePayload(payload, CREDIT_CARD_TRANSACTION_FIELDS);
    requireString(sanitized, "transaction_id");
    requireString(sanitized, "account_id");
    requireString(sanitized, "cycle_id");
    requireString(sanitized, "purchase_type");
    if (sanitized.purchase_type !== "regular" && sanitized.purchase_type !== "installment") {
      throw new Error("purchase_type must be regular or installment");
    }
    if (sanitized.purchase_type === "installment") requireString(sanitized, "installment_id");
    if (sanitized.purchase_type === "regular" && sanitized.installment_id != null) throw new Error("regular purchases cannot reference an installment");
    await verifyAccountOwnership(supabase, userId, sanitized.account_id as string);
    return sanitized;
  }

  if (entity === "income_sources") {
    assertOnlyAllowed(payload, INCOME_SOURCE_CREATE_FIELDS);
    const sanitized = sanitizePayload(payload, INCOME_SOURCE_CREATE_FIELDS);
    requireString(sanitized, "name");
    requireString(sanitized, "income_type");
    requireString(sanitized, "frequency");
    requireString(sanitized, "destination_account_id");
    requireString(sanitized, "subcategory_id");
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
    optionalString(sanitized, "recurring_template_id");
    validateNonNegative(sanitized, ["expected_amount_centavos", "min_amount_centavos", "max_amount_centavos"]);
    validateMinMaxOrdering(sanitized, "min_amount_centavos", "max_amount_centavos");
    validateDayRange(sanitized, "payday_day_of_month", 1, 31);
    validateDayRange(sanitized, "payday_second_day_of_month", 1, 31);
    validateDayRange(sanitized, "payday_day_of_week", 0, 6);
    validateDayRange(sanitized, "payday_second_day_of_week", 0, 6);
     await verifyAccountOwnership(supabase, userId, sanitized.destination_account_id as string);
    await verifySubcategoryOwnership(supabase, userId, sanitized.subcategory_id as string, "income");
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

  if (entity === "budgets") {
    assertOnlyAllowed(payload, BUDGET_CREATE_FIELDS);
    if (payload.status !== "draft" || payload.allocation_method !== "MANUAL") {
      throw new Error("only manual draft budgets can sync");
    }
    return validateBudgetPayload(supabase, userId, payload, BUDGET_CREATE_FIELDS);
  }

  if (entity === "transaction_templates") {
    assertOnlyAllowed(payload, TEMPLATE_FIELDS);
    const sanitized = sanitizePayload(payload, TEMPLATE_FIELDS);
    requireString(sanitized, "transaction_type");
    if (!VALID_TRANSACTION_TYPES.includes(sanitized.transaction_type as string)) {
      throw new Error(`transaction_type must be one of: ${VALID_TRANSACTION_TYPES.join(", ")}`);
    }
    requireString(sanitized, "name");
    if (sanitized.amount_centavos != null) {
      requirePositiveInteger(sanitized, "amount_centavos");
    }
    if (sanitized.subcategory_id) await verifySubcategoryOwnership(supabase, userId, sanitized.subcategory_id as string);
    if (sanitized.source_account_id) await verifyAccountOwnership(supabase, userId, sanitized.source_account_id as string);
    if (sanitized.destination_account_id) await verifyAccountOwnership(supabase, userId, sanitized.destination_account_id as string);
    return sanitized;
  }

  if (entity === "transaction_drafts") {
    assertOnlyAllowed(payload, DRAFT_FIELDS);
    const sanitized = sanitizePayload(payload, DRAFT_FIELDS);
    requireString(sanitized, "client_draft_id");
    if (!sanitized.payload || typeof sanitized.payload !== "object") {
      throw new Error("payload must be an object");
    }
    return sanitized;
  }

  if (entity === "recurring_transaction_templates") {
    assertOnlyAllowed(payload, RECURRING_TEMPLATE_FIELDS);
    const sanitized = sanitizePayload(payload, RECURRING_TEMPLATE_FIELDS);
    requireString(sanitized, "transaction_type");
    if (!VALID_TRANSACTION_TYPES.includes(sanitized.transaction_type as string)) {
      throw new Error(`transaction_type must be one of: ${VALID_TRANSACTION_TYPES.join(", ")}`);
    }
    requireString(sanitized, "name");
    requirePositiveInteger(sanitized, "amount_centavos");
    requireString(sanitized, "frequency");
    if (!["daily", "weekly", "biweekly", "semi_monthly", "monthly", "quarterly", "yearly", "custom"].includes(sanitized.frequency as string)) {
      throw new Error("frequency must be a valid schedule");
    }
    requireString(sanitized, "starts_on");
    optionalString(sanitized, "ends_on");
    if (sanitized.interval_count != null) {
      if (typeof sanitized.interval_count !== "number" || !Number.isInteger(sanitized.interval_count) || (sanitized.interval_count as number) <= 0) {
        throw new Error("interval_count must be a positive integer");
      }
    }
    optionalNumber(sanitized, "day_of_month");
    optionalNumber(sanitized, "second_day_of_month");
    optionalNumber(sanitized, "day_of_week");
    validateDayRange(sanitized, "day_of_month", 1, 31);
    validateDayRange(sanitized, "second_day_of_month", 1, 31);
    validateDayRange(sanitized, "day_of_week", 0, 6);
    validateDateOrdering(sanitized, "starts_on", "ends_on");
    const transactionType = sanitized.transaction_type as string;
    optionalString(sanitized, "subcategory_id");
    optionalString(sanitized, "source_account_id");
    optionalString(sanitized, "destination_account_id");
    validateRecurringTemplateShape(sanitized, transactionType);
    if (sanitized.subcategory_id) {
      if (transactionType === "transfer") throw new Error("transfer templates cannot have a subcategory_id");
      await verifySubcategoryOwnership(supabase, userId, sanitized.subcategory_id as string, transactionType);
    }
    if (sanitized.source_account_id) await verifyAccountOwnership(supabase, userId, sanitized.source_account_id as string);
    if (sanitized.destination_account_id) await verifyAccountOwnership(supabase, userId, sanitized.destination_account_id as string);
    return sanitized;
  }

  if (entity === "recurring_transaction_occurrences") {
    assertOnlyAllowed(payload, RECURRING_OCCURRENCE_FIELDS);
    const sanitized = sanitizePayload(payload, RECURRING_OCCURRENCE_FIELDS);
    requireString(sanitized, "recurring_template_id");
    requireString(sanitized, "scheduled_date");
    const { data: template, error: templateErr } = await supabase
      .from("recurring_transaction_templates")
      .select("id")
      .eq("id", sanitized.recurring_template_id as string)
      .eq("user_id", userId)
      .eq("deleted", false)
      .maybeSingle();
    if (templateErr) throw new Error(`recurring template validation failed: ${templateErr.message}`);
    if (!template) throw new Error("recurring template not found or inaccessible");
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
    optionalBoolean(sanitized, "include_in_dashboard_balance");
    optionalString(sanitized, "institution_name");
    optionalString(sanitized, "opened_on");
    optionalNumber(sanitized, "sort_order");
    return sanitized;
  }

  if (entity === "transactions") {
    // Older clients briefly queued this UI-only routing context with the
    // transaction. It is not a transaction column and must not reach the RPC.
    const { debt_account_id: _debtAccountId, ...transactionPayload } = payload;
    payload = transactionPayload;
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
      await verifyOwnedAccount(supabase, userId, sanitized.destination_account_id as string);
      await verifySubcategoryOwnership(supabase, userId, sanitized.subcategory_id as string, "income");
      sanitized.source_account_id = null;
    } else if (txType === "expense") {
      requireString(sanitized, "source_account_id");
      requireString(sanitized, "subcategory_id");
      if (sanitized.destination_account_id != null) throw new Error("destination_account_id must not be set for expense");
      await verifyOwnedAccount(supabase, userId, sanitized.source_account_id as string);
      await verifySubcategoryOwnership(supabase, userId, sanitized.subcategory_id as string, "expense");
      sanitized.destination_account_id = null;
    } else {
      requireString(sanitized, "source_account_id");
      requireString(sanitized, "destination_account_id");
      if (sanitized.source_account_id === sanitized.destination_account_id) {
        throw new Error("source and destination accounts must differ");
      }
      if (sanitized.subcategory_id != null) throw new Error("subcategory_id must not be set for transfer");
      await verifyOwnedAccount(supabase, userId, sanitized.source_account_id as string);
      await verifyOwnedAccount(supabase, userId, sanitized.destination_account_id as string);
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

  if (entity === "transaction_templates") {
    assertOnlyAllowed(payload, TEMPLATE_FIELDS);
    const sanitized = sanitizePayload(payload, TEMPLATE_FIELDS);
    requireString(sanitized, "transaction_type");
    if (!VALID_TRANSACTION_TYPES.includes(sanitized.transaction_type as string)) {
      throw new Error(`transaction_type must be one of: ${VALID_TRANSACTION_TYPES.join(", ")}`);
    }
    requireString(sanitized, "name");
    if (sanitized.amount_centavos != null) {
      requirePositiveInteger(sanitized, "amount_centavos");
    }
    if (sanitized.subcategory_id) await verifySubcategoryOwnership(supabase, userId, sanitized.subcategory_id as string);
    if (sanitized.source_account_id) await verifyAccountOwnership(supabase, userId, sanitized.source_account_id as string);
    if (sanitized.destination_account_id) await verifyAccountOwnership(supabase, userId, sanitized.destination_account_id as string);
    return sanitized;
  }
  if (entity === "transaction_drafts") {
    assertOnlyAllowed(payload, DRAFT_FIELDS);
    const sanitized = sanitizePayload(payload, DRAFT_FIELDS);
    requireString(sanitized, "client_draft_id");
    if (!sanitized.payload || typeof sanitized.payload !== "object") {
      throw new Error("payload must be an object");
    }
    return sanitized;
  }
  if (entity === "recurring_transaction_templates") {
    assertOnlyAllowed(payload, RECURRING_TEMPLATE_FIELDS);
    const sanitized = sanitizePayload(payload, RECURRING_TEMPLATE_FIELDS);
    requireString(sanitized, "transaction_type");
    if (!VALID_TRANSACTION_TYPES.includes(sanitized.transaction_type as string)) {
      throw new Error(`transaction_type must be one of: ${VALID_TRANSACTION_TYPES.join(", ")}`);
    }
    requireString(sanitized, "name");
    requirePositiveInteger(sanitized, "amount_centavos");
    requireString(sanitized, "frequency");
    if (!["daily", "weekly", "biweekly", "semi_monthly", "monthly", "quarterly", "yearly", "custom"].includes(sanitized.frequency as string)) {
      throw new Error("frequency must be a valid schedule");
    }
    requireString(sanitized, "starts_on");
    if (sanitized.interval_count != null) {
      if (typeof sanitized.interval_count !== "number" || !Number.isInteger(sanitized.interval_count) || (sanitized.interval_count as number) <= 0) {
        throw new Error("interval_count must be a positive integer");
      }
    }
    if (sanitized.subcategory_id) await verifySubcategoryOwnership(supabase, userId, sanitized.subcategory_id as string);
    if (sanitized.source_account_id) await verifyAccountOwnership(supabase, userId, sanitized.source_account_id as string);
    if (sanitized.destination_account_id) await verifyAccountOwnership(supabase, userId, sanitized.destination_account_id as string);
    return sanitized;
  }
  if (entity === "recurring_transaction_occurrences") {
    assertOnlyAllowed(payload, RECURRING_OCCURRENCE_FIELDS);
    const sanitized = sanitizePayload(payload, RECURRING_OCCURRENCE_FIELDS);
    requireString(sanitized, "recurring_template_id");
    requireString(sanitized, "scheduled_date");
    // ponytail: verify the template exists and belongs to this user
    const { data: template, error: templateErr } = await supabase
      .from("recurring_transaction_templates")
      .select("id")
      .eq("id", sanitized.recurring_template_id as string)
      .eq("user_id", userId)
      .eq("deleted", false)
      .maybeSingle();
    if (templateErr) throw new Error(`recurring template validation failed: ${templateErr.message}`);
    if (!template) throw new Error("recurring template not found or inaccessible");
    return sanitized;
  }

  throw new Error(`Unknown entity for create: ${entity}`);
}

async function validateBudgetPayload(
  supabase: SupabaseClient,
  userId: string,
  payload: Record<string, unknown>,
  allowedFields: Set<string>,
  excludeId?: string,
): Promise<Record<string, unknown>> {
  assertOnlyAllowed(payload, allowedFields);
  if (!VALID_BUDGET_PERIOD_KINDS.includes(payload.periodKind as string)) {
    throw new Error("periodKind must be WEEKLY, MONTHLY, CUSTOM, or INCOME_CYCLE");
  }
  requireDateString(payload, "periodStart");
  requireDateString(payload, "periodEnd");
  const periodDays = inclusiveDays(payload.periodStart as string, payload.periodEnd as string);
  if (periodDays <= 0) throw new Error("periodEnd must be on or after periodStart");
  if (payload.periodKind === "WEEKLY" && periodDays !== 7) throw new Error("WEEKLY budgets must span 7 days");
  if (payload.periodKind === "MONTHLY") {
    const start = parseDateString(payload.periodStart as string);
    const nextMonthDays = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 2, 0)).getUTCDate();
    const expectedEnd = new Date(Date.UTC(
      start.getUTCFullYear(),
      start.getUTCMonth() + 1,
      Math.min(start.getUTCDate(), nextMonthDays),
    ));
    if (payload.periodEnd !== expectedEnd.toISOString().slice(0, 10)) {
      throw new Error("MONTHLY budgets must cover one month from the start date");
    }
  }
  if (payload.periodKind === "CUSTOM" && periodDays > 366) throw new Error("CUSTOM budgets cannot exceed 366 days");
  if (payload.budget_period_days !== periodDays) throw new Error("budget_period_days must match the inclusive date range");
  requirePositiveInteger(payload, "totalAmountMinor");
  const overlapQuery = supabase
    .from("budgets")
    .select("id")
    .eq("user_id", userId)
    .eq("deleted", false)
    .neq("status", "deleted")
    .limit(1);
  if (excludeId) overlapQuery.neq("id", excludeId);
  const { data: existingBudget, error: overlapError } = await overlapQuery.maybeSingle();
  if (overlapError) throw new Error(`budget uniqueness validation failed: ${overlapError.message}`);
  if (existingBudget) throw new Error("only one budget can exist at a time");
  if (!Array.isArray(payload.allocations)) throw new Error("allocations must be an array");
  if (payload.allocations.length > 100) throw new Error("allocations cannot contain more than 100 items");
  const categoryIds = payload.allocations.map((item) => item && typeof item === "object" ? (item as Record<string, unknown>).categoryId : undefined).filter((id): id is string => typeof id === "string");
  const subcategoryIds = payload.allocations.map((item) => item && typeof item === "object" ? (item as Record<string, unknown>).subcategoryId : undefined).filter((id): id is string => typeof id === "string");
  await verifyBudgetReferences(supabase, userId, categoryIds, subcategoryIds);
  let allocated = 0;
  for (const allocation of payload.allocations) {
    if (!allocation || typeof allocation !== "object") throw new Error("allocations must contain objects");
    const value = allocation as Record<string, unknown>;
    if ((!value.categoryId && !value.subcategoryId) || (value.categoryId && value.subcategoryId)) {
      throw new Error("each allocation must reference one category or subcategory");
    }
    requirePositiveInteger(value, "amountMinor");
    allocated += value.amountMinor as number;
  }
  if (allocated > (payload.totalAmountMinor as number)) throw new Error("allocations cannot exceed the budget total");
  return payload;
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
  } else if (entity === "credit_card_cycles") {
    allowedFields = CREDIT_CARD_CYCLE_FIELDS;
  } else if (entity === "credit_card_statements") {
    allowedFields = CREDIT_CARD_STATEMENT_UPDATE_FIELDS;
  } else if (entity === "credit_card_payments") {
    allowedFields = CREDIT_CARD_PAYMENT_UPDATE_FIELDS;
  } else if (entity === "credit_card_details") {
    allowedFields = CREDIT_CARD_DETAILS_UPDATE_FIELDS;
  } else if (entity === "transactions") {
    allowedFields = TRANSACTION_UPDATE_FIELDS;
  } else if (entity === "income_sources") {
    allowedFields = INCOME_SOURCE_UPDATE_FIELDS;
  } else if (entity === "financial_obligations") {
    allowedFields = OBLIGATION_UPDATE_FIELDS;
  } else if (entity === "debt_accounts") {
    allowedFields = DEBT_ACCOUNT_FIELDS;
  } else if (entity === "debt_payments") {
    allowedFields = DEBT_PAYMENT_FIELDS;
  } else if (entity === "transaction_templates") {
    allowedFields = TEMPLATE_FIELDS;
  } else if (entity === "transaction_drafts") {
    allowedFields = DRAFT_FIELDS;
  } else if (entity === "recurring_transaction_templates") {
    if (Object.prototype.hasOwnProperty.call(payload, "transaction_type")) {
      throw new Error("transaction_type is immutable for recurring transaction templates");
    }
    allowedFields = RECURRING_TEMPLATE_UPDATE_FIELDS;
  } else if (entity === "recurring_transaction_occurrences") {
    allowedFields = RECURRING_OCCURRENCE_FIELDS;
  } else if (entity === "budgets") {
    return validateBudgetPayload(supabase, userId, payload, BUDGET_UPDATE_FIELDS, recordId);
  } else {
    throw new Error(`entity '${entity}' is not in the sync allowlist`);
  }

  assertOnlyAllowed(payload, allowedFields);
  const sanitized = sanitizePayload(payload, allowedFields);

  if (entity === "credit_card_cycles") {
    if (sanitized.account_id !== undefined) {
      if (typeof sanitized.account_id !== "string") throw new Error("account_id must be a string");
      await verifyAccountOwnership(supabase, userId, sanitized.account_id);
    }
    for (const field of ["cycle_start_date", "cutoff_date", "statement_date"]) {
      if (sanitized[field] !== undefined) requireDateString(sanitized, field);
    }
    if (sanitized.statement_date !== undefined) {
      const { data: statement, error } = await supabase
        .from("credit_card_statements")
        .select("id")
        .eq("cycle_id", recordId)
        .eq("user_id", userId)
        .eq("statement_date", sanitized.statement_date)
        .eq("deleted", false)
        .maybeSingle();
      if (error) throw new Error(`credit-card statement lookup failed: ${error.message}`);
      if (!statement) throw new Error("statement_date must match a recorded statement on this billing cycle");
    }
  } else if (entity === "credit_card_details" && sanitized.account_id !== undefined) {
    if (typeof sanitized.account_id !== "string") throw new Error("account_id must be a string");
    await verifyAccountOwnership(supabase, userId, sanitized.account_id);
  } else if (entity === "transactions") {
    for (const field of ["source_account_id", "destination_account_id"]) {
      const accountId = sanitized[field];
      if (accountId !== undefined && accountId !== null) {
        if (typeof accountId !== "string") throw new Error(`${field} must be a string or null`);
        await verifyAccountOwnership(supabase, userId, accountId);
      }
    }
  }

  if (entity === "debt_accounts") {
    if (sanitized.linked_account_id != null) { if (typeof sanitized.linked_account_id !== "string") throw new Error("linked_account_id must be a string or null"); await verifyAccountOwnership(supabase, userId, sanitized.linked_account_id); }
    if (sanitized.name !== undefined && (typeof sanitized.name !== "string" || !sanitized.name.trim())) throw new Error("name must be a non-empty string");
    if (sanitized.preset_key !== undefined && !DEBT_ACCOUNT_TYPES.includes(sanitized.preset_key as string)) throw new Error("preset_key is not a supported non-credit-card debt type");
    if (sanitized.status !== undefined && !["active", "archived", "paid_off"].includes(sanitized.status as string)) throw new Error("status is invalid");
    if (sanitized.preset_data !== undefined && (!sanitized.preset_data || typeof sanitized.preset_data !== "object" || Array.isArray(sanitized.preset_data))) throw new Error("preset_data must be an object");
    for (const [key, value] of Object.entries(sanitized)) {
      if (["original_balance_centavos", "current_balance_centavos", "annual_interest_rate_bps", "minimum_payment_centavos"].includes(key) && (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0)) throw new Error(`${key} must be a non-negative whole number`);
      if (["lender_name", "maturity_date", "target_payoff_date", "interest_period", "interest_method", "notes", "next_due_date", "payment_frequency"].includes(key) && value !== null && typeof value !== "string") throw new Error(`${key} must be a string or null`);
    }
    return sanitized;
  }

  if (entity === "credit_card_payments") {
    for (const [key, value] of Object.entries(sanitized)) {
      if (key === "amount_centavos") requirePositiveInteger(sanitized, key);
      else if (key === "payment_date") requireDateString(sanitized, key);
      else if (key === "source_account_id") {
        if (typeof value !== "string" || !value) throw new Error("source_account_id must be a non-empty string");
        await verifyAccountOwnership(supabase, userId, value);
      } else if (key === "notes" && value !== null && typeof value !== "string") {
        throw new Error("notes must be a string or null");
      }
    }
    return sanitized;
  }

  if (entity === "debt_payments") {
    for (const field of ["debt_account_id", "transaction_id", "source", "payment_date", "linked_transaction_type", "linked_source_account_id", "linked_subcategory_id"]) requireString(sanitized, field);
    requirePositiveInteger(sanitized, "amount_centavos"); requireBigInt(sanitized, "principal_centavos"); requireBigInt(sanitized, "interest_centavos");
    if (sanitized.source !== "transaction" || sanitized.linked_transaction_type !== "expense") throw new Error("debt payment must link an expense transaction");
    return sanitized;
  }

  for (const [key, value] of Object.entries(sanitized)) {
    if (entity === "credit_card_cycles") {
       if (key === "statement_date" && value === null) continue;
       if (typeof value !== "string" || !value) throw new Error(`${key} must be a non-empty string`);
      continue;
    }
    if (entity === "credit_card_statements") {
      if (key === "statement_date" || key === "due_date") {
        if (typeof value !== "string" || !value) throw new Error(`${key} must be a non-empty string`);
        continue;
      }
      if (key === "statement_balance_centavos" || key === "minimum_due_centavos" || key === "finance_charge_centavos") {
        if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
          throw new Error(`${key} must be a non-negative whole number`);
        }
        continue;
      }
    }
    if (entity === "credit_card_details") {
      if (key === "account_id") {
        if (typeof value !== "string" || !value) throw new Error("account_id must be a non-empty string");
      } else if (["issuer", "notes"].includes(key)) {
        if (value !== null && typeof value !== "string") throw new Error(`${key} must be a string or null`);
       } else if (key === "cutoff_day" || key === "statement_day") {
         if (key === "statement_day" && value === null) continue;
        requireNumberInRange(sanitized, key, 1, 31);
      } else {
        optionalFiniteInteger(sanitized, key);
      }
      continue;
    }
    if (entity === "recurring_transaction_templates") {
      if (key === "subcategory_id" || key === "source_account_id" || key === "destination_account_id") {
        if (value !== null && typeof value !== "string") throw new Error(`${key} must be a string or null`);
        continue;
      }

      if (key === "interval_count") {
        requirePositiveInteger(sanitized, key);
        continue;
      }

      if (key === "amount_centavos") {
        requirePositiveInteger(sanitized, key);
        continue;
      }

      if (key === "day_of_month" || key === "second_day_of_month") {
        if (value !== null && (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 31)) {
          throw new Error(`${key} must be between 1 and 31 or null`);
        }
        continue;
      }

      if (key === "day_of_week") {
        if (value !== null && (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 6)) {
          throw new Error("day_of_week must be between 0 and 6 or null");
        }
        continue;
      }
    }

    if (entity === "financial_accounts") {
      if (key === "name" || key === "institution_name" || key === "opened_on" || key === "archived_at") {
        if (value !== null && typeof value !== "string") throw new Error(`${key} must be a string or null`);
        continue;
      }
      if (key === "status") {
        if (typeof value !== "string") throw new Error("status must be a string");
        if (value === "deleted") throw new Error("status 'deleted' must use the delete operation");
        if (!["active", "archived"].includes(value)) throw new Error("status must be active or archived");
        continue;
      }
      if (key === "opening_balance_centavos" || key === "current_balance_centavos") {
        if (value != null) {
          if (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value)) {
            throw new Error(`${key} must be a finite integer or null`);
          }
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

    if (key === "slug" || key === "subcategory_id" || key === "source_account_id" || key === "destination_account_id") {
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

    if (key === "expected_amount_centavos" || key === "min_amount_centavos" || key === "max_amount_centavos") {
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
      } else if (entity === "recurring_transaction_templates") {
        if (!["daily", "weekly", "biweekly", "semi_monthly", "monthly", "quarterly", "yearly", "custom"].includes(value as string)) {
          throw new Error("frequency must be a valid recurring frequency");
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

  if (entity === "credit_card_statements") {
    const balance = sanitized.statement_balance_centavos as number | undefined;
    const minimum = sanitized.minimum_due_centavos as number | undefined;
    if (balance !== undefined && minimum !== undefined && minimum > balance) {
      throw new Error("minimum_due_centavos must be <= statement_balance_centavos");
    }
    const { data: statement, error } = await supabase
      .from("credit_card_statements")
      .select("cycle_id")
      .eq("id", recordId)
      .eq("user_id", userId)
      .eq("deleted", false)
      .maybeSingle();
    if (error) throw new Error(`credit-card statement lookup failed: ${error.message}`);
    if (!statement) throw new Error("credit-card statement not found or inaccessible");
    const statementDate = sanitized.statement_date as string | undefined;
    if (statementDate !== undefined) {
      const { data: cycle, error: cycleError } = await supabase
        .from("credit_card_cycles")
        .select("cycle_start_date")
        .eq("id", statement.cycle_id)
        .eq("user_id", userId)
        .eq("deleted", false)
        .maybeSingle();
      if (cycleError) throw new Error(`credit-card cycle lookup failed: ${cycleError.message}`);
      if (!cycle) throw new Error("credit-card statement cycle is invalid");
      const today = new Date().toISOString().slice(0, 10);
      if (statementDate <= cycle.cycle_start_date || statementDate > today) {
        throw new Error("statement_date must be after the billing cycle start and no later than today");
      }
    }
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

  if (entity === "recurring_transaction_templates") {
    const { data: current, error } = await supabase
      .from("recurring_transaction_templates")
      .select("id, transaction_type, subcategory_id, source_account_id, destination_account_id, starts_on, ends_on")
      .eq("id", recordId)
      .eq("user_id", userId)
      .eq("deleted", false)
      .maybeSingle();
    if (error) throw new Error(`recurring template lookup failed: ${error.message}`);
    if (!current) throw new Error("recurring template not found or inaccessible");

    validateDateOrdering({ ...current, ...sanitized }, "starts_on", "ends_on");
    const transactionType = current.transaction_type as string;
    validateRecurringTemplateShape({ ...current, ...sanitized }, transactionType);
    const subcategoryId = sanitized.subcategory_id;
    if (subcategoryId !== undefined && subcategoryId !== null) {
      if (transactionType === "transfer") throw new Error("transfer templates cannot have a subcategory_id");
      await verifySubcategoryOwnership(supabase, userId, subcategoryId as string, transactionType);
    }
    for (const accountField of ["source_account_id", "destination_account_id"] as const) {
      const accountId = sanitized[accountField];
      if (accountId !== undefined && accountId !== null) {
        await verifyAccountOwnership(supabase, userId, accountId as string);
      }
    }
  }

  if (entity === "income_sources") {
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
    if (sanitized.destination_account_id && typeof sanitized.destination_account_id === "string") {
      await verifyAccountOwnership(supabase, userId, sanitized.destination_account_id);
    }
    if (sanitized.subcategory_id && typeof sanitized.subcategory_id === "string") {
      await verifySubcategoryOwnership(supabase, userId, sanitized.subcategory_id, "income");
    }
    if (sanitized.recurring_template_id && typeof sanitized.recurring_template_id === "string") {
      const { data: template, error: templateErr } = await supabase
        .from("recurring_transaction_templates")
        .select("id")
        .eq("id", sanitized.recurring_template_id)
        .eq("user_id", userId)
        .maybeSingle();
      if (templateErr) throw new Error(`recurring_template_id validation failed: ${templateErr.message}`);
      if (!template) throw new Error("recurring_template_id does not reference an accessible recurring template");
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

  if (entity === "transaction_templates" || entity === "recurring_transaction_templates") {
    const src = sanitized.source_account_id;
    const dst = sanitized.destination_account_id;
    const sub = sanitized.subcategory_id;
    if (src && typeof src === "string") await verifyAccountOwnership(supabase, userId, src);
    if (dst && typeof dst === "string") await verifyAccountOwnership(supabase, userId, dst);
    if (sub && typeof sub === "string") await verifySubcategoryOwnership(supabase, userId, sub);
  }

  if (entity === "recurring_transaction_occurrences") {
    const tid = sanitized.generated_transaction_id;
    if (tid && typeof tid === "string") {
      const { data: tx, error: txErr } = await supabase
        .from("transactions")
        .select("id")
        .eq("id", tid)
        .eq("user_id", userId)
        .eq("deleted", false)
        .maybeSingle();
      if (txErr) throw new Error(`transaction lookup failed: ${txErr.message}`);
      if (!tx) throw new Error("generated_transaction_id not found or inaccessible");
    }
  }

  return sanitized;
}

function opFields(payload: Record<string, unknown>, fields: Set<string>): string[] {
  return Object.keys(payload).filter((field) => fields.has(field));
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

const VALID_BUDGET_PERIOD_KINDS = ["WEEKLY", "MONTHLY", "CUSTOM", "INCOME_CYCLE"];

function requireDateString(payload: Record<string, unknown>, field: string): void {
  if (typeof payload[field] !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(payload[field] as string)) {
    throw new Error(`${field} must be a valid YYYY-MM-DD date`);
  }
  if (Number.isNaN(parseDateString(payload[field] as string).getTime())) {
    throw new Error(`${field} must be a valid calendar date`);
  }
}

function parseDateString(value: string): Date {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (date.toISOString().slice(0, 10) !== value) return new Date(NaN);
  return date;
}

function inclusiveDays(start: string, end: string): number {
  return Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000) + 1;
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

function requireNumberInRange(payload: Record<string, unknown>, field: string, min: number, max: number): void {
  const value = payload[field];
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${field} must be an integer between ${min} and ${max}`);
  }
}

function validateOptionalRange(payload: Record<string, unknown>, field: string, min: number, max: number): void {
  if (payload[field] !== undefined && payload[field] !== null) requireNumberInRange(payload, field, min, max);
}

function validateRecurringTemplateShape(payload: Record<string, unknown>, transactionType: string): void {
  const source = payload.source_account_id;
  const destination = payload.destination_account_id;
  const subcategory = payload.subcategory_id;

  if (transactionType === "income") {
    requireString(payload, "destination_account_id");
    requireString(payload, "subcategory_id");
    if (source !== undefined && source !== null) throw new Error("income templates cannot have a source_account_id");
    return;
  }

  if (transactionType === "expense") {
    requireString(payload, "source_account_id");
    requireString(payload, "subcategory_id");
    if (destination !== undefined && destination !== null) throw new Error("expense templates cannot have a destination_account_id");
    return;
  }

  requireString(payload, "source_account_id");
  requireString(payload, "destination_account_id");
  if (source === destination) throw new Error("transfer templates require distinct source and destination accounts");
  if (subcategory !== undefined && subcategory !== null) throw new Error("transfer templates cannot have a subcategory_id");
}

function optionalFiniteInteger(payload: Record<string, unknown>, field: string): void {
  const v = payload[field];
  if (v !== undefined && v !== null) {
    if (typeof v !== "number" || !Number.isFinite(v) || !Number.isInteger(v)) {
      throw new Error(`${field} must be a finite integer or null`);
    }
  }
}

async function verifyOwnedAccount(
  supabase: SupabaseClient,
  userId: string,
  accountId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from("financial_accounts")
    .select("id")
    .eq("id", accountId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`account validation failed: ${error.message}`);
  if (!data) throw new Error("account not found or inaccessible");
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

async function verifyStatementCycle(
  supabase: SupabaseClient,
  userId: string,
  cycleId: string,
  statementDate: string,
): Promise<void> {
  const { data: cycle, error } = await supabase
    .from("credit_card_cycles")
    .select("id, cycle_start_date, statement_date, account_id")
    .eq("id", cycleId)
    .eq("user_id", userId)
    .eq("deleted", false)
    .maybeSingle();
  if (error) throw new Error(`credit-card cycle validation failed: ${error.message}`);
  const today = new Date().toISOString().slice(0, 10);
  if (!cycle || cycle.statement_date !== null || statementDate <= cycle.cycle_start_date || statementDate > today) {
    throw new Error("credit-card statement cycle is invalid");
  }
  const { data: account, error: accountError } = await supabase
    .from("financial_accounts")
    .select("id")
    .eq("id", cycle.account_id)
    .eq("user_id", userId)
    .eq("kind", "credit_card")
    .eq("deleted", false)
    .maybeSingle();
  if (accountError) throw new Error(`credit-card account validation failed: ${accountError.message}`);
  if (!account) throw new Error("credit-card statement cycle is invalid");
}

async function verifyCreditCardPaymentReferences(
  supabase: SupabaseClient,
  userId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const { data: statement, error: statementError } = await supabase
    .from("credit_card_statements")
    .select("id, authoritative, statement_balance_centavos")
    .eq("id", payload.statement_id as string)
    .eq("cycle_id", payload.cycle_id as string)
    .eq("user_id", userId)
    .eq("deleted", false)
    .maybeSingle();
  if (statementError) throw new Error(`credit-card statement validation failed: ${statementError.message}`);
  if (!statement || statement.authoritative !== true) throw new Error("payment must reference an authoritative statement in its billing cycle");
  if ((payload.amount_centavos as number) > statement.statement_balance_centavos) throw new Error("payment amount cannot exceed the statement balance");

  const { data: source, error: sourceError } = await supabase
    .from("financial_accounts")
    .select("id")
    .eq("id", payload.source_account_id as string)
    .eq("user_id", userId)
    .neq("kind", "credit_card")
    .eq("status", "active")
    .eq("deleted", false)
    .maybeSingle();
  if (sourceError) throw new Error(`payment source-account validation failed: ${sourceError.message}`);
  if (!source) throw new Error("payment source account must be an active non-credit-card account");

  const { data: transaction, error: transactionError } = await supabase
    .from("transactions")
    .select("id")
    .eq("id", payload.transaction_id as string)
    .eq("user_id", userId)
    .eq("transaction_type", "expense")
    .eq("source_account_id", payload.source_account_id as string)
    .eq("amount_centavos", payload.amount_centavos as number)
    .eq("deleted", false)
    .maybeSingle();
  if (transactionError) throw new Error(`payment transaction validation failed: ${transactionError.message}`);
  if (!transaction) throw new Error("payment transaction must match its amount and source account");
}

async function verifyCategoryOwnership(
  supabase: SupabaseClient,
  userId: string,
  categoryId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from("categories")
    .select("id")
    .eq("id", categoryId)
    .eq("deleted", false)
    .eq("is_active", true)
    .or(`user_id.is.null,user_id.eq.${userId}`)
    .maybeSingle();
  if (error) throw new Error(`category validation failed: ${error.message}`);
  if (!data) throw new Error("category not found or inaccessible");
}

async function verifyBudgetReferences(
  supabase: SupabaseClient,
  userId: string,
  categoryIds: string[],
  subcategoryIds: string[],
): Promise<void> {
  const [categories, subcategories] = await Promise.all([
    categoryIds.length ? supabase.from("categories").select("id").in("id", [...new Set(categoryIds)]).eq("deleted", false).eq("is_active", true).or(`user_id.is.null,user_id.eq.${userId}`) : Promise.resolve({ data: [], error: null }),
    subcategoryIds.length ? supabase.from("subcategories").select("id").in("id", [...new Set(subcategoryIds)]).eq("deleted", false).eq("is_active", true).eq("kind", "expense").or(`user_id.is.null,user_id.eq.${userId}`) : Promise.resolve({ data: [], error: null }),
  ]);
  if (categories.error) throw new Error(`category validation failed: ${categories.error.message}`);
  if (subcategories.error) throw new Error(`subcategory validation failed: ${subcategories.error.message}`);
  if ((categories.data?.length ?? 0) !== new Set(categoryIds).size || (subcategories.data?.length ?? 0) !== new Set(subcategoryIds).size) throw new Error("budget allocation reference not found or inaccessible");
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
