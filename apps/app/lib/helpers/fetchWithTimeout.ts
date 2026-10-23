import { REQUEST_TIMEOUT_MS } from "../api";

/** Apply a deadline to SDK HTTP calls while preserving caller cancellation. */
export const fetchWithTimeout: typeof fetch = async (input, init) => {
  const controller = new AbortController();
  const originalSignal = init?.signal;
  const abort = () => controller.abort();
  if (originalSignal?.aborted) controller.abort();
  originalSignal?.addEventListener("abort", abort);
  const timeout = setTimeout(abort, REQUEST_TIMEOUT_MS);
  try { return await fetch(input, { ...init, signal: controller.signal }); }
  finally { clearTimeout(timeout); originalSignal?.removeEventListener("abort", abort); }
};
