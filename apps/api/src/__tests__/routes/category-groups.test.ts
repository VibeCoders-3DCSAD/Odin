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

describe("GET /odin/api/category-groups", () => {
  it("returns 200 with category groups", async () => {
    mockAuth();

    const groupsResult: MockQueryResult = {
      data: [
        { id: "g1", slug: "essentials", label: "Essentials", sort_order: 100, is_active: true },
        { id: "g2", slug: "obligatory", label: "Obligatory", sort_order: 200, is_active: true },
      ],
      error: null,
    };

    mockFrom.mockReturnValue(createListQuery(groupsResult));

    const response = await request(app)
      .get("/odin/api/category-groups")
      .set(authHeader());

    expect(response.status).toBe(200);
    expect(response.body.payload.category_groups).toHaveLength(2);
    expect(response.body.payload.category_groups[0]).toMatchObject({
      slug: "essentials",
      label: "Essentials",
    });
  });

  it("returns 200 with category groups including subcategories", async () => {
    mockAuth();

    const groupsResult: MockQueryResult = {
      data: [
        { id: "g1", slug: "essentials", label: "Essentials", sort_order: 100, is_active: true },
      ],
      error: null,
    };

    const categoriesResult: MockQueryResult = {
      data: [
        { id: "c1", category_group_id: "g1", slug: "essentials_food", label: "Food", is_active: true, user_id: null },
        { id: "c2", category_group_id: "g1", slug: "essentials_utilities", label: "Utilities", is_active: true, user_id: null },
      ],
      error: null,
    };

    const subcategoriesResult: MockQueryResult = {
      data: [
        { id: "s1", category_id: "c1", slug: "groceries", label: "Groceries", kind: "expense", is_active: true, user_id: null },
      ],
      error: null,
    };

    mockFrom
      .mockReturnValueOnce(createListQuery(groupsResult))
      .mockReturnValueOnce(createListQuery(categoriesResult))
      .mockReturnValueOnce(createListQuery(subcategoriesResult));

    const response = await request(app)
      .get("/odin/api/category-groups?include_subcategories=true")
      .set(authHeader());

    expect(response.status).toBe(200);
    expect(response.body.payload.category_groups).toHaveLength(1);
    expect(response.body.payload.category_groups[0].categories).toHaveLength(2);
    expect(response.body.payload.category_groups[0].categories[0].subcategories).toHaveLength(1);
    expect(response.body.payload.category_groups[0].categories[0].subcategories[0]).toMatchObject({
      slug: "groceries",
    });
  });

  it("returns 401 when no authorization header", async () => {
    const response = await request(app).get("/odin/api/category-groups");
    expect(response.status).toBe(401);
  });

  it("returns 500 when database query fails", async () => {
    mockAuth();
    mockFrom.mockReturnValue(createListQuery({
      data: null,
      error: { message: "Database error" },
    }));

    const response = await request(app)
      .get("/odin/api/category-groups")
      .set(authHeader());

    expect(response.status).toBe(500);
  });
});
