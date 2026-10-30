import type { OfflineAccount } from "../types";

let anchor: { wall: number; elapsed: number } | null = null;

export function resetAccessClock(): void {
  anchor = { wall: Date.now(), elapsed: performance.now() };
}

export function accessNow(account: Pick<OfflineAccount, "clockOffsetMs">): number {
  const wall = Date.now();
  if (anchor && Math.abs(wall - anchor.wall - (performance.now() - anchor.elapsed)) > 5000) {
    return Number.NaN;
  }
  return wall + account.clockOffsetMs;
}