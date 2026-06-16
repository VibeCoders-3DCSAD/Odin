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
  authHeader,
  validUpdateMePayload,
} from "../helpers/fixtures.js";

const mockGetUser = supabase.auth.getUser as jest.Mock;
const mockFrom = supabase.from as jest.Mock;

describe("GET /odin/api/me", () => {
  function mockAuth() {
    mockGetUser.mockResolvedValue({
      data: { user: { id: validUserId } },
      error: null,
    });
  }

  it("returns 200 with profile, privacy, and current_profile", async () => {
    mockAuth();

    mockFrom
      .mockReturnValueOnce(createMockQuery({
        data: { display_name: "Juan Dela Cruz", metro_manila_city: "Quezon City" },
        error: null,
      }))
      .mockReturnValueOnce(createMockQuery({
        data: { personalization_enabled: true, notifications_opt_in: true },
        error: null,
      }))
      .mockReturnValueOnce(createMockQuery({
        data: { profile_label: "stable_obligated", confirmed_at: "2026-06-10T00:00:00Z" },
        error: null,
      }));

    const response = await request(app)
      .get("/odin/api/me")
      .set(authHeader());

    expect(response.status).toBe(200);
    expect(response.body.payload).toMatchObject({
      profile: {
        display_name: "Juan Dela Cruz",
        metro_manila_city: "Quezon City",
      },
      privacy_settings: {
        personalization_enabled: true,
        notifications_opt_in: true,
      },
      current_profile: {
        profile_label: "stable_obligated",
        confirmed: true,
      },
    });
  });

  it("returns 200 with null current_profile when no assignment exists", async () => {
    mockAuth();

    mockFrom
      .mockReturnValueOnce(createMockQuery({
        data: { display_name: "Juan", metro_manila_city: null },
        error: null,
      }))
      .mockReturnValueOnce(createMockQuery({
        data: { personalization_enabled: true, notifications_opt_in: false },
        error: null,
      }))
      .mockReturnValueOnce(createMockQuery({
        data: null,
        error: { message: "Not found", code: "PGRST116" },
      }));

    const response = await request(app)
      .get("/odin/api/me")
      .set(authHeader());

    expect(response.status).toBe(200);
    expect(response.body.payload.current_profile).toBeNull();
  });

  it("returns 401 when no authorization header", async () => {
    const response = await request(app).get("/odin/api/me");
    expect(response.status).toBe(401);
  });

  it("returns 401 when token is invalid", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: "Invalid token" },
    });

    const response = await request(app)
      .get("/odin/api/me")
      .set(authHeader("bad-token"));

    expect(response.status).toBe(401);
  });

  it("returns 404 when profile is not found", async () => {
    mockAuth();
    mockFrom.mockReturnValueOnce(createMockQuery({
      data: null,
      error: { message: "Not found", code: "PGRST116" },
    }));

    const response = await request(app)
      .get("/odin/api/me")
      .set(authHeader());

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ error: "Not Found" });
  });

  it("returns 500 when getUser succeeds but profile query throws", async () => {
    mockAuth();

    const mockSingle = jest.fn(() => { throw new Error("DB connection lost"); });
    const mockEq = jest.fn().mockReturnValue({ single: mockSingle });
    const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });
    mockFrom.mockReturnValue({ select: mockSelect });

    const response = await request(app)
      .get("/odin/api/me")
      .set(authHeader());

    expect(response.status).toBe(500);
  });
});

