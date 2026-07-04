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

describe("POST /odin/api/data-export-requests", () => {
  function mockAuth() {
    mockGetUser.mockResolvedValue({
      data: { user: { id: validUserId } },
      error: null,
    });
  }

  it("creates a data export request", async () => {
    mockAuth();

    const requestId = "00000000-0000-0000-0000-000000000020";
    const mockSingle = jest.fn().mockReturnValue({
      data: { id: requestId, status: "requested" },
      error: null,
    });
    const mockSelect = jest.fn().mockReturnValue({ single: mockSingle });
    const mockInsert = jest.fn().mockReturnValue({ select: mockSelect });
    mockFrom.mockReturnValue({ insert: mockInsert });

    const response = await request(app)
      .post("/odin/api/data-export-requests")
      .set(authHeader())
      .send({ payload: { format: "json", reason: "user_request" } });

    expect(response.status).toBe(201);
    expect(response.body.payload.request).toEqual({
      id: requestId,
      status: "requested",
    });
  });

  it("creates a minimal export request without optional fields", async () => {
    mockAuth();

    const requestId = "00000000-0000-0000-0000-000000000021";
    const mockSingle = jest.fn().mockReturnValue({
      data: { id: requestId, status: "requested" },
      error: null,
    });
    const mockSelect = jest.fn().mockReturnValue({ single: mockSingle });
    const mockInsert = jest.fn().mockReturnValue({ select: mockSelect });
    mockFrom.mockReturnValue({ insert: mockInsert });

    const response = await request(app)
      .post("/odin/api/data-export-requests")
      .set(authHeader())
      .send({ payload: {} });

    expect(response.status).toBe(201);
  });

  it("scopes creation by user_id", async () => {
    mockAuth();

    let insertData: Record<string, unknown> | undefined;
    const mockSingle = jest.fn().mockReturnValue({
      data: { id: "id", status: "requested" },
      error: null,
    });
    const mockSelect = jest.fn().mockReturnValue({ single: mockSingle });
    const mockInsert = jest.fn().mockImplementation((data) => {
      insertData = data as Record<string, unknown>;
      return { select: mockSelect };
    });
    mockFrom.mockReturnValue({ insert: mockInsert });

    await request(app)
      .post("/odin/api/data-export-requests")
      .set(authHeader())
      .send({ payload: {} });

    expect(insertData).toMatchObject({ user_id: validUserId });
  });

  it("returns 400 for missing payload", async () => {
    mockAuth();

    const response = await request(app)
      .post("/odin/api/data-export-requests")
      .set(authHeader())
      .send({});

    expect(response.status).toBe(400);
  });

  it("returns 400 for invalid format", async () => {
    mockAuth();

    const response = await request(app)
      .post("/odin/api/data-export-requests")
      .set(authHeader())
      .send({ payload: { format: "xml" } });

    expect(response.status).toBe(400);
  });

  it("returns 400 for non-string reason", async () => {
    mockAuth();

    const response = await request(app)
      .post("/odin/api/data-export-requests")
      .set(authHeader())
      .send({ payload: { reason: 123 } });

    expect(response.status).toBe(400);
  });

  it("returns 401 without authorization header", async () => {
    const response = await request(app)
      .post("/odin/api/data-export-requests")
      .send({ payload: {} });

    expect(response.status).toBe(401);
  });

  it("returns 401 with invalid token", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: "Invalid token" },
    });

    const response = await request(app)
      .post("/odin/api/data-export-requests")
      .set(authHeader("bad-token"))
      .send({ payload: {} });

    expect(response.status).toBe(401);
  });

  it("returns 500 when database insert fails", async () => {
    mockAuth();

    const mockSingle = jest.fn().mockReturnValue({
      data: null,
      error: { message: "Database error" },
    });
    const mockSelect = jest.fn().mockReturnValue({ single: mockSingle });
    const mockInsert = jest.fn().mockReturnValue({ select: mockSelect });
    mockFrom.mockReturnValue({ insert: mockInsert });

    const response = await request(app)
      .post("/odin/api/data-export-requests")
      .set(authHeader())
      .send({ payload: {} });

    expect(response.status).toBe(500);
  });
});
