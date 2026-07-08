import { API_BASE_URL, REQUEST_TIMEOUT_MS } from "../../lib/api";
import type { CategoryGroup } from "./types";

export async function getCategoryGroups(
  accessToken: string,
  includeSubcategories = true,
) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const params = new URLSearchParams();
    if (includeSubcategories) params.set("include_subcategories", "true");
    const response = await fetch(
      `${API_BASE_URL}/odin/api/category-groups?${params}`,
      { headers: { Authorization: `Bearer ${accessToken}` }, signal: controller.signal },
    );
    let body = {};
    try { body = await response.json(); } catch {}
    return { response, body } as {
      response: Response;
      body: { payload?: { category_groups: CategoryGroup[] }; error?: string; message?: string };
    };
  } finally {
    clearTimeout(timeoutId);
  }
}
