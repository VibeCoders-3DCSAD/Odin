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
import { createMockQuery } from "../helpers/supabase.js";
import { clearLocalitiesCache } from "../../lib/locality-cache.js";
import type { MockQueryResult } from "../helpers/supabase.js";
import {
  validUserId,
  validProfileId,
  authHeader,
  validEligibilityPayload,
  tooYoungDateOfBirth,
  tooOldDateOfBirth,
} from "../helpers/fixtures.js";

const mockGetUser = supabase.auth.getUser as jest.Mock;
const mockFrom = supabase.from as jest.Mock;

describe("GET /odin/api/eligibility-profile", () => {
  function mockAuth() {
    mockGetUser.mockResolvedValue({
      data: { user: { id: validUserId } },
      error: null,
    });
  }

  it("returns 200 with eligibility profile when it exists", async () => {
    mockAuth();

    const profileResult: MockQueryResult = {
      data: {
        user_id: validUserId,
        date_of_birth: "1996-06-15",
        is_filipino: true,
        metro_manila_presence: "lives_in_metro_manila",
        metro_manila_locality_code: "quezon_city",
        primary_employment_classification: "full_time_employee",
        eligibility_confirmed_at: "2026-06-10T00:00:00Z",
      },
      error: null,
    };

    mockFrom.mockReturnValue(createMockQuery(profileResult));

    const response = await request(app)
      .get("/odin/api/eligibility-profile")
      .set(authHeader());

    expect(response.status).toBe(200);
    expect(response.body.payload.profile).toMatchObject({
      user_id: validUserId,
      is_filipino: true,
      metro_manila_locality_code: "quezon_city",
    });
  });

  it("returns 200 with null profile when eligibility profile does not exist", async () => {
    mockAuth();
    mockFrom.mockReturnValue(createMockQuery({
      data: null,
      error: null,
    }));

    const response = await request(app)
      .get("/odin/api/eligibility-profile")
      .set(authHeader());

    expect(response.status).toBe(200);
    expect(response.body.payload.profile).toBeNull();
  });

  it("returns 401 when no authorization header", async () => {
    const response = await request(app).get("/odin/api/eligibility-profile");
    expect(response.status).toBe(401);
  });

  it("returns 500 when database query fails", async () => {
    mockAuth();
    mockFrom.mockReturnValue(createMockQuery({
      data: null,
      error: { message: "Database error" },
    }));

    const response = await request(app)
      .get("/odin/api/eligibility-profile")
      .set(authHeader());

    expect(response.status).toBe(500);
  });

  it("returns 500 when getUser succeeds but profile query throws", async () => {
    mockAuth();

    const mockMaybeSingle = jest.fn(() => { throw new Error("DB connection lost"); });
    const mockEq = jest.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
    const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });
    mockFrom.mockReturnValue({ select: mockSelect });

    const response = await request(app)
      .get("/odin/api/eligibility-profile")
      .set(authHeader());

    expect(response.status).toBe(500);
  });
});

