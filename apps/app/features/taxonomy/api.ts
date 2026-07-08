import { API_BASE_URL, REQUEST_TIMEOUT_MS } from "../../lib/api";
import type { Category, CategoryGroup } from "./types";

async function apiFetch<T>(
  accessToken: string,
  path: string,
  options?: { method?: string; body?: unknown },
) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: options?.method ?? "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: options?.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
    let body = {};
    try { body = await response.json(); } catch {}
    return { response, body } as { response: Response; body: T };
  } finally {
    clearTimeout(timeoutId);
  }
}

export function getCategoryGroups(accessToken: string, includeSubcategories = true) {
  const params = new URLSearchParams();
  if (includeSubcategories) params.set("include_subcategories", "true");
  return apiFetch<{ payload?: { category_groups: CategoryGroup[] }; error?: string; message?: string }>(
    accessToken, `/odin/api/category-groups?${params}`,
  );
}

export function createCategory(
  accessToken: string,
  payload: {
    category_group_id: string;
    slug: string;
    label: string;
    description: string;
    short_label?: string | null;
    is_filipino_context?: boolean;
    sort_order?: number;
  },
) {
  return apiFetch<{ payload?: { category: Category }; error?: string; message?: string }>(
    accessToken, "/odin/api/categories", { method: "POST", body: { payload } },
  );
}

export function updateCategory(
  accessToken: string,
  id: string,
  payload: {
    label?: string;
    short_label?: string | null;
    description?: string;
    is_filipino_context?: boolean;
    sort_order?: number;
    is_active?: boolean;
  },
) {
  return apiFetch<{ payload?: { category: Category }; error?: string; message?: string }>(
    accessToken, `/odin/api/categories/${id}`, { method: "PATCH", body: { payload } },
  );
}

export function deleteCategory(accessToken: string, id: string) {
  return apiFetch<{ payload?: { category: Category }; error?: string; message?: string }>(
    accessToken, `/odin/api/categories/${id}`, { method: "DELETE" },
  );
}
