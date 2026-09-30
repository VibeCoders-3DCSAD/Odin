import { jest } from "@jest/globals";
import request from "supertest";

jest.mock("../../lib/supabase.js", () => {
  const client = { auth: { getUser: jest.fn() } };
  return { supabase: client, createAuthenticatedSupabaseClient: () => client };
});
jest.mock("../../services/financialPlan/recommendationService.js", () => ({
  FinancialPlanInputError: class FinancialPlanInputError extends Error {},
  FinancialPlanUnavailableError: class FinancialPlanUnavailableError extends Error {},
  getFinancialPlanRecommendation: jest.fn(),
}));

import app from "../../app.js";
import { supabase } from "../../lib/supabase.js";
import { getFinancialPlanRecommendation } from "../../services/financialPlan/recommendationService.js";
import { authHeader, validUserId } from "../helpers/fixtures.js";

describe("POST /odin/api/financial-plans/recommendation", () => {
  beforeEach(() => {
    (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: { id: validUserId } }, error: null });
    (getFinancialPlanRecommendation as jest.Mock).mockResolvedValue({ status: "RECOMMENDATION_READY", period: { start: "2026-10-01", end: "2026-10-31" } });
  });

  afterEach(() => jest.restoreAllMocks());

  it("requires authentication and derives inputs for the authenticated user", async () => {
    const response = await request(app).post("/odin/api/financial-plans/recommendation").set(authHeader()).send({ periodStart: "2000-01-01" });
    expect(response.status).toBe(200);
    expect(response.body.payload.status).toBe("RECOMMENDATION_READY");
    expect(getFinancialPlanRecommendation).toHaveBeenCalledWith(validUserId, expect.anything());
    expect((await request(app).post("/odin/api/financial-plans/recommendation").send({})).status).toBe(401);
  });

  it("returns a safe validation response when plan inputs are incomplete", async () => {
    const { FinancialPlanInputError } = await import("../../services/financialPlan/recommendationService.js");
    (getFinancialPlanRecommendation as jest.Mock).mockRejectedValue(new FinancialPlanInputError("sensitive source details"));

    const response = await request(app)
      .post("/odin/api/financial-plans/recommendation")
      .set(authHeader())
      .send({});

    expect(response.status).toBe(422);
    expect(response.body).toEqual({ error: "Unprocessable Entity", message: "Financial Plan inputs are incomplete" });
  });
});
