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

  return {
    supabase: mockClient,
    createAuthenticatedSupabaseClient: () => mockClient,
  };
});

import app from "../../app.js";
import { supabase } from "../../lib/supabase.js";
import { createMockQuery } from "../helpers/supabase.js";
import type { MockQueryResult } from "../helpers/supabase.js";
import {
  validUserId,
  authHeader,
} from "../helpers/fixtures.js";

const mockGetUser = supabase.auth.getUser as jest.Mock;
const mockFrom = supabase.from as jest.Mock;
const mockRpc = supabase.rpc as jest.Mock;

function mockAuth() {
  mockGetUser.mockResolvedValue({
    data: { user: { id: validUserId } },
    error: null,
  });
}

const basePath = "/odin/api/onboarding";

describe("POST /odin/api/onboarding/sessions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 201 with session when created", async () => {
    mockAuth();

    const newSession = {
      id: "session-1",
      user_id: validUserId,
      status: "in_progress",
      started_at: "2026-07-08T00:00:00Z",
      current_step_key: "welcome",
      raw_answers: { name: "Juan" },
      metadata: {},
    };

    mockRpc.mockReturnValue(createMockQuery({ data: newSession, error: null }));

    const response = await request(app)
      .post(`${basePath}/sessions`)
      .set(authHeader())
      .send({ payload: { raw_answers: { name: "Juan" }, current_step_key: "welcome" } });

    expect(response.status).toBe(201);
    expect(response.body.payload.session).toMatchObject({
      id: "session-1",
      status: "in_progress",
      current_step_key: "welcome",
    });
  });

  it("returns 201 without optional payload fields", async () => {
    mockAuth();

    mockRpc.mockReturnValue(createMockQuery({
      data: {
        id: "session-2",
        user_id: validUserId,
        status: "in_progress",
        current_step_key: null,
        raw_answers: {},
        metadata: {},
      },
      error: null,
    }));

    const response = await request(app)
      .post(`${basePath}/sessions`)
      .set(authHeader())
      .send({ payload: {} });

    expect(response.status).toBe(201);
  });

  it("returns 400 when raw_answers is an array", async () => {
    mockAuth();

    const response = await request(app)
      .post(`${basePath}/sessions`)
      .set(authHeader())
      .send({ payload: { raw_answers: ["a", "b"] } });

    expect(response.status).toBe(400);
  });

  it("returns 400 when current_step_key is not a string", async () => {
    mockAuth();

    const response = await request(app)
      .post(`${basePath}/sessions`)
      .set(authHeader())
      .send({ payload: { current_step_key: 123 } });

    expect(response.status).toBe(400);
  });

  it("returns 401 when no authorization header", async () => {
    const response = await request(app)
      .post(`${basePath}/sessions`)
      .send({ payload: {} });

    expect(response.status).toBe(401);
  });

  it("returns 500 when rpc call fails", async () => {
    mockAuth();

    mockRpc.mockReturnValue(createMockQuery({ data: null, error: { message: "DB error" } }));

    const response = await request(app)
      .post(`${basePath}/sessions`)
      .set(authHeader())
      .send({ payload: {} });

    expect(response.status).toBe(500);
  });

  it("calls rpc with raw_answers and current_step_key", async () => {
    mockAuth();

    mockRpc.mockReturnValue(createMockQuery({
      data: {
        id: "session-3",
        user_id: validUserId,
        status: "in_progress",
        raw_answers: {},
        metadata: {},
      },
      error: null,
    }));

    await request(app)
      .post(`${basePath}/sessions`)
      .set(authHeader())
      .send({ payload: { raw_answers: { name: "Juan" }, current_step_key: "welcome" } });

    expect(mockRpc).toHaveBeenCalledWith("create_onboarding_session", {
      p_raw_answers: { name: "Juan" },
      p_current_step_key: "welcome",
    });
  });
});

