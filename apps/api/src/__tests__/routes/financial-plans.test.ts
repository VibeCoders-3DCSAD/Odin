import { jest } from "@jest/globals";
import request from "supertest";

jest.mock("../../lib/supabase.js", () => {
  const client = { auth: { getUser: jest.fn() } };
  return { supabase: client, createAuthenticatedSupabaseClient: () => client };
});
jest.mock("../../services/financialPlan/recommendationService.js", () => ({
  ...jest.requireActual("../../services/financialPlan/recommendationService.js"),
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

  it("passes a selected development month to the recommendation service", async () => {
    const response = await request(app).post("/odin/api/financial-plans/recommendation").set(authHeader()).send({ plannedAmountCentavos: 100_000, planMonth: "2026-11" });
    expect(response.status).toBe(200);
    expect(getFinancialPlanRecommendation).toHaveBeenCalledWith(validUserId, expect.anything(), 100_000, [], [], [], { skipDebtRepayments: false, skipSavingsContributions: false }, "2026-11");
  });

  it.each(["2026-13", "2026-1", "2026-11-01", 202611, null])("rejects an invalid plan month %p", async (planMonth) => {
    const response = await request(app).post("/odin/api/financial-plans/recommendation").set(authHeader()).send({ plannedAmountCentavos: 100_000, planMonth });
    expect(response.status).toBe(422);
    expect(getFinancialPlanRecommendation).not.toHaveBeenCalled();
  });

  it("rejects month overrides in production", async () => {
    jest.replaceProperty(process, "env", { ...process.env, NODE_ENV: "production" });
    const response = await request(app).post("/odin/api/financial-plans/recommendation").set(authHeader()).send({ plannedAmountCentavos: 100_000, planMonth: "2026-11" });
    expect(response.status).toBe(422);
    expect(getFinancialPlanRecommendation).not.toHaveBeenCalled();
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

  it("passes validated commitment budgets and rejects malformed amounts", async () => {
    const commitmentBudgets = [{ key: "debt:loan:2026-10-20", amountCentavos: 7_500 }];
    const response = await request(app).post("/odin/api/financial-plans/recommendation").set(authHeader()).send({ plannedAmountCentavos: 100_000, commitmentBudgets });
    expect(response.status).toBe(200);
    expect(getFinancialPlanRecommendation).toHaveBeenCalledWith(validUserId, expect.anything(), 100_000, [], [], [], { skipDebtRepayments: false, skipSavingsContributions: false, commitmentBudgets });
    for (const amountCentavos of [-1, 1.5, "7500", null]) {
      expect((await request(app).post("/odin/api/financial-plans/recommendation").set(authHeader()).send({ plannedAmountCentavos: 100_000, commitmentBudgets: [{ ...commitmentBudgets[0], amountCentavos }] })).status).toBe(422);
    }
    expect((await request(app).post("/odin/api/financial-plans/commitments").send({})).status).toBe(401);
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

describe("POST /odin/api/financial-plans/explanations", () => {
  const evidence = { planPeriodLabel: "October 2026", surplusCentavos: 0, debtSurplusCentavos: 0, savingsSurplusCentavos: 0, seasonalPreferences: [], forecastChanges: [] };

  beforeEach(() => {
    (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: { id: validUserId } }, error: null });
  });

  it("returns the merged explanations for the authenticated user", async () => {
    const response = await request(app).post("/odin/api/financial-plans/explanations").set(authHeader()).send({ leading: ["Leading notice."], evidence });

    expect(response.status).toBe(200);
    expect(response.body.payload.explanations[0]).toBe("Leading notice.");
    expect((await request(app).post("/odin/api/financial-plans/explanations").send({ leading: [], evidence })).status).toBe(401);
  });

  it("rejects a malformed explanation request", async () => {
    const response = await request(app).post("/odin/api/financial-plans/explanations").set(authHeader()).send({ leading: "Leading notice.", evidence });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({ error: "Unprocessable Entity", message: "Financial Plan explanation request is invalid" });
  });
});
