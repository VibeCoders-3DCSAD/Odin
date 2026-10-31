import { API_BASE_URL, REQUEST_TIMEOUT_MS } from "../api";
import { authorizedFetch } from "../localAccess";

// A JSON request to the Odin API with the bearer token (refreshed once on 401 by authorizedFetch) and the shared
// request timeout. An unreadable body comes back as {}, so callers read `response.ok` and fields of `body`.
export function apiFetch<T>(
  accessToken: string,
  path: string,
  options?: { method?: string; body?: unknown },
) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  return authorizedFetch(`${API_BASE_URL}${path}`, {
    method: options?.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: options?.body ? JSON.stringify(options.body) : undefined,
    signal: controller.signal,
  })
    .then(async (res) => {
      let body = {};
      try { body = await res.json(); } catch {}
      return { response: res, body } as { response: Response; body: T };
    })
    .finally(() => clearTimeout(timeoutId));
}
