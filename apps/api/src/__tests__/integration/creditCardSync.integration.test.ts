import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for integration tests");
const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
type User = { id: string; client: SupabaseClient };

async function user(): Promise<User> {
  const email = `odin-card-${randomUUID()}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({ email, password: "test-password-123", email_confirm: true });
  if (error || !data.user) throw error ?? new Error("user creation failed");
  await admin.from("profiles").upsert({ user_id: data.user.id });
  const signed = await admin.auth.signInWithPassword({ email, password: "test-password-123" });
  if (signed.error || !signed.data.session) throw signed.error ?? new Error("sign-in failed");
  return { id: data.user.id, client: createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false }, global: { headers: { Authorization: `Bearer ${signed.data.session.access_token}` } } }) };
}

describe("credit-card sync RPC", () => {
  let owner: User; let other: User; let accountId: string; let cycleId: string; let operationId: string;
  beforeAll(async () => { owner = await user(); other = await user(); accountId = randomUUID(); cycleId = randomUUID(); const account = await owner.client.from("financial_accounts").insert({ id: accountId, user_id: owner.id, name: "Card", kind: "credit_card", current_balance_centavos: 0, opening_balance_centavos: 0 }).select().single(); if (account.error) throw account.error; });
  afterAll(async () => { await admin.auth.admin.deleteUser(owner.id); await admin.auth.admin.deleteUser(other.id); });

  it("validates shape, ownership, stale updates, and replay identity", async () => {
    operationId = randomUUID();
    const detail = await owner.client.rpc("apply_credit_card_sync_operation", { p_operation_id: operationId, p_device_id: "integration-device", p_entity: "credit_card_details", p_record_id: accountId, p_operation_type: "create", p_base_version: null, p_changed_fields: [], p_payload: { account_id: accountId, credit_limit_centavos: 100000, available_credit_centavos: 95000, default_cutoff_date: "2026-09-15", default_statement_date: "2026-09-20" } });
    expect(detail.error).toBeNull(); expect(detail.data?.[0]?.status).toBe("applied");
    const cycle = await owner.client.rpc("apply_credit_card_sync_operation", { p_operation_id: randomUUID(), p_device_id: "integration-device", p_entity: "credit_card_cycles", p_record_id: cycleId, p_operation_type: "create", p_base_version: null, p_changed_fields: [], p_payload: { account_id: accountId, cycle_start_date: "2026-09-01", cutoff_date: "2026-09-15", statement_date: "2026-09-20" } });
    expect(cycle.error).toBeNull(); expect(cycle.data?.[0]?.status).toBe("applied");
    const paymentId = randomUUID();
    const payment = await owner.client.rpc("apply_credit_card_sync_operation", { p_operation_id: randomUUID(), p_device_id: "integration-device", p_entity: "credit_card_payments", p_record_id: paymentId, p_operation_type: "create", p_base_version: null, p_changed_fields: [], p_payload: { cycle_id: cycleId, amount_centavos: 5000, payment_date: "2026-09-03", issuer_recognized: false } });
    expect(payment.error).toBeNull(); expect(payment.data?.[0]?.status).toBe("applied");
    const beforeRecognition = await owner.client.from("credit_card_details").select("available_credit_centavos").eq("account_id", accountId).single();
    expect(beforeRecognition.data?.available_credit_centavos).toBe(95000);
    const recognized = await owner.client.rpc("apply_credit_card_sync_operation", { p_operation_id: randomUUID(), p_device_id: "integration-device", p_entity: "credit_card_payments", p_record_id: paymentId, p_operation_type: "update", p_base_version: 1, p_changed_fields: ["issuer_recognized"], p_payload: { issuer_recognized: true } });
    expect(recognized.error).toBeNull(); expect(recognized.data?.[0]?.status).toBe("applied");
    const afterRecognition = await owner.client.from("credit_card_details").select("available_credit_centavos").eq("account_id", accountId).single();
    expect(afterRecognition.data?.available_credit_centavos).toBe(100000);
    const stale = await owner.client.rpc("apply_credit_card_sync_operation", { p_operation_id: randomUUID(), p_device_id: "integration-device", p_entity: "credit_card_cycles", p_record_id: cycleId, p_operation_type: "update", p_base_version: 0, p_changed_fields: ["cutoff_date"], p_payload: { cutoff_date: "2026-09-14" } });
    expect(stale.error).toBeNull(); expect(stale.data?.[0]?.status).toBe("conflict");
    const crossUser = await other.client.rpc("apply_credit_card_sync_operation", { p_operation_id: operationId, p_device_id: "integration-device", p_entity: "credit_card_details", p_record_id: accountId, p_operation_type: "create", p_base_version: null, p_changed_fields: [], p_payload: {} });
    expect(crossUser.error).toBeNull(); expect(crossUser.data?.[0]?.status).toBe("rejected");
  });
});
