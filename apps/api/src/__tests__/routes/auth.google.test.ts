import { jest } from "@jest/globals";
import request from "supertest";

jest.mock("../../lib/supabase.js", () => {
  const mockClient = {
    auth: {
      signInWithIdToken: jest.fn(),
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
import { createMockQuery } from "../helpers/supabase.js";
import type { MockQueryResult } from "../helpers/supabase.js";
import {
  validAccessToken,
  validProfileId,
  validRefreshToken,
  validUserId,
} from "../helpers/fixtures.js";

const mockSignInWithIdToken = supabase.auth.signInWithIdToken as jest.Mock;
const mockFrom = supabase.from as jest.Mock;
const validGoogleIdToken = "google-id-token-abc-123";

describe("POST /odin/api/auth/google", () => {
  function mockSuccessfulBootstrap() {
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

  function mockSuccessfulGoogleSignIn() {
    mockSignInWithIdToken.mockResolvedValue({
      data: {
        user: { id: validUserId },
        session: {
          access_token: validAccessToken,
          refresh_token: validRefreshToken,
        },
      },
      error: null,
    });
  }

  it("returns 200 with Supabase session and bootstrapped user data", async () => {
    mockSuccessfulGoogleSignIn();
    mockSuccessfulBootstrap();

    const response = await request(app)
      .post("/odin/api/auth/google")
      .send({ payload: { googleIdToken: validGoogleIdToken } });

    expect(response.status).toBe(200);
    expect(mockSignInWithIdToken).toHaveBeenCalledWith({
      provider: "google",
      token: validGoogleIdToken,
    });
    expect(response.body).toEqual({
      payload: {
        session: {
          access_token: validAccessToken,
          refresh_token: validRefreshToken,
        },
        user: { id: validUserId },
        profile: { id: validProfileId },
        onboarding: { status: "in_progress" },
        privacy_settings: { personalization_enabled: true },
      },
    });
  });

  it("returns 400 when Google ID token is missing", async () => {
    const response = await request(app)
      .post("/odin/api/auth/google")
      .send({ payload: {} });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      error: "Bad Request",
      message: expect.stringMatching(/google id token/i),
    });
  });

  it("returns 400 when payload wrapper is missing", async () => {
    const response = await request(app)
      .post("/odin/api/auth/google")
      .send({});

    expect(response.status).toBe(400);
  });

  it("returns 401 when Supabase rejects the Google token", async () => {
    mockSignInWithIdToken.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: "Invalid login credentials", status: 400 },
    });

    const response = await request(app)
      .post("/odin/api/auth/google")
      .send({ payload: { googleIdToken: validGoogleIdToken } });

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ error: "Unauthorized" });
  });

  it("returns 401 when Supabase does not return a session", async () => {
    mockSignInWithIdToken.mockResolvedValue({
      data: { user: { id: validUserId }, session: null },
      error: null,
    });

    const response = await request(app)
      .post("/odin/api/auth/google")
      .send({ payload: { googleIdToken: validGoogleIdToken } });

    expect(response.status).toBe(401);
  });

  it("returns 500 when profile bootstrap fails", async () => {
    mockSuccessfulGoogleSignIn();
    mockFrom.mockReturnValueOnce(
      createMockQuery({ data: null, error: { message: "Insert failed" } }),
    );

    const response = await request(app)
      .post("/odin/api/auth/google")
      .send({ payload: { googleIdToken: validGoogleIdToken } });

    expect(response.status).toBe(500);
    expect(response.body).toMatchObject({
      message: expect.stringMatching(/profile/i),
    });
  });

  it("returns 500 when onboarding query fails", async () => {
    mockSuccessfulGoogleSignIn();
    mockFrom
      .mockReturnValueOnce(createMockQuery({ data: { id: validProfileId }, error: null }))
      .mockReturnValueOnce(
        createMockQuery({ data: { personalization_enabled: true }, error: null }),
      )
      .mockReturnValueOnce(
        createMockQuery({ data: null, error: { message: "DB error" } }),
      );

    const response = await request(app)
      .post("/odin/api/auth/google")
      .send({ payload: { googleIdToken: validGoogleIdToken } });

    expect(response.status).toBe(500);
    expect(response.body).toMatchObject({
      message: expect.stringMatching(/onboarding/i),
    });
  });
});
