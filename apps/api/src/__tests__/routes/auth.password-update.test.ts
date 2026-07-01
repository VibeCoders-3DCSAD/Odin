import { jest } from "@jest/globals";
import request from "supertest";

jest.mock("../../lib/supabase.js", () => {
  const mockClient = {
    auth: {
      getUser: jest.fn(),
      updateUser: jest.fn(),
    },
  };

  return {
    supabase: mockClient,
    createAuthenticatedSupabaseClient: () => mockClient,
  };
});

import app from "../../app.js";
import { supabase } from "../../lib/supabase.js";
import {
  validAccessToken,
  validUserId,
  validPasswordUpdatePayload,
  authHeader,
} from "../helpers/fixtures.js";

const mockGetUser = supabase.auth.getUser as jest.Mock;
const mockUpdateUser = supabase.auth.updateUser as jest.Mock;

describe("POST /odin/api/auth/password-update", () => {
  it("returns 200 with updated:true when password update succeeds", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: validUserId } },
      error: null,
    });
    mockUpdateUser.mockResolvedValue({ data: {}, error: null });

    const response = await request(app)
      .post("/odin/api/auth/password-update")
      .set(authHeader())
      .send(validPasswordUpdatePayload());

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ payload: { updated: true } });
    expect(mockUpdateUser).toHaveBeenCalledWith({
      password: "NewStr0ng!Pass",
    });
  });

  it("returns 400 when password is missing", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: validUserId } },
      error: null,
    });

    const response = await request(app)
      .post("/odin/api/auth/password-update")
      .set(authHeader())
      .send({ payload: {} });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      error: "Bad Request",
      message: expect.stringMatching(/password/i),
    });
  });

  it("returns 400 when password is empty", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: validUserId } },
      error: null,
    });

    const response = await request(app)
      .post("/odin/api/auth/password-update")
      .set(authHeader())
      .send({ payload: { password: "" } });

    expect(response.status).toBe(400);
  });

  it("returns 400 when payload wrapper is missing", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: validUserId } },
      error: null,
    });

    const response = await request(app)
      .post("/odin/api/auth/password-update")
      .set(authHeader())
      .send({});

    expect(response.status).toBe(400);
  });

  it("returns 401 when no auth header is provided", async () => {
    const response = await request(app)
      .post("/odin/api/auth/password-update")
      .send(validPasswordUpdatePayload());

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      error: "Unauthorized",
      message: expect.stringMatching(/authorization/i),
    });
  });

  it("returns 401 when token is invalid", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: "Invalid token" },
    });

    const response = await request(app)
      .post("/odin/api/auth/password-update")
      .set(authHeader("invalid-token"))
      .send(validPasswordUpdatePayload());

    expect(response.status).toBe(401);
  });

  it("returns 500 when Supabase update fails", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: validUserId } },
      error: null,
    });
    mockUpdateUser.mockResolvedValue({
      data: {},
      error: { message: "Password too weak" },
    });

    const response = await request(app)
      .post("/odin/api/auth/password-update")
      .set(authHeader())
      .send(validPasswordUpdatePayload());

    expect(response.status).toBe(500);
    expect(response.body).toMatchObject({
      error: "Internal Server Error",
    });
  });

  it("returns 500 when updateUser throws", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: validUserId } },
      error: null,
    });
    mockUpdateUser.mockRejectedValue(new Error("Supabase unreachable"));

    const response = await request(app)
      .post("/odin/api/auth/password-update")
      .set(authHeader())
      .send(validPasswordUpdatePayload());

    expect(response.status).toBe(500);
  });
});
