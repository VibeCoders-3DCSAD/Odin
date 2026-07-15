import { createClient } from "@supabase/supabase-js";

const LOCAL_API_URL = "http://127.0.0.1:54321";
const LOCAL_SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const serviceRole = createClient(LOCAL_API_URL, LOCAL_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let testUserId: string;

async function ensureLocalSupabase(): Promise<boolean> {
  try {
    const { error } = await serviceRole.rpc("submit_onboarding_session", {
      p_session_id: "00000000-0000-0000-0000-000000000000",
      p_user_id: "00000000-0000-0000-0000-000000000000",
    });
    return error?.message !== "Could not find the function 'public.submit_onboarding_session'";
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
  await serviceRole.from("user_eligibility_profiles").delete().eq("user_id", uid);
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

  await serviceRole.from("user_eligibility_profiles").upsert({
    user_id: uid,
    date_of_birth: "2000-01-01",
    is_filipino: true,
    metro_manila_presence: "lives_in_metro_manila",
    metro_manila_locality_code: "manila",
    primary_employment_classification: "full_time_employee",
    eligibility_confirmed_at: new Date().toISOString(),
  });

  return uid;
}

beforeAll(async () => {
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
    "submit_onboarding_session",
    { p_session_id: session.id, p_user_id: testUserId }
  );

  if (rpcError) throw new Error(`RPC failed: ${rpcError.message}`);

  return result as { assessment_id: string; assignment_id: string; profile_label: string };
}

describe("submit_onboarding_session (integration)", () => {
  it("returns stable_obligated for stable income with low obligations", async () => {
    const result = await submitWithAnswers({
      income_type: "stable",
      monthly_income: 50000,
      monthly_obligations: 5000,
    });
    expect(result.profile_label).toBe("stable_obligated");
  }, 15000);

  it("returns stable_obligated for variable income with high obligations", async () => {
    const result = await submitWithAnswers({
      income_type: "variable",
      monthly_income: 30000,
      monthly_obligations: 12000,
    });
    expect(result.profile_label).toBe("stable_obligated");
  }, 15000);

  it("returns stable_obligated for no income with dependents", async () => {
    const result = await submitWithAnswers({
      income_type: "variable",
      monthly_income: 0,
      monthly_obligations: 0,
      has_dependents: true,
    });
    expect(result.profile_label).toBe("stable_obligated");
  }, 15000);

  it("persists assessment with deterministic_placeholder_v1 model_kind and rule", async () => {
    const result = await submitWithAnswers({
      income_type: "stable",
      monthly_income: 40000,
      monthly_obligations: 8000,
    });

    const { data: assessment, error } = await serviceRole
      .from("financial_profile_assessments")
      .select("model_kind, assessment_method, proposed_profile_label, output_snapshot")
      .eq("id", result.assessment_id)
      .single();

    expect(error).toBeNull();
    expect(assessment!.model_kind).toBe("deterministic_placeholder_v1");
    expect(assessment!.assessment_method).toBe("questionnaire");
    expect(assessment!.proposed_profile_label).toBe("stable_obligated");
    expect(assessment!.output_snapshot).toMatchObject({
      profile_label: "stable_obligated",
      rule: "deterministic_placeholder_v1",
    });
  }, 15000);
});
