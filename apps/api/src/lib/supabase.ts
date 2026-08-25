import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY ?? "";

const fetchWithTimeout: typeof fetch = (input, init) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timeout));
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
  global: { fetch: fetchWithTimeout },
});

let serviceRoleClientInstance: SupabaseClient | null = null;

export function getServiceRoleClient(): SupabaseClient {
  if (!serviceRoleClientInstance) {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!key) {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for server-only operations");
    }
    serviceRoleClientInstance = createClient(supabaseUrl, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: { fetch: fetchWithTimeout },
    });
  }
  return serviceRoleClientInstance;
}

export function createAuthenticatedSupabaseClient(
  accessToken: string,
): SupabaseClient {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      fetch: fetchWithTimeout,
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}
