import { API_BASE_URL } from "./api";

export async function isOnline(): Promise<boolean> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3000);
  try {
    await fetch(API_BASE_URL, { method: "HEAD", signal: controller.signal });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}
