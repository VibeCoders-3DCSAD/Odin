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
  validDeviceTokenPayload,
} from "../helpers/fixtures.js";

const mockGetUser = supabase.auth.getUser as jest.Mock;
const mockFrom = supabase.from as jest.Mock;

describe("POST /odin/api/push-device-tokens", () => {
  function mockAuth() {
    mockGetUser.mockResolvedValue({
      data: { user: { id: validUserId } },
      error: null,
    });
  }

  it("returns 200 with token id, device_token, and platform", async () => {
    mockAuth();

    const mockSingle = jest.fn().mockReturnValue({
      data: {
        id: "00000000-0000-0000-0000-000000000020",
        device_token: "fcm-token-abc-123-def-456",
        platform: "android",
      },
      error: null,
    });
    const mockSelect = jest.fn().mockReturnValue({ single: mockSingle });
    const mockUpsert = jest.fn().mockReturnValue({ select: mockSelect });
    mockFrom.mockReturnValue({ upsert: mockUpsert });

    const response = await request(app)
      .post("/odin/api/push-device-tokens")
      .set(authHeader())
      .send(validDeviceTokenPayload());

    expect(response.status).toBe(200);
    expect(response.body.payload.token).toMatchObject({
      id: "00000000-0000-0000-0000-000000000020",
      device_token: "fcm-token-abc-123-def-456",
      platform: "android",
    });
  });

  it("queries the push_device_tokens table", async () => {
    mockAuth();

    const mockSingle = jest.fn().mockReturnValue({
      data: {
        id: "00000000-0000-0000-0000-000000000020",
        device_token: "fcm-token-abc-123-def-456",
        platform: "android",
      },
      error: null,
    });
    const mockSelect = jest.fn().mockReturnValue({ single: mockSingle });
    const mockUpsert = jest.fn().mockReturnValue({ select: mockSelect });
    mockFrom.mockReturnValue({ upsert: mockUpsert });

    await request(app)
      .post("/odin/api/push-device-tokens")
      .set(authHeader())
      .send(validDeviceTokenPayload());

    expect(mockFrom).toHaveBeenCalledWith("push_device_tokens");
  });

  it("passes onConflict: 'user_id, device_token' to the upsert call", async () => {
    mockAuth();

    let upsertOptions: Record<string, unknown> | undefined;
    const mockSingle = jest.fn().mockReturnValue({
      data: {
        id: "00000000-0000-0000-0000-000000000020",
        device_token: "fcm-token-abc-123-def-456",
        platform: "android",
      },
      error: null,
    });
    const mockSelect = jest.fn().mockReturnValue({ single: mockSingle });
    const mockUpsert = jest
      .fn()
      .mockImplementation(
        (_data: Record<string, unknown>, options: Record<string, unknown>) => {
          upsertOptions = options;
          return { select: mockSelect };
        },
      );
    mockFrom.mockReturnValue({ upsert: mockUpsert });

    await request(app)
      .post("/odin/api/push-device-tokens")
      .set(authHeader())
      .send(validDeviceTokenPayload());

    expect(upsertOptions).toEqual({ onConflict: "user_id, device_token" });
  });

  it("includes user_id in the upsert data", async () => {
    mockAuth();

    let upsertData: Record<string, unknown> | undefined;
    const mockSingle = jest.fn().mockReturnValue({
      data: {
        id: "00000000-0000-0000-0000-000000000020",
        device_token: "fcm-token-abc-123-def-456",
        platform: "android",
      },
      error: null,
    });
    const mockSelect = jest.fn().mockReturnValue({ single: mockSingle });
    const mockUpsert = jest.fn().mockImplementation((data: Record<string, unknown>) => {
      upsertData = data;
      return { select: mockSelect };
    });
    mockFrom.mockReturnValue({ upsert: mockUpsert });

    await request(app)
      .post("/odin/api/push-device-tokens")
      .set(authHeader())
      .send(validDeviceTokenPayload());

    expect(upsertData).toHaveProperty("user_id", validUserId);
    expect(upsertData).toHaveProperty("device_token", "fcm-token-abc-123-def-456");
    expect(upsertData).toHaveProperty("platform", "android");
    expect(upsertData).toHaveProperty("is_active", true);
  });

  it("returns 200 when re-registering an existing token (idempotent)", async () => {
    mockAuth();

    const mockSingle = jest.fn().mockReturnValue({
      data: {
        id: "00000000-0000-0000-0000-000000000020",
        device_token: "fcm-token-abc-123-def-456",
        platform: "android",
      },
      error: null,
    });
    const mockSelect = jest.fn().mockReturnValue({ single: mockSingle });
    const mockUpsert = jest.fn().mockReturnValue({ select: mockSelect });
    mockFrom.mockReturnValue({ upsert: mockUpsert });

    const response = await request(app)
      .post("/odin/api/push-device-tokens")
      .set(authHeader())
      .send(validDeviceTokenPayload());

    expect(response.status).toBe(200);
  });

  it("returns 400 when device_token is missing", async () => {
    mockAuth();

    const response = await request(app)
      .post("/odin/api/push-device-tokens")
      .set(authHeader())
      .send({ payload: { platform: "android" } });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      message: expect.stringMatching(/token/i),
    });
  });

  it("returns 400 when device_token is empty", async () => {
    mockAuth();

    const response = await request(app)
      .post("/odin/api/push-device-tokens")
      .set(authHeader())
      .send({ payload: { device_token: "", platform: "android" } });

    expect(response.status).toBe(400);
  });

  it("returns 400 when platform is missing", async () => {
    mockAuth();

    const response = await request(app)
      .post("/odin/api/push-device-tokens")
      .set(authHeader())
      .send({ payload: { device_token: "fcm-token-abc" } });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      message: expect.stringMatching(/platform/i),
    });
  });

  it.each(["ios", "android", "web"])("returns 200 when platform is '%s'", async (platform) => {
    mockAuth();

    const mockSingle = jest.fn().mockReturnValue({
      data: {
        id: "00000000-0000-0000-0000-000000000020",
        device_token: "fcm-token-abc",
        platform,
      },
      error: null,
    });
    const mockSelect = jest.fn().mockReturnValue({ single: mockSingle });
    const mockUpsert = jest.fn().mockReturnValue({ select: mockSelect });
    mockFrom.mockReturnValue({ upsert: mockUpsert });

    const response = await request(app)
      .post("/odin/api/push-device-tokens")
      .set(authHeader())
      .send({ payload: { device_token: "fcm-token-abc", platform } });

    expect(response.status).toBe(200);
  });

  it("returns 400 when platform is invalid", async () => {
    mockAuth();

    const response = await request(app)
      .post("/odin/api/push-device-tokens")
      .set(authHeader())
      .send({ payload: { device_token: "fcm-token-abc", platform: "blackberry" } });

    expect(response.status).toBe(400);
  });

  it("returns 401 when no authorization header", async () => {
    const response = await request(app)
      .post("/odin/api/push-device-tokens")
      .send(validDeviceTokenPayload());

    expect(response.status).toBe(401);
  });

  it("returns 401 when token is invalid", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: "Invalid token" },
    });

    const response = await request(app)
      .post("/odin/api/push-device-tokens")
      .set(authHeader("bad-token"))
      .send(validDeviceTokenPayload());

    expect(response.status).toBe(401);
  });

  it("returns 500 when upsert fails", async () => {
    mockAuth();

    const mockSingle = jest.fn().mockReturnValue({ data: null, error: { message: "Database error" } });
    const mockSelect = jest.fn().mockReturnValue({ single: mockSingle });
    const mockUpsert = jest.fn().mockReturnValue({ select: mockSelect });
    mockFrom.mockReturnValue({ upsert: mockUpsert });

    const response = await request(app)
      .post("/odin/api/push-device-tokens")
      .set(authHeader())
      .send(validDeviceTokenPayload());

    expect(response.status).toBe(500);
  });

  it("returns 500 when getUser succeeds but upsert throws", async () => {
    mockAuth();

    const mockUpsert = jest.fn(() => { throw new Error("DB error"); });
    mockFrom.mockReturnValue({ upsert: mockUpsert });

    const response = await request(app)
      .post("/odin/api/push-device-tokens")
      .set(authHeader())
      .send(validDeviceTokenPayload());

    expect(response.status).toBe(500);
  });
});
