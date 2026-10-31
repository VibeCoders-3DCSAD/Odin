// Income source row, domain and input types plus the row-to-domain mapper.

// ---------------------------------------------------------------------------
// Row types — raw SQLite columns
// ---------------------------------------------------------------------------

export type IncomeSourceRow = {
  id: string;
  user_id: string;
  name: string;
  frequency: string;
  recurring_template_id: string | null;
  destination_account_id: string | null;
  subcategory_id: string | null;
  expected_amount_centavos: number;
  payday_day_of_month: number | null;
  payday_second_day_of_month: number | null;
  payday_day_of_week: number | null;
  next_expected_date: string | null;
  is_active: number;
  notes: string | null;
  metadata: string;
  version: number;
  deleted: number;
  created_at: string;
  updated_at: string;
  last_synced_at: string | null;
};

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

export type IncomeFrequency = "daily" | "weekly" | "semi_monthly" | "monthly";

export type IncomeSource = {
  id: string;
  name: string;
  frequency: IncomeFrequency;
  recurringTemplateId: string | null;
  destinationAccountId: string | null;
  subcategoryId: string | null;
  expectedAmountCentavos: number;
  paydayDayOfMonth: number | null;
  paydaySecondDayOfMonth: number | null;
  paydayDayOfWeek: number | null;
  nextExpectedDate: string | null;
  isActive: boolean;
  notes: string | null;
};

// ---------------------------------------------------------------------------
// Create / update inputs
// ---------------------------------------------------------------------------

export type CreateIncomeSourceInput = {
  name: string;
  frequency: IncomeFrequency;
  destinationAccountId: string;
  subcategoryId: string;
  expectedAmountCentavos: number;
  paydayDayOfMonth?: number | null;
  paydaySecondDayOfMonth?: number | null;
  paydayDayOfWeek?: number | null;
  nextExpectedDate?: string | null;
  isActive?: boolean;
  notes?: string | null;
};

export type UpdateIncomeSourceInput = {
  name?: string;
  frequency?: IncomeFrequency;
  recurringTemplateId?: string | null;
  destinationAccountId?: string | null;
  subcategoryId?: string | null;
  expectedAmountCentavos?: number;
  paydayDayOfMonth?: number | null;
  paydaySecondDayOfMonth?: number | null;
  paydayDayOfWeek?: number | null;
  nextExpectedDate?: string | null;
  isActive?: boolean;
  notes?: string | null;
};

// ---------------------------------------------------------------------------
// Mapper
// ---------------------------------------------------------------------------

export function mapIncomeSource(row: IncomeSourceRow): IncomeSource {
  return {
    id: row.id,
    name: row.name,
    frequency: row.frequency as IncomeFrequency,
    recurringTemplateId: row.recurring_template_id,
    destinationAccountId: row.destination_account_id,
    subcategoryId: row.subcategory_id,
    expectedAmountCentavos: row.expected_amount_centavos,
    paydayDayOfMonth: row.payday_day_of_month,
    paydaySecondDayOfMonth: row.payday_second_day_of_month,
    paydayDayOfWeek: row.payday_day_of_week,
    nextExpectedDate: row.next_expected_date,
    isActive: row.is_active === 1,
    notes: row.notes,
  };
}
