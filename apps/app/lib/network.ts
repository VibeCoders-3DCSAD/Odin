import { API_BASE_URL } from "./api";

const HEALTHCHECK_TIMEOUT_MS = 10_000;

export async function isOnline(): Promise<boolean> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), HEALTHCHECK_TIMEOUT_MS);
  const healthUrl = `${API_BASE_URL}/health`;
  const startedAt = Date.now();

  console.log("[network] healthcheck:start", {
    url: healthUrl,
    timeout_ms: HEALTHCHECK_TIMEOUT_MS,
  });

  try {
    const response = await fetch(healthUrl, {
      signal: controller.signal,
    });

    console.log("[network] healthcheck:response", {
      elapsed_ms: Date.now() - startedAt,
      ok: response.ok,
      status: response.status,
    });

    return response.ok;
  } catch (error) {
    console.warn("[network] healthcheck:error", {
      elapsed_ms: Date.now() - startedAt,
      error_name: error instanceof Error ? error.name : "unknown",
      error_message: error instanceof Error ? error.message : "unknown error",
    });

    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}
