import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { pushOperations } from "../../services/syncService.js";

const localUrl = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for integration tests");
const service = createClient(localUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
type TestUser = { id: string; client: SupabaseClient };

async function createTestUser(): Promise<TestUser> {
  const email = `odin-sync-${randomUUID()}@example.com`;
  const { data, error } = await service.auth.admin.createUser({ email, password: "test-password-123", email_confirm: true });
  if (error || !data.user) throw new Error(error?.message ?? "test user creation failed");
  await service.from("profiles").upsert({ user_id: data.user.id });
  const { data: session, error: signInError } = await service.auth.signInWithPassword({ email, password: "test-password-123" });
  if (signInError || !session.session) throw new Error(signInError?.message ?? "test user sign-in failed");
  return {
    id: data.user.id,
    client: createClient(localUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${session.session.access_token}` } },
    }),
  };
}

async function assertLocalSupabase(): Promise<void> {
  try {
    const { error } = await service.from("profiles").select("user_id").limit(1);
    if (error) throw error;
  } catch {
    throw new Error("Local Supabase not available. Start with: npx supabase start");
  }
}

describe("debt sync RPC integration", () => {
  let owner: TestUser;
  let other: TestUser;
  let accountId: string;
  let debtId: string;
  let subcategoryId: string;

  beforeAll(async () => {
    await assertLocalSupabase();
    owner = await createTestUser();
    other = await createTestUser();
    const { data: subcategory, error } = await service.from("subcategories").select("id").eq("is_system", true).eq("kind", "expense").limit(1).single();
    if (error || !subcategory) throw new Error(error?.message ?? "expense subcategory missing");
    subcategoryId = subcategory.id;
  });

  afterAll(async () => {
    if (owner?.id) await service.auth.admin.deleteUser(owner.id);
    if (other?.id) await service.auth.admin.deleteUser(other.id);
  });

  beforeEach(async () => {
    accountId = randomUUID();
    debtId = randomUUID();
    const { error } = await owner.client.from("financial_accounts").insert({ id: accountId, user_id: owner.id, name: "Sync test account", kind: "cash", current_balance_centavos: 5000, opening_balance_centavos: 5000 });
    if (error) throw new Error(error.message);
    const { error: debtError } = await owner.client.from("debt_accounts").insert({ id: debtId, user_id: owner.id, name: "Sync test debt", preset_key: "integration", current_balance_centavos: 4000, original_balance_centavos: 4000 });
    if (debtError) throw new Error(debtError.message);
  });

  it("replays once and rejects cross-user operation reuse", async () => {
    const operationId = randomUUID();
    const paymentId = randomUUID();
    const transactionId = randomUUID();
    const args = { p_operation_id: operationId, p_device_id: "integration-device", p_entity: "debt_payments", p_record_id: paymentId, p_operation_type: "create", p_base_version: null, p_changed_fields: [], p_payload: { debt_account_id: debtId, transaction_id: transactionId, linked_transaction_type: "expense", linked_source_account_id: accountId, linked_subcategory_id: subcategoryId, source: "transaction", payment_date: "2026-08-21", amount_centavos: 4000, principal_centavos: 4000 } };
    const first = await owner.client.rpc("apply_debt_sync_operation", args);
    expect(first.error).toBeNull();
    expect(first.data?.[0]?.status).toBe("applied");
    const replay = await owner.client.rpc("apply_debt_sync_operation", args);
    expect(replay.error).toBeNull();
    expect(replay.data?.[0]?.status).toBe("duplicate");
    const crossUser = await other.client.rpc("apply_debt_sync_operation", args);
    expect(crossUser.error).toBeNull();
    expect(crossUser.data?.[0]?.status).toBe("rejected");
    const { data: account } = await owner.client.from("financial_accounts").select("current_balance_centavos").eq("id", accountId).single();
    const { data: debt } = await owner.client.from("debt_accounts").select("current_balance_centavos").eq("id", debtId).single();
    expect(account?.current_balance_centavos).toBe(1000);
    expect(debt?.current_balance_centavos).toBe(0);
    const { data: payoff } = await owner.client.from("debt_accounts").select("status,paid_off_at").eq("id", debtId).single();
    expect(payoff).toMatchObject({ status: "paid_off" });
    expect(payoff?.paid_off_at).not.toBeNull();
  });

  it("converges a reconstructed debt create under a new operation id", async () => {
    const result = await pushOperations(owner.client, owner.id, "integration-device", [{
      operation_id: randomUUID(), entity: "debt_accounts", record_id: debtId,
      operation_type: "create", base_version: null, changed_fields: [],
      payload: { name: "Reconstructed debt", preset_key: "integration", current_balance_centavos: 4000, original_balance_centavos: 4000 },
    }]);
    expect(result[0]?.status).toBe("duplicate");

    const crossUser = await pushOperations(other.client, other.id, "integration-device", [{
      operation_id: randomUUID(), entity: "debt_accounts", record_id: debtId,
      operation_type: "create", base_version: null, changed_fields: [],
      payload: { name: "Cross-user reuse", preset_key: "integration" },
    }]);
    expect(crossUser[0]?.status).toBe("rejected");
  });

  it("rolls back transaction and balance when the source account is insufficient", async () => {
    await owner.client.from("financial_accounts").update({ current_balance_centavos: 500 }).eq("id", accountId);
    const result = await owner.client.rpc("apply_debt_sync_operation", { p_operation_id: randomUUID(), p_device_id: "integration-device", p_entity: "debt_payments", p_record_id: randomUUID(), p_operation_type: "create", p_base_version: null, p_changed_fields: [], p_payload: { debt_account_id: debtId, transaction_id: randomUUID(), linked_transaction_type: "expense", linked_source_account_id: accountId, linked_subcategory_id: subcategoryId, source: "transaction", payment_date: "2026-08-21", amount_centavos: 1000, principal_centavos: 1000 } });
    expect(result.error).not.toBeNull();
    const { data: account } = await owner.client.from("financial_accounts").select("current_balance_centavos").eq("id", accountId).single();
    const { data: transactions } = await owner.client.from("transactions").select("id").eq("user_id", owner.id).eq("source_account_id", accountId);
    expect(account?.current_balance_centavos).toBe(500);
    expect(transactions).toEqual([]);
  });

  it("does not debit an already-created linked transaction twice", async () => {
    const paymentId = randomUUID();
    const transactionId = randomUUID();
    const { error } = await owner.client.from("transactions").insert({
      id: transactionId,
      user_id: owner.id,
      transaction_type: "expense",
      status: "posted",
      entry_source: "offline_sync",
      transaction_date: "2026-08-21",
      amount_centavos: 1000,
      subcategory_id: subcategoryId,
      source_account_id: accountId,
      client_mutation_id: `debt-payment:${paymentId}`,
      metadata: {},
    });
    if (error) throw new Error(error.message);

    const result = await owner.client.rpc("apply_debt_sync_operation", {
      p_operation_id: randomUUID(), p_device_id: "integration-device", p_entity: "debt_payments", p_record_id: paymentId,
      p_operation_type: "create", p_base_version: null, p_changed_fields: [],
      p_payload: { debt_account_id: debtId, transaction_id: transactionId, linked_transaction_type: "expense", linked_source_account_id: accountId, linked_subcategory_id: subcategoryId, source: "transaction", payment_date: "2026-08-21", amount_centavos: 1000, principal_centavos: 1000 },
    });

    expect(result.error).toBeNull();
    const { data: account } = await owner.client.from("financial_accounts").select("current_balance_centavos").eq("id", accountId).single();
    const { data: debt } = await owner.client.from("debt_accounts").select("current_balance_centavos").eq("id", debtId).single();
    expect(account?.current_balance_centavos).toBe(4000);
    expect(debt?.current_balance_centavos).toBe(3000);
  });

  it("debits an applied linked transaction when its server debit marker is absent", async () => {
    const paymentId = randomUUID();
    const transactionId = randomUUID();
    const transactionOperationId = randomUUID();
    await owner.client.from("financial_accounts").update({ current_balance_centavos: 500 }).eq("id", accountId);
    const { error: transactionError } = await service.from("transactions").insert({
      id: transactionId, user_id: owner.id, transaction_type: "expense", status: "posted",
      entry_source: "offline_sync", transaction_date: "2026-08-21", amount_centavos: 1000,
      subcategory_id: subcategoryId, source_account_id: accountId,
      client_mutation_id: `debt-payment:${paymentId}`, metadata: {},
    });
    if (transactionError) throw new Error(transactionError.message);
    const { error: operationError } = await service.from("applied_operations").insert({
      operation_id: transactionOperationId, user_id: owner.id, device_id: "integration-device",
      entity: "transactions", record_id: transactionId, operation_type: "create", result: { status: "applied" },
    });
    if (operationError) throw new Error(operationError.message);

    const result = await owner.client.rpc("apply_debt_sync_operation", {
      p_operation_id: randomUUID(), p_device_id: "integration-device", p_entity: "debt_payments",
      p_record_id: paymentId, p_operation_type: "create", p_base_version: null, p_changed_fields: [],
      p_payload: { debt_account_id: debtId, transaction_id: transactionId, linked_transaction_type: "expense", linked_source_account_id: accountId, linked_subcategory_id: subcategoryId, source: "transaction", payment_date: "2026-08-21", amount_centavos: 1000, principal_centavos: 1000 },
    });

    expect(result.error).toBeNull();
    const { data: account } = await owner.client.from("financial_accounts").select("current_balance_centavos").eq("id", accountId).single();
    expect(account?.current_balance_centavos).toBe(-500);
  });

  it("does not trust forged transaction metadata to skip the cash debit", async () => {
    const paymentId = randomUUID();
    const transactionId = randomUUID();
    const { error } = await owner.client.from("transactions").insert({
      id: transactionId, user_id: owner.id, transaction_type: "expense", status: "posted",
      entry_source: "offline_sync", transaction_date: "2026-08-21", amount_centavos: 1000,
      subcategory_id: subcategoryId, source_account_id: accountId,
      client_mutation_id: `debt-payment:${paymentId}`, metadata: { debt_payment_balance_debited: true },
    });
    if (error) throw new Error(error.message);

    const result = await owner.client.rpc("apply_debt_sync_operation", {
      p_operation_id: randomUUID(), p_device_id: "integration-device", p_entity: "debt_payments",
      p_record_id: paymentId, p_operation_type: "create", p_base_version: null, p_changed_fields: [],
      p_payload: { debt_account_id: debtId, transaction_id: transactionId, linked_transaction_type: "expense", linked_source_account_id: accountId, linked_subcategory_id: subcategoryId, source: "transaction", payment_date: "2026-08-21", amount_centavos: 1000, principal_centavos: 1000 },
    });
    expect(result.error).toBeNull();
    const { data: account } = await owner.client.from("financial_accounts").select("current_balance_centavos").eq("id", accountId).single();
    const { data: debt } = await owner.client.from("debt_accounts").select("current_balance_centavos").eq("id", debtId).single();
    expect(account?.current_balance_centavos).toBe(4000);
    expect(debt?.current_balance_centavos).toBe(3000);
  });

  it("applies standalone payments without a transaction and replays once", async () => {
    const operationId = randomUUID();
    const paymentId = randomUUID();
    const args = { p_operation_id: operationId, p_device_id: "integration-device", p_entity: "debt_payments", p_record_id: paymentId, p_operation_type: "create", p_base_version: null, p_changed_fields: [], p_payload: { debt_account_id: debtId, transaction_id: null, source: "manual", payment_date: "2026-08-21", amount_centavos: 1000, principal_centavos: 900, interest_centavos: 100 } };
    const first = await owner.client.rpc("apply_debt_sync_operation", args);
    const replay = await owner.client.rpc("apply_debt_sync_operation", args);
    expect(first.error).toBeNull(); expect(first.data?.[0]?.status).toBe("applied");
    expect(replay.error).toBeNull(); expect(replay.data?.[0]?.status).toBe("duplicate");
    const { data: debt } = await owner.client.from("debt_accounts").select("current_balance_centavos").eq("id", debtId).single();
    const { data: payments } = await owner.client.from("debt_payments").select("id,transaction_id,source").eq("id", paymentId).single();
    expect(debt?.current_balance_centavos).toBe(3000);
    expect(payments).toEqual({ id: paymentId, transaction_id: null, source: "manual" });
  });

  it("rejects linking a standalone payment to a mismatched transaction without mutation", async () => {
    const paymentId = randomUUID();
    const transactionId = randomUUID();
    const standalone = await owner.client.rpc("apply_debt_sync_operation", {
      p_operation_id: randomUUID(), p_device_id: "integration-device", p_entity: "debt_payments", p_record_id: paymentId,
      p_operation_type: "create", p_base_version: null, p_changed_fields: [],
      p_payload: { debt_account_id: debtId, transaction_id: null, source: "manual", payment_date: "2026-08-21", amount_centavos: 1000, principal_centavos: 1000 },
    });
    expect(standalone.error).toBeNull();

    const transaction = await pushOperations(owner.client, owner.id, "integration-device", [{
      operation_id: randomUUID(), entity: "transactions", record_id: transactionId,
      operation_type: "create", base_version: null, changed_fields: [],
      payload: {
        transaction_type: "expense", transaction_date: "2026-08-21", amount_centavos: 900,
        source_account_id: accountId, subcategory_id: subcategoryId,
        destination_account_id: null, client_mutation_id: `debt-payment:${paymentId}`,
      },
    }]);
    expect(transaction[0]?.status).toBe("applied");

    const result = await owner.client.rpc("apply_debt_sync_operation", {
      p_operation_id: randomUUID(), p_device_id: "integration-device", p_entity: "debt_payments", p_record_id: paymentId,
      p_operation_type: "update", p_base_version: 1, p_changed_fields: ["transaction_id", "linked_transaction_type", "source", "payment_date"],
      p_payload: { transaction_id: transactionId, linked_transaction_type: "expense", linked_source_account_id: accountId, linked_subcategory_id: subcategoryId, source: "transaction", payment_date: "2026-08-21" },
    });
    expect(result.error?.message).toContain("linked transaction amount does not match payment amount");

    const { data: payment } = await owner.client.from("debt_payments").select("transaction_id,amount_centavos").eq("id", paymentId).single();
    const { data: debt } = await owner.client.from("debt_accounts").select("current_balance_centavos").eq("id", debtId).single();
    expect(payment).toEqual({ transaction_id: null, amount_centavos: 1000 });
    expect(debt?.current_balance_centavos).toBe(3000);
  });

  it("preserves archived debt account create operations", async () => {
    const createdId = randomUUID();
    const result = await pushOperations(owner.client, owner.id, "integration-device", [{
      operation_id: randomUUID(), entity: "debt_accounts", record_id: createdId,
      operation_type: "create", base_version: null, changed_fields: [],
      payload: { name: "Archived synced debt", preset_key: "integration", status: "archived", original_balance_centavos: 100, current_balance_centavos: 100 },
    }]);
    expect(result[0]?.status).toBe("applied");
    const { data: debt } = await owner.client.from("debt_accounts").select("status,paid_off_at").eq("id", createdId).single();
    expect(debt).toEqual({ status: "archived", paid_off_at: null });
  });

  it("preserves paid-off debt account create operations and timestamp", async () => {
    const createdId = randomUUID();
    const paidOffAt = "2026-08-21T10:00:00Z";
    const result = await pushOperations(owner.client, owner.id, "integration-device", [{
      operation_id: randomUUID(), entity: "debt_accounts", record_id: createdId,
      operation_type: "create", base_version: null, changed_fields: [],
      payload: { name: "Paid-off synced debt", preset_key: "integration", status: "paid_off", paid_off_at: paidOffAt, original_balance_centavos: 100, current_balance_centavos: 0 },
    }]);
    expect(result[0]?.status).toBe("applied");
    const { data: debt } = await owner.client.from("debt_accounts").select("status,paid_off_at").eq("id", createdId).single();
    expect(debt).toEqual({ status: "paid_off", paid_off_at: paidOffAt.replace("Z", "+00:00") });
  });

  it("archives and unarchives through status sync", async () => {
    const archive = await pushOperations(owner.client, owner.id, "device-a", [{
      operation_id: randomUUID(), entity: "debt_accounts", record_id: debtId,
      operation_type: "update", base_version: 1, changed_fields: ["status", "archived_at"],
      payload: { status: "archived", archived_at: "2026-08-21T10:00:00Z" },
    }]);
    expect(archive[0]?.status).toBe("applied");
    const active = await pushOperations(owner.client, owner.id, "device-b", [{
      operation_id: randomUUID(), entity: "debt_accounts", record_id: debtId,
      operation_type: "update", base_version: 2, changed_fields: ["status", "archived_at"],
      payload: { status: "active", archived_at: null },
    }]);
    expect(active[0]?.status).toBe("applied");
    const { data } = await owner.client.from("debt_accounts").select("status,archived_at").eq("id", debtId).single();
    expect(data).toEqual({ status: "active", archived_at: null });
  });

  it("preserves archived_at when an archived debt is ordinarily edited", async () => {
    const archive = await pushOperations(owner.client, owner.id, "device-a", [{
      operation_id: randomUUID(), entity: "debt_accounts", record_id: debtId,
      operation_type: "update", base_version: 1, changed_fields: ["status"],
      payload: { status: "archived" },
    }]);
    expect(archive[0]?.status).toBe("applied");
    const { data: before } = await owner.client.from("debt_accounts").select("archived_at").eq("id", debtId).single();

    const edit = await pushOperations(owner.client, owner.id, "device-a", [{
      operation_id: randomUUID(), entity: "debt_accounts", record_id: debtId,
      operation_type: "update", base_version: 2, changed_fields: ["name"],
      payload: { name: "Edited archived debt" },
    }]);
    expect(edit[0]?.status).toBe("applied");
    const { data: after } = await owner.client.from("debt_accounts").select("status,archived_at").eq("id", debtId).single();
    expect(after).toEqual({ status: "archived", archived_at: before?.archived_at });
  });

  it("preserves paid_off_at when a paid-off debt is ordinarily edited", async () => {
    const payoff = await owner.client.rpc("apply_debt_sync_operation", {
      p_operation_id: randomUUID(), p_device_id: "device-a", p_entity: "debt_payments", p_record_id: randomUUID(),
      p_operation_type: "create", p_base_version: null, p_changed_fields: [],
      p_payload: { debt_account_id: debtId, transaction_id: null, source: "manual", payment_date: "2026-08-21", amount_centavos: 4000, principal_centavos: 4000 },
    });
    expect(payoff.error).toBeNull();
    const { data: before } = await owner.client.from("debt_accounts").select("paid_off_at").eq("id", debtId).single();

    const edit = await pushOperations(owner.client, owner.id, "device-a", [{
      operation_id: randomUUID(), entity: "debt_accounts", record_id: debtId,
      operation_type: "update", base_version: 2, changed_fields: ["name"],
      payload: { name: "Edited paid-off debt" },
    }]);
    expect(edit[0]?.status).toBe("applied");
    const { data: after } = await owner.client.from("debt_accounts").select("status,paid_off_at").eq("id", debtId).single();
    expect(after).toEqual({ status: "paid_off", paid_off_at: before?.paid_off_at });
  });

  it("rejects paid-off status while the balance is non-zero", async () => {
    const result = await pushOperations(owner.client, owner.id, "device-a", [{
      operation_id: randomUUID(), entity: "debt_accounts", record_id: debtId,
      operation_type: "update", base_version: 1, changed_fields: ["status"],
      payload: { status: "paid_off" },
    }]);
    expect(result[0]?.status).toBe("rejected");
  });

  it("rejects a stale debt strategy update from a second device", async () => {
    const first = await pushOperations(owner.client, owner.id, "device-a", [{
      operation_id: randomUUID(), entity: "debt_strategy_preferences", record_id: owner.id,
      operation_type: "update", base_version: null, changed_fields: ["strategy"], payload: { strategy: "snowball" },
    }]);
    const second = await pushOperations(owner.client, owner.id, "device-b", [{
      operation_id: randomUUID(), entity: "debt_strategy_preferences", record_id: owner.id,
      operation_type: "update", base_version: null, changed_fields: ["strategy"], payload: { strategy: "avalanche" },
    }]);
    expect(first[0]?.status).toBe("applied");
    expect(second[0]).toMatchObject({ status: "conflict", current_version: 1, conflicted_fields: ["strategy"] });
  });

  it("rejects a stale overpayment without changing any balance or payment state", async () => {
    const paymentId = randomUUID();
    const result = await owner.client.rpc("apply_debt_sync_operation", {
      p_operation_id: randomUUID(), p_device_id: "integration-device", p_entity: "debt_payments", p_record_id: paymentId,
      p_operation_type: "create", p_base_version: null, p_changed_fields: [],
      p_payload: { debt_account_id: debtId, transaction_id: null, source: "manual", payment_date: "2026-08-21", amount_centavos: 5000, principal_centavos: 5000 },
    });

    expect(result.error).not.toBeNull();
    const { data: account } = await owner.client.from("financial_accounts").select("current_balance_centavos").eq("id", accountId).single();
    const { data: debt } = await owner.client.from("debt_accounts").select("current_balance_centavos,status,paid_off_at").eq("id", debtId).single();
    const { data: payment } = await owner.client.from("debt_payments").select("id").eq("id", paymentId).maybeSingle();
    expect(account?.current_balance_centavos).toBe(5000);
    expect(debt).toMatchObject({ current_balance_centavos: 4000, status: "active", paid_off_at: null });
    expect(payment).toBeNull();
  });

  it("sets paid_off_at on exact standalone payoff", async () => {
    const result = await owner.client.rpc("apply_debt_sync_operation", {
      p_operation_id: randomUUID(), p_device_id: "integration-device", p_entity: "debt_payments", p_record_id: randomUUID(), p_operation_type: "create", p_base_version: null, p_changed_fields: [],
      p_payload: { debt_account_id: debtId, transaction_id: null, source: "manual", payment_date: "2026-08-21", amount_centavos: 4000, principal_centavos: 4000 },
    });
    expect(result.error).toBeNull();
    const { data: debt } = await owner.client.from("debt_accounts").select("status,paid_off_at").eq("id", debtId).single();
    expect(debt).toMatchObject({ status: "paid_off" });
    expect(debt?.paid_off_at).not.toBeNull();
  });

  it("keeps priority conflicts and payment component checks in the latest wrapper", async () => {
    const priorityId = randomUUID();
    const { error: priorityError } = await owner.client.from("user_debt_priorities").insert({ id: priorityId, user_id: owner.id, debt_account_id: debtId, priority_rank: 1, version: 1 });
    if (priorityError) throw new Error(priorityError.message);
    const conflict = await owner.client.rpc("apply_debt_sync_operation", {
      p_operation_id: randomUUID(), p_device_id: "integration-device", p_entity: "user_debt_priorities", p_record_id: owner.id, p_operation_type: "update", p_base_version: 0, p_changed_fields: ["priorities"], p_payload: { priorities: [debtId] },
    });
    expect(conflict.error).toBeNull();
    expect(conflict.data?.[0]).toMatchObject({ status: "conflict", reason: "debt priority version changed" });
    const invalidPayment = await owner.client.rpc("apply_debt_sync_operation", {
      p_operation_id: randomUUID(), p_device_id: "integration-device", p_entity: "debt_payments", p_record_id: randomUUID(), p_operation_type: "create", p_base_version: null, p_changed_fields: [],
      p_payload: { debt_account_id: debtId, transaction_id: null, source: "manual", payment_date: "2026-08-21", amount_centavos: 100, principal_centavos: 60, interest_centavos: 50 },
    });
    expect(invalidPayment.error?.message).toContain("principal and interest cannot exceed payment amount");
  });

  it("syncs the queued transaction and payment exactly once, including retry", async () => {
    const paymentId = randomUUID();
    const transactionId = randomUUID();
    const operations = [
      {
        operation_id: randomUUID(), entity: "transactions", record_id: transactionId,
        operation_type: "create" as const, base_version: null, changed_fields: [],
        payload: {
          transaction_type: "expense", transaction_date: "2026-08-21", amount_centavos: 1000,
          source_account_id: accountId, subcategory_id: subcategoryId,
          destination_account_id: null, client_mutation_id: `debt-payment:${paymentId}`,
        },
      },
      {
        operation_id: randomUUID(), entity: "debt_payments", record_id: paymentId,
        operation_type: "create" as const, base_version: null, changed_fields: [],
        payload: {
          debt_account_id: debtId, transaction_id: transactionId, linked_transaction_type: "expense",
          linked_source_account_id: accountId, linked_subcategory_id: subcategoryId,
          source: "transaction", payment_date: "2026-08-21", amount_centavos: 1000,
          principal_centavos: 1000,
        },
      },
    ];

    const first = await pushOperations(owner.client, owner.id, "integration-device", operations);
    const retry = await pushOperations(owner.client, owner.id, "integration-device", operations);
    expect(first.map(({ status }) => status)).toEqual(["applied", "applied"]);
    expect(retry.map(({ status }) => status)).toEqual(["duplicate", "duplicate"]);

    const { data: account } = await owner.client.from("financial_accounts").select("current_balance_centavos").eq("id", accountId).single();
    const { data: debt } = await owner.client.from("debt_accounts").select("current_balance_centavos").eq("id", debtId).single();
    const { data: payments } = await owner.client.from("debt_payments").select("id").eq("user_id", owner.id).eq("id", paymentId);
    const { data: transactions } = await owner.client.from("transactions").select("id").eq("user_id", owner.id).eq("id", transactionId);
    expect(account?.current_balance_centavos).toBe(4000);
    expect(debt?.current_balance_centavos).toBe(3000);
    expect(payments).toHaveLength(1);
    expect(transactions).toHaveLength(1);
  });

  it("rejects linked source and subcategory claims without changing balances", async () => {
    const transactionId = randomUUID();
    const paymentId = randomUUID();
    const { error } = await owner.client.from("transactions").insert({
      id: transactionId, user_id: owner.id, transaction_type: "expense", status: "posted",
      entry_source: "offline_sync", transaction_date: "2026-08-21", amount_centavos: 1000,
      subcategory_id: subcategoryId, source_account_id: accountId,
      client_mutation_id: `debt-payment:${paymentId}`, metadata: {},
    });
    if (error) throw new Error(error.message);

    const result = await owner.client.rpc("apply_debt_sync_operation", {
      p_operation_id: randomUUID(), p_device_id: "integration-device", p_entity: "debt_payments",
      p_record_id: paymentId, p_operation_type: "create", p_base_version: null, p_changed_fields: [],
      p_payload: {
        debt_account_id: debtId, transaction_id: transactionId, linked_transaction_type: "expense",
        linked_source_account_id: randomUUID(), linked_subcategory_id: subcategoryId,
        source: "transaction", payment_date: "2026-08-21", amount_centavos: 1000,
        principal_centavos: 1000,
      },
    });
    expect(result.error).not.toBeNull();
    const { data: account } = await owner.client.from("financial_accounts").select("current_balance_centavos").eq("id", accountId).single();
    const { data: debt } = await owner.client.from("debt_accounts").select("current_balance_centavos").eq("id", debtId).single();
    expect(account?.current_balance_centavos).toBe(5000);
    expect(debt?.current_balance_centavos).toBe(4000);
  });

  it("rejects payments for archived debts", async () => {
    await owner.client.from("debt_accounts").update({ status: "archived" }).eq("id", debtId);
    const result = await owner.client.rpc("apply_debt_sync_operation", {
      p_operation_id: randomUUID(), p_device_id: "integration-device", p_entity: "debt_payments", p_record_id: randomUUID(),
      p_operation_type: "create", p_base_version: null, p_changed_fields: [],
      p_payload: { debt_account_id: debtId, transaction_id: randomUUID(), linked_transaction_type: "expense", linked_source_account_id: accountId, linked_subcategory_id: subcategoryId, source: "transaction", payment_date: "2026-08-21", amount_centavos: 1000, principal_centavos: 1000 },
    });
    expect(result.error).not.toBeNull();
  });
});
