import { getServiceRoleClient } from "../lib/supabase.js";

export async function runEngine(
  asOf?: string,
  limit?: number,
): Promise<{ engineResults: unknown[] }> {
  const client = getServiceRoleClient();
  const { data, error } = await client.rpc("run_recurring_transaction_engine", {
    p_as_of: asOf ?? null,
    p_limit: limit ?? null,
  });

  if (error) throw error;

  return { engineResults: data ?? [] };
}

export const ENGINE_ERRORS = {
  cron_secret_mismatch: "Invalid cron secret.",
  user_session_rejected: "User sessions are not allowed on this endpoint. Use the cron secret.",
  no_cron_secret: "RECURRING_CRON_SECRET is not configured.",
} as const;
