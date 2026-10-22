import { jest } from "@jest/globals";
import request from "supertest";

jest.mock("../../lib/supabase.js", () => {
  const client = { auth: { getUser: jest.fn() }, from: jest.fn(), rpc: jest.fn() };
  return { supabase: client, createAuthenticatedSupabaseClient: () => client };
});

import app from "../../app.js";
import { supabase } from "../../lib/supabase.js";
import { createMockQuery } from "../helpers/supabase.js";
import { validUserId, authHeader } from "../helpers/fixtures.js";

const mockFrom = supabase.from as jest.Mock;
const mockGetUser = supabase.auth.getUser as jest.Mock;
const path = "/odin/api/onboarding/preferences";

beforeEach(() => {
  jest.clearAllMocks();
  mockGetUser.mockResolvedValue({ data: { user: { id: validUserId } }, error: null });
});

it("returns only seasonal answers from the latest submitted questionnaire owned by the user", async () => {
  const event = { id: "custom_tuition", name: "Tuition payment", months: [1, 8] };
  const expected = { high_expense_seasons: ["christmas_ber_months", event.id], low_expense_seasons: ["summer"], saving_seasons: ["none"], custom_seasonal_events: [event] };
  const query = createMockQuery({ data: { submitted_at: "2026-10-22T00:00:00Z", raw_answers: { ...expected, monthly_income: "50000", monthly_debt_payment_percentage: "25", monthly_essential_living_costs: "10000", emergency_savings_runway: "2_months", credit_card_revolving_months: "4", display_name: "Juan", unrelated_field: "private" } }, error: null });
  mockFrom.mockReturnValue(query);
  const response = await request(app).get(path).set(authHeader());
  expect(response.status).toBe(200);
  expect(response.body.payload).toEqual({ preferences: expected, submitted_at: "2026-10-22T00:00:00Z" });
  expect(query.eq).toHaveBeenCalledWith("user_id", validUserId);
  expect(query.eq).toHaveBeenCalledWith("status", "submitted");
  expect(query.order).toHaveBeenCalledWith("submitted_at", { ascending: false });
  expect(query.limit).toHaveBeenCalledWith(1);
});

it("returns a distinct empty state before the first submitted questionnaire", async () => {
  mockFrom.mockReturnValue(createMockQuery({ data: null, error: null }));
  const response = await request(app).get(path).set(authHeader());
  expect(response.status).toBe(200);
  expect(response.body.payload).toEqual({ preferences: null, submitted_at: null });
});

it("preserves legacy quarter selections and omits dangling custom references", async () => {
  mockFrom.mockReturnValue(createMockQuery({ data: { submitted_at: null, raw_answers: { high_expense_seasons: ["q4", "custom_missing", "q4"], saving_seasons: ["q1"] } }, error: null }));
  const response = await request(app).get(path).set(authHeader());
  expect(response.body.payload.preferences).toEqual({ high_expense_seasons: ["q4"], low_expense_seasons: [], saving_seasons: ["q1"], custom_seasonal_events: [] });
});

it("requires authentication before reading any saved answers", async () => {
  const response = await request(app).get(path);
  expect(response.status).toBe(401);
  expect(mockFrom).not.toHaveBeenCalled();
});

it("reports a fetch failure without exposing the database error", async () => {
  mockFrom.mockReturnValue(createMockQuery({ data: null, error: { message: "private database detail" } }));
  const response = await request(app).get(path).set(authHeader());
  expect(response.status).toBe(500);
  expect(response.body.message).toBe("Unable to load saved seasonal preferences.");
  expect(JSON.stringify(response.body)).not.toContain("private database detail");
});

const editablePreferences = {
  high_expense_seasons: ["christmas_ber_months"], low_expense_seasons: ["summer"], saving_seasons: ["custom_school"],
  custom_seasonal_events: [{ id: "custom_school", name: " Tuition   payment ", months: [8, 1] }],
};

