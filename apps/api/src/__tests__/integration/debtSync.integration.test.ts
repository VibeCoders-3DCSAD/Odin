import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const localUrl = "http://127.0.0.1:54321";
const serviceKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
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
    const args = { p_operation_id: operationId, p_device_id: "integration-device", p_entity: "debt_payments", p_record_id: paymentId, p_operation_type: "create", p_base_version: null, p_changed_fields: [], p_payload: { debt_account_id: debtId, transaction_id: transactionId, linked_transaction_type: "expense", linked_source_account_id: accountId, linked_subcategory_id: subcategoryId, source: "transaction", payment_date: "2026-08-21", amount_centavos: 1000, principal_centavos: 1000 } };
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
    expect(account?.current_balance_centavos).toBe(4000);
    expect(debt?.current_balance_centavos).toBe(3000);
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
