import { jest } from "@jest/globals";
import request from "supertest";

jest.mock("../../lib/supabase.js", () => {
  const mockClient = { auth: { getUser: jest.fn() } };
  return { supabase: mockClient, createAuthenticatedSupabaseClient: () => mockClient };
});

import app from "../../app.js";
import { supabase } from "../../lib/supabase.js";
import { authHeader, validUserId } from "../helpers/fixtures.js";

const mockGetUser = supabase.auth.getUser as jest.Mock;
const body = { historicalTransactions: [{ transactionId: "b9df3d82-b64a-4b25-b8aa-dd36f70a42be", date: "2026-09-04", amount: 245.5, category: "Essentials", transactionType: "expense" }], forecastHorizon: "MONTHLY", forecastLevel: "TOTAL" };

describe("POST /odin/api/forecast", () => {
  beforeEach(() => {
    process.env.FORECASTING_ML_BASE_URL = "http://ml.internal";
    mockGetUser.mockResolvedValue({ data: { user: { id: validUserId } }, error: null });
  });
  afterEach(() => { delete process.env.FORECASTING_ML_BASE_URL; jest.restoreAllMocks(); });

  it("requires auth and injects the authenticated user into the ML request", async () => {
    const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({ forecasts: [{ date: "next", amount: 1, category: null }], forecast_horizon: "MONTHLY", forecast_level: "TOTAL", confidence_intervals: { lower_80: 1, upper_80: 1, lower_95: 1, upper_95: 1 }, model_version: "v1", status: "SUCCESS" }), { status: 200 }));
    const response = await request(app).post("/odin/api/forecast").set(authHeader()).send(body);
    expect(response.status).toBe(200);
    expect(JSON.parse(String(fetchSpy.mock.calls[0]![1]?.body))).toMatchObject({ user_id: validUserId });
    expect((await request(app).post("/odin/api/forecast").send(body)).status).toBe(401);
  });

  it("rejects malformed caller input without contacting ML", async () => {
    const fetchSpy = jest.spyOn(global, "fetch");
    const response = await request(app).post("/odin/api/forecast").set(authHeader()).send({ ...body, forecastLevel: "CATEGORY" });
    expect(response.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
