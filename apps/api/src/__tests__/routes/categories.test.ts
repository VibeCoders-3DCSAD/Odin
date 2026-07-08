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

describe("GET /odin/api/categories", () => {
  it("returns 200 with accessible categories", async () => {
    mockAuth();

    const result: MockQueryResult = {
      data: [
        { id: "c1", slug: "essentials_food", label: "Food", user_id: null, is_active: true, sort_order: 100 },
        { id: "c2", slug: "my_custom", label: "My Custom", user_id: validUserId, is_active: true, sort_order: 500 },
      ],
      error: null,
    };

    mockFrom.mockReturnValue(createListQuery(result));

    const response = await request(app)
      .get("/odin/api/categories")
      .set(authHeader());

    expect(response.status).toBe(200);
    expect(response.body.payload.categories).toHaveLength(2);
  });

  it("returns 200 with only user categories when include_system=false", async () => {
    mockAuth();

    const result: MockQueryResult = {
      data: [
        { id: "c2", slug: "my_custom", label: "My Custom", user_id: validUserId, is_active: true, sort_order: 500 },
      ],
      error: null,
    };

    mockFrom.mockReturnValue(createListQuery(result));

    const response = await request(app)
      .get("/odin/api/categories?include_system=false")
      .set(authHeader());

    expect(response.status).toBe(200);
    expect(response.body.payload.categories).toHaveLength(1);
    expect(response.body.payload.categories[0]).toMatchObject({ user_id: validUserId });
  });

  it("returns 200 with inactive categories when is_active=false", async () => {
    mockAuth();

    const result: MockQueryResult = {
      data: [
        { id: "c3", slug: "archived", label: "Archived", user_id: validUserId, is_active: false, sort_order: 900 },
      ],
      error: null,
    };

    mockFrom.mockReturnValue(createListQuery(result));

    const response = await request(app)
      .get("/odin/api/categories?is_active=false")
      .set(authHeader());

    expect(response.status).toBe(200);
    expect(response.body.payload.categories).toHaveLength(1);
    expect(response.body.payload.categories[0].is_active).toBe(false);
  });

  it("returns 401 when no authorization header", async () => {
    const response = await request(app).get("/odin/api/categories");
    expect(response.status).toBe(401);
  });

  it("returns 500 when database query fails", async () => {
    mockAuth();
    mockFrom.mockReturnValue(createListQuery({
      data: null,
      error: { message: "Database error" },
    }));

    const response = await request(app)
      .get("/odin/api/categories")
      .set(authHeader());

    expect(response.status).toBe(500);
  });
});

