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
    const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({ forecasts: [{ category: "food", month: "2026-10", quarter: "2026Q4", amount: 1, user_baseline_amount: 1, hfce_multiplier: 1, hfce_forecast_amount_million_php: 1, explanation: "Personalized food forecast.", baseline_method: "median_monthly", seasonal_uncertainty: true }], snapshot: { month: "2026-10", total_amount: 1, category_forecasts: [{ category: "food", amount: 1 }], model_version: "hfce-sarima-v4-category-quarterly", generated_at: "2026-09-29T00:00:00Z", quality: "PERSONALIZED" }, model_version: "hfce-sarima-v4-category-quarterly", status: "SUCCESS" }), { status: 200 }));
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

  it("returns monthly and four quarterly totals from the quarterly route", async () => {
    jest.useFakeTimers({ doNotFake: ["nextTick", "setImmediate"] }).setSystemTime(new Date("2026-10-18T12:00:00.000Z"));
    const months = ["2026-10", "2026-11", "2026-12", "2027-01", "2027-02", "2027-03", "2027-04", "2027-05", "2027-06", "2027-07", "2027-08", "2027-09"];
    const forecasts = months.map((month) => ({ category: "food", month, quarter: `${month.slice(0, 4)}Q${Math.ceil(Number(month.slice(5)) / 3)}`, amount: 100, user_baseline_amount: 90, hfce_multiplier: 1.1, hfce_forecast_amount_million_php: 1, explanation: "Personalized food forecast.", baseline_method: "median_monthly", seasonal_uncertainty: true }));
    const fetchSpy = jest.spyOn(global, "fetch").mockImplementation(async () => new Response(JSON.stringify({ forecasts, snapshot: { month: "2026-11", total_amount: 100, category_forecasts: [{ category: "food", amount: 100 }], model_version: "hfce-sarima-v4-category-quarterly", generated_at: "2026-10-18T00:00:00Z", quality: "PERSONALIZED" }, model_version: "hfce-sarima-v4-category-quarterly", status: "SUCCESS" }), { status: 200 }));
    const response = await request(app).post("/odin/api/forecast/quarterly").set(authHeader()).send(body);
    jest.useRealTimers();
    expect(response.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(response.body.payload.months).toHaveLength(12);
    expect(response.body.payload.quarters.map((quarter: { quarter: string }) => quarter.quarter)).toEqual(["2026Q4", "2027Q1", "2027Q2", "2027Q3"]);
    expect(response.body.payload.quarters[0].totalCentavos).toBe(30_000);
    expect(response.body.payload).toMatchObject({ quality: "PERSONALIZED", baselineMethod: "median_monthly", seasonalUncertainty: true });
  });

  it("returns the notes unchanged from the interpretation route when Groq is not configured", async () => {
    const apiKey = process.env.GROQ_API_KEY;
    delete process.env.GROQ_API_KEY;
    const notes = ["Your spending will likely stay about the same, around PHP 10,000 every 3 months."];
    const response = await request(app).post("/odin/api/forecast/interpretation").set(authHeader()).send({ notes });
    const invalid = await request(app).post("/odin/api/forecast/interpretation").set(authHeader()).send({ notes: [] });
    if (apiKey === undefined) delete process.env.GROQ_API_KEY; else process.env.GROQ_API_KEY = apiKey;
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ payload: { notes } });
    expect(invalid.status).toBe(400);
    expect((await request(app).post("/odin/api/forecast/interpretation").send({ notes })).status).toBe(401);
  });

  it("returns a no-recent-spending message instead of an error when every category is stale", async () => {
    jest.useFakeTimers({ doNotFake: ["nextTick", "setImmediate"] }).setSystemTime(new Date("2026-10-07T12:00:00.000Z"));
    const fetchSpy = jest.spyOn(global, "fetch");
    const response = await request(app).post("/odin/api/forecast").set(authHeader()).send({ historicalTransactions: [{ ...body.historicalTransactions[0], date: "2026-03-04" }] });
    jest.useRealTimers();
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ payload: null, reason: "NO_RECENT_SPENDING", message: expect.stringContaining("last 6 months") });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects malformed caller input without contacting ML", async () => {
    const fetchSpy = jest.spyOn(global, "fetch");
    const response = await request(app).post("/odin/api/forecast").set(authHeader()).send({ historicalTransactions: [{ ...body.historicalTransactions[0], amount: 0 }] });
    expect(response.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