describe("PATCH /odin/api/eligibility-profile", () => {
  beforeEach(() => {
    clearLocalitiesCache();
  });

  function mockAuth() {
    mockGetUser.mockResolvedValue({
      data: { user: { id: validUserId } },
      error: null,
    });
  }

  function upsertChainResult(returnData = { id: validProfileId, updated_at: "2026-06-12T12:00:00Z" }) {
    return { data: returnData, error: null };
  }

  function mockExistingProfile(data: Record<string, unknown> | null) {
    return createMockQuery({ data, error: null });
  }

  function mockLocalities() {
    const mockSelect = jest.fn().mockResolvedValue({
      data: [
        { code: "manila" },
        { code: "quezon_city" },
        { code: "taguig" },
      ],
      error: null,
    });
    return { select: mockSelect };
  }

  it("returns 200 with profile id and updated_at", async () => {
    mockAuth();

    mockFrom
      .mockReturnValueOnce(mockLocalities())
      .mockReturnValueOnce(mockExistingProfile(null))
      .mockReturnValueOnce(createMockQuery(upsertChainResult()));

    const response = await request(app)
      .patch("/odin/api/eligibility-profile")
      .set(authHeader())
      .send(validEligibilityPayload());

    expect(response.status).toBe(200);
    expect(response.body.payload.profile).toMatchObject({
      id: validProfileId,
    });
  });

  it("includes eligibility_confirmed_at when all required fields are present and is_filipino is true", async () => {
    mockAuth();

    let upsertData: Record<string, unknown> | undefined;
    let upsertCalled = false;
    const mockSingle = jest.fn().mockReturnValue({
      data: { id: validProfileId, updated_at: "2026-06-12T12:00:00Z" },
      error: null,
    });
    const mockSelect = jest.fn().mockReturnValue({ single: mockSingle });
    const mockUpsert = jest.fn().mockImplementation((data: Record<string, unknown>) => {
      upsertData = data;
      upsertCalled = true;
      return { select: mockSelect };
    });

    mockFrom
      .mockReturnValueOnce(mockLocalities())
      .mockReturnValueOnce(mockExistingProfile(null))
      .mockReturnValueOnce({ upsert: mockUpsert });

    const response = await request(app)
      .patch("/odin/api/eligibility-profile")
      .set(authHeader())
      .send(validEligibilityPayload());

    if (response.status !== 200) {
      console.log("Response status:", response.status);
      console.log("Response body:", JSON.stringify(response.body));
    }
    expect(upsertCalled).toBe(true);
    expect(upsertData).toBeDefined();
    expect(upsertData).toHaveProperty("eligibility_confirmed_at");
    expect(typeof upsertData!.eligibility_confirmed_at).toBe("string");
  });

  it("clears eligibility_confirmed_at when some required fields are missing", async () => {
    mockAuth();

    let upsertData: Record<string, unknown> | undefined;
    const mockSingle = jest.fn().mockReturnValue({
      data: { id: validProfileId, updated_at: "2026-06-12T12:00:00Z" },
      error: null,
    });
    const mockSelect = jest.fn().mockReturnValue({ single: mockSingle });
    const mockUpsert = jest.fn().mockImplementation((data: Record<string, unknown>) => {
      upsertData = data;
      return { select: mockSelect };
    });
    mockFrom
      .mockReturnValueOnce(mockExistingProfile(null))
      .mockReturnValueOnce({ upsert: mockUpsert });

    await request(app)
      .patch("/odin/api/eligibility-profile")
      .set(authHeader())
      .send({ payload: { is_filipino: true } });

    expect(upsertData).toBeDefined();
    expect(upsertData).toHaveProperty("eligibility_confirmed_at", null);
  });

  it("clears eligibility_confirmed_at when is_filipino is false", async () => {
    mockAuth();

    let upsertData: Record<string, unknown> | undefined;
    const mockSingle = jest.fn().mockReturnValue({
      data: { id: validProfileId, updated_at: "2026-06-12T12:00:00Z" },
      error: null,
    });
    const mockSelect = jest.fn().mockReturnValue({ single: mockSingle });
    const mockUpsert = jest.fn().mockImplementation((data: Record<string, unknown>) => {
      upsertData = data;
      return { select: mockSelect };
    });

    mockFrom
      .mockReturnValueOnce(mockLocalities())
      .mockReturnValueOnce(mockExistingProfile(null))
      .mockReturnValueOnce({ upsert: mockUpsert });

    await request(app)
      .patch("/odin/api/eligibility-profile")
      .set(authHeader())
      .send({
        payload: {
          ...validEligibilityPayload().payload,
          is_filipino: false,
        },
      });

    expect(upsertData).toBeDefined();
    expect(upsertData).toHaveProperty("eligibility_confirmed_at", null);
  });

  it("sets eligibility_confirmed_at when merging with existing data across requests", async () => {
    mockAuth();

    const existingProfile = {
      date_of_birth: "1996-06-15",
      is_filipino: true,
      metro_manila_presence: "lives_in_metro_manila",
      metro_manila_locality_code: null,
      primary_employment_classification: null,
      primary_employment_other: null,
    };

    let upsertData: Record<string, unknown> | undefined;
    const mockSingle = jest.fn().mockReturnValue({
      data: { id: validProfileId, updated_at: "2026-06-12T12:00:00Z" },
      error: null,
    });
    const mockSelect = jest.fn().mockReturnValue({ single: mockSingle });
    const mockUpsert = jest.fn().mockImplementation((data: Record<string, unknown>) => {
      upsertData = data;
      return { select: mockSelect };
    });

    mockFrom
      .mockReturnValueOnce(mockLocalities())
      .mockReturnValueOnce(mockExistingProfile(existingProfile))
      .mockReturnValueOnce({ upsert: mockUpsert });

    await request(app)
      .patch("/odin/api/eligibility-profile")
      .set(authHeader())
      .send({
        payload: {
          metro_manila_locality_code: "quezon_city",
          primary_employment_classification: "full_time_employee",
        },
      });

    expect(upsertData).toBeDefined();
    expect(upsertData).toHaveProperty("eligibility_confirmed_at");
    expect(upsertData).toHaveProperty("date_of_birth", "1996-06-15");
  });

  it("returns 200 when updating a subset of fields", async () => {
    mockAuth();

    mockFrom
      .mockReturnValueOnce(mockExistingProfile(null))
      .mockReturnValueOnce(createMockQuery(upsertChainResult()));

    const response = await request(app)
      .patch("/odin/api/eligibility-profile")
      .set(authHeader())
      .send({ payload: { is_filipino: false } });

    expect(response.status).toBe(200);
  });

  it("includes user_id in the upsert data", async () => {
    mockAuth();

    let upsertData: Record<string, unknown> | undefined;
    const mockSingle = jest.fn().mockReturnValue({
      data: { id: validProfileId, updated_at: "2026-06-12T12:00:00Z" },
      error: null,
    });
    const mockSelect = jest.fn().mockReturnValue({ single: mockSingle });
    const mockUpsert = jest.fn().mockImplementation((data: Record<string, unknown>) => {
      upsertData = data;
      return { select: mockSelect };
    });
    mockFrom
      .mockReturnValueOnce(mockExistingProfile(null))
      .mockReturnValueOnce({ upsert: mockUpsert });

    await request(app)
      .patch("/odin/api/eligibility-profile")
      .set(authHeader())
      .send({ payload: { is_filipino: true } });

    expect(upsertData).toHaveProperty("user_id", validUserId);
  });

  it("returns 400 when date_of_birth makes user too young (< 20)", async () => {
    mockAuth();

    const response = await request(app)
      .patch("/odin/api/eligibility-profile")
      .set(authHeader())
      .send({
        payload: {
          ...validEligibilityPayload().payload,
          date_of_birth: tooYoungDateOfBirth,
        },
      });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      message: expect.stringMatching(/age/i),
    });
  });

  it("returns 400 when date_of_birth makes user too old (> 40)", async () => {
    mockAuth();

    const response = await request(app)
      .patch("/odin/api/eligibility-profile")
      .set(authHeader())
      .send({
        payload: {
          ...validEligibilityPayload().payload,
          date_of_birth: tooOldDateOfBirth,
        },
      });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      message: expect.stringMatching(/age/i),
    });
  });

  it("returns 400 when date_of_birth is before the exact 20-year boundary", async () => {
    mockAuth();

    const today = new Date();
    const boundaryDate = new Date(Date.UTC(
      today.getUTCFullYear() - 20,
      today.getUTCMonth(),
      today.getUTCDate() + 1,
    )).toISOString().slice(0, 10);

    const response = await request(app)
      .patch("/odin/api/eligibility-profile")
      .set(authHeader())
      .send({
        payload: {
          ...validEligibilityPayload().payload,
          date_of_birth: boundaryDate,
        },
      });

    expect(response.status).toBe(400);
  });

  it("clears eligibility_confirmed_at when a patch makes the profile incomplete", async () => {
    mockAuth();

    let upsertData: Record<string, unknown> | undefined;
    const mockSingle = jest.fn().mockReturnValue({
      data: { id: validProfileId, updated_at: "2026-06-12T12:00:00Z" },
      error: null,
    });
    const mockSelect = jest.fn().mockReturnValue({ single: mockSingle });
    const mockUpsert = jest.fn().mockImplementation((data: Record<string, unknown>) => {
      upsertData = data;
      return { select: mockSelect };
    });

    mockFrom
      .mockReturnValueOnce(mockExistingProfile({
        date_of_birth: "1996-06-15",
        is_filipino: true,
        metro_manila_presence: "lives_in_metro_manila",
        metro_manila_locality_code: "quezon_city",
        primary_employment_classification: "full_time_employee",
        primary_employment_other: null,
        eligibility_confirmed_at: "2026-06-10T00:00:00Z",
      }))
      .mockReturnValueOnce({ upsert: mockUpsert });

    await request(app)
      .patch("/odin/api/eligibility-profile")
      .set(authHeader())
      .send({ payload: { is_filipino: false } });

    expect(upsertData).toBeDefined();
    expect(upsertData).toHaveProperty("eligibility_confirmed_at", null);
  });

  it("returns 400 when metro_manila_locality_code is invalid", async () => {
    mockAuth();

    mockFrom.mockReturnValueOnce({
      select: jest.fn().mockResolvedValue({
        data: [{ code: "manila" }, { code: "quezon_city" }],
        error: null,
      }),
    });

    const response = await request(app)
      .patch("/odin/api/eligibility-profile")
      .set(authHeader())
      .send({
        payload: {
          ...validEligibilityPayload().payload,
          metro_manila_locality_code: "invalid_city",
        },
      });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      message: expect.stringMatching(/locality/i),
    });
  });

  it("returns 400 when metro_manila_presence is invalid", async () => {
    mockAuth();

    const response = await request(app)
      .patch("/odin/api/eligibility-profile")
      .set(authHeader())
      .send({
        payload: {
          metro_manila_presence: "invalid_presence",
        },
      });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      message: expect.stringMatching(/metro manila presence/i),
    });
  });

  it("returns 400 when employment classification is invalid", async () => {
    mockAuth();

    const response = await request(app)
      .patch("/odin/api/eligibility-profile")
      .set(authHeader())
      .send({
        payload: {
          primary_employment_classification: "invalid_classification",
        },
      });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      message: expect.stringMatching(/employment classification/i),
    });
  });

  it("returns 400 when employment is 'other' but description is missing", async () => {
    mockAuth();

    mockFrom.mockReturnValueOnce({
      select: jest.fn().mockResolvedValue({
        data: [{ code: "manila" }, { code: "quezon_city" }, { code: "taguig" }],
        error: null,
      }),
    });

    const response = await request(app)
      .patch("/odin/api/eligibility-profile")
      .set(authHeader())
      .send({
        payload: {
          ...validEligibilityPayload().payload,
          primary_employment_classification: "other",
          primary_employment_other: undefined,
        },
      });

    expect(response.status).toBe(400);
  });

  it("returns 401 when no authorization header", async () => {
    const response = await request(app)
      .patch("/odin/api/eligibility-profile")
      .send(validEligibilityPayload());

    expect(response.status).toBe(401);
  });

  it("returns 500 when upsert fails", async () => {
    mockAuth();

    mockFrom
      .mockReturnValueOnce(mockLocalities())
      .mockReturnValueOnce(mockExistingProfile(null))
      .mockReturnValueOnce(createMockQuery({ data: null, error: { message: "Database error" } }));

    const response = await request(app)
      .patch("/odin/api/eligibility-profile")
      .set(authHeader())
      .send(validEligibilityPayload());

    expect(response.status).toBe(500);
  });

  it("returns 500 when getUser succeeds but upsert throws", async () => {
    mockAuth();

    const mockUpsert = jest.fn(() => { throw new Error("DB error"); });

    mockFrom
      .mockReturnValueOnce(mockLocalities())
      .mockReturnValueOnce(mockExistingProfile(null))
      .mockReturnValueOnce({ upsert: mockUpsert });

    const response = await request(app)
      .patch("/odin/api/eligibility-profile")
      .set(authHeader())
      .send(validEligibilityPayload());

    expect(response.status).toBe(500);
  });

  it("returns 500 when locality cache fetch fails", async () => {
    mockAuth();

    mockFrom.mockReturnValueOnce({
      select: jest.fn().mockResolvedValue({
        data: null,
        error: { message: "DB error" },
      }),
    });

    const response = await request(app)
      .patch("/odin/api/eligibility-profile")
      .set(authHeader())
      .send({
        payload: {
          metro_manila_locality_code: "quezon_city",
        },
      });

    expect(response.status).toBe(500);
  });

  it("returns 500 when existing profile fetch fails", async () => {
    mockAuth();

    mockFrom
      .mockReturnValueOnce(mockLocalities())
      .mockReturnValueOnce(createMockQuery({
        data: null,
        error: { message: "DB error" },
      }));

    const response = await request(app)
      .patch("/odin/api/eligibility-profile")
      .set(authHeader())
      .send(validEligibilityPayload());

    expect(response.status).toBe(500);
  });
});
