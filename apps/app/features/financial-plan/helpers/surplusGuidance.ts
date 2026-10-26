import { formatIncomeShare, formatMonthsCovered, formatProfilePeso, PROFILE_STATUS } from "../../../lib/helpers/financialProfileWording";
import type { FinancialPlanSurplusRecommendation } from "../types";

type ProfileValues = { monthsCovered: number | null; debtShare: number | null; margin: number | null };

// Explains the leftover-money suggestion in the Savings & Debt Profile's own words.
export function surplusGuidanceMessage(guidance: FinancialPlanSurplusRecommendation | undefined, values: ProfileValues): string {
  const label = guidance?.advisoryDestination?.label;
  const toward = (fallback: string) => ` We suggest putting it toward ${label ?? fallback}.`;
  switch (guidance?.reasonCode) {
    case "DEBT_SIGNAL":
      return `Debt burden is ${PROFILE_STATUS.debtTooHigh.toLowerCase()}${values.debtShare === null ? "" : `: payments use ${formatIncomeShare(values.debtShare)}`}.${toward("your debt")}`;
    case "EMERGENCY_FUND_INADEQUATE":
      return `Your emergency fund ${PROFILE_STATUS.emergencyBuilding.toLowerCase()}${values.monthsCovered === null ? "" : `: it covers ${formatMonthsCovered(values.monthsCovered)}`}.${toward("your emergency fund")}`;
    case "CREDIT_CARD_SIGNAL":
      return `Your credit card keeps a balance, so paying extra cuts the interest.${toward("your credit card")}`;
    case "REWARD_YOURSELF":
      return `You have ${PROFILE_STATUS.marginLeftOver.toLowerCase()}${values.margin === null ? "" : ` (${formatProfilePeso(values.margin)} a month)`}, so you can choose to spend some of this on things you enjoy.`;
    case "NEGATIVE_FINANCIAL_MARGIN":
      return `Your monthly budget is ${PROFILE_STATUS.marginShort.toLowerCase()}${values.margin === null ? "" : ` by ${formatProfilePeso(values.margin)}`}.${guidance.advisoryDestination ? toward("your debt") : " We suggest keeping this money aside for now."}`;
    default:
      if (guidance?.assessmentStatus === "stale") return "Your Savings & Debt Profile changed since it was last checked, so choose how to use this money.";
      if (guidance?.assessmentStatus === "insufficient_data") return `Your Savings & Debt Profile has ${PROFILE_STATUS.notEnoughData.toLowerCase()}, so choose how to use this money.`;
      return "Choose how to use this money.";
  }
}
