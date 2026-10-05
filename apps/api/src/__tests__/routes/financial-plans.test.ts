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
    const response = await request(app).post("/odin/api/financial-plans/recommendation").set(authHeader()).send({ includedSubcategoryIds: ["groceries", "groceries", "transport"], plannedAmountCentavos: 100_000 });
    expect(response.status).toBe(200);
    expect(response.body.payload.status).toBe("RECOMMENDATION_READY");
    expect(getFinancialPlanRecommendation).toHaveBeenCalledWith(validUserId, expect.anything(), 100_000, ["groceries", "transport"], [], [], { skipDebtRepayments: false, skipSavingsContributions: false });
    expect((await request(app).post("/odin/api/financial-plans/recommendation").send({})).status).toBe(401);
  });

  it("rejects an invalid category selection", async () => {
    const response = await request(app).post("/odin/api/financial-plans/recommendation").set(authHeader()).send({ includedSubcategoryIds: "groceries", plannedAmountCentavos: 100_000 });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({ error: "Unprocessable Entity", message: "Financial Plan inputs are incomplete" });
  });

  it("requires a positive planning amount", async () => {
    const response = await request(app).post("/odin/api/financial-plans/recommendation").set(authHeader()).send({ includedSubcategoryIds: ["groceries"], plannedAmountCentavos: 0 });

    expect(response.status).toBe(422);
    expect(getFinancialPlanRecommendation).not.toHaveBeenCalled();
  });

  it("accepts a one-time amount for a selected new category", async () => {
    const response = await request(app).post("/odin/api/financial-plans/recommendation").set(authHeader()).send({ includedSubcategoryIds: ["pet-care"], plannedAmountCentavos: 100_000, manualAllocations: [{ target: "subcategory", id: "pet-care", amountCentavos: 2_500 }] });

    expect(response.status).toBe(200);
    expect(getFinancialPlanRecommendation).toHaveBeenCalledWith(validUserId, expect.anything(), 100_000, ["pet-care"], [], [{ target: "subcategory", id: "pet-care", amountCentavos: 2_500 }], { skipDebtRepayments: false, skipSavingsContributions: false });
  });

  it("accepts explicit reservation skips", async () => {
    const response = await request(app).post("/odin/api/financial-plans/recommendation").set(authHeader()).send({ includedSubcategoryIds: ["groceries"], plannedAmountCentavos: 100_000, skipDebtRepayments: true, skipSavingsContributions: true });

    expect(response.status).toBe(200);
    expect(getFinancialPlanRecommendation).toHaveBeenCalledWith(validUserId, expect.anything(), 100_000, ["groceries"], [], [], { skipDebtRepayments: true, skipSavingsContributions: true });
  });

  it("rejects invalid one-time category amounts", async () => {
    const response = await request(app).post("/odin/api/financial-plans/recommendation").set(authHeader()).send({ includedSubcategoryIds: ["pet-care"], plannedAmountCentavos: 100_000, manualAllocations: [{ target: "subcategory", id: "pet-care", amountCentavos: 0 }] });

    expect(response.status).toBe(422);
    expect(getFinancialPlanRecommendation).not.toHaveBeenCalled();
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
