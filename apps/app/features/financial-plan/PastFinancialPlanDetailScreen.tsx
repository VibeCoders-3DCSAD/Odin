import { useEffect, useState } from "react";
import { ArrowLeft } from "phosphor-react-native";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { getFinancialPlan, getFinancialPlanLabels, type AcceptedFinancialPlan } from "../../local-db/repositories/financialPlans";
import { getPlanCommitmentReview } from "../../local-db/repositories/financialPlanCommitmentReview";
import { getPlanSpendingReview } from "../../local-db/repositories/financialPlanSpendingReview";
import { PastPlanCommitmentsSection, type PastPlanCommitmentItem } from "./PastPlanCommitmentsSection";
import { PlanScheduledPayments } from "./PlanScheduledPayments";
import { PastPlanSpendingSection } from "./PastPlanSpendingSection";
import { formatPeso, formatPlanMonthLabel, labelWithRemovedSuffix, type FinancialPlanLabels } from "./financialPlanPresentation";
import type { PlanCommitmentReview, PlanSpendingReview } from "./pastPlanTypes";

export type PastFinancialPlanDetailScreenProps = {
  userId: string;
  planId: string;
  onBack: () => void;
};

type LoadedPlan = { plan: AcceptedFinancialPlan; labels: FinancialPlanLabels; spending: PlanSpendingReview; commitments: PlanCommitmentReview };
type LoadState = { status: "loading" } | { status: "not_found" } | { status: "error" } | { status: "ready"; data: LoadedPlan };

/** Adds goals and debts that only have unplanned activity so their labels resolve too. */
function withReviewedReferences(plan: AcceptedFinancialPlan, review: PlanCommitmentReview): Pick<AcceptedFinancialPlan, "recommendation"> {
  const recommendation = plan.recommendation as { debtReservations?: unknown[]; savingsReservations?: unknown[] };
  return {
    recommendation: {
      ...plan.recommendation,
      savingsReservations: [...(recommendation.savingsReservations ?? []), ...review.savings.map((row) => ({ savingsGoalId: row.savingsGoalId, amountCentavos: 0 }))],
      debtReservations: [...(recommendation.debtReservations ?? []), ...review.debts.map((row) => ({ debtAccountId: row.debtAccountId, creditCardStatementId: row.creditCardStatementId, amountCentavos: 0 }))],
    },
  };
}

function savingsItems(review: PlanCommitmentReview, labels: FinancialPlanLabels): PastPlanCommitmentItem[] {
  return review.savings.map((row) => ({
    key: row.savingsGoalId,
    label: labelWithRemovedSuffix(labels.savingsGoals[row.savingsGoalId] ?? "Savings goal", row.savingsGoalId, labels.removedIds),
    reservedCentavos: row.reservedCentavos,
    actualCentavos: row.actualCentavos,
    additionalCentavos: row.additionalCentavos,
    status: row.status,
  }));
}

function debtItems(review: PlanCommitmentReview, labels: FinancialPlanLabels): PastPlanCommitmentItem[] {
  return review.debts.map((row) => {
    const id = row.debtAccountId ?? row.creditCardStatementId;
    const label = row.debtAccountId ? labels.debtAccounts[row.debtAccountId] ?? "Debt account" : (row.creditCardStatementId ? labels.creditCardStatements[row.creditCardStatementId] : undefined) ?? "Credit card statement";
    return { key: `${row.debtAccountId ? "debt" : "statement"}:${id}`, label: labelWithRemovedSuffix(label, id, labels.removedIds), reservedCentavos: row.reservedCentavos, actualCentavos: row.actualCentavos, additionalCentavos: row.additionalCentavos, status: row.status };
  });
}

function stringField(record: unknown, field: string): string | null {
  const value = record && typeof record === "object" ? (record as Record<string, unknown>)[field] : undefined;
  return typeof value === "string" && value.length > 0 ? value : null;
}

function numberField(record: Record<string, unknown>, field: string): number | null {
  const value = record[field];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function formatAssessedAt(value: string | null): string {
  if (!value) return "Not assessed";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric", timeZone: "Asia/Manila" });
}

function SnapshotRow({ label, value }: { label: string; value: string }) {
  return <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12, marginTop: 8 }}><Text style={{ flex: 1, fontFamily: "Manrope", fontSize: 12, color: "#414942" }}>{label}</Text><Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 12, color: "#1B1C1A" }}>{value}</Text></View>;
}

