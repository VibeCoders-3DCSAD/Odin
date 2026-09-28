import { API_BASE_URL, REQUEST_TIMEOUT_MS } from "../../lib/api";

export async function refreshFinancialReport(accessToken: string): Promise<void> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${API_BASE_URL}/odin/api/financial-reports/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error("financial report refresh failed");
  } finally {
    clearTimeout(timeoutId);
  }
}
