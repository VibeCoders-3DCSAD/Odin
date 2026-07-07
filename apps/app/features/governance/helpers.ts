import { ERRORS } from "./constants";

export function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.name === "AbortError") {
    return ERRORS.TIMEOUT;
  }
  return error instanceof Error ? error.message : ERRORS.GENERIC;
}
