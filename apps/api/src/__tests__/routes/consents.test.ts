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
import { authHeader, validUserId } from "../helpers/fixtures.js";

const mockGetUser = supabase.auth.getUser as jest.Mock;
const mockFrom = supabase.from as jest.Mock;

describe("/odin/api/consents", () => {
  function mockAuth() {
    mockGetUser.mockResolvedValue({
      data: { user: { id: validUserId } },
      error: null,
    });
  }

  it("returns consent history newest first", async () => {
    mockAuth();

    const mockLimit = jest.fn().mockResolvedValue({
      data: [
        {
          consent_kind: "terms",
          status: "granted",
          version: "2026-06",
          recorded_at: "2026-06-12T12:00:00Z",
        },
      ],
      error: null,
    });
    const mockOrder = jest.fn().mockReturnValue({ limit: mockLimit });
    const mockEq = jest.fn().mockReturnValue({ order: mockOrder });
    const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });
    mockFrom.mockReturnValue({ select: mockSelect });

    const response = await request(app)
      .get("/odin/api/consents")
      .set(authHeader());

    expect(response.status).toBe(200);
    expect(response.body.payload.items).toEqual([
      {
        consent_kind: "terms",
        status: "granted",
        version: "2026-06",
        recorded_at: "2026-06-12T12:00:00Z",
      },
    ]);
    expect(mockFrom).toHaveBeenCalledWith("user_consents");
    expect(mockEq).toHaveBeenCalledWith("user_id", validUserId);
    expect(mockOrder).toHaveBeenCalledWith("recorded_at", { ascending: false });
    expect(mockLimit).toHaveBeenCalledWith(20);
  });

  it("filters consent history by consent_kind", async () => {
    mockAuth();

    const consentKindEq = jest.fn().mockReturnValue({
      order: jest.fn().mockReturnValue({
        limit: jest.fn().mockResolvedValue({ data: [], error: null }),
      }),
    });
    const userIdEq = jest.fn().mockReturnValue({ eq: consentKindEq });
    const mockSelect = jest.fn().mockReturnValue({ eq: userIdEq });
    mockFrom.mockReturnValue({ select: mockSelect });

    const response = await request(app)
      .get("/odin/api/consents?consent_kind=personalization")
      .set(authHeader());

    expect(response.status).toBe(200);
    expect(userIdEq).toHaveBeenCalledWith("user_id", validUserId);
    expect(consentKindEq).toHaveBeenCalledWith("consent_kind", "personalization");
  });

  it("records a granted consent with audit metadata", async () => {
    mockAuth();

    let insertData: Record<string, unknown> | undefined;
    const mockSingle = jest.fn().mockReturnValue({
      data: { id: "consent-1", status: "granted" },
      error: null,
    });
    const mockSelect = jest.fn().mockReturnValue({ single: mockSingle });
    const mockInsert = jest.fn().mockImplementation((data) => {
      insertData = data as Record<string, unknown>;
      return { select: mockSelect };
    });
    mockFrom.mockReturnValue({ insert: mockInsert });

    const response = await request(app)
      .post("/odin/api/consents")
      .set(authHeader())
      .send({
        payload: {
          consent_kind: "personalization",
          status: "granted",
          version: "2026-06",
          source: "onboarding",
        },
      });

    expect(response.status).toBe(201);
    expect(response.body.payload.consent).toEqual({ id: "consent-1", status: "granted" });
    expect(insertData).toMatchObject({
      user_id: validUserId,
      consent_kind: "personalization",
      status: "granted",
      version: "2026-06",
      source: "onboarding",
    });
    expect(insertData?.withdrawn_at).toBeNull();
    expect(insertData?.ip_address).toEqual(expect.any(String));
    expect(insertData).toHaveProperty("user_agent");
  });

  it("sets withdrawn_at for withdrawn consent", async () => {
    mockAuth();

    let insertData: Record<string, unknown> | undefined;
    const mockSingle = jest.fn().mockReturnValue({
      data: { id: "consent-2", status: "withdrawn" },
      error: null,
    });
    const mockSelect = jest.fn().mockReturnValue({ single: mockSingle });
    const mockInsert = jest.fn().mockImplementation((data) => {
      insertData = data as Record<string, unknown>;
      return { select: mockSelect };
    });
    mockFrom.mockReturnValue({ insert: mockInsert });

    const response = await request(app)
      .post("/odin/api/consents")
      .set(authHeader())
      .send({
        payload: {
          consent_kind: "notifications",
          status: "withdrawn",
          version: "2026-06",
        },
      });

    expect(response.status).toBe(201);
    expect(insertData?.withdrawn_at).toEqual(expect.any(String));
  });

  it.each([
    "/odin/api/consents?consent_kind=nope",
    "/odin/api/consents",
  ])("returns 401 when auth is missing for %s", async (url) => {
    const method = url.includes("?") ? request(app).get(url) : request(app).post(url).send({
      payload: {
        consent_kind: "terms",
        status: "granted",
        version: "2026-06",
      },
    });
    const response = await method;

    expect(response.status).toBe(401);
  });

  it.each([
    { payload: null },
    { payload: {} },
    { payload: { consent_kind: "wat", status: "granted", version: "2026-06" } },
    { payload: { consent_kind: "terms", status: "wat", version: "2026-06" } },
    { payload: { consent_kind: "terms", status: "granted", version: "   " } },
    { payload: { consent_kind: "terms", status: "granted", version: "2026-06", source: "" } },
  ])("returns 400 for invalid consent payload %#", async (body) => {
    mockAuth();

    const response = await request(app)
      .post("/odin/api/consents")
      .set(authHeader())
      .send(body);

    expect(response.status).toBe(400);
  });

  it("returns 400 for invalid consent_kind filter", async () => {
    mockAuth();

    const response = await request(app)
      .get("/odin/api/consents?consent_kind=wat")
      .set(authHeader());

    expect(response.status).toBe(400);
  });

  it("returns 500 when history lookup fails", async () => {
    mockAuth();

    const mockLimit = jest.fn().mockResolvedValue({
      data: null,
      error: { message: "Database error" },
    });
    const mockOrder = jest.fn().mockReturnValue({ limit: mockLimit });
    const mockEq = jest.fn().mockReturnValue({ order: mockOrder });
    const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });
    mockFrom.mockReturnValue({ select: mockSelect });

    const response = await request(app)
      .get("/odin/api/consents")
      .set(authHeader());

    expect(response.status).toBe(500);
  });

  it("returns 500 when consent insert fails", async () => {
    mockAuth();

    const mockSingle = jest.fn().mockReturnValue({ data: null, error: { message: "Database error" } });
    const mockSelect = jest.fn().mockReturnValue({ single: mockSingle });
    const mockInsert = jest.fn().mockReturnValue({ select: mockSelect });
    mockFrom.mockReturnValue({ insert: mockInsert });

    const response = await request(app)
      .post("/odin/api/consents")
      .set(authHeader())
      .send({
        payload: {
          consent_kind: "terms",
          status: "granted",
          version: "2026-06",
        },
      });

    expect(response.status).toBe(500);
  });
});
