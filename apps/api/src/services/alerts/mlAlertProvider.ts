/*
 * Future adapter boundary.
 *
 * The ML adapter must accept the provider inputs from types.ts, call odin-ml
 * with a configured bearer credential and an explicit timeout, and map its
 * response to DetectionResult. It must not expose model scores to callers.
 * Network failures should produce a recorded model_failure/no-alert result;
 * they must not block sync or remove existing alerts. Retries, if added, must
 * be bounded and remain inside this adapter.
 */

export class MlAlertProviderNotImplementedError extends Error {
  constructor() {
    super("The odin-ml alert provider is not implemented.");
    this.name = "MlAlertProviderNotImplementedError";
  }
}
