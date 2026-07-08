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

describe("GET /odin/api/subcategories", () => {
  it("returns 200 with accessible subcategories", async () => {
    mockAuth();

    const result: MockQueryResult = {
      data: [
        { id: "s1", category_id: "c1", slug: "groceries", label: "Groceries", kind: "expense", user_id: null, is_active: true, sort_order: 100 },
      ],
      error: null,
    };

    mockFrom.mockReturnValue(createListQuery(result));

    const response = await request(app)
      .get("/odin/api/subcategories")
      .set(authHeader());

    expect(response.status).toBe(200);
    expect(response.body.payload.subcategories).toHaveLength(1);
    expect(response.body.payload.subcategories[0]).toMatchObject({ slug: "groceries", kind: "expense" });
  });

  it("returns 200 filtered by kind", async () => {
    mockAuth();

    const result: MockQueryResult = {
      data: [
        { id: "s2", category_id: null, slug: "salary", label: "Salary", kind: "income", user_id: null, is_active: true, sort_order: 100 },
      ],
      error: null,
    };

    mockFrom.mockReturnValue(createListQuery(result));

    const response = await request(app)
      .get("/odin/api/subcategories?kind=income")
      .set(authHeader());

    expect(response.status).toBe(200);
    expect(response.body.payload.subcategories).toHaveLength(1);
    expect(response.body.payload.subcategories[0].kind).toBe("income");
  });

  it("returns 200 filtered by category_id", async () => {
    mockAuth();

    const result: MockQueryResult = {
      data: [
        { id: "s1", category_id: "c1", slug: "groceries", label: "Groceries", kind: "expense", user_id: null, is_active: true, sort_order: 100 },
      ],
      error: null,
    };

    mockFrom.mockReturnValue(createListQuery(result));

    const response = await request(app)
      .get("/odin/api/subcategories?category_id=c1")
      .set(authHeader());

    expect(response.status).toBe(200);
    expect(response.body.payload.subcategories).toHaveLength(1);
  });

  it("returns 400 when kind is invalid", async () => {
    mockAuth();

    const response = await request(app)
      .get("/odin/api/subcategories?kind=invalid_kind")
      .set(authHeader());

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ message: expect.stringMatching(/kind/i) });
  });

  it("returns 401 when no authorization header", async () => {
    const response = await request(app).get("/odin/api/subcategories");
    expect(response.status).toBe(401);
  });

  it("returns 500 when database query fails", async () => {
    mockAuth();
    mockFrom.mockReturnValue(createListQuery({
      data: null,
      error: { message: "Database error" },
    }));

    const response = await request(app)
      .get("/odin/api/subcategories")
      .set(authHeader());

    expect(response.status).toBe(500);
  });
});