describe("PATCH /odin/api/onboarding/sessions/:id", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const sessionId = "session-1";

  it("returns 200 with updated session", async () => {
    mockAuth();

    const existingSession = {
      id: sessionId,
      user_id: validUserId,
      status: "in_progress",
      raw_answers: { name: "Juan" },
    };

    const updatedSession = {
      id: sessionId,
      user_id: validUserId,
      status: "in_progress",
      started_at: "2026-07-08T00:00:00Z",
      current_step_key: "income",
      raw_answers: { name: "Juan", age: 25 },
      metadata: {},
    };

    mockFrom
      .mockReturnValueOnce(createMockQuery({ data: existingSession, error: null }))
      .mockReturnValueOnce(createMockQuery({ data: updatedSession, error: null }));

    const response = await request(app)
      .patch(`${basePath}/sessions/${sessionId}`)
      .set(authHeader())
      .send({ payload: { current_step_key: "income", raw_answers: { age: 25 } } });

    expect(response.status).toBe(200);
    expect(response.body.payload.session.current_step_key).toBe("income");
  });

  it("returns 400 when raw_answers is an array", async () => {
    mockAuth();

    const response = await request(app)
      .patch(`${basePath}/sessions/${sessionId}`)
      .set(authHeader())
      .send({ payload: { raw_answers: [] } });

    expect(response.status).toBe(400);
  });

  it("returns 404 when session does not exist", async () => {
    mockAuth();

    mockFrom.mockReturnValueOnce(createMockQuery({ data: null, error: null }));

    const response = await request(app)
      .patch(`${basePath}/sessions/${sessionId}`)
      .set(authHeader())
      .send({ payload: { current_step_key: "income" } });

    expect(response.status).toBe(404);
  });

  it("returns 409 when session is not in_progress", async () => {
    mockAuth();

    const submittedSession = {
      id: sessionId,
      user_id: validUserId,
      status: "submitted",
      raw_answers: {},
    };

    mockFrom.mockReturnValueOnce(createMockQuery({ data: submittedSession, error: null }));

    const response = await request(app)
      .patch(`${basePath}/sessions/${sessionId}`)
      .set(authHeader())
      .send({ payload: { current_step_key: "income" } });

    expect(response.status).toBe(409);
  });

  it("returns 400 when no fields to update", async () => {
    mockAuth();

    const existingSession = {
      id: sessionId,
      user_id: validUserId,
      status: "in_progress",
      raw_answers: {},
    };

    mockFrom.mockReturnValueOnce(createMockQuery({ data: existingSession, error: null }));

    const response = await request(app)
      .patch(`${basePath}/sessions/${sessionId}`)
      .set(authHeader())
      .send({ payload: {} });

    expect(response.status).toBe(400);
  });

  it("returns 401 when no authorization header", async () => {
    const response = await request(app)
      .patch(`${basePath}/sessions/${sessionId}`)
      .send({ payload: { current_step_key: "income" } });

    expect(response.status).toBe(401);
  });

  it("returns 500 when update fails", async () => {
    mockAuth();

    const existingSession = {
      id: sessionId,
      user_id: validUserId,
      status: "in_progress",
      raw_answers: {},
    };

    mockFrom
      .mockReturnValueOnce(createMockQuery({ data: existingSession, error: null }))
      .mockReturnValueOnce(createMockQuery({ data: null, error: { message: "DB error" } }));

    const response = await request(app)
      .patch(`${basePath}/sessions/${sessionId}`)
      .set(authHeader())
      .send({ payload: { current_step_key: "income" } });

    expect(response.status).toBe(500);
  });
});

