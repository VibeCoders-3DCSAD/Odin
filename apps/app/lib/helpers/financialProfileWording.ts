// Status words shared by the Savings & Debt Profile and the Financial Plan's leftover-money guidance,
// so both screens describe the same classification the same way.
export const PROFILE_STATUS = {
  notEnoughData: "Not enough data yet",
  emergencyCovered: "Well covered",
  emergencyBuilding: "Needs building",
  debtManageable: "Manageable",
  debtTooHigh: "Too high",
  marginLeftOver: "Money left over",
  marginShort: "Falling short",
  cardNone: "No card",
  cardPaidInFull: "Paid in full",
  cardPaidOnTime: "Paid on time",
  cardSometimes: "Sometimes carries a balance",
  cardCarrying: "Carrying a balance",
  cardAlways: "Always carries a balance",
  cardOverAYear: "Carried for over a year",
} as const;

export function formatMonthsCovered(months: number): string {
  return `about ${months.toFixed(1)} months of expenses`;
}

export function formatIncomeShare(ratio: number): string {
  return `${Math.round(ratio * 100)}% of your monthly income`;
}

export function formatProfilePeso(amount: number): string {
  return `PHP ${Math.abs(amount).toLocaleString("en-PH", { maximumFractionDigits: 0 })}`;
}