it("saves only seasonal fields while preserving the name and classification answers", async () => {
  const previous = { display_name: "Juan", monthly_income: "50000", emergency_savings_runway: "2_months", monthly_debt_payment_percentage: "25", monthly_essential_living_costs: "10000", paying_off_debt: "true", credit_card_revolving_months: "4", high_expense_seasons: ["summer"] };
  const normalized = { ...editablePreferences, custom_seasonal_events: [{ id: "custom_school", name: "Tuition payment", months: [1, 8] }] };
  const lookup = createMockQuery({ data: { id: "owned-session", raw_answers: previous }, error: null });
  const update = createMockQuery({ data: { raw_answers: { ...previous, ...normalized }, submitted_at: "2026-10-22T00:00:00Z" }, error: null });
  mockFrom.mockReturnValueOnce(lookup).mockReturnValueOnce(update);
  const response = await request(app).patch(path).set(authHeader()).send({ payload: { preferences: editablePreferences } });
  expect(response.status).toBe(200);
  expect(update.update).toHaveBeenCalledWith({ raw_answers: { ...previous, ...normalized } });
  expect(lookup.eq).toHaveBeenCalledWith("user_id", validUserId);
  expect(lookup.eq).toHaveBeenCalledWith("status", "submitted");
  expect(update.eq).toHaveBeenCalledWith("id", "owned-session");
  expect(update.eq).toHaveBeenCalledWith("user_id", validUserId);
  expect(update.eq).toHaveBeenCalledWith("status", "submitted");
  expect(response.body.payload).toEqual({ preferences: normalized, submitted_at: "2026-10-22T00:00:00Z" });
});

it.each([
  { ...editablePreferences, display_name: "Changed" },
  { ...editablePreferences, monthly_income: "1" },
  { ...editablePreferences, user_id: "other-user" },
  { ...editablePreferences, high_expense_seasons: [] },
  { ...editablePreferences, low_expense_seasons: ["christmas_ber_months"] },
  { ...editablePreferences, saving_seasons: ["none", "summer"] },
  { ...editablePreferences, saving_seasons: ["custom_missing"] },
  { ...editablePreferences, low_expense_seasons: "summer" },
  { ...editablePreferences, custom_seasonal_events: [{ id: "custom_school", name: "Tuition", months: [] }] },
])("rejects invalid edits and attempts to change non-preference fields: %j", async (preferences) => {
  const response = await request(app).patch(path).set(authHeader()).send({ payload: { preferences } });
  expect(response.status).toBe(400);
  expect(mockFrom).not.toHaveBeenCalled();
});

it("rejects extra fields outside the preferences object", async () => {
  const response = await request(app).patch(path).set(authHeader()).send({ payload: { preferences: editablePreferences, raw_answers: { monthly_income: "1" } } });
  expect(response.status).toBe(400);
  expect(mockFrom).not.toHaveBeenCalled();
});

it("cannot save without authentication", async () => {
  const response = await request(app).patch(path).send({ payload: { preferences: editablePreferences } });
  expect(response.status).toBe(401);
  expect(mockFrom).not.toHaveBeenCalled();
});

it("does not create a questionnaire implicitly when no submitted session exists", async () => {
  mockFrom.mockReturnValue(createMockQuery({ data: null, error: null }));
  const response = await request(app).patch(path).set(authHeader()).send({ payload: { preferences: editablePreferences } });
  expect(response.status).toBe(404);
  expect(mockFrom).toHaveBeenCalledTimes(1);
});

it("reports a write failure and does not return submitted values as saved", async () => {
  mockFrom.mockReturnValueOnce(createMockQuery({ data: { id: "owned-session", raw_answers: { monthly_income: "50000" } }, error: null }))
    .mockReturnValueOnce(createMockQuery({ data: null, error: { message: "private database details" } }));
  const response = await request(app).patch(path).set(authHeader()).send({ payload: { preferences: editablePreferences } });
  expect(response.status).toBe(500);
  expect(response.body.payload).toBeUndefined();
  expect(response.body.message).not.toContain("private database details");
});
