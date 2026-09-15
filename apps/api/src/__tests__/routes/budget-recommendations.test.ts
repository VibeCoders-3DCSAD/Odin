import { jest } from "@jest/globals";
import request from "supertest";

jest.mock("../../lib/supabase.js", () => {
  const client = { auth: { getUser: jest.fn() } };
  return { supabase: client, createAuthenticatedSupabaseClient: () => client };
});

jest.mock("../../services/budgetRecommendationService.js", () => {
  const actual = jest.requireActual("../../services/budgetRecommendationService.js");
  return { ...actual, getBudgetRecommendation: jest.fn() };
});

import app from "../../app.js";
import { supabase } from "../../lib/supabase.js";
import { getBudgetRecommendation } from "../../services/budgetRecommendationService.js";
import { authHeader, validUserId } from "../helpers/fixtures.js";

const body = { periodKind: "MONTHLY", periodStart: "2026-09-01", periodEnd: "2026-10-01", totalAmountMinor: 10_000, debtBudgetAmountMinor: 2_000, savingsBudgetAmountMinor: 1_000, allocations: [{ categoryId: "category-1", subcategoryId: null, preferredAmountMinor: 5_000 }, { categoryId: null, subcategoryId: "subcategory-1", preferredAmountMinor: 2_000 }] };

describe("POST /odin/api/budget/recommendations", () => {
  beforeEach(() => { process.env.BUDGET_ML_BASE_URL = "http://ml.internal"; (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: { id: validUserId } }, error: null }); });
  afterEach(() => { delete process.env.BUDGET_ML_BASE_URL; jest.restoreAllMocks(); });

  it("requires authentication and injects the authenticated user into ML", async () => {
    (getBudgetRecommendation as jest.Mock).mockResolvedValue({ availableFundsMinor: 7_000, debtBudgetAmountMinor: 2_000, savingsBudgetAmountMinor: 1_000, allocations: [] });
    const response = await request(app).post("/odin/api/budget/recommendations").set(authHeader()).send(body);
    expect(response.status).toBe(200);
    expect(getBudgetRecommendation).toHaveBeenCalledWith(validUserId, expect.objectContaining({ totalAmountMinor: 10_000 }), expect.anything());
    expect((await request(app).post("/odin/api/budget/recommendations").send(body)).status).toBe(401);
  });

  it("rejects malformed caller input without contacting ML", async () => {
    (getBudgetRecommendation as jest.Mock).mockClear();
    expect((await request(app).post("/odin/api/budget/recommendations").set(authHeader()).send({ ...body, historicalTransactions: Array.from({ length: 501 }, () => ({})) })).status).toBe(400);
    expect(getBudgetRecommendation).not.toHaveBeenCalled();
  });
});
