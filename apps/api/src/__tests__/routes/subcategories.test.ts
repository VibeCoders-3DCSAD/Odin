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
import { createListQuery } from "../helpers/supabase.js";
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
        {
          id: "s1",
          category_id: "c1",
          slug: "groceries",
          label: "Groceries",
          kind: "expense",
          user_id: null,
          is_active: true,
          sort_order: 100,
        },
      ],
      error: null,
    };

    mockFrom.mockReturnValue(createListQuery(result));

    const response = await request(app)
      .get("/odin/api/subcategories")
      .set(authHeader());

    expect(response.status).toBe(200);
    expect(response.body.payload.subcategories).toHaveLength(1);
    expect(response.body.payload.subcategories[0]).toMatchObject({
      slug: "groceries",
      kind: "expense",
    });
  });

  it("returns 200 filtered by kind", async () => {
    mockAuth();

    const result: MockQueryResult = {
      data: [
        {
          id: "s2",
          category_id: null,
          slug: "salary",
          label: "Salary",
          kind: "income",
          user_id: null,
          is_active: true,
          sort_order: 100,
        },
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
        {
          id: "s1",
          category_id: "c1",
          slug: "groceries",
          label: "Groceries",
          kind: "expense",
          user_id: null,
          is_active: true,
          sort_order: 100,
        },
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
    expect(response.body).toMatchObject({
      message: expect.stringMatching(/kind/i),
    });
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
