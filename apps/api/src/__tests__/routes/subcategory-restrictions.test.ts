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
import { createMockQuery, createListQuery } from "../helpers/supabase.js";
import type { MockQueryResult } from "../helpers/supabase.js";
import { validUserId, authHeader } from "../helpers/fixtures.js";

const mockGetUser = supabase.auth.getUser as jest.Mock;
const mockFrom = supabase.from as jest.Mock;

function mockAuth() {
  mockGetUser.mockResolvedValue({
    data: { user: { id: validUserId } },
    error: null,
  });
}

describe("GET /odin/api/subcategory-restrictions", () => {
  it("returns 200 with active restrictions", async () => {
    mockAuth();

    const result: MockQueryResult = {
      data: [
        { id: "r1", subcategory_id: "s1", restriction_level: "protected", floor_amount_centavos: 30000, ceiling_amount_centavos: null, subcategories: { id: "s1", slug: "groceries", label: "Groceries" } },
      ],
      error: null,
    };

    mockFrom.mockReturnValue(createListQuery(result));

    const response = await request(app)
      .get("/odin/api/subcategory-restrictions")
      .set(authHeader());

    expect(response.status).toBe(200);
    expect(response.body.payload.restrictions).toHaveLength(1);
    expect(response.body.payload.restrictions[0]).toMatchObject({ restriction_level: "protected" });
  });

  it("returns 401 when no authorization header", async () => {
    const response = await request(app).get("/odin/api/subcategory-restrictions");
    expect(response.status).toBe(401);
  });
});

describe("PUT /odin/api/subcategory-restrictions/:subcategoryId", () => {
  function validFreePayload() {
    return { payload: { restriction_level: "free" } };
  }

  function validProtectedPayload() {
    return { payload: { restriction_level: "protected", floor_amount_centavos: 30000 } };
  }

  it("creates a free restriction", async () => {
    mockAuth();

    const subcatResult: MockQueryResult = { data: { id: "s1" }, error: null };
    const noExistingResult: MockQueryResult = { data: null, error: null };
    const insertResult: MockQueryResult = { data: { id: "r1", subcategory_id: "s1", restriction_level: "free" }, error: null };

    mockFrom
      .mockReturnValueOnce(createMockQuery(subcatResult))
      .mockReturnValueOnce(createMockQuery(noExistingResult))
      .mockReturnValueOnce(createMockQuery(insertResult));

    const response = await request(app)
      .put("/odin/api/subcategory-restrictions/s1")
      .set(authHeader())
      .send(validFreePayload());

    expect(response.status).toBe(200);
    expect(response.body.payload.restriction).toMatchObject({ restriction_level: "free" });
  });

  it("updates an existing restriction", async () => {
    mockAuth();

    const subcatResult: MockQueryResult = { data: { id: "s1" }, error: null };
    const existingResult: MockQueryResult = { data: { id: "r1" }, error: null };
    const updateResult: MockQueryResult = { data: { id: "r1", subcategory_id: "s1", restriction_level: "protected", floor_amount_centavos: 50000 }, error: null };

    mockFrom
      .mockReturnValueOnce(createMockQuery(subcatResult))
      .mockReturnValueOnce(createMockQuery(existingResult))
      .mockReturnValueOnce(createMockQuery(updateResult));

    const response = await request(app)
      .put("/odin/api/subcategory-restrictions/s1")
      .set(authHeader())
      .send(validProtectedPayload());

    expect(response.status).toBe(200);
  });

  it("returns 400 when subcategory is not accessible", async () => {
    mockAuth();

    mockFrom.mockReturnValueOnce(createMockQuery({ data: null, error: null }));

    const response = await request(app)
      .put("/odin/api/subcategory-restrictions/invalid")
      .set(authHeader())
      .send(validFreePayload());

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ message: expect.stringMatching(/subcategory/i) });
  });

  it("returns 400 when restriction_level is missing", async () => {
    mockAuth();

    mockFrom.mockReturnValueOnce(createMockQuery({ data: { id: "s1" }, error: null }));

    const response = await request(app)
      .put("/odin/api/subcategory-restrictions/s1")
      .set(authHeader())
      .send({ payload: {} });

    expect(response.status).toBe(400);
  });

  it("returns 400 when floor is missing for protected", async () => {
    mockAuth();

    const subcatResult: MockQueryResult = { data: { id: "s1" }, error: null };
    mockFrom.mockReturnValueOnce(createMockQuery(subcatResult));

    const response = await request(app)
      .put("/odin/api/subcategory-restrictions/s1")
      .set(authHeader())
      .send({ payload: { restriction_level: "protected" } });

    expect(response.status).toBe(400);
  });

  it("returns 401 when no authorization header", async () => {
    const response = await request(app)
      .put("/odin/api/subcategory-restrictions/s1")
      .send(validFreePayload());

    expect(response.status).toBe(401);
  });
});
