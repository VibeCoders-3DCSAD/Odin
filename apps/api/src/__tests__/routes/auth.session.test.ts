import { jest } from "@jest/globals";
import request from "supertest";

jest.mock("../../lib/supabase.js", () => ({
  supabase: {
    auth: {
      getUser: jest.fn(),
    },
    from: jest.fn(),
  },
}));

import app from "../../app.js";
import { supabase } from "../../lib/supabase.js";
import { createMockQuery } from "../helpers/supabase.js";
import type { MockQueryResult } from "../helpers/supabase.js";
import {
  validUserId,
  validProfileId,
  validRefreshToken,
  authHeader,
} from "../helpers/fixtures.js";

const mockGetUser = supabase.auth.getUser as jest.Mock;
const mockFrom = supabase.from as jest.Mock;

describe("POST /odin/api/auth/session", () => {
  function mockSuccess() {
    mockGetUser.mockResolvedValue({
      data: { user: { id: validUserId } },
      error: null,
    });

    const profileResult: MockQueryResult = {
      data: { id: validProfileId },
      error: null,
    };
    const privacyResult: MockQueryResult = {
      data: { personalization_enabled: true },
      error: null,
    };
    const onboardingResult: MockQueryResult = {
      data: { status: "in_progress" },
      error: null,
    };

    mockFrom
      .mockReturnValueOnce(createMockQuery(profileResult))
      .mockReturnValueOnce(createMockQuery(privacyResult))
      .mockReturnValueOnce(createMockQuery(onboardingResult));
  }

  it("returns 200 with user, profile, onboarding, and privacy", async () => {
    mockSuccess();

    const response = await request(app)
      .post("/odin/api/auth/session")
      .set(authHeader())
      .send({ payload: { refresh_token: validRefreshToken } });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      payload: {
        user: { id: validUserId },
        profile: { id: validProfileId },
        onboarding: { status: "in_progress" },
        privacy_settings: { personalization_enabled: true },
      },
    });
  });

  it("returns 200 and bootstraps profile when it does not exist", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: validUserId } },
      error: null,
    });

    const newProfileResult = { id: validProfileId };
    const privacyResult = { personalization_enabled: true };
    const onboardingResult = { status: "in_progress" };

    mockFrom
      .mockReturnValueOnce(createMockQuery({ data: null, error: null }))
      .mockReturnValueOnce(createMockQuery({ data: newProfileResult, error: null }))
      .mockReturnValueOnce(createMockQuery({ data: privacyResult, error: null }))
      .mockReturnValueOnce(createMockQuery({ data: onboardingResult, error: null }));

    const response = await request(app)
      .post("/odin/api/auth/session")
      .set(authHeader())
      .send({ payload: { refresh_token: validRefreshToken } });

    expect(response.status).toBe(200);
    expect(response.body.payload.profile.id).toBe(validProfileId);
    expect(mockFrom).toHaveBeenNthCalledWith(1, "profiles");
    expect(mockFrom).toHaveBeenNthCalledWith(2, "profiles");
  });

  it("returns 200 and bootstraps privacy settings when they do not exist", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: validUserId } },
      error: null,
    });

    const profileResult = { id: validProfileId };
    const newPrivacyResult = { personalization_enabled: true };
    const onboardingResult = { status: "in_progress" };

    mockFrom
      .mockReturnValueOnce(createMockQuery({ data: profileResult, error: null }))
      .mockReturnValueOnce(createMockQuery({ data: null, error: null }))
      .mockReturnValueOnce(createMockQuery({ data: newPrivacyResult, error: null }))
      .mockReturnValueOnce(createMockQuery({ data: onboardingResult, error: null }));

    const response = await request(app)
      .post("/odin/api/auth/session")
      .set(authHeader())
      .send({ payload: { refresh_token: validRefreshToken } });

    expect(response.status).toBe(200);
    expect(response.body.payload.privacy_settings.personalization_enabled).toBe(true);
  });

  it("returns 200 with default onboarding when no onboarding row exists", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: validUserId } },
      error: null,
    });

    mockFrom
      .mockReturnValueOnce(createMockQuery({ data: { id: validProfileId }, error: null }))
      .mockReturnValueOnce(createMockQuery({ data: { personalization_enabled: true }, error: null }))
      .mockReturnValueOnce(createMockQuery({ data: null, error: null }));

    const response = await request(app)
      .post("/odin/api/auth/session")
      .set(authHeader())
      .send({ payload: { refresh_token: validRefreshToken } });

    expect(response.status).toBe(200);
    expect(response.body.payload.onboarding.status).toBe("in_progress");
  });

  it("returns 500 when profile creation fails", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: validUserId } },
      error: null,
    });

    mockFrom
      .mockReturnValueOnce(createMockQuery({ data: null, error: null }))
      .mockReturnValueOnce(createMockQuery({ data: null, error: { message: "Insert failed" } }));

    const response = await request(app)
      .post("/odin/api/auth/session")
      .set(authHeader())
      .send({ payload: {} });

    expect(response.status).toBe(500);
    expect(response.body).toMatchObject({
      message: expect.stringMatching(/bootstrap/i),
    });
  });

  it("returns 400 when authorization header is missing", async () => {
    const response = await request(app)
      .post("/odin/api/auth/session")
      .send({ payload: {} });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      message: expect.stringMatching(/authorization/i),
    });
  });

  it("returns 400 when authorization is not Bearer", async () => {
    const response = await request(app)
      .post("/odin/api/auth/session")
      .set({ authorization: "Basic dXNlcjpwYXNz" })
      .send({ payload: {} });

    expect(response.status).toBe(400);
  });

  it("returns 400 when token is empty after Bearer", async () => {
    const response = await request(app)
      .post("/odin/api/auth/session")
      .set({ authorization: "Bearer " })
      .send({ payload: {} });

    expect(response.status).toBe(400);
  });

  it("returns 401 when token is invalid", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: "Invalid token" },
    });

    const response = await request(app)
      .post("/odin/api/auth/session")
      .set(authHeader("invalid-token"))
      .send({ payload: {} });

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ error: "Unauthorized" });
  });

  it("returns 500 when getUser throws", async () => {
    mockGetUser.mockRejectedValue(new Error("Supabase unreachable"));

    const response = await request(app)
      .post("/odin/api/auth/session")
      .set(authHeader())
      .send({ payload: {} });

    expect(response.status).toBe(500);
  });

  it("returns 500 when getUser succeeds but profile query throws", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: validUserId } },
      error: null,
    });

    const mockMaybeSingle = jest.fn(() => { throw new Error("DB connection lost"); });
    const mockEq = jest.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
    const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });
    mockFrom.mockReturnValue({ select: mockSelect });

    const response = await request(app)
      .post("/odin/api/auth/session")
      .set(authHeader())
      .send({ payload: {} });

    expect(response.status).toBe(500);
  });
});
