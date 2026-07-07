export function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.name === "AbortError") {
    return "The request timed out. Check your connection and try again.";
  }
  return error instanceof Error ? error.message : "Something went wrong.";
}
