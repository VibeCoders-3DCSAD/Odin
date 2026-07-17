import { supabase } from "../lib/supabase";

// ponytail: fire-and-forget trigger, cron is the source of truth —
// this just accelerates catch-up when the user opens the app.
export async function triggerRecurringEngine(): Promise<void> {
  try {
    const { data: { user } = {} } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.rpc("run_recurring_transaction_engine", {
      p_user_id: user.id,
    });
  } catch {
    // swallow errors — cron catches anything missed
  }
}
