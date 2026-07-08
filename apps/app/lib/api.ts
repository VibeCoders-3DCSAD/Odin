export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:3001";
export const REQUEST_TIMEOUT_MS = 10_000;

export function apiFetch<T>(
  accessToken: string,
  path: string,
  options?: { method?: string; body?: unknown },
) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  return fetch(`${API_BASE_URL}${path}`, {
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
