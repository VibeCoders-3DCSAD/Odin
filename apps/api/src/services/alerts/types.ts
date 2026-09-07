export type AlertSeverity = "low" | "medium" | "high" | "critical";

export type AlertCategory = "anomaly_detection" | "budget_overspending";

export type AlertDecision = "alert" | "no_alert" | "insufficient_history";

export type AlertReference = {
  merchant_name?: string;
  transaction_id?: string;
  subcategory_id?: string;
  budget_id?: string;
  budget_allocation_id?: string;
};

export type FeatureDriver = {
  key: string;
  label: string;
  value_centavos: number;
  baseline_centavos: number | null;
  deviation_percent: number | null;
};

export type SuppressionDecision = {
  suppressed: boolean;
  reason: "none" | "expected_recurring_spending" | "rule";
};

export type DetectionResult = {
  category: AlertCategory;
  evaluated_at: string;
  decision: AlertDecision;
  should_alert_user: boolean;
  severity: AlertSeverity | null;
  explanation: string;
  feature_drivers: FeatureDriver[];
  references: AlertReference;
  suppression: SuppressionDecision;
};

export type AlertTransaction = {
  id: string;
  amount_centavos: number;
  transaction_date: string;
  transaction_type: "income" | "expense" | "transfer";
  merchant_name: string | null;
  category_id: string | null;
  subcategory_id: string | null;
  subcategory_label: string | null;
};

export type AnomalyProviderInput = {
  transaction: AlertTransaction;
  historical_transactions: AlertTransaction[];
  now?: Date;
  minimum_history_count?: number;
  anomaly_multiplier?: number;
};

export type BudgetAllocation = {
  budget_id: string;
  budget_allocation_id: string;
  amount_centavos: number;
  category_id: string | null;
  subcategory_id: string | null;
  cycle_start: string;
  cycle_end: string;
};

export type OverspendingProviderInput = {
  allocation: BudgetAllocation;
  transactions: AlertTransaction[];
  now?: Date;
};

export interface AnomalyProvider {
  evaluate(input: AnomalyProviderInput): DetectionResult;
}

export interface OverspendingProvider {
  evaluate(input: OverspendingProviderInput): DetectionResult;
}

export interface AlertIntelligenceProvider {
  readonly name: "rules" | "ml";
  readonly anomaly: AnomalyProvider;
  readonly overspending: OverspendingProvider;
}
