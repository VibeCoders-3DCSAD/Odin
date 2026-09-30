import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { createFinancialPlan, getLatestFinancialPlan } from "../../local-db/repositories/financialPlans";
import { requestFinancialPlanRecommendation } from "./api";
import { PlanAllocations } from "./PlanAllocations";
import { PlanReservations } from "./PlanReservations";
import { formatPeso, toCentavos } from "./financialPlanPresentation";
import type { FinancialPlanAllocation, FinancialPlanRecommendation } from "./types";

type Props = { userId: string; deviceId: string; accessToken: string; syncVersion: number; onSyncRequested?: () => Promise<void> };
type State = "loading" | "ready" | "infeasible" | "stale" | "saving" | "saved" | "error";

function savedPlanToRecommendation(savedPlan: NonNullable<Awaited<ReturnType<typeof getLatestFinancialPlan>>>): FinancialPlanRecommendation {
  return {
    status: "RECOMMENDATION_READY",
    period: { start: savedPlan.periodStart, end: savedPlan.periodEnd },
    inputSnapshot: savedPlan.inputSnapshot as FinancialPlanRecommendation["inputSnapshot"],
    recommendation: savedPlan.recommendation as FinancialPlanRecommendation["recommendation"],
    explanations: ["You are viewing your last accepted Financial Plan from this device."],
  };
}

function forecastTrust(snapshot: FinancialPlanRecommendation["inputSnapshot"]): string {
  const quality = snapshot.forecast.quality;
  return typeof quality === "string" ? quality.replace(/_/g, " ").toLowerCase() : "unavailable";
}

