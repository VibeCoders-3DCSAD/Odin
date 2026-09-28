import { jest } from "@jest/globals";
import request from "supertest";

jest.mock("../../lib/mlClient.js", () => ({ classifyFinancialCondition: jest.fn() }));
jest.mock("../../lib/supabase.js", () => {
  const client = { auth: { getUser: jest.fn() }, from: jest.fn(), rpc: jest.fn() };
  return { supabase: client, getServiceRoleClient: () => client, createAuthenticatedSupabaseClient: () => client };
});

import app from "../../app.js";
import { classifyFinancialCondition } from "../../lib/mlClient.js";
import { supabase } from "../../lib/supabase.js";
import { authHeader, validUserId } from "../helpers/fixtures.js";

const client = supabase as { auth: { getUser: jest.Mock }; rpc: jest.Mock; from: jest.Mock };
const classify = classifyFinancialCondition as jest.Mock;

describe("POST /odin/api/financial-classification/v2/assess", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    client.auth.getUser.mockResolvedValue({ data: { user: { id: validUserId } }, error: null });
    client.rpc.mockResolvedValue({
      data: { liquid_emergency_savings: 3000, average_monthly_recurring_essential_expenses: 1000, monthly_disposable_income: 10000, required_monthly_debt_payments: 4000, monthly_basic_living_costs: 6000, credit_card_accounts: [] },
      error: null,
    });
    classify.mockResolvedValue({ ok: true, modelVersion: "financial_rules_v1", classification: { emergency_savings: { label: "EMERGENCY_FUND_ADEQUATE" } } });
    client.from.mockReturnValue({ insert: jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue({ single: jest.fn().mockResolvedValue({ data: { id: "assessment-1", assessed_at: "2026-10-18T00:00:00Z", rule_set_version: "financial_rules_v1", output_snapshot: {} }, error: null }) }) }) });
  });

  it("derives the input server-side and persists the rule result", async () => {
    const response = await request(app).post("/odin/api/financial-classification/v2/assess").set(authHeader());
    expect(response.status).toBe(200);
    expect(client.rpc).toHaveBeenCalledWith("get_financial_classification_v2_input", { p_user_id: validUserId });
    expect(classify).toHaveBeenCalledWith(validUserId, expect.objectContaining({ monthly_disposable_income: 10000 }));
    expect(response.body.payload.assessment.id).toBe("assessment-1");
  });
});
