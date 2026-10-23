let sequence = 0;

function failureCategory(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (/database is locked|database is busy/i.test(message)) return "database-busy";
  if (/file is not a database|hmac check|decrypt/i.test(message)) return "database-key-or-format";
  if (/no such table|no such column/i.test(message)) return "database-schema";
  if (/no such function.*sqlcipher|cipher_version/i.test(message)) return "sqlcipher-unavailable";
  if (/constraint/i.test(message)) return "database-constraint";
  if (/permission|denied/i.test(message)) return "permission-denied";
  if (/timed? out|took too long/i.test(message)) return "timeout";
  return "operation-failed";
}

/** Development diagnostics: never log arguments, results, SQL, filenames or raw errors. */
export async function tracePinStep<T>(stage: string, work: () => T | Promise<T>): Promise<T> {
  if (!__DEV__) return work();
  const step = ++sequence;
  const startedAt = performance.now();
  const elapsedMs = () => Math.round(performance.now() - startedAt);
  console.info("[PIN-SETUP]", { step, stage, status: "started" });
  const heartbeat = setInterval(() => {
    console.info("[PIN-SETUP]", { step, stage, status: "waiting", elapsedMs: elapsedMs() });
  }, 5000);
  try {
    const result = await work();
    console.info("[PIN-SETUP]", { step, stage, status: "completed", elapsedMs: elapsedMs() });
    return result;
  } catch (error) {
    console.warn("[PIN-SETUP]", { step, stage, status: "failed", elapsedMs: elapsedMs(), category: failureCategory(error) });
    throw error;
  } finally { clearInterval(heartbeat); }
}