describe("POST /odin/api/categories", () => {
  function validCreatePayload(overrides: Record<string, unknown> = {}) {
    return {
      payload: {
        category_group_id: "group-uuid-1",
        slug: "my_category",
        label: "My Category",
        description: "A custom category",
        ...overrides,
      },
    };
  }

  it("returns 201 with created category", async () => {
    mockAuth();

    const groupResult: MockQueryResult = { data: { id: "group-uuid-1" }, error: null };
    const insertResult: MockQueryResult = {
      data: { id: "cat-1", category_group_id: "group-uuid-1", user_id: validUserId, slug: "my_category", label: "My Category", description: "A custom category", is_system: false, is_active: true, sort_order: 0 },
      error: null,
    };

    mockFrom
      .mockReturnValueOnce(createMockQuery(groupResult))
      .mockReturnValueOnce(createMockQuery(insertResult));

    const response = await request(app)
      .post("/odin/api/categories")
      .set(authHeader())
      .send(validCreatePayload());

    expect(response.status).toBe(201);
    expect(response.body.payload.category).toMatchObject({ slug: "my_category", is_system: false });
  });

  it("returns 400 when payload is missing", async () => {
    mockAuth();

    const response = await request(app)
      .post("/odin/api/categories")
      .set(authHeader())
      .send({});

    expect(response.status).toBe(400);
  });

  it("returns 400 when category_group_id is missing", async () => {
    mockAuth();

    const response = await request(app)
      .post("/odin/api/categories")
      .set(authHeader())
      .send({ payload: { slug: "test", label: "Test", description: "desc" } });

    expect(response.status).toBe(400);
  });

  it("returns 400 when slug is missing", async () => {
    mockAuth();

    const response = await request(app)
      .post("/odin/api/categories")
      .set(authHeader())
      .send({ payload: { category_group_id: "g1", label: "Test", description: "desc" } });

    expect(response.status).toBe(400);
  });

  it("returns 400 when label is missing", async () => {
    mockAuth();

    const response = await request(app)
      .post("/odin/api/categories")
      .set(authHeader())
      .send({ payload: { category_group_id: "g1", slug: "test", description: "desc" } });

    expect(response.status).toBe(400);
  });

  it("returns 400 when description is missing", async () => {
    mockAuth();

    const response = await request(app)
      .post("/odin/api/categories")
      .set(authHeader())
      .send({ payload: { category_group_id: "g1", slug: "test", label: "Test" } });

    expect(response.status).toBe(400);
  });

  it("returns 400 when category_group_id is invalid", async () => {
    mockAuth();

    mockFrom.mockReturnValue(createMockQuery({ data: null, error: null }));

    const response = await request(app)
      .post("/odin/api/categories")
      .set(authHeader())
      .send(validCreatePayload({ category_group_id: "invalid-group" }));

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ message: expect.stringMatching(/category group/i) });
  });

  it("returns 409 when slug already exists", async () => {
    mockAuth();

    const groupResult: MockQueryResult = { data: { id: "group-uuid-1" }, error: null };
    const conflictResult: MockQueryResult = {
      data: null,
      error: { code: "23505", message: "duplicate key value" },
    };

    mockFrom
      .mockReturnValueOnce(createMockQuery(groupResult))
      .mockReturnValueOnce(createMockQuery(conflictResult));

    const response = await request(app)
      .post("/odin/api/categories")
      .set(authHeader())
      .send(validCreatePayload());

    expect(response.status).toBe(409);
  });

  it("returns 401 when no authorization header", async () => {
    const response = await request(app)
      .post("/odin/api/categories")
      .send(validCreatePayload());

    expect(response.status).toBe(401);
  });

  it("returns 500 when insert fails", async () => {
    mockAuth();

    const groupResult: MockQueryResult = { data: { id: "group-uuid-1" }, error: null };
    const insertResult: MockQueryResult = { data: null, error: { message: "Database error" } };

    mockFrom
      .mockReturnValueOnce(createMockQuery(groupResult))
      .mockReturnValueOnce(createMockQuery(insertResult));

    const response = await request(app)
      .post("/odin/api/categories")
      .set(authHeader())
      .send(validCreatePayload());

    expect(response.status).toBe(500);
  });
});

