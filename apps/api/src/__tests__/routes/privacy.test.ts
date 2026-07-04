import { jest } from "@jest/globals";
import request from "supertest";

jest.mock("../../lib/supabase.js", () => {
  const mockClient = {
    auth: {
      getUser: jest.fn(),
    },
    from: jest.fn(),
  };

  return {
    supabase: mockClient,
    createAuthenticatedSupabaseClient: () => mockClient,
  };
});

import app from "../../app.js";
import { supabase } from "../../lib/supabase.js";
import { authHeader, validAccessToken, validUserId } from "../helpers/fixtures.js";

const mockGetUser = supabase.auth.getUser as jest.Mock;
const mockFrom = supabase.from as jest.Mock;

describe("/odin/api/privacy/settings", () => {
  function mockAuth() {
    mockGetUser.mockResolvedValue({
      data: { user: { id: validUserId } },
      error: null,
    });
  }

  it("returns 200 with privacy settings", async () => {
    mockAuth();

    const mockSingle = jest.fn().mockReturnValue({
      data: {
        personalization_enabled: false,
        model_training_opt_in: true,
        research_evaluation_opt_in: false,
        notifications_opt_in: true,
        data_retention_days: 365,
      },
      error: null,
    });
    const mockEq = jest.fn().mockReturnValue({ single: mockSingle });
    const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });
    mockFrom.mockReturnValue({ select: mockSelect });

    const response = await request(app)
      .get("/odin/api/privacy/settings")
      .set(authHeader());

    expect(response.status).toBe(200);
    expect(response.body.payload).toMatchObject({
      personalization_enabled: false,
      model_training_opt_in: true,
      research_evaluation_opt_in: false,
      notifications_opt_in: true,
      data_retention_days: 365,
    });
  });

  it("returns defaults when privacy settings are missing", async () => {
    mockAuth();

    const mockSingle = jest.fn().mockReturnValue({
      data: null,
      error: { message: "No rows", code: "PGRST116" },
    });
    const mockEq = jest.fn().mockReturnValue({ single: mockSingle });
    const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });
    mockFrom.mockReturnValue({ select: mockSelect });

    const response = await request(app)
      .get("/odin/api/privacy/settings")
      .set(authHeader());

    expect(response.status).toBe(200);
    expect(response.body.payload).toEqual({
      personalization_enabled: true,
      model_training_opt_in: false,
      research_evaluation_opt_in: false,
      notifications_opt_in: false,
      data_retention_days: null,
    });
  });

  it("scopes privacy reads by user_id", async () => {
    mockAuth();

    const mockSingle = jest.fn().mockReturnValue({ data: null, error: { code: "PGRST116" } });
    const mockEq = jest.fn().mockReturnValue({ single: mockSingle });
    const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });
    mockFrom.mockReturnValue({ select: mockSelect });

    await request(app).get("/odin/api/privacy/settings").set(authHeader());

    expect(mockFrom).toHaveBeenCalledWith("user_privacy_settings");
    expect(mockEq).toHaveBeenCalledWith("user_id", validUserId);
  });

  it("updates privacy settings with user_id scoping", async () => {
    mockAuth();

    let upsertData: Record<string, unknown> | undefined;
    let upsertOptions: Record<string, unknown> | undefined;
    const mockSingle = jest.fn().mockReturnValue({
      data: { updated_at: "2026-07-04T12:00:00.000Z" },
      error: null,
    });
    const mockSelect = jest.fn().mockReturnValue({ single: mockSingle });
    const mockUpsert = jest.fn().mockImplementation((data, options) => {
      upsertData = data as Record<string, unknown>;
      upsertOptions = options as Record<string, unknown>;
      return { select: mockSelect };
    });
    mockFrom.mockReturnValue({ upsert: mockUpsert });

    const response = await request(app)
      .patch("/odin/api/privacy/settings")
      .set(authHeader())
      .send({ payload: { personalization_enabled: false, data_retention_days: 90 } });

    expect(response.status).toBe(200);
    expect(response.body.payload.privacy_settings.updated_at).toBe("2026-07-04T12:00:00.000Z");
    expect(upsertData).toMatchObject({
      user_id: validUserId,
      personalization_enabled: false,
      data_retention_days: 90,
    });
    expect(upsertData).toHaveProperty("updated_at");
    expect(upsertOptions).toEqual({ onConflict: "user_id" });
  });

  it.each([
    ["non-boolean flag", { personalization_enabled: "yes" }],
    ["zero retention", { data_retention_days: 0 }],
    ["negative retention", { data_retention_days: -1 }],
    ["unknown field", { dark_mode_enabled: true }],
    ["empty payload", {}],
  ])("returns 400 for %s", async (_label, payload) => {
    mockAuth();

    const response = await request(app)
      .patch("/odin/api/privacy/settings")
      .set(authHeader())
      .send({ payload });

    expect(response.status).toBe(400);
  });

  it.each(["get", "patch"] as const)("returns 401 when %s has no authorization header", async (method) => {
    const requestBuilder = request(app)[method]("/odin/api/privacy/settings");
    const response = method === "patch"
      ? await requestBuilder.send({ payload: { notifications_opt_in: true } })
      : await requestBuilder;

    expect(response.status).toBe(401);
  });

  it("returns 401 when token is invalid", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: "Invalid token" },
    });

    const response = await request(app)
      .get("/odin/api/privacy/settings")
      .set(authHeader("bad-token"));

    expect(response.status).toBe(401);
  });

  it("returns 500 when read fails", async () => {
    mockAuth();

    const mockSingle = jest.fn().mockReturnValue({
      data: null,
      error: { message: "Database error" },
    });
    const mockEq = jest.fn().mockReturnValue({ single: mockSingle });
    const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });
    mockFrom.mockReturnValue({ select: mockSelect });

    const response = await request(app)
      .get("/odin/api/privacy/settings")
      .set(authHeader(validAccessToken));

    expect(response.status).toBe(500);
  });

  it("returns 500 when update fails", async () => {
    mockAuth();

    const mockSingle = jest.fn().mockReturnValue({ data: null, error: { message: "Database error" } });
    const mockSelect = jest.fn().mockReturnValue({ single: mockSingle });
    const mockUpsert = jest.fn().mockReturnValue({ select: mockSelect });
    mockFrom.mockReturnValue({ upsert: mockUpsert });

    const response = await request(app)
      .patch("/odin/api/privacy/settings")
      .set(authHeader())
      .send({ payload: { notifications_opt_in: true } });

    expect(response.status).toBe(500);
  });
});