describe("POST /odin/api/onboarding/sessions/:id/responses", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const sessionId = "session-1";

  it("returns 200 with upserted response", async () => {
    mockAuth();

    const session = { id: sessionId, status: "in_progress" };
    const upsertedResponse = {
      onboarding_session_id: sessionId,
      question_key: "income_type",
      answer: { value: "stable" },
      updated_at: "2026-07-08T00:00:00Z",
    };

    mockFrom
      .mockReturnValueOnce(createMockQuery({ data: session, error: null }))
      .mockReturnValueOnce(createMockQuery({ data: upsertedResponse, error: null }));

    const response = await request(app)
      .post(`${basePath}/sessions/${sessionId}/responses`)
      .set(authHeader())
      .send({ payload: { question_key: "income_type", answer: { value: "stable" } } });

    expect(response.status).toBe(200);
    expect(response.body.payload.response.question_key).toBe("income_type");
  });

  it("returns 400 when question_key is missing", async () => {
    mockAuth();

    const response = await request(app)
      .post(`${basePath}/sessions/${sessionId}/responses`)
      .set(authHeader())
      .send({ payload: { answer: { value: "stable" } } });

    expect(response.status).toBe(400);
  });

  it("returns 400 when answer is missing", async () => {
    mockAuth();

    const response = await request(app)
      .post(`${basePath}/sessions/${sessionId}/responses`)
      .set(authHeader())
      .send({ payload: { question_key: "income_type" } });

    expect(response.status).toBe(400);
  });

  it("returns 404 when session does not exist", async () => {
    mockAuth();

    mockFrom.mockReturnValueOnce(createMockQuery({ data: null, error: null }));

    const response = await request(app)
      .post(`${basePath}/sessions/${sessionId}/responses`)
      .set(authHeader())
      .send({ payload: { question_key: "income_type", answer: { value: "stable" } } });

    expect(response.status).toBe(404);
  });

  it("returns 409 when session is not in_progress", async () => {
    mockAuth();

    const submittedSession = { id: sessionId, status: "submitted" };

    mockFrom.mockReturnValueOnce(createMockQuery({ data: submittedSession, error: null }));

    const response = await request(app)
      .post(`${basePath}/sessions/${sessionId}/responses`)
      .set(authHeader())
      .send({ payload: { question_key: "income_type", answer: { value: "stable" } } });

    expect(response.status).toBe(409);
  });

  it("returns 401 when no authorization header", async () => {
    const response = await request(app)
      .post(`${basePath}/sessions/${sessionId}/responses`)
      .send({ payload: { question_key: "income_type", answer: { value: "stable" } } });

    expect(response.status).toBe(401);
  });

  it("returns 500 when upsert fails", async () => {
    mockAuth();

    mockFrom
      .mockReturnValueOnce(createMockQuery({ data: { id: sessionId, status: "in_progress" }, error: null }))
      .mockReturnValueOnce(createMockQuery({ data: null, error: { message: "DB error" } }));

    const response = await request(app)
      .post(`${basePath}/sessions/${sessionId}/responses`)
      .set(authHeader())
      .send({ payload: { question_key: "income_type", answer: { value: "stable" } } });

    expect(response.status).toBe(500);
  });
});

describe("GET /odin/api/onboarding/sessions/current", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 200 with in_progress session when it exists", async () => {
    mockAuth();

    const inProgressSession = {
      id: "session-1",
      status: "in_progress",
      started_at: "2026-07-08T00:00:00Z",
      submitted_at: null,
      current_step_key: "welcome",
      raw_answers: {},
    };

    mockFrom.mockReturnValueOnce(createMockQuery({ data: inProgressSession, error: null }));

    const response = await request(app)
      .get(`${basePath}/sessions/current`)
      .set(authHeader());

    expect(response.status).toBe(200);
    expect(response.body.payload.session.status).toBe("in_progress");
  });

  it("returns 200 with submitted session when no in_progress exists", async () => {
    mockAuth();

    const submittedSession = {
      id: "session-2",
      status: "submitted",
      started_at: "2026-07-07T00:00:00Z",
      submitted_at: "2026-07-07T01:00:00Z",
      current_step_key: "done",
      raw_answers: {},
    };

    mockFrom
      .mockReturnValueOnce(createMockQuery({ data: null, error: null }))
      .mockReturnValueOnce(createMockQuery({ data: submittedSession, error: null }));

    const response = await request(app)
      .get(`${basePath}/sessions/current`)
      .set(authHeader());

    expect(response.status).toBe(200);
    expect(response.body.payload.session.status).toBe("submitted");
  });

  it("returns 200 with null when no sessions exist", async () => {
    mockAuth();

    mockFrom
      .mockReturnValueOnce(createMockQuery({ data: null, error: null }))
      .mockReturnValueOnce(createMockQuery({ data: null, error: null }));

    const response = await request(app)
      .get(`${basePath}/sessions/current`)
      .set(authHeader());

    expect(response.status).toBe(200);
    expect(response.body.payload.session).toBeNull();
  });

  it("returns 401 when no authorization header", async () => {
    const response = await request(app).get(`${basePath}/sessions/current`);
    expect(response.status).toBe(401);
  });

  it("returns 500 when in_progress query fails", async () => {
    mockAuth();

    mockFrom.mockReturnValueOnce(createMockQuery({ data: null, error: { message: "DB error" } }));

    const response = await request(app)
      .get(`${basePath}/sessions/current`)
      .set(authHeader());

    expect(response.status).toBe(500);
  });

  it("returns 500 when submitted query fails", async () => {
    mockAuth();

    mockFrom
      .mockReturnValueOnce(createMockQuery({ data: null, error: null }))
      .mockReturnValueOnce(createMockQuery({ data: null, error: { message: "DB error" } }));

    const response = await request(app)
      .get(`${basePath}/sessions/current`)
      .set(authHeader());

    expect(response.status).toBe(500);
  });
});
