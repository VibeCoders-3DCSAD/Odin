import { jest } from "@jest/globals";
import request from "supertest";

jest.mock("../../lib/supabase.js", () => {
  const mockClient = {
    auth: {
      getUser: jest.fn(),
      signOut: jest.fn(),
    },
  };

  return {
    supabase: mockClient,
    createAuthenticatedSupabaseClient: () => mockClient,
  };
});

import app from "../../app.js";
import { supabase } from "../../lib/supabase.js";
import { authHeader } from "../helpers/fixtures.js";

const mockGetUser = supabase.auth.getUser as jest.Mock;
const mockSignOut = supabase.auth.signOut as jest.Mock;

describe("POST /odin/api/auth/logout", () => {
  function mockAuth() {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "00000000-0000-0000-0000-000000000001" } },
      error: null,
    });
  }

  it("returns 200 with logged_out:true when signOut succeeds", async () => {
    mockAuth();
    mockSignOut.mockResolvedValue({ error: null });

    const response = await request(app)
      .post("/odin/api/auth/logout")
      .set(authHeader())
      .send({ payload: { reason: "user_requested" } });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ payload: { logged_out: true } });
  });

  it("returns 200 even without a reason", async () => {
    mockAuth();
    mockSignOut.mockResolvedValue({ error: null });

    const response = await request(app)
      .post("/odin/api/auth/logout")
      .set(authHeader())
      .send({ payload: {} });

    expect(response.status).toBe(200);
  });

  it("returns 500 when Supabase signOut fails", async () => {
    mockAuth();
    mockSignOut.mockResolvedValue({
      error: { message: "Session not found" },
    });

    const response = await request(app)
      .post("/odin/api/auth/logout")
      .set(authHeader())
      .send({ payload: { reason: "user_requested" } });

    expect(response.status).toBe(500);
    expect(response.body).toMatchObject({ error: "Internal Server Error" });
  });

  it("returns 500 when signOut throws", async () => {
    mockAuth();
    mockSignOut.mockRejectedValue(new Error("Supabase unreachable"));

    const response = await request(app)
      .post("/odin/api/auth/logout")
      .set(authHeader())
      .send({ payload: { reason: "user_requested" } });

    expect(response.status).toBe(500);
  });

  it("returns 401 when authorization header is missing", async () => {
    const response = await request(app)
      .post("/odin/api/auth/logout")
      .send({ payload: {} });

    expect(response.status).toBe(401);
  });
});
