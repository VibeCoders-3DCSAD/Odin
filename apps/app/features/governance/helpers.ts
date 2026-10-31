import { ERRORS } from "./constants";

export function getErrorMessage(error: unknown, timeoutMessage: string = ERRORS.TIMEOUT) {
  if (error instanceof Error && error.name === "AbortError") {
    return timeoutMessage;
  }
  return error instanceof Error ? error.message : ERRORS.GENERIC;
}