describe("PATCH /odin/api/categories/:id", () => {
  function mockExistingCategory(overrides: Record<string, unknown> = {}) {
    return {
      data: {
        id: "cat-1",
        category_group_id: "group-uuid-1",
        user_id: validUserId,
        slug: "my_category",
        label: "My Category",
        description: "A custom category",
        is_system: false,
        is_active: true,
        sort_order: 0,
        ...overrides,
      },
      error: null,
    };
  }

  it("returns 200 with updated category", async () => {
    mockAuth();

    mockFrom
      .mockReturnValueOnce(createMockQuery(mockExistingCategory()))
      .mockReturnValueOnce(createMockQuery({
        data: { ...mockExistingCategory().data, label: "Updated Label" },
        error: null,
      }));

    const response = await request(app)
      .patch("/odin/api/categories/cat-1")
      .set(authHeader())
      .send({ payload: { label: "Updated Label" } });

    expect(response.status).toBe(200);
    expect(response.body.payload.category).toMatchObject({ label: "Updated Label" });
  });

  it("returns 400 when no valid fields to update", async () => {
    mockAuth();

    mockFrom.mockReturnValueOnce(createMockQuery(mockExistingCategory()));

    const response = await request(app)
      .patch("/odin/api/categories/cat-1")
      .set(authHeader())
      .send({ payload: {} });

    expect(response.status).toBe(400);
  });

  it("returns 403 when updating a system category", async () => {
    mockAuth();

    mockFrom.mockReturnValueOnce(createMockQuery(mockExistingCategory({ is_system: true, user_id: null })));

    const response = await request(app)
      .patch("/odin/api/categories/cat-1")
      .set(authHeader())
      .send({ payload: { label: "Updated" } });

    expect(response.status).toBe(403);
  });

  it("returns 403 when updating another user's category", async () => {
    mockAuth();

    mockFrom.mockReturnValueOnce(createMockQuery(mockExistingCategory({ user_id: "other-user-id" })));

    const response = await request(app)
      .patch("/odin/api/categories/cat-1")
      .set(authHeader())
      .send({ payload: { label: "Updated" } });

    expect(response.status).toBe(403);
  });

  it("returns 404 when category not found", async () => {
    mockAuth();

    mockFrom.mockReturnValueOnce(createMockQuery({ data: null, error: null }));

    const response = await request(app)
      .patch("/odin/api/categories/non-existent")
      .set(authHeader())
      .send({ payload: { label: "Updated" } });

    expect(response.status).toBe(404);
  });

  it("returns 409 on slug conflict", async () => {
    mockAuth();

    mockFrom
      .mockReturnValueOnce(createMockQuery(mockExistingCategory()))
      .mockReturnValueOnce(createMockQuery({
        data: null,
        error: { code: "23505", message: "duplicate key value" },
      }));

    const response = await request(app)
      .patch("/odin/api/categories/cat-1")
      .set(authHeader())
      .send({ payload: { slug: "taken_slug" } });

    expect(response.status).toBe(409);
  });

  it("returns 401 when no authorization header", async () => {
    const response = await request(app)
      .patch("/odin/api/categories/cat-1")
      .send({ payload: { label: "Updated" } });

    expect(response.status).toBe(401);
  });
});

describe("DELETE /odin/api/categories/:id", () => {
  function mockExistingCategory(overrides: Record<string, unknown> = {}) {
    return {
      data: {
        id: "cat-1",
        category_group_id: "group-uuid-1",
        user_id: validUserId,
        slug: "my_category",
        label: "My Category",
        description: "A custom category",
        is_system: false,
        is_active: true,
        sort_order: 0,
        ...overrides,
      },
      error: null,
    };
  }

  it("returns 200 with soft-deleted category", async () => {
    mockAuth();

    mockFrom
      .mockReturnValueOnce(createMockQuery(mockExistingCategory()))
      .mockReturnValueOnce(createMockQuery({
        data: { ...mockExistingCategory().data, is_active: false },
        error: null,
      }));

    const response = await request(app)
      .delete("/odin/api/categories/cat-1")
      .set(authHeader());

    expect(response.status).toBe(200);
    expect(response.body.payload.category.is_active).toBe(false);
  });

  it("returns 403 when deleting a system category", async () => {
    mockAuth();

    mockFrom.mockReturnValueOnce(createMockQuery(mockExistingCategory({ is_system: true, user_id: null })));

    const response = await request(app)
      .delete("/odin/api/categories/cat-1")
      .set(authHeader());

    expect(response.status).toBe(403);
  });

  it("returns 403 when deleting another user's category", async () => {
    mockAuth();

    mockFrom.mockReturnValueOnce(createMockQuery(mockExistingCategory({ user_id: "other-user-id" })));

    const response = await request(app)
      .delete("/odin/api/categories/cat-1")
      .set(authHeader());

    expect(response.status).toBe(403);
  });

  it("returns 404 when category not found", async () => {
    mockAuth();

    mockFrom.mockReturnValueOnce(createMockQuery({ data: null, error: null }));

    const response = await request(app)
      .delete("/odin/api/categories/non-existent")
      .set(authHeader());

    expect(response.status).toBe(404);
  });

  it("returns 401 when no authorization header", async () => {
    const response = await request(app).delete("/odin/api/categories/cat-1");
    expect(response.status).toBe(401);
  });
});