export default function FinancialPlanScreen({ userId, deviceId, accessToken, syncVersion, onSyncRequested }: Props) {
  const [plan, setPlan] = useState<FinancialPlanRecommendation | null>(null);
  const [state, setState] = useState<State>("loading");
  const [error, setError] = useState<string | null>(null);
  const requestAbort = useRef<AbortController | null>(null);
  const observedSyncVersion = useRef(syncVersion);

  const loadRecommendation = useCallback(async () => {
    requestAbort.current?.abort();
    const controller = new AbortController();
    requestAbort.current = controller;
    setState("loading");
    setError(null);
    try {
      const { response, body } = await requestFinancialPlanRecommendation(accessToken, controller.signal);
      if (!response.ok || !body.payload) throw new Error(body.message ?? "Your Financial Plan could not be generated.");
      setPlan(body.payload);
      setState(body.payload.status === "INFEASIBLE" ? "infeasible" : "ready");
    } catch (cause) {
      if (cause instanceof Error && cause.name === "AbortError") return;
      const savedPlan = await getLatestFinancialPlan(userId);
      if (savedPlan) {
        setPlan(savedPlanToRecommendation(savedPlan));
        setState("saved");
        return;
      }
      setError(cause instanceof Error ? cause.message : "Your Financial Plan could not be generated.");
      setState("error");
    } finally {
      if (requestAbort.current === controller) requestAbort.current = null;
    }
  }, [accessToken, userId]);

  useEffect(() => { void loadRecommendation(); return () => requestAbort.current?.abort(); }, [loadRecommendation]);

  useEffect(() => {
    if (observedSyncVersion.current === syncVersion) return;
    observedSyncVersion.current = syncVersion;
    setState((current) => current === "ready" ? "stale" : current);
  }, [syncVersion]);

  const updateAllocation = (index: number, change: Partial<FinancialPlanAllocation>) => {
    if (!plan || state === "infeasible" || state === "saved") return;
    const allocations = plan.recommendation.allocations.map((allocation, allocationIndex) => allocationIndex === index ? { ...allocation, ...change } : allocation);
    if (allocations.reduce((sum, allocation) => sum + allocation.allocatedAmountCentavos, 0) > plan.recommendation.availableFundsCentavos) {
      setError("Flexible allocations cannot exceed the money available for categories.");
      return;
    }
    setError(null);
    setPlan({ ...plan, recommendation: { ...plan.recommendation, allocations } });
    setState("ready");
  };

  const savePlan = async () => {
    if (!plan || state !== "ready") return;
    setState("saving");
    setError(null);
    try {
      await createFinancialPlan(userId, deviceId, {
        periodStart: plan.period.start,
        periodEnd: plan.period.end,
        inputSnapshot: plan.inputSnapshot,
        recommendation: plan.recommendation,
        allocations: plan.recommendation.allocations,
        debtReservations: plan.recommendation.debtReservations.map(({ debtAccountId, creditCardStatementId, amountCentavos, dueDate }) => ({ debtAccountId, creditCardStatementId, amountCentavos, dueDate })),
        savingsReservations: plan.recommendation.savingsReservations.filter((reservation) => reservation.savingsGoalId).map(({ savingsGoalId, amountCentavos, dueDate }) => ({ savingsGoalId: savingsGoalId!, amountCentavos, dueDate })),
      });
      try { await onSyncRequested?.(); } catch {}
      setState("saved");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Your Financial Plan could not be saved.");
      setState("error");
    }
  };

  if (state === "loading") return <View style={{ paddingTop: 32, alignItems: "center" }}><ActivityIndicator color="#0E6D46" /><Text style={{ fontFamily: "Manrope", fontSize: 12, color: "#6B7A6F", marginTop: 10 }}>Preparing your next-month plan...</Text></View>;
  if (!plan) return <View style={{ marginTop: 16, backgroundColor: "#FBE9E7", borderRadius: 16, padding: 16 }}><Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 15, color: "#D9001F" }}>Plan unavailable</Text><Text style={{ fontFamily: "Manrope", fontSize: 12, color: "#414942", marginTop: 5 }}>{error ?? "Your Financial Plan could not be generated."}</Text><Pressable accessibilityRole="button" accessibilityLabel="Retry Financial Plan" onPress={() => void loadRecommendation()} style={{ marginTop: 12 }}><Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 12, color: "#0E6D46" }}>Try again</Text></Pressable></View>;

  const { recommendation } = plan;
  return (
    <View style={{ paddingBottom: 28 }}>
      <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 20, color: "#1B1C1A" }}>Financial Plan</Text>
      <Text style={{ fontFamily: "Manrope", fontSize: 12, color: "#6B7A6F", marginTop: 2 }}>Review your plan for {plan.period.start} to {plan.period.end}.</Text>
      <View style={{ marginTop: 16, backgroundColor: "#EEFFF8", borderRadius: 16, padding: 15 }}><Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 14, color: "#1B1C1A" }}>Forecast trust: {forecastTrust(plan.inputSnapshot)}</Text><Text style={{ fontFamily: "Manrope", fontSize: 11.5, color: "#416153", marginTop: 4 }}>Recommendations use your forecast, commitments, and latest Financial Condition Assessment.</Text></View>
      {state === "infeasible" ? <View accessibilityRole="alert" style={{ marginTop: 16, borderRadius: 16, padding: 16, backgroundColor: "#FFF0F2" }}><Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 15, color: "#D9001F" }}>This plan cannot cover all requirements</Text><Text style={{ fontFamily: "Manrope", fontSize: 12, color: "#414942", marginTop: 5 }}>Shortfall: {formatPeso(recommendation.shortfallCentavos ?? 0)}. Fixed and minimum commitments were not reduced.</Text></View> : null}
      <PlanReservations title="Debt reservations" reservations={recommendation.debtReservations} />
      <PlanReservations title="Savings reservations" reservations={recommendation.savingsReservations} />
      <View style={{ marginTop: 16, borderRadius: 16, padding: 16, backgroundColor: "#013220" }}><Text style={{ fontFamily: "Manrope", fontSize: 12, color: "#D7EEE2" }}>Available for categories</Text><Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 25, color: "#FFFFFF", marginTop: 2 }}>{formatPeso(recommendation.availableFundsCentavos)}</Text></View>
      <PlanAllocations allocations={recommendation.allocations} onFlexibleAmountChange={(index, amount) => { const value = toCentavos(amount); if (value != null) updateAllocation(index, { allocatedAmountCentavos: value }); }} onWeightChange={(index, weight) => { const value = Number(weight); if (Number.isFinite(value) && value >= 0 && value <= 100) updateAllocation(index, { subcategoryWeightBps: Math.round(value * 100) }); }} />
      {plan.explanations.map((explanation, index) => <Text key={`${explanation}-${index}`} style={{ fontFamily: "Manrope", fontSize: 11.5, color: "#6B7A6F", marginTop: 8 }}>{explanation}</Text>)}
      {state === "stale" ? <Text accessibilityRole="alert" style={{ fontFamily: "Manrope", fontSize: 12, color: "#B45309", marginTop: 16 }}>Your source data changed. Refresh this unaccepted recommendation before saving.</Text> : null}
       {state === "saved" ? <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 12, color: "#087A51", marginTop: 16 }}>Saved Financial Plan. It will sync when a connection is available.</Text> : null}
      {error ? <Text accessibilityRole="alert" style={{ fontFamily: "Manrope", fontSize: 12, color: "#D9001F", marginTop: 16 }}>{error}</Text> : null}
      {state !== "infeasible" && state !== "saved" ? <Pressable accessibilityRole="button" accessibilityLabel={state === "stale" ? "Refresh Financial Plan recommendation" : "Accept and save Financial Plan"} disabled={state === "saving"} onPress={() => state === "stale" ? void loadRecommendation() : void savePlan()} style={{ backgroundColor: "#013220", borderRadius: 14, padding: 14, marginTop: 18, opacity: state === "saving" ? 0.6 : 1 }}><Text style={{ fontFamily: "Manrope", fontWeight: "800", color: "#FFFFFF", textAlign: "center" }}>{state === "saving" ? "Saving..." : state === "stale" ? "Refresh recommendation" : "Accept and save plan"}</Text></Pressable> : null}
      {state === "infeasible" ? <Pressable accessibilityRole="button" accessibilityLabel="Refresh Financial Plan" onPress={() => void loadRecommendation()} style={{ marginTop: 16 }}><Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 12, color: "#0E6D46", textAlign: "center" }}>Refresh plan</Text></Pressable> : null}
    </View>
  );
}
