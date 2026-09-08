import { createClient } from "@supabase/supabase-js";

const LOCAL_API_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const LOCAL_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "test-key";

const serviceRole = createClient(LOCAL_API_URL, LOCAL_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let testUserId: string;

async function ensureLocalSupabase(): Promise<boolean> {
  try {
    const { error } = await serviceRole.rpc("submit_onboarding_session_with_classification", {
      p_session_id: "00000000-0000-0000-0000-000000000000",
      p_user_id: "00000000-0000-0000-0000-000000000000",
    });
    return error?.message !== "Could not find the function 'public.submit_onboarding_session_with_classification'";
  } catch {
    return false;
  }
}

async function cleanupUser(uid: string) {
  await serviceRole.from("financial_profile_events").delete().eq("user_id", uid);
  await serviceRole.from("financial_profile_explanation_drivers").delete().filter("assessment_id", "in", `(select id from financial_profile_assessments where user_id=eq.${uid})`);
  await serviceRole.from("financial_profile_assignments").delete().eq("user_id", uid);
  await serviceRole.from("financial_profile_assessments").delete().eq("user_id", uid);
  await serviceRole.from("onboarding_sessions").delete().eq("user_id", uid);
  await serviceRole.from("profiles").delete().eq("user_id", uid);
}

async function setupUser(): Promise<string> {
  const email = `odin-test-${Date.now()}@example.com`;
  const { data: user, error } = await serviceRole.auth.admin.createUser({
    email,
    password: "test-password-123",
    email_confirm: true,
  });

  if (error || !user?.user) throw new Error(`Failed to create test user: ${error?.message}`);

  const uid = user.user.id;

  await serviceRole.from("profiles").upsert({ user_id: uid });

  return uid;
}

beforeAll(async () => {
  if (!process.env.RUN_INTEGRATION_TESTS) return;
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for integration tests");
  const available = await ensureLocalSupabase();
  if (!available) {
    throw new Error("Local Supabase not available. Start with: npx supabase start");
  }
});

afterAll(async () => {
  if (testUserId) {
    await cleanupUser(testUserId);
    await serviceRole.auth.admin.deleteUser(testUserId);
  }
});

beforeEach(async () => {
  testUserId = await setupUser();
});

afterEach(async () => {
  if (testUserId) {
    await cleanupUser(testUserId);
    await serviceRole.auth.admin.deleteUser(testUserId);
  }
});

async function submitWithAnswers(answers: Record<string, unknown>) {
  const { data: session, error: sessionError } = await serviceRole
    .from("onboarding_sessions")
    .insert({
      user_id: testUserId,
      status: "in_progress",
      raw_answers: answers,
    })
    .select("id")
    .single();

  if (sessionError || !session) {
    throw new Error(`Failed to create session: ${sessionError?.message}`);
  }

  const { data: result, error: rpcError } = await serviceRole.rpc(
    "submit_onboarding_session_with_classification",
    { p_session_id: session.id, p_user_id: testUserId }
  );

  if (rpcError) throw new Error(`RPC failed: ${rpcError.message}`);

  return result as { assessment_id: string; assignment_id: string; profile_label: string };
}

describe("submit_onboarding_session_with_classification (integration)", () => {
  if (!process.env.RUN_INTEGRATION_TESTS) {
    it.skip("skipped — set RUN_INTEGRATION_TESTS=true to run", () => {});
    return;
  }

  it("uses the questionnaire fallback for stable income, low obligations, and runway", async () => {
    const result = await submitWithAnswers({
      income_pattern: "predictable_income",
      obligation_load: "low",
      emergency_runway: "3_to_6_months",
    });
    expect(result.profile_label).toBe("STABLE_FLEXIBLE_TOLERANT");
  }, 15000);

  it("returns variable obligated at risk for variable income with high obligations", async () => {
    const result = await submitWithAnswers({
      income_pattern: "variable_income",
      obligation_load: "high",
      emergency_runway: "less_than_1_month",
    });
    expect(result.profile_label).toBe("VARIABLE_OBLIGATED_AT_RISK");
  }, 15000);

  it("maps zero-income users without required payments to flexible", async () => {
    const result = await submitWithAnswers({
      income_pattern: "no_current_income",
      obligation_load: "no_income_without_obligations",
      emergency_runway: "1_to_3_months",
    });
    expect(result.profile_label).toBe("VARIABLE_FLEXIBLE_AT_RISK");
  }, 15000);

  it("persists assessment with heuristic_v1 model_kind and rule", async () => {
    const result = await submitWithAnswers({
      income_pattern: "predictable_income",
      obligation_load: "low",
      emergency_runway: "1_to_3_months",
    });

    const { data: assessment, error } = await serviceRole
      .from("financial_profile_assessments")
      .select("model_kind, assessment_method, proposed_profile_label, output_snapshot")
      .eq("id", result.assessment_id)
      .single();

    expect(error).toBeNull();
    expect(assessment!.model_kind).toBe("heuristic_v1");
    expect(assessment!.assessment_method).toBe("questionnaire");
    expect(assessment!.proposed_profile_label).toBe("STABLE_FLEXIBLE_AT_RISK");
    expect(assessment!.output_snapshot).toMatchObject({
      profile_label: "STABLE_FLEXIBLE_AT_RISK",
    });
  }, 15000);
});
