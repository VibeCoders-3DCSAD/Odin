import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// createClient throws on empty URL/key. Use inert placeholders so the app can
// boot for local UI work when credentials are unavailable.
const clientUrl = isSupabaseConfigured
  ? supabaseUrl
  : "https://supabase-not-configured.invalid";
const clientKey = isSupabaseConfigured
  ? supabaseAnonKey
  : "supabase-not-configured";

export const supabase: SupabaseClient = createClient(clientUrl, clientKey);
