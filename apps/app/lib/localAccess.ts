// Installed by the native auth controller. Web retains its existing session flow.
type AccessGuard = (userId: string) => Promise<string>;
let guard: AccessGuard | null = null;
let isAllowed: (() => boolean) | null = null;
let invalidated: (() => void) | null = null;
const requests = new Set<AbortController>();

export function configureLocalAccess(next: AccessGuard, allowed?: () => boolean, onInvalidated?: () => void): void {
  guard = next;
  isAllowed = allowed ?? null;
  invalidated = onInvalidated ?? null;
}

export async function authorizeLocalRequest(userId: string, accessToken: string): Promise<string> {
  return guard ? guard(userId) : accessToken;
}

export function trackProtectedRequest(controller: AbortController): () => void {
  if (isAllowed && !isAllowed()) throw new Error("Unlock and verify Budgie before syncing.");
  requests.add(controller);
  return () => { requests.delete(controller); };
}

export function abortProtectedRequests(): void {
  for (const controller of requests) controller.abort();
  requests.clear();
}

export function rejectServerSession(): void { invalidated?.(); }
