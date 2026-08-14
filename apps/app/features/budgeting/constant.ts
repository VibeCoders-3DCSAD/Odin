export const PROVISIONAL_TRACKING_LABEL = "Provisional tracking; not final budget health";

export function calculateProvisionalPercentage(actualAmountMinor: number, allocationAmountMinor: number): number {
  return allocationAmountMinor > 0 ? (actualAmountMinor / allocationAmountMinor) * 100 : 0;
}
