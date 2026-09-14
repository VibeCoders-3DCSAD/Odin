import { SAVINGS_GOAL_CATEGORIES, SAVINGS_GOAL_PRIORITIES, type SavingsGoalCategory, type SavingsGoalPriority } from "./types";

export const SAVINGS_GOAL_TYPES = SAVINGS_GOAL_CATEGORIES;
export { SAVINGS_GOAL_PRIORITIES };
export type SavingsGoalType = SavingsGoalCategory;
export type { SavingsGoalPriority };

export const SAVINGS_GOAL_TYPE_LABELS: Record<SavingsGoalType, string> = {
  emergency_fund: "Emergency Fund",
  custom: "Custom",
};

export const SAVINGS_GOAL_PRIORITY_LABELS: Record<SavingsGoalPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

export const SAVINGS_GOAL_PLACEHOLDERS = {
  name: "e.g. New laptop",
  targetAmount: "0.00",
  startingAmount: "0.00",
  targetDate: "YYYY-MM-DD",
};
