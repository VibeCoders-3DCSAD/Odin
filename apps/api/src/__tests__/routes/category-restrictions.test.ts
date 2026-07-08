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

describe("GET /odin/api/category-restrictions", () => {
  it("returns 200 with active restrictions", async () => {
    mockAuth();

    const result: MockQueryResult = {
      data: [
        { id: "r1", category_id: "c1", restriction_level: "protected", floor_amount_centavos: 50000, ceiling_amount_centavos: null, categories: { id: "c1", slug: "essentials_food", label: "Food" } },
      ],
      error: null,
    };

    mockFrom.mockReturnValue(createListQuery(result));

    const response = await request(app)
      .get("/odin/api/category-restrictions")
      .set(authHeader());

    expect(response.status).toBe(200);
    expect(response.body.payload.restrictions).toHaveLength(1);
    expect(response.body.payload.restrictions[0]).toMatchObject({ restriction_level: "protected" });
  });

  it("returns 401 when no authorization header", async () => {
    const response = await request(app).get("/odin/api/category-restrictions");
    expect(response.status).toBe(401);
  });
});

describe("PUT /odin/api/category-restrictions/:categoryId", () => {
  function validFreePayload() {
    return { payload: { restriction_level: "free" } };
  }

  function validProtectedPayload() {
    return { payload: { restriction_level: "protected", floor_amount_centavos: 50000 } };
  }

  function validLockedPayload() {
    return { payload: { restriction_level: "locked", floor_amount_centavos: 100000, ceiling_amount_centavos: 100000 } };
  }

  it("creates a free restriction", async () => {
    mockAuth();

    const categoryResult: MockQueryResult = { data: { id: "c1" }, error: null };
    const noExistingResult: MockQueryResult = { data: null, error: null };
    const insertResult: MockQueryResult = { data: { id: "r1", category_id: "c1", restriction_level: "free" }, error: null };

    mockFrom
      .mockReturnValueOnce(createMockQuery(categoryResult))
      .mockReturnValueOnce(createMockQuery(noExistingResult))
      .mockReturnValueOnce(createMockQuery(insertResult));

    const response = await request(app)
      .put("/odin/api/category-restrictions/c1")
      .set(authHeader())
      .send(validFreePayload());

    expect(response.status).toBe(200);
    expect(response.body.payload.restriction).toMatchObject({ restriction_level: "free" });
  });

  it("updates an existing restriction", async () => {
    mockAuth();

    const categoryResult: MockQueryResult = { data: { id: "c1" }, error: null };
    const existingResult: MockQueryResult = { data: { id: "r1" }, error: null };
    const updateResult: MockQueryResult = { data: { id: "r1", category_id: "c1", restriction_level: "protected", floor_amount_centavos: 75000 }, error: null };

    mockFrom
      .mockReturnValueOnce(createMockQuery(categoryResult))
      .mockReturnValueOnce(createMockQuery(existingResult))
      .mockReturnValueOnce(createMockQuery(updateResult));

    const response = await request(app)
      .put("/odin/api/category-restrictions/c1")
      .set(authHeader())
      .send(validProtectedPayload());

    expect(response.status).toBe(200);
  });

  it("creates a locked restriction", async () => {
    mockAuth();

    const categoryResult: MockQueryResult = { data: { id: "c1" }, error: null };
    const noExistingResult: MockQueryResult = { data: null, error: null };
    const insertResult: MockQueryResult = { data: { id: "r1", category_id: "c1", restriction_level: "locked", floor_amount_centavos: 100000, ceiling_amount_centavos: 100000 }, error: null };

    mockFrom
      .mockReturnValueOnce(createMockQuery(categoryResult))
      .mockReturnValueOnce(createMockQuery(noExistingResult))
      .mockReturnValueOnce(createMockQuery(insertResult));

    const response = await request(app)
      .put("/odin/api/category-restrictions/c1")
      .set(authHeader())
      .send(validLockedPayload());

    expect(response.status).toBe(200);
    expect(response.body.payload.restriction).toMatchObject({ restriction_level: "locked" });
  });

  it("returns 400 when category is not accessible", async () => {
    mockAuth();

    mockFrom.mockReturnValueOnce(createMockQuery({ data: null, error: null }));

    const response = await request(app)
      .put("/odin/api/category-restrictions/invalid")
      .set(authHeader())
      .send(validFreePayload());

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ message: expect.stringMatching(/category/i) });
  });

  it("returns 400 when restriction_level is missing", async () => {
    mockAuth();

    mockFrom.mockReturnValueOnce(createMockQuery({ data: { id: "c1" }, error: null }));

    const response = await request(app)
      .put("/odin/api/category-restrictions/c1")
      .set(authHeader())
      .send({ payload: {} });

    expect(response.status).toBe(400);
  });

  it("returns 400 when ceiling is set for free", async () => {
    mockAuth();

    const categoryResult: MockQueryResult = { data: { id: "c1" }, error: null };
    mockFrom.mockReturnValueOnce(createMockQuery(categoryResult));

    const response = await request(app)
      .put("/odin/api/category-restrictions/c1")
      .set(authHeader())
      .send({ payload: { restriction_level: "free", ceiling_amount_centavos: 50000 } });

    expect(response.status).toBe(400);
  });

  it("returns 400 when floor is missing for protected", async () => {
    mockAuth();

    const categoryResult: MockQueryResult = { data: { id: "c1" }, error: null };
    mockFrom.mockReturnValueOnce(createMockQuery(categoryResult));

    const response = await request(app)
      .put("/odin/api/category-restrictions/c1")
      .set(authHeader())
      .send({ payload: { restriction_level: "protected" } });

    expect(response.status).toBe(400);
  });

  it("returns 400 when floor and ceiling don't match for locked", async () => {
    mockAuth();

    const categoryResult: MockQueryResult = { data: { id: "c1" }, error: null };
    mockFrom.mockReturnValueOnce(createMockQuery(categoryResult));

    const response = await request(app)
      .put("/odin/api/category-restrictions/c1")
      .set(authHeader())
      .send({ payload: { restriction_level: "locked", floor_amount_centavos: 50000, ceiling_amount_centavos: 100000 } });

    expect(response.status).toBe(400);
  });

  it("returns 400 when amounts are negative", async () => {
    mockAuth();

    const categoryResult: MockQueryResult = { data: { id: "c1" }, error: null };
    mockFrom.mockReturnValueOnce(createMockQuery(categoryResult));

    const response = await request(app)
      .put("/odin/api/category-restrictions/c1")
      .set(authHeader())
      .send({ payload: { restriction_level: "protected", floor_amount_centavos: -100 } });

    expect(response.status).toBe(400);
  });

  it("returns 401 when no authorization header", async () => {
    const response = await request(app)
      .put("/odin/api/category-restrictions/c1")
      .send(validFreePayload());

    expect(response.status).toBe(401);
  });
});
