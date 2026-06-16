import { supabase } from "./supabase.js";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

interface CacheEntry {
  codes: string[];
  timestamp: number;
}

let cache: CacheEntry | null = null;

export async function getValidLocalities(): Promise<string[]> {
  if (cache && Date.now() - cache.timestamp < CACHE_TTL_MS) {
    return cache.codes;
  }

  const { data, error } = await supabase
    .from("metro_manila_localities")
    .select("code");

  if (error) {
    throw error;
  }

  const codes = data.map((row: { code: string }) => row.code);
  cache = { codes, timestamp: Date.now() };
  return codes;
}

export function clearLocalitiesCache(): void {
  cache = null;
}
