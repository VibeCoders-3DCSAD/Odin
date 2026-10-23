import { createClient } from "@supabase/supabase-js";
import { fetchWithTimeout } from "./helpers/fetchWithTimeout";

// The auth feature owns one SecureStore account record, including rotated tokens.
// Automatic SDK storage/sign-out must never erase offline access on a network error.
export const supabase = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL ?? "",
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "", {
    global: { fetch: fetchWithTimeout },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
