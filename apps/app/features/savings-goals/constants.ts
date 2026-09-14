export const SAVINGS_GOAL_TYPES = ["emergency_fund", "custom"] as const;
export const SAVINGS_GOAL_PRIORITIES = ["low", "medium", "high"] as const;

export type SavingsGoalType = typeof SAVINGS_GOAL_TYPES[number];
export type SavingsGoalPriority = typeof SAVINGS_GOAL_PRIORITIES[number];

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