describe("PATCH /odin/api/me", () => {
  function mockAuth() {
    mockGetUser.mockResolvedValue({
      data: { user: { id: validUserId } },
      error: null,
    });
  }

  it("returns 200 with updated profile", async () => {
    mockAuth();

    const mockSingle = jest.fn().mockReturnValue({
      data: { display_name: "Juan Updated", metro_manila_city: "Makati" },
      error: null,
    });
    const mockSelect = jest.fn().mockReturnValue({ single: mockSingle });
    const mockEq = jest.fn().mockReturnValue({ select: mockSelect });
    const mockUpdate = jest.fn().mockReturnValue({ eq: mockEq });
    mockFrom.mockReturnValue({ update: mockUpdate });

    const response = await request(app)
      .patch("/odin/api/me")
      .set(authHeader())
      .send(validUpdateMePayload());

    expect(response.status).toBe(200);
    expect(response.body.payload.profile).toMatchObject({
      display_name: "Juan Updated",
      metro_manila_city: "Makati",
    });
  });

  it("returns 200 with partial update (display_name only)", async () => {
    mockAuth();

    const mockSingle = jest.fn().mockReturnValue({
      data: { display_name: "Just Name", metro_manila_city: null },
      error: null,
    });
    const mockSelect = jest.fn().mockReturnValue({ single: mockSingle });
    const mockEq = jest.fn().mockReturnValue({ select: mockSelect });
    const mockUpdate = jest.fn().mockReturnValue({ eq: mockEq });
    mockFrom.mockReturnValue({ update: mockUpdate });

    const response = await request(app)
      .patch("/odin/api/me")
      .set(authHeader())
      .send({ payload: { display_name: "Just Name" } });

    expect(response.status).toBe(200);
  });

  it("ignores birth_year and occupation fields (not sent to DB)", async () => {
    mockAuth();

    const mockSingle = jest.fn().mockReturnValue({
      data: { display_name: "Juan", metro_manila_city: "Makati" },
      error: null,
    });
    const mockSelect = jest.fn().mockReturnValue({ single: mockSingle });
    const mockEq = jest.fn().mockReturnValue({ select: mockSelect });
    const mockUpdate = jest.fn().mockReturnValue({ eq: mockEq });
    mockFrom.mockReturnValue({ update: mockUpdate });

    await request(app)
      .patch("/odin/api/me")
      .set(authHeader())
      .send({
        payload: {
          display_name: "Juan",
          birth_year: 1996,
          occupation: "Software Engineer",
        },
      });

    const updateArg = mockUpdate.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(updateArg).not.toHaveProperty("birth_year");
    expect(updateArg).not.toHaveProperty("occupation");
    expect(updateArg).toHaveProperty("display_name");
  });

  it("returns 400 when display_name exceeds 100 characters", async () => {
    mockAuth();

    const response = await request(app)
      .patch("/odin/api/me")
      .set(authHeader())
      .send({ payload: { display_name: "A".repeat(101) } });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/display name/i);
  });

  it("returns 400 when display_name is whitespace only", async () => {
    mockAuth();

    const response = await request(app)
      .patch("/odin/api/me")
      .set(authHeader())
      .send({ payload: { display_name: "   " } });

    expect(response.status).toBe(400);
  });

  it("returns 401 when no authorization header", async () => {
    const response = await request(app)
      .patch("/odin/api/me")
      .send(validUpdateMePayload());

    expect(response.status).toBe(401);
  });

  it("returns 401 when token is invalid", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: "Invalid token" },
    });

    const response = await request(app)
      .patch("/odin/api/me")
      .set(authHeader("bad-token"))
      .send(validUpdateMePayload());

    expect(response.status).toBe(401);
  });

  it("returns 404 when profile not found after update", async () => {
    mockAuth();

    const mockSingle = jest.fn().mockReturnValue({ data: null, error: null });
    const mockSelect = jest.fn().mockReturnValue({ single: mockSingle });
    const mockEq = jest.fn().mockReturnValue({ select: mockSelect });
    const mockUpdate = jest.fn().mockReturnValue({ eq: mockEq });
    mockFrom.mockReturnValue({ update: mockUpdate });

    const response = await request(app)
      .patch("/odin/api/me")
      .set(authHeader())
      .send(validUpdateMePayload());

    expect(response.status).toBe(404);
  });

  it("returns 500 when getUser succeeds but update throws", async () => {
    mockAuth();

    const mockUpdate = jest.fn(() => { throw new Error("DB error"); });
    mockFrom.mockReturnValue({ update: mockUpdate });

    const response = await request(app)
      .patch("/odin/api/me")
      .set(authHeader())
      .send(validUpdateMePayload());

    expect(response.status).toBe(500);
  });
});