function PlanSnapshotFooter({ plan }: { plan: AcceptedFinancialPlan }) {
  const forecast = plan.inputSnapshot.forecast;
  const classification = plan.inputSnapshot.classification;
  const shortfallCentavos = numberField(plan.recommendation, "shortfallCentavos");
  return (
    <View style={{ marginTop: 16, borderWidth: 1, borderColor: "#EAEAE6", borderRadius: 16, padding: 16 }}>
      <Text accessibilityRole="header" style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 15, color: "#1B1C1A" }}>Plan snapshot</Text>
      <Text style={{ fontFamily: "Manrope", fontSize: 11, color: "#6B7A6F", marginTop: 3 }}>Saved when this plan was accepted. It cannot be changed.</Text>
      <SnapshotRow label="Available funds" value={formatPeso(numberField(plan.recommendation, "availableFundsCentavos") ?? 0)} />
      {shortfallCentavos ? <SnapshotRow label="Shortfall" value={formatPeso(shortfallCentavos)} /> : null}
      <SnapshotRow label="Forecast model" value={stringField(forecast, "modelVersion") ?? "Unknown"} />
      <SnapshotRow label="Forecast quality" value={stringField(forecast, "quality") ?? "Unknown"} />
      <SnapshotRow label="Classification status" value={stringField(classification, "status") ?? "Not assessed"} />
      <SnapshotRow label="Assessed on" value={formatAssessedAt(stringField(classification, "assessed_at"))} />
    </View>
  );
}

export default function PastFinancialPlanDetailScreen({ userId, planId, onBack }: PastFinancialPlanDetailScreenProps) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    void (async () => {
      try {
        const [plan, spending, commitments] = await Promise.all([getFinancialPlan(userId, planId), getPlanSpendingReview(userId, planId), getPlanCommitmentReview(userId, planId)]);
        if (!plan || !spending || !commitments) {
          if (!cancelled) setState({ status: "not_found" });
          return;
        }
        const labels = await getFinancialPlanLabels(userId, withReviewedReferences(plan, commitments), { includeDeleted: true });
        if (!cancelled) setState({ status: "ready", data: { plan, labels, spending, commitments } });
      } catch {
        if (!cancelled) setState({ status: "error" });
      }
    })();
    return () => { cancelled = true; };
  }, [userId, planId, reloadKey]);

  const backButton = <Pressable accessibilityRole="button" accessibilityLabel="Back to past plans" onPress={onBack} style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 14 }}><ArrowLeft size={18} color="#1B1C1A" weight="bold" /><Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 14, color: "#6B7A6F" }}>Past plans</Text></Pressable>;

  if (state.status === "loading") return <View>{backButton}<View style={{ paddingTop: 32, alignItems: "center" }}><ActivityIndicator color="#0E6D46" /><Text style={{ fontFamily: "Manrope", fontSize: 12, color: "#6B7A6F", marginTop: 10 }}>Loading past plan...</Text></View></View>;
  if (state.status === "not_found") return <View>{backButton}<View style={{ backgroundColor: "#F1F0EB", borderRadius: 16, padding: 16 }}><Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 15, color: "#1B1C1A" }}>Plan not found</Text><Text style={{ fontFamily: "Manrope", fontSize: 12, color: "#414942", marginTop: 5 }}>This Financial Plan is not available on this device.</Text></View></View>;
  if (state.status === "error") return <View>{backButton}<View accessibilityRole="alert" style={{ backgroundColor: "#FBE9E7", borderRadius: 16, padding: 16 }}><Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 15, color: "#D9001F" }}>Plan unavailable</Text><Text style={{ fontFamily: "Manrope", fontSize: 12, color: "#414942", marginTop: 5 }}>This past Financial Plan could not be loaded.</Text><Pressable accessibilityRole="button" accessibilityLabel="Retry loading past plan" onPress={() => setReloadKey((key) => key + 1)} style={{ marginTop: 12 }}><Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 12, color: "#0E6D46" }}>Try again</Text></Pressable></View></View>;

  const { plan, labels, spending, commitments } = state.data;
  return (
    <View style={{ paddingBottom: 28 }}>
      {backButton}
      <Text accessibilityRole="header" style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 20, color: "#1B1C1A" }}>{formatPlanMonthLabel(plan.periodStart)}</Text>
      <Text style={{ fontFamily: "Manrope", fontSize: 12, color: "#6B7A6F", marginTop: 2 }}>Plan period {plan.periodStart} to {plan.periodEnd}</Text>
      <Text accessibilityRole="header" style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 16, color: "#1B1C1A", marginTop: 16 }}>Savings &amp; Debt</Text>
      <PastPlanCommitmentsSection title="Savings" kind="savings" items={savingsItems(commitments, labels)} emptyText="No savings reservations or contributions for this period." />
      <PastPlanCommitmentsSection title="Debt" kind="debt" items={debtItems(commitments, labels)} emptyText="No debt reservations or payments for this period." />
      <PlanScheduledPayments obligations={plan.inputSnapshot.obligations} />
      <PastPlanSpendingSection review={spending} labels={labels} />
      <PlanSnapshotFooter plan={plan} />
    </View>
  );
}
