import { supabase } from "../lib/supabase";
import { API_BASE_URL } from "../lib/api";

// ponytail: fire-and-forget trigger, cron is the source of truth —
// this just accelerates catch-up when the user opens the app.
export async function triggerRecurringEngine(): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;

    await fetch(`${API_BASE_URL}/odin/api/recurring/run/me`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
  } catch {
    // swallow errors — cron catches anything missed
  }
}