describe("POST /odin/api/subcategories", () => {
  function validExpensePayload(overrides: Record<string, unknown> = {}) {
    return {
      payload: {
        kind: "expense",
        category_id: "cat-1",
        slug: "my_subcategory",
        label: "My Subcategory",
        description: "A custom subcategory",
        ...overrides,
      },
    };
  }

  function validIncomePayload(overrides: Record<string, unknown> = {}) {
    return {
      payload: {
        kind: "income",
        slug: "my_income",
        label: "My Income",
        description: "An income subcategory",
        ...overrides,
      },
    };
  }

  it("returns 201 with created expense subcategory", async () => {
    mockAuth();

    const categoryResult: MockQueryResult = { data: { id: "cat-1" }, error: null };
    const insertResult: MockQueryResult = {
      data: { id: "sc-1", category_id: "cat-1", user_id: validUserId, slug: "my_subcategory", kind: "expense", label: "My Subcategory", description: "A custom subcategory", is_system: false, is_active: true, sort_order: 0 },
      error: null,
    };

    mockFrom
      .mockReturnValueOnce(createMockQuery(categoryResult))
      .mockReturnValueOnce(createMockQuery(insertResult));

    const response = await request(app)
      .post("/odin/api/subcategories")
      .set(authHeader())
      .send(validExpensePayload());

    expect(response.status).toBe(201);
    expect(response.body.payload.subcategory).toMatchObject({ slug: "my_subcategory", kind: "expense", is_system: false });
  });

  it("returns 201 with created non-expense subcategory", async () => {
    mockAuth();

    const insertResult: MockQueryResult = {
      data: { id: "sc-2", category_id: null, user_id: validUserId, slug: "my_income", kind: "income", label: "My Income", description: "An income subcategory", is_system: false, is_active: true, sort_order: 0 },
      error: null,
    };

    mockFrom.mockReturnValueOnce(createMockQuery(insertResult));

    const response = await request(app)
      .post("/odin/api/subcategories")
      .set(authHeader())
      .send(validIncomePayload());

    expect(response.status).toBe(201);
    expect(response.body.payload.subcategory).toMatchObject({ slug: "my_income", kind: "income", category_id: null });
  });

  it("returns 400 when kind is missing", async () => {
    mockAuth();

    const response = await request(app)
      .post("/odin/api/subcategories")
      .set(authHeader())
      .send({ payload: { slug: "test", label: "Test", description: "desc" } });

    expect(response.status).toBe(400);
  });

  it("returns 400 when kind is invalid", async () => {
    mockAuth();

    const response = await request(app)
      .post("/odin/api/subcategories")
      .set(authHeader())
      .send({ payload: { kind: "invalid", slug: "test", label: "Test", description: "desc" } });

    expect(response.status).toBe(400);
  });

  it("returns 400 when slug is missing", async () => {
    mockAuth();

    const response = await request(app)
      .post("/odin/api/subcategories")
      .set(authHeader())
      .send({ payload: { kind: "expense", category_id: "c1", label: "Test", description: "desc" } });

    expect(response.status).toBe(400);
  });

  it("returns 400 when label is missing", async () => {
    mockAuth();

    const response = await request(app)
      .post("/odin/api/subcategories")
      .set(authHeader())
      .send({ payload: { kind: "expense", category_id: "c1", slug: "test", description: "desc" } });

    expect(response.status).toBe(400);
  });

  it("returns 400 when description is missing", async () => {
    mockAuth();

    const response = await request(app)
      .post("/odin/api/subcategories")
      .set(authHeader())
      .send({ payload: { kind: "expense", category_id: "c1", slug: "test", label: "Test" } });

    expect(response.status).toBe(400);
  });

  it("returns 400 when expense subcategory has no category_id", async () => {
    mockAuth();

    const response = await request(app)
      .post("/odin/api/subcategories")
      .set(authHeader())
      .send({ payload: { kind: "expense", slug: "test", label: "Test", description: "desc" } });

    expect(response.status).toBe(400);
  });

  it("returns 400 when expense category_id is not accessible", async () => {
    mockAuth();

    mockFrom.mockReturnValueOnce(createMockQuery({ data: null, error: null }));

    const response = await request(app)
      .post("/odin/api/subcategories")
      .set(authHeader())
      .send(validExpensePayload({ category_id: "inaccessible-cat" }));

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ message: expect.stringMatching(/category/i) });
  });

  it("returns 400 when non-expense subcategory has category_id", async () => {
    mockAuth();

    const response = await request(app)
      .post("/odin/api/subcategories")
      .set(authHeader())
      .send(validIncomePayload({ category_id: "cat-1" }));

    expect(response.status).toBe(400);
  });

  it("returns 409 when slug already exists", async () => {
    mockAuth();

    const categoryResult: MockQueryResult = { data: { id: "cat-1" }, error: null };
    const conflictResult: MockQueryResult = {
      data: null,
      error: { code: "23505", message: "duplicate key value" },
    };

    mockFrom
      .mockReturnValueOnce(createMockQuery(categoryResult))
      .mockReturnValueOnce(createMockQuery(conflictResult));

    const response = await request(app)
      .post("/odin/api/subcategories")
      .set(authHeader())
      .send(validExpensePayload());

    expect(response.status).toBe(409);
  });

  it("returns 401 when no authorization header", async () => {
    const response = await request(app)
      .post("/odin/api/subcategories")
      .send(validExpensePayload());

    expect(response.status).toBe(401);
  });

  it("returns 500 when insert fails", async () => {
    mockAuth();

    const categoryResult: MockQueryResult = { data: { id: "cat-1" }, error: null };
    const insertResult: MockQueryResult = { data: null, error: { message: "Database error" } };

    mockFrom
      .mockReturnValueOnce(createMockQuery(categoryResult))
      .mockReturnValueOnce(createMockQuery(insertResult));

    const response = await request(app)
      .post("/odin/api/subcategories")
      .set(authHeader())
      .send(validExpensePayload());

    expect(response.status).toBe(500);
  });
});

