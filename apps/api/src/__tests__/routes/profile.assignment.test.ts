import { jest } from "@jest/globals";
import request from "supertest";

jest.mock("../../lib/supabase.js", () => {
  const mockClient = {
    auth: {
      getUser: jest.fn(),
    },
    from: jest.fn(),
    rpc: jest.fn(),
  };

  const mockServiceClient = {
    rpc: jest.fn(),
  };

  return {
    supabase: mockClient,
    getServiceRoleClient: () => mockServiceClient,
    createAuthenticatedSupabaseClient: () => mockClient,
  };
});

import app from "../../app.js";
import { supabase, getServiceRoleClient } from "../../lib/supabase.js";
import { createMockQuery } from "../helpers/supabase.js";
import { validUserId, authHeader } from "../helpers/fixtures.js";

const mockGetUser = supabase.auth.getUser as jest.Mock;
const mockFrom = supabase.from as jest.Mock;
const mockRpc = getServiceRoleClient().rpc as jest.Mock;

function mockAuth(userId = validUserId) {
  mockGetUser.mockResolvedValue({
    data: { user: { id: userId } },
    error: null,
  });
}

const basePath = "/odin/api/profile";

describe("GET /odin/api/profile/assignment/current", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 200 with assignment and drivers when active assignment exists", async () => {
    mockAuth();

    const mockOrder = jest.fn().mockResolvedValue({
      data: [{ driver_key: "income_type", driver_label: "Income Type", value_text: "Stable", impact_label: "primary", explanation: "test", sort_order: 1 }],
      error: null,
    });
    const mockEq = jest.fn().mockReturnValue({ order: mockOrder });
    const mockDriversSelect = jest.fn().mockReturnValue({ eq: mockEq });

    mockFrom
      .mockReturnValueOnce(createMockQuery({
        data: { id: "assign-1", user_id: validUserId, assessment_id: "assess-1", profile_label: "stable_flexible", is_active: true, confirmation_required: true, effective_from: "2026-07-08T00:00:00Z", confirmed_at: null, rejected_at: null, explanation: "test", created_at: "2026-07-08T00:00:00Z" },
        error: null,
      }))
      .mockReturnValueOnce({ select: mockDriversSelect });

    const response = await request(app)
      .get(`${basePath}/assignment/current`)
      .set(authHeader());

    expect(response.status).toBe(200);
    expect(response.body.payload.assignment.profile_label).toBe("stable_flexible");
    expect(response.body.payload.drivers).toHaveLength(1);
  });

  it("returns 200 with null and empty drivers when no active assignment exists", async () => {
    mockAuth();
    mockFrom.mockReturnValueOnce(createMockQuery({ data: null, error: null }));

    const response = await request(app)
      .get(`${basePath}/assignment/current`)
      .set(authHeader());

    expect(response.status).toBe(200);
    expect(response.body.payload.assignment).toBeNull();
    expect(response.body.payload.drivers).toEqual([]);
  });

  it("returns 200 with empty drivers when assignment has no assessment_id", async () => {
    mockAuth();
    mockFrom.mockReturnValueOnce(createMockQuery({
      data: { id: "assign-1", user_id: validUserId, assessment_id: null, profile_label: "stable_flexible", is_active: true, confirmation_required: false },
      error: null,
    }));

    const response = await request(app)
      .get(`${basePath}/assignment/current`)
      .set(authHeader());

    expect(response.status).toBe(200);
    expect(response.body.payload.drivers).toEqual([]);
  });

  it("returns null assignment when no active assignment exists for user", async () => {
    mockAuth();
    mockFrom.mockReturnValueOnce(createMockQuery({ data: null, error: null }));

    const response = await request(app)
      .get(`${basePath}/assignment/current`)
      .set(authHeader());

    expect(response.status).toBe(200);
    expect(response.body.payload.assignment).toBeNull();
    expect(response.body.payload.drivers).toEqual([]);
  });

  it("returns 401 when no authorization header", async () => {
    const response = await request(app).get(`${basePath}/assignment/current`);
    expect(response.status).toBe(401);
  });
});

