import { ROUTES } from "../Routes";

// Supabase emails link to odin://auth/reset and odin://auth/verify. useDeepLink reads
// their tokens itself, so the router only needs the screen that handles each one.
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  if (/^(odin:\/\/)?\/?auth\/reset\b/.test(path)) return ROUTES.forgotPassword;
  if (/^(odin:\/\/)?\/?auth\//.test(path)) return ROUTES.login;
  return path;
}
