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
import type { MockQueryResult } from "../helpers/supabase.js";
import {
  validUserId,
  authHeader,
} from "../helpers/fixtures.js";
import { ONBOARDING_ERRORS } from "../../lib/constants.js";

const mockGetUser = supabase.auth.getUser as jest.Mock;
const mockFrom = supabase.from as jest.Mock;
const mockRpc = getServiceRoleClient().rpc as jest.Mock;

function mockAuth() {
  mockGetUser.mockResolvedValue({
    data: { user: { id: validUserId } },
    error: null,
  });
}

function mockInProgressSession() {
  mockFrom.mockReturnValueOnce(createMockQuery({
    data: {
      id: "session-1",
      status: "in_progress",
      raw_answers: { income_type: "stable", monthly_income: "50000", monthly_obligations: "5000" },
    },
    error: null,
  }));
}

function mockRpcSuccess(overrides: Record<string, unknown> = {}) {
  mockRpc.mockResolvedValue({
    data: {
      assessment_id: "assess-1",
      assignment_id: "assign-1",
      profile_label: "stable_obligated",
      ...overrides,
    },
    error: null,
  });
}

const basePath = "/odin/api/onboarding";

describe("POST /odin/api/onboarding/sessions/:id/submit", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const sessionId = "session-1";

  it("returns 200 with assessment and assignment on successful submit", async () => {
    mockAuth();
    mockInProgressSession();
    mockRpcSuccess();

    const response = await request(app)
      .post(`${basePath}/sessions/${sessionId}/submit`)
      .set(authHeader())
      .send({ payload: { confirm_data_use: true } });

    expect(response.status).toBe(200);
    expect(response.body.payload).toMatchObject({
      session: { id: sessionId, status: "submitted" },
      assessment: { id: "assess-1", proposed_profile_label: "stable_obligated" },
      assignment: { id: "assign-1", profile_label: "stable_obligated", confirmation_required: true },
    });
  });

  it("returns stable_obligated regardless of income type in answers", async () => {
    mockAuth();
    mockInProgressSession();
    mockRpcSuccess();

    const response = await request(app)
      .post(`${basePath}/sessions/${sessionId}/submit`)
      .set(authHeader())
      .send({ payload: { confirm_data_use: true } });

    expect(response.status).toBe(200);
    expect(response.body.payload.assessment.proposed_profile_label).toBe("stable_obligated");
    expect(response.body.payload.assignment.profile_label).toBe("stable_obligated");
  });

  it("returns 400 when confirm_data_use is missing", async () => {
    mockAuth();

    const response = await request(app)
      .post(`${basePath}/sessions/${sessionId}/submit`)
      .set(authHeader())
      .send({ payload: {} });

    expect(response.status).toBe(400);
  });

  it("returns 400 when confirm_data_use is false", async () => {
    mockAuth();

    const response = await request(app)
      .post(`${basePath}/sessions/${sessionId}/submit`)
      .set(authHeader())
      .send({ payload: { confirm_data_use: false } });

    expect(response.status).toBe(400);
  });

  it("returns 404 when session does not exist", async () => {
    mockAuth();

    mockFrom.mockReturnValueOnce(createMockQuery({ data: null, error: null }));

    const response = await request(app)
      .post(`${basePath}/sessions/${sessionId}/submit`)
      .set(authHeader())
      .send({ payload: { confirm_data_use: true } });

    expect(response.status).toBe(404);
  });

  it("returns 409 when session is not in_progress", async () => {
    mockAuth();

    mockFrom.mockReturnValueOnce(createMockQuery({
      data: { id: sessionId, status: "submitted" },
      error: null,
    }));

    const response = await request(app)
      .post(`${basePath}/sessions/${sessionId}/submit`)
      .set(authHeader())
      .send({ payload: { confirm_data_use: true } });

    expect(response.status).toBe(409);
  });

  it("returns 404 when session belongs to another user", async () => {
    mockAuth();

    mockFrom.mockReturnValueOnce(createMockQuery({ data: null, error: null }));

    const response = await request(app)
      .post(`${basePath}/sessions/${sessionId}/submit`)
      .set(authHeader())
      .send({ payload: { confirm_data_use: true } });

    expect(response.status).toBe(404);
    expect(response.body.message).toBe(ONBOARDING_ERRORS.session_not_found);
  });

  it("returns 401 when no authorization header", async () => {
    const response = await request(app)
      .post(`${basePath}/sessions/${sessionId}/submit`)
      .send({ payload: { confirm_data_use: true } });

    expect(response.status).toBe(401);
  });

  it("calls rpc with session_id and user_id", async () => {
    mockAuth();
    mockInProgressSession();
    mockRpcSuccess();

    await request(app)
      .post(`${basePath}/sessions/${sessionId}/submit`)
      .set(authHeader())
      .send({ payload: { confirm_data_use: true } });

    expect(mockRpc).toHaveBeenCalledWith("submit_onboarding_session", {
      p_session_id: sessionId,
      p_user_id: validUserId,
    });
  });

  it("returns 500 when session fetch fails", async () => {
    mockAuth();

    mockFrom.mockReturnValueOnce(createMockQuery({
      data: null,
      error: { message: "DB error" },
    }));

    const response = await request(app)
      .post(`${basePath}/sessions/${sessionId}/submit`)
      .set(authHeader())
      .send({ payload: { confirm_data_use: true } });

    expect(response.status).toBe(500);
  });

  it("returns 500 when rpc call fails", async () => {
    mockAuth();
    mockInProgressSession();

    mockRpc.mockResolvedValue({
      data: null,
      error: { message: "RPC error" },
    });

    const response = await request(app)
      .post(`${basePath}/sessions/${sessionId}/submit`)
      .set(authHeader())
      .send({ payload: { confirm_data_use: true } });

    expect(response.status).toBe(500);
  });
});
