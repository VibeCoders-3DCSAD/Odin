// Route params are untrusted. Local ids are UUIDs; anything outside this alphabet never reaches a query.
export const ROUTE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;

// Accepts only a single, id-shaped string.
export function parseRouteId(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" && ROUTE_ID_PATTERN.test(value) ? value : undefined;
}
