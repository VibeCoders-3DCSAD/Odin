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

jest.mock("../../lib/mlClient.js", () => ({
  classifyPfpQuestionnaire: jest.fn(),
}));

import app from "../../app.js";
import { supabase, getServiceRoleClient } from "../../lib/supabase.js";
import { createMockQuery } from "../helpers/supabase.js";
import type { MockQueryResult } from "../helpers/supabase.js";
import {
  validUserId,
  authHeader,
} from "../helpers/fixtures.js";
import { ONBOARDING_ERRORS } from "../../lib/constants.js";
import { classifyPfpQuestionnaire } from "../../lib/mlClient.js";

const mockGetUser = supabase.auth.getUser as jest.Mock;
const mockFrom = supabase.from as jest.Mock;
const mockRpc = getServiceRoleClient().rpc as jest.Mock;
const mockClassify = classifyPfpQuestionnaire as jest.Mock;

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
      raw_answers: {
        display_name: "Juan",
        date_of_birth: "1995-06-15",
        is_filipino: "true",
        metro_manila_presence: "lives_in_metro_manila",
        metro_manila_locality_code: "makati",
        primary_employment_classification: "full_time_employee",
        employment_status: "employed_full_time",
        monthly_income: "50000",
        income_pattern: "predictable_income",
        obligation_load: "low",
        emergency_runway: "3_to_6_months",
        protected_categories: ["none"],
      },
    },
    error: null,
  }));
}

function mockRpcSuccess(overrides: Record<string, unknown> = {}) {
  mockRpc.mockResolvedValue({
    data: {
      assessment_id: "assess-1",
      assignment_id: "assign-1",
      profile_label: "STABLE_FLEXIBLE_TOLERANT",
      ...overrides,
    },
    error: null,
  });
}

const basePath = "/odin/api/onboarding";

describe("POST /odin/api/onboarding/sessions/:id/submit", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockClassify.mockResolvedValue({ ok: true, classification: { prediction: "STABLE_FLEXIBLE_TOLERANT", confidence: 0.9, modelName: "questionnaire_rule", modelVersion: "v1.4.0" } });
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
      assessment: { id: "assess-1", proposed_profile_label: "STABLE_FLEXIBLE_TOLERANT" },
      assignment: { id: "assign-1", profile_label: "STABLE_FLEXIBLE_TOLERANT", confirmation_required: true },
    });
  });

  it("returns the classifier prediction", async () => {
    mockAuth();
    mockInProgressSession();
    mockRpcSuccess();

    const response = await request(app)
      .post(`${basePath}/sessions/${sessionId}/submit`)
      .set(authHeader())
      .send({ payload: { confirm_data_use: true } });

    expect(response.status).toBe(200);
    expect(response.body.payload.assessment.proposed_profile_label).toBe("STABLE_FLEXIBLE_TOLERANT");
    expect(response.body.payload.assignment.profile_label).toBe("STABLE_FLEXIBLE_TOLERANT");
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

  it("passes classifier metadata to the classification-aware RPC", async () => {
    mockAuth();
    mockInProgressSession();
    mockRpcSuccess();

    await request(app)
      .post(`${basePath}/sessions/${sessionId}/submit`)
      .set(authHeader())
      .send({ payload: { confirm_data_use: true } });

    expect(mockRpc).toHaveBeenCalledWith("submit_onboarding_session_with_classification", {
      p_session_id: sessionId,
      p_user_id: validUserId,
      p_profile_label: "STABLE_FLEXIBLE_TOLERANT",
      p_confidence_score: 0.9,
      p_model_kind: "questionnaire_rule",
      p_model_version: "v1.4.0",
    });
  });

  it("uses the RPC fallback when the classifier is unavailable", async () => {
    mockAuth(); mockInProgressSession(); mockRpcSuccess({ profile_label: "STABLE_FLEXIBLE_TOLERANT" });
    mockClassify.mockResolvedValue({ ok: false, reason: "timeout" });
    await request(app).post(`${basePath}/sessions/${sessionId}/submit`).set(authHeader()).send({ payload: { confirm_data_use: true } });
    expect(mockRpc).toHaveBeenCalledWith("submit_onboarding_session_with_classification", expect.objectContaining({ p_profile_label: null, p_confidence_score: null, p_model_kind: null, p_model_version: null }));
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

  it("returns 400 when raw_answers is missing a required field", async () => {
    mockAuth();
    mockFrom.mockReturnValueOnce(createMockQuery({
      data: {
        id: "session-1",
        status: "in_progress",
        raw_answers: {
          display_name: "Juan",
          date_of_birth: "1995-06-15",
          is_filipino: "true",
          metro_manila_presence: "lives_in_metro_manila",
          metro_manila_locality_code: "makati",
          primary_employment_classification: "full_time_employee",
          employment_status: "employed_full_time",
          income_pattern: "predictable_income",
          monthly_income: "50000",
          obligation_load: "low",
          // emergency_runway missing
          protected_categories: ["none"],
        },
      },
      error: null,
    }));

    const response = await request(app)
      .post(`${basePath}/sessions/${sessionId}/submit`)
      .set(authHeader())
      .send({ payload: { confirm_data_use: true } });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain("incomplete");
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("returns 400 when an income pattern is missing", async () => {
    mockAuth();
    mockFrom.mockReturnValueOnce(createMockQuery({
      data: {
        id: "session-1",
        status: "in_progress",
        raw_answers: {
          display_name: "Juan",
          date_of_birth: "1995-06-15",
          is_filipino: "true",
          metro_manila_presence: "lives_in_metro_manila",
          metro_manila_locality_code: "makati",
          primary_employment_classification: "full_time_employee",
          employment_status: "employed_full_time",
          monthly_income: "50000",
          obligation_load: "low",
          emergency_runway: "1_to_3_months",
          protected_categories: ["none"],
        },
      },
      error: null,
    }));

    const response = await request(app)
      .post(`${basePath}/sessions/${sessionId}/submit`)
      .set(authHeader())
      .send({ payload: { confirm_data_use: true } });

    expect(response.status).toBe(400);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("returns 400 when zero income conflicts with the income pattern", async () => {
    mockAuth();
    mockFrom.mockReturnValueOnce(createMockQuery({
      data: {
        id: "session-1",
        status: "in_progress",
        raw_answers: {
          display_name: "Juan",
          date_of_birth: "1995-06-15",
          is_filipino: "true",
          metro_manila_presence: "lives_in_metro_manila",
          metro_manila_locality_code: "makati",
          primary_employment_classification: "full_time_employee",
          employment_status: "employed_full_time",
          income_pattern: "predictable_income",
          monthly_income: "0",
          obligation_load: "low",
          emergency_runway: "1_to_3_months",
          protected_categories: ["none"],
        },
      },
      error: null,
    }));

    const response = await request(app)
      .post(`${basePath}/sessions/${sessionId}/submit`)
      .set(authHeader())
      .send({ payload: { confirm_data_use: true } });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain("income_pattern");
    expect(mockRpc).not.toHaveBeenCalled();
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
