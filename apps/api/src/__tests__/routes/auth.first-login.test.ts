import { jest } from "@jest/globals";
import request from "supertest";

jest.mock("../../lib/supabase.js", () => {
  const mockClient = {
    auth: { getUser: jest.fn() },
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
import { validAccessToken, validUserId } from "../helpers/fixtures.js";

const mockGetUser = supabase.auth.getUser as jest.Mock;
const mockFrom = supabase.from as jest.Mock;

describe("POST /odin/api/auth/first-login-complete", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: validUserId } }, error: null });
  });

  it("returns 200 after updating a matching profile", async () => {
    mockFrom.mockReturnValueOnce(createMockQuery({ data: { user_id: validUserId }, error: null }));

    const response = await request(app)
      .post("/odin/api/auth/first-login-complete")
      .set("Authorization", `Bearer ${validAccessToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ payload: { is_first_logged_in: false } });
  });

  it("rejects a completion when no profile row was updated", async () => {
    mockFrom.mockReturnValueOnce(createMockQuery({ data: null, error: null }));

    const response = await request(app)
      .post("/odin/api/auth/first-login-complete")
      .set("Authorization", `Bearer ${validAccessToken}`);

    expect(response.status).toBe(500);
    expect(response.body.message).toMatch(/first-login/i);
  });
});
