import type { SupabaseClient } from "@supabase/supabase-js";
import { financialPlanPeriod } from "./recommendationService.js";
import { FinancialPlanUnavailableError } from "./errors.js";
import { DEBT_COMMITMENT_FIELDS, SAVINGS_COMMITMENT_FIELDS, debtCommitments, savingsCommitments, statementCommitments } from "./commitments.js";
import { scheduledPaymentReservations, type ScheduledPaymentRow } from "./scheduledPaymentDates.js";
export async function getFinancialPlanCommitments(userId: string, supabase: SupabaseClient, planMonth?: string) {
  const period = financialPlanPeriod(planMonth);
  const previousMonth = new Date(`${period.start}T00:00:00Z`);
  previousMonth.setUTCMonth(previousMonth.getUTCMonth() - 1);
  const results = await Promise.all([
    supabase.from("debt_accounts").select(DEBT_COMMITMENT_FIELDS).eq("user_id", userId).eq("status", "active").eq("deleted", false).limit(100),
    supabase.from("savings_goals").select(SAVINGS_COMMITMENT_FIELDS).eq("user_id", userId).eq("status", "active").eq("deleted", false).limit(100),
    supabase.from("credit_card_statements").select("id, minimum_due_centavos, due_date").eq("user_id", userId).eq("authoritative", true).eq("deleted", false).gte("due_date", period.start).lte("due_date", period.end).limit(100),
    supabase.from("credit_card_payments").select("statement_id, amount_centavos").eq("user_id", userId).eq("deleted", false).gte("payment_date", previousMonth.toISOString().slice(0, 10)).lte("payment_date", period.end).limit(500),
    supabase.from("scheduled_payments").select("id, amount_centavos, frequency, due_day_of_month, due_second_day_of_month, due_day_of_week, due_month, starts_on, ends_on").eq("user_id", userId).eq("status", "active").eq("deleted", false).limit(200),
    supabase.from("scheduled_payment_records").select("scheduled_payment_id, occurrence_date, amount_centavos").eq("user_id", userId).eq("deleted", false).gte("occurrence_date", period.start).lte("occurrence_date", period.end).limit(1000),
  ]);
  if (results.some((result) => result.error)) throw new FinancialPlanUnavailableError("Commitments could not be loaded");
  return {
    period,
    debtReservations: [...debtCommitments((results[0]!.data ?? []) as unknown as Parameters<typeof debtCommitments>[0], period), ...statementCommitments((results[2]!.data ?? []) as unknown as Parameters<typeof statementCommitments>[0], (results[3]!.data ?? []) as unknown as Parameters<typeof statementCommitments>[1])],
    savingsReservations: savingsCommitments((results[1]!.data ?? []) as unknown as Parameters<typeof savingsCommitments>[0], period),
    obligations: scheduledPaymentReservations((results[4]!.data ?? []) as ScheduledPaymentRow[], (results[5]!.data ?? []) as Parameters<typeof scheduledPaymentReservations>[1], period),
  };
}
