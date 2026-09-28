import { jest } from "@jest/globals";
import request from "supertest";

jest.mock("../../lib/supabase.js", () => {
  const query = {
    select: () => query,
    eq: () => query,
    in: async () => ({ data: [], error: null }),
  };
  const mockClient = { auth: { getUser: jest.fn() }, from: () => query };
  return { supabase: mockClient, createAuthenticatedSupabaseClient: () => mockClient };
});

import app from "../../app.js";
import { supabase } from "../../lib/supabase.js";
import { authHeader, validUserId } from "../helpers/fixtures.js";

const mockGetUser = supabase.auth.getUser as jest.Mock;
const body = { historicalTransactions: [
  { transactionId: "b9df3d82-b64a-4b25-b8aa-dd36f70a42be", date: "2026-06-04", amount: 245.5, category: "food", transactionType: "expense" },
  { transactionId: "a9df3d82-b64a-4b25-b8aa-dd36f70a42be", date: "2026-09-04", amount: 245.5, category: "food", transactionType: "expense" },
] };

describe("POST /odin/api/forecast", () => {
  beforeEach(() => {
    process.env.FORECASTING_ML_BASE_URL = "http://ml.internal";
    process.env.ODIN_TRUSTED_HISTORY_SHARED_SECRET = "test-secret";
    mockGetUser.mockResolvedValue({ data: { user: { id: validUserId } }, error: null });
  });
  afterEach(() => { delete process.env.FORECASTING_ML_BASE_URL; delete process.env.ODIN_TRUSTED_HISTORY_SHARED_SECRET; jest.restoreAllMocks(); });

  it("requires auth and injects the authenticated user into the ML request", async () => {
    const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({ forecasts: [{ category: "food", month: "2026-10", quarter: "2026Q4", amount: 1, user_baseline_amount: 1, hfce_multiplier: 1, hfce_forecast_amount_million_php: 1, explanation: "Personalized food forecast." }], model_version: "hfce-sarima-v4-category-quarterly", status: "SUCCESS" }), { status: 200 }));
    const response = await request(app).post("/odin/api/forecast").set(authHeader()).send(body);
    expect(response.status).toBe(200);
    expect(JSON.parse(String(fetchSpy.mock.calls[0]![1]?.body))).toMatchObject({ user_id: validUserId });
    expect(fetchSpy.mock.calls[0]![1]?.headers).toEqual(expect.objectContaining({
      "X-Odin-User-Id": validUserId,
      "X-Odin-History-Source": "odin_api",
      "X-Odin-History-Signature": expect.any(String),
    }));
    expect((await request(app).post("/odin/api/forecast").send(body)).status).toBe(401);
  });

  it("rejects malformed caller input without contacting ML", async () => {
    const fetchSpy = jest.spyOn(global, "fetch");
    const response = await request(app).post("/odin/api/forecast").set(authHeader()).send({ historicalTransactions: [{ ...body.historicalTransactions[0], amount: 0 }] });
    expect(response.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