describe("PATCH /odin/api/subcategories/:id", () => {
  function mockExistingSubcategory(overrides: Record<string, unknown> = {}) {
    return {
      data: {
        id: "sc-1",
        category_id: "cat-1",
        user_id: validUserId,
        slug: "my_subcategory",
        kind: "expense",
        label: "My Subcategory",
        description: "A custom subcategory",
        is_system: false,
        is_active: true,
        sort_order: 0,
        ...overrides,
      },
      error: null,
    };
  }

  it("returns 200 with updated subcategory", async () => {
    mockAuth();

    mockFrom
      .mockReturnValueOnce(createMockQuery(mockExistingSubcategory()))
      .mockReturnValueOnce(createMockQuery({
        data: { ...mockExistingSubcategory().data, label: "Updated Label" },
        error: null,
      }));

    const response = await request(app)
      .patch("/odin/api/subcategories/sc-1")
      .set(authHeader())
      .send({ payload: { label: "Updated Label" } });

    expect(response.status).toBe(200);
    expect(response.body.payload.subcategory).toMatchObject({ label: "Updated Label" });
  });

  it("returns 400 when no valid fields to update", async () => {
    mockAuth();

    mockFrom.mockReturnValueOnce(createMockQuery(mockExistingSubcategory()));

    const response = await request(app)
      .patch("/odin/api/subcategories/sc-1")
      .set(authHeader())
      .send({ payload: {} });

    expect(response.status).toBe(400);
  });

  it("returns 400 when field value has wrong type", async () => {
    mockAuth();

    mockFrom.mockReturnValueOnce(createMockQuery(mockExistingSubcategory()));

    const response = await request(app)
      .patch("/odin/api/subcategories/sc-1")
      .set(authHeader())
      .send({ payload: { is_active: "not-a-boolean" } });

    expect(response.status).toBe(400);
  });

  it("returns 403 when updating a system subcategory", async () => {
    mockAuth();

    mockFrom.mockReturnValueOnce(createMockQuery(mockExistingSubcategory({ is_system: true, user_id: null })));

    const response = await request(app)
      .patch("/odin/api/subcategories/sc-1")
      .set(authHeader())
      .send({ payload: { label: "Updated" } });

    expect(response.status).toBe(403);
  });

  it("returns 403 when updating another user's subcategory", async () => {
    mockAuth();

    mockFrom.mockReturnValueOnce(createMockQuery(mockExistingSubcategory({ user_id: "other-user-id" })));

    const response = await request(app)
      .patch("/odin/api/subcategories/sc-1")
      .set(authHeader())
      .send({ payload: { label: "Updated" } });

    expect(response.status).toBe(403);
  });

  it("returns 404 when subcategory not found", async () => {
    mockAuth();

    mockFrom.mockReturnValueOnce(createMockQuery({ data: null, error: null }));

    const response = await request(app)
      .patch("/odin/api/subcategories/non-existent")
      .set(authHeader())
      .send({ payload: { label: "Updated" } });

    expect(response.status).toBe(404);
  });

  it("returns 401 when no authorization header", async () => {
    const response = await request(app)
      .patch("/odin/api/subcategories/sc-1")
      .send({ payload: { label: "Updated" } });

    expect(response.status).toBe(401);
  });
});

describe("DELETE /odin/api/subcategories/:id", () => {
  function mockExistingSubcategory(overrides: Record<string, unknown> = {}) {
    return {
      data: {
        id: "sc-1",
        category_id: "cat-1",
        user_id: validUserId,
        slug: "my_subcategory",
        kind: "expense",
        label: "My Subcategory",
        description: "A custom subcategory",
        is_system: false,
        is_active: true,
        sort_order: 0,
        ...overrides,
      },
      error: null,
    };
  }

  it("returns 200 with soft-deleted subcategory", async () => {
    mockAuth();

    mockFrom
      .mockReturnValueOnce(createMockQuery(mockExistingSubcategory()))
      .mockReturnValueOnce(createMockQuery({
        data: { ...mockExistingSubcategory().data, is_active: false },
        error: null,
      }));

    const response = await request(app)
      .delete("/odin/api/subcategories/sc-1")
      .set(authHeader());

    expect(response.status).toBe(200);
    expect(response.body.payload.subcategory.is_active).toBe(false);
  });

  it("returns 403 when deleting a system subcategory", async () => {
    mockAuth();

    mockFrom.mockReturnValueOnce(createMockQuery(mockExistingSubcategory({ is_system: true, user_id: null })));

    const response = await request(app)
      .delete("/odin/api/subcategories/sc-1")
      .set(authHeader());

    expect(response.status).toBe(403);
  });

  it("returns 403 when deleting another user's subcategory", async () => {
    mockAuth();

    mockFrom.mockReturnValueOnce(createMockQuery(mockExistingSubcategory({ user_id: "other-user-id" })));

    const response = await request(app)
      .delete("/odin/api/subcategories/sc-1")
      .set(authHeader());

    expect(response.status).toBe(403);
  });

  it("returns 404 when subcategory not found", async () => {
    mockAuth();

    mockFrom.mockReturnValueOnce(createMockQuery({ data: null, error: null }));

    const response = await request(app)
      .delete("/odin/api/subcategories/non-existent")
      .set(authHeader());

    expect(response.status).toBe(404);
  });

  it("returns 401 when no authorization header", async () => {
    const response = await request(app).delete("/odin/api/subcategories/sc-1");
    expect(response.status).toBe(401);
  });
});
