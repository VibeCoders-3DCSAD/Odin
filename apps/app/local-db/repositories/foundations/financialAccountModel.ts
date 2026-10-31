// Financial account row, domain and input types plus the row-to-domain mapper.

// ---------------------------------------------------------------------------
// Row types — raw SQLite columns
// ---------------------------------------------------------------------------

export type FinancialAccountRow = {
  id: string;
  user_id: string;
  name: string;
  kind: string;
  status: string;
  opening_balance_centavos: number;
  current_balance_centavos: number;
  include_in_dashboard_balance: number;
  institution_name: string | null;
  opened_on: string | null;
  archived_at: string | null;
  deleted_at: string | null;
  sort_order: number;
  metadata: string;
  version: number;
  deleted: number;
  created_at: string;
  updated_at: string;
  last_synced_at: string | null;
  cc_credit_limit_centavos: number | null;
  cc_available_credit_centavos: number | null;
  cc_reconciled_available_credit_centavos: number | null;
  cc_pre_reconciliation_available_credit_centavos: number | null;
  cc_available_credit_reconciled_at: string | null;
  cc_issuer: string | null;
  cc_notes: string | null;
  cc_billing_cycle_days: number | null;
  cc_cutoff_day: number | null;
  cc_statement_day: number | null;
  cc_alert_threshold_percent: number | null;
  cc_allows_extra_payments: number | null;
  cc_repayment_strategy: CreditCardRepaymentStrategy | null;
  cc_repayment_custom_amount_centavos: number | null;
  cc_repayment_percentage_bps: number | null;
  sa_account_type?: "personal_savings" | "high_yield_savings" | "time_deposit" | null;
};

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

export type FinancialAccountKind =
  | "cash"
  | "bank"
  | "e_wallet"
  | "savings"
  | "credit_card"
  | "other";

export type FinancialAccountStatus = "active" | "archived";

export type FinancialAccount = {
  id: string;
  name: string;
  kind: FinancialAccountKind;
  status: FinancialAccountStatus;
  openingBalanceCentavos: number;
  currentBalanceCentavos: number;
  includeInDashboardBalance: boolean;
  institutionName: string | null;
  openedOn: string | null;
  archivedAt: string | null;
  sortOrder: number;
  savingsAccountType?: "personal_savings" | "high_yield_savings" | "time_deposit" | null;
  creditCardDetails: CreditCardDetails | null;
};

export type CreditCardDetails = {
  creditLimitCentavos: number;
  availableCreditCentavos: number | null;
  reconciledAvailableCreditCentavos: number | null;
  preReconciliationAvailableCreditCentavos: number | null;
  availableCreditReconciledAt: string | null;
  issuer: string | null;
  notes: string | null;
  billingCycleDays: number | null;
  cutoffDay: number;
  statementDay: number | null;
  alertThresholdPercent: number | null;
  allowsExtraPayments: boolean;
  repaymentStrategy: CreditCardRepaymentStrategy | null;
  repaymentCustomAmountCentavos: number | null;
  repaymentPercentageBps: number | null;
};

export type CreditCardRepaymentStrategy = "pay_in_full" | "pay_minimum" | "percentage_of_statement" | "custom_payment";

export type CreditCardDetailsInput = {
  creditLimitCentavos: number;
  billingCycleDays?: number | null;
  cutoffDay: number;
  statementDay?: number | null;
  alertThresholdPercent: number;
  allowsExtraPayments?: boolean;
};


// ---------------------------------------------------------------------------
// Create / update inputs
// ---------------------------------------------------------------------------

export type CreateFinancialAccountInput = {
  name: string;
  kind: FinancialAccountKind;
  openingBalanceCentavos?: number;
  includeInDashboardBalance?: boolean;
  institutionName?: string | null;
  openedOn?: string | null;
  sortOrder?: number;
  creditCardDetails?: CreditCardDetailsInput;
};

export type UpdateFinancialAccountInput = {
  name?: string;
  kind?: FinancialAccountKind;
  status?: FinancialAccountStatus;
  openingBalanceCentavos?: number;
  currentBalanceCentavos?: number;
  includeInDashboardBalance?: boolean;
  institutionName?: string | null;
  openedOn?: string | null;
  archivedAt?: string | null;
  sortOrder?: number;
  creditCardDetails?: CreditCardDetailsInput;
};

// ---------------------------------------------------------------------------
// Mapper
// ---------------------------------------------------------------------------

export function mapAccount(row: FinancialAccountRow): FinancialAccount {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind as FinancialAccountKind,
    status: row.status as FinancialAccountStatus,
    openingBalanceCentavos: row.opening_balance_centavos,
    currentBalanceCentavos: row.current_balance_centavos,
    includeInDashboardBalance: row.include_in_dashboard_balance === 1,
    institutionName: row.institution_name,
    openedOn: row.opened_on,
    archivedAt: row.archived_at,
    sortOrder: row.sort_order,
    savingsAccountType: row.sa_account_type ?? null,
    creditCardDetails:
      row.kind === "credit_card" && row.cc_credit_limit_centavos != null
        ? {
            creditLimitCentavos: row.cc_credit_limit_centavos,
            availableCreditCentavos: row.cc_available_credit_centavos,
            reconciledAvailableCreditCentavos: row.cc_reconciled_available_credit_centavos,
            preReconciliationAvailableCreditCentavos: row.cc_pre_reconciliation_available_credit_centavos,
            availableCreditReconciledAt: row.cc_available_credit_reconciled_at,
            issuer: row.cc_issuer,
            notes: row.cc_notes,
            billingCycleDays: row.cc_billing_cycle_days,
            cutoffDay: row.cc_cutoff_day ?? 0,
            statementDay: row.cc_statement_day,
            alertThresholdPercent: row.cc_alert_threshold_percent,
            allowsExtraPayments: row.cc_allows_extra_payments === 1,
            repaymentStrategy: row.cc_repayment_strategy,
            repaymentCustomAmountCentavos: row.cc_repayment_custom_amount_centavos,
            repaymentPercentageBps: row.cc_repayment_percentage_bps,
          }
        : null,
  };
}

// ---------------------------------------------------------------------------
// Allowed values
// ---------------------------------------------------------------------------

export const VALID_ACCOUNT_KINDS: FinancialAccountKind[] = [
  "cash",
  "bank",
  "e_wallet",
  "savings",
  "credit_card",
  "other",
];

export const VALID_ACCOUNT_STATUSES: FinancialAccountStatus[] = [
  "active",
  "archived",
];