describe("POST /odin/api/profile/assignment/confirm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const validUuid = "00000000-0000-0000-0000-000000000001";

  it("returns 200 with confirmed assignment", async () => {
    mockAuth();
    mockRpc.mockResolvedValue({
      data: { success: true, assignment_id: validUuid, status: "confirmed" },
      error: null,
    });

    const response = await request(app)
      .post(`${basePath}/assignment/confirm`)
      .set(authHeader())
      .send({ payload: { assignment_id: validUuid, confirmation: true } });

    expect(response.status).toBe(200);
    expect(response.body.payload.status).toBe("confirmed");
  });

  it("returns 404 when assignment does not belong to user", async () => {
    mockAuth();
    mockRpc.mockResolvedValue({
      data: { success: false, code: "not_found" },
      error: null,
    });

    const response = await request(app)
      .post(`${basePath}/assignment/confirm`)
      .set(authHeader())
      .send({ payload: { assignment_id: validUuid, confirmation: true } });

    expect(response.status).toBe(404);
  });

  it("returns 400 when confirmation is not true", async () => {
    mockAuth();

    const response = await request(app)
      .post(`${basePath}/assignment/confirm`)
      .set(authHeader())
      .send({ payload: { assignment_id: validUuid, confirmation: false } });

    expect(response.status).toBe(400);
  });

  it("returns 400 when assignment_id is missing", async () => {
    mockAuth();

    const response = await request(app)
      .post(`${basePath}/assignment/confirm`)
      .set(authHeader())
      .send({ payload: { confirmation: true } });

    expect(response.status).toBe(400);
  });

  it("returns 400 when assignment_id is not a valid UUID", async () => {
    mockAuth();

    const response = await request(app)
      .post(`${basePath}/assignment/confirm`)
      .set(authHeader())
      .send({ payload: { assignment_id: "not-a-uuid", confirmation: true } });

    expect(response.status).toBe(400);
  });

  it("returns 401 when no authorization header", async () => {
    const response = await request(app)
      .post(`${basePath}/assignment/confirm`)
      .send({ payload: { assignment_id: validUuid, confirmation: true } });

    expect(response.status).toBe(401);
  });

  it("returns 500 when rpc fails", async () => {
    mockAuth();
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: "RPC error" },
    });

    const response = await request(app)
      .post(`${basePath}/assignment/confirm`)
      .set(authHeader())
      .send({ payload: { assignment_id: validUuid, confirmation: true } });

    expect(response.status).toBe(500);
  });
});

describe("POST /odin/api/profile/assignment/reject", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const validUuid = "00000000-0000-0000-0000-000000000001";

  it("returns 200 with rejected assignment", async () => {
    mockAuth();
    mockRpc.mockResolvedValue({
      data: { success: true, assignment_id: validUuid, status: "rejected" },
      error: null,
    });

    const response = await request(app)
      .post(`${basePath}/assignment/reject`)
      .set(authHeader())
      .send({ payload: { assignment_id: validUuid, override_reason: "Not a fit" } });

    expect(response.status).toBe(200);
    expect(response.body.payload.status).toBe("rejected");
  });

  it("returns 404 when assignment does not belong to user", async () => {
    mockAuth();
    mockRpc.mockResolvedValue({
      data: { success: false, code: "not_found" },
      error: null,
    });

    const response = await request(app)
      .post(`${basePath}/assignment/reject`)
      .set(authHeader())
      .send({ payload: { assignment_id: validUuid, override_reason: "Not a fit" } });

    expect(response.status).toBe(404);
  });

  it("returns 400 when assignment_id is missing", async () => {
    mockAuth();

    const response = await request(app)
      .post(`${basePath}/assignment/reject`)
      .set(authHeader())
      .send({ payload: { override_reason: "Not a fit" } });

    expect(response.status).toBe(400);
  });

  it("returns 400 when assignment_id is not a valid UUID", async () => {
    mockAuth();

    const response = await request(app)
      .post(`${basePath}/assignment/reject`)
      .set(authHeader())
      .send({ payload: { assignment_id: "bad-id", override_reason: "Not a fit" } });

    expect(response.status).toBe(400);
  });

  it("returns 400 when override_reason is missing", async () => {
    mockAuth();

    const response = await request(app)
      .post(`${basePath}/assignment/reject`)
      .set(authHeader())
      .send({ payload: { assignment_id: validUuid } });

    expect(response.status).toBe(400);
  });

  it("returns 401 when no authorization header", async () => {
    const response = await request(app)
      .post(`${basePath}/assignment/reject`)
      .send({ payload: { assignment_id: validUuid, override_reason: "Not a fit" } });

    expect(response.status).toBe(401);
  });
});

describe("POST /odin/api/profile/assignment/select", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 200 with selected assignment", async () => {
    mockAuth();
    mockRpc.mockResolvedValue({
      data: { success: true, assignment_id: "assign-2", profile_label: "variable_obligated", previous_deactivated: true },
      error: null,
    });

    const response = await request(app)
      .post(`${basePath}/assignment/select`)
      .set(authHeader())
      .send({ payload: { profile_label: "variable_obligated" } });

    expect(response.status).toBe(200);
    expect(response.body.payload.profile_label).toBe("variable_obligated");
  });

  it("returns 400 when profile_label is invalid", async () => {
    mockAuth();

    const response = await request(app)
      .post(`${basePath}/assignment/select`)
      .set(authHeader())
      .send({ payload: { profile_label: "invalid_label" } });

    expect(response.status).toBe(400);
  });

  it("returns 400 when profile_label is missing", async () => {
    mockAuth();

    const response = await request(app)
      .post(`${basePath}/assignment/select`)
      .set(authHeader())
      .send({ payload: {} });

    expect(response.status).toBe(400);
  });

  it("returns 401 when no authorization header", async () => {
    const response = await request(app)
      .post(`${basePath}/assignment/select`)
      .send({ payload: { profile_label: "stable_flexible" } });

    expect(response.status).toBe(401);
  });
});
