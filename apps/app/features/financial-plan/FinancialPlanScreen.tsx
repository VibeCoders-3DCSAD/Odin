import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { createFinancialPlan, getFinancialPlanAllocationSpending, getFinancialPlanLabels, getFinancialPlanSpentAmount, getLatestFinancialPlan } from "../../local-db/repositories/financialPlans";
import { listRecentExpenseCategoryIds, listRecentExpenseSubcategoryIds } from "../../local-db/repositories/forecastTransactions";
import { listCategories, listSubcategories, updateCategory, updateSubcategory, type Category, type Subcategory } from "../../local-db/repositories/taxonomy";
import { listIncomeSources } from "../../local-db/repositories/financialFoundations";
import { listDebtAccounts } from "../../local-db/repositories/debtAccounts";
import { getIncomeSummary } from "../../local-db/repositories/incomeSummary";
import { requestFinancialPlanRecommendation } from "./api";
import { PlanAllocations } from "./PlanAllocations";
import { PlanCategorySelection } from "./PlanCategorySelection";
import { PlanReservations } from "./PlanReservations";
import { applyFinancialPlanLabels, applyFinancialPlanSpending, formatPeso, remainingUnallocatedCentavos, toCentavos } from "./financialPlanPresentation";
import type { FinancialPlanAllocation, FinancialPlanRecommendation } from "./types";
import type { PlanCategoryRuleUpdate } from "./PlanCategoryRuleEditor";

type Props = { userId: string; deviceId: string; accessToken: string; syncVersion: number; onSyncRequested?: () => Promise<void> };
type State = "loading" | "selecting" | "ready" | "infeasible" | "stale" | "saving" | "saved" | "error";

function savedPlanToRecommendation(savedPlan: NonNullable<Awaited<ReturnType<typeof getLatestFinancialPlan>>>): FinancialPlanRecommendation {
  return {
    status: "RECOMMENDATION_READY",
    period: { start: savedPlan.periodStart, end: savedPlan.periodEnd },
    inputSnapshot: savedPlan.inputSnapshot as FinancialPlanRecommendation["inputSnapshot"],
    recommendation: savedPlan.recommendation as FinancialPlanRecommendation["recommendation"],
    explanations: ["You are viewing your last accepted Financial Plan from this device."],
  };
}

export default function FinancialPlanScreen({ userId, deviceId, accessToken, syncVersion, onSyncRequested }: Props) {
  const [plan, setPlan] = useState<FinancialPlanRecommendation | null>(null);
  const [state, setState] = useState<State>("loading");
  const [error, setError] = useState<string | null>(null);
  const [planSpentCentavos, setPlanSpentCentavos] = useState(0);
  const [categories, setCategories] = useState<Subcategory[]>([]);
  const [topLevelCategories, setTopLevelCategories] = useState<Category[]>([]);
  const [includedIds, setIncludedIds] = useState<Set<string>>(new Set());
  const [includedCategoryIds, setIncludedCategoryIds] = useState<Set<string>>(new Set());
  const [recommendedIds, setRecommendedIds] = useState<Set<string>>(new Set());
  const [recommendedCategoryIds, setRecommendedCategoryIds] = useState<Set<string>>(new Set());
  const [availableMoneyCentavos, setAvailableMoneyCentavos] = useState(0);
  const [plannedAmount, setPlannedAmount] = useState("");
  const requestAbort = useRef<AbortController | null>(null);
  const observedSyncVersion = useRef(syncVersion);

  const plannedAmountCentavos = toCentavos(plannedAmount);
  const planningAmountError = plannedAmountCentavos === null || plannedAmountCentavos <= 0
    ? "Enter an amount greater than zero."
    : plannedAmountCentavos > availableMoneyCentavos
      ? "Your planning amount cannot exceed available money."
      : null;

  const loadRecommendation = useCallback(async () => {
    if (plannedAmountCentavos === null || planningAmountError) return;
    requestAbort.current?.abort();
    const controller = new AbortController();
    requestAbort.current = controller;
    setState("loading");
    setError(null);
    try {
      const { response, body } = await requestFinancialPlanRecommendation(accessToken, [...includedIds], [...includedCategoryIds], plannedAmountCentavos, controller.signal);
      if (!response.ok || !body.payload) throw new Error(body.message ?? "Your Financial Plan could not be generated.");
      const labels = await getFinancialPlanLabels(userId, { recommendation: body.payload.recommendation });
      setPlan({ ...body.payload, recommendation: applyFinancialPlanLabels(body.payload.recommendation, labels) });
      setState(body.payload.status === "INFEASIBLE" ? "infeasible" : "ready");
    } catch (cause) {
      if (cause instanceof Error && cause.name === "AbortError") return;
      const savedPlan = await getLatestFinancialPlan(userId);
      if (savedPlan) {
        const savedRecommendation = savedPlanToRecommendation(savedPlan);
        const [labels, spending, spentAmount] = await Promise.all([getFinancialPlanLabels(userId, savedPlan), getFinancialPlanAllocationSpending(userId, savedPlan.id), getFinancialPlanSpentAmount(userId, savedPlan.id)]);
        setPlan({ ...savedRecommendation, recommendation: applyFinancialPlanLabels({ ...savedRecommendation.recommendation, allocations: applyFinancialPlanSpending(savedRecommendation.recommendation.allocations, spending) }, labels) });
        setPlanSpentCentavos(spentAmount);
        setState("saved");
        return;
      }
      setError(cause instanceof Error ? cause.message : "Your Financial Plan could not be generated.");
      setState("error");
    } finally {
      if (requestAbort.current === controller) requestAbort.current = null;
    }
  }, [accessToken, includedCategoryIds, includedIds, plannedAmountCentavos, planningAmountError, userId]);

  useEffect(() => {
    let active = true;
    void Promise.all([listCategories(userId), listSubcategories(userId, undefined, "expense"), listRecentExpenseSubcategoryIds(userId), listRecentExpenseCategoryIds(userId), getLatestFinancialPlan(userId), listIncomeSources(userId), listDebtAccounts(userId)]).then(async ([topLevelResult, result, recentIds, recentCategoryIds, savedPlan, incomeSources, debts]) => {
      if (!active) return;
      if (savedPlan) {
        const savedRecommendation = savedPlanToRecommendation(savedPlan);
        const [labels, spending, spentAmount] = await Promise.all([getFinancialPlanLabels(userId, savedPlan), getFinancialPlanAllocationSpending(userId, savedPlan.id), getFinancialPlanSpentAmount(userId, savedPlan.id)]);
        if (!active) return;
        setPlan({ ...savedRecommendation, recommendation: applyFinancialPlanLabels({ ...savedRecommendation.recommendation, allocations: applyFinancialPlanSpending(savedRecommendation.recommendation.allocations, spending) }, labels) });
        setPlanSpentCentavos(spentAmount);
        setState("saved");
        return;
      }
      setTopLevelCategories(topLevelResult);
      setCategories(result);
      const validRecentIds = new Set(recentIds.filter((id) => result.some((category) => category.id === id)));
      const requiredIds = result.filter((category) => category.fixed_amount_centavos !== null || category.minimum_amount_centavos !== null).map((category) => category.id);
      const validRecentCategoryIds = new Set(recentCategoryIds.filter((id) => topLevelResult.some((category) => category.id === id)));
      const requiredCategoryIds = topLevelResult.filter((category) => category.fixed_amount_centavos != null || category.minimum_amount_centavos != null).map((category) => category.id);
      setRecommendedIds(validRecentIds);
      setRecommendedCategoryIds(validRecentCategoryIds);
      setIncludedIds(new Set([...requiredIds, ...validRecentIds]));
      setIncludedCategoryIds(new Set([...requiredCategoryIds, ...validRecentCategoryIds]));
      const available = getIncomeSummary(incomeSources, debts).netMonthlyCentavos;
      setAvailableMoneyCentavos(available);
      setPlannedAmount((current) => current || (available / 100).toFixed(2));
      setState("selecting");
    }).catch((cause) => {
      if (!active) return;
      setError(cause instanceof Error ? cause.message : "Your expense categories could not be loaded.");
      setState("error");
    });
    return () => { active = false; requestAbort.current?.abort(); };
  }, [userId]);

  useEffect(() => {
    if (observedSyncVersion.current === syncVersion) return;
    observedSyncVersion.current = syncVersion;
    if (state !== "saved") {
      setState((current) => current === "ready" ? "stale" : current);
      return;
    }
    void getLatestFinancialPlan(userId).then(async (savedPlan) => {
      if (!savedPlan) return;
      const savedRecommendation = savedPlanToRecommendation(savedPlan);
      const [labels, spending, spentAmount] = await Promise.all([getFinancialPlanLabels(userId, savedPlan), getFinancialPlanAllocationSpending(userId, savedPlan.id), getFinancialPlanSpentAmount(userId, savedPlan.id)]);
      setPlan({ ...savedRecommendation, recommendation: applyFinancialPlanLabels({ ...savedRecommendation.recommendation, allocations: applyFinancialPlanSpending(savedRecommendation.recommendation.allocations, spending) }, labels) });
      setPlanSpentCentavos(spentAmount);
    }).catch(() => {});
  }, [state, syncVersion, userId]);

  const updateAllocation = (index: number, change: Partial<FinancialPlanAllocation>) => {
    if (!plan || state === "infeasible" || state === "saved") return;
    const allocations = plan.recommendation.allocations.map((allocation, allocationIndex) => allocationIndex === index ? { ...allocation, ...change } : allocation);
    setError(null);
    setPlan({ ...plan, recommendation: { ...plan.recommendation, allocations } });
    setState("ready");
  };

  const updateSurplus = (field: "debtSurplusCentavos" | "savingsSurplusCentavos", amount: string) => {
    if (!plan || state === "infeasible" || state === "saved") return;
    const value = toCentavos(amount);
    if (value == null) return;
    setError(null);
    setPlan({ ...plan, recommendation: { ...plan.recommendation, [field]: value } });
    setState("ready");
  };

  const toggleSubcategory = (id: string) => {
    setIncludedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    const categoryId = categories.find((category) => category.id === id)?.category_id;
    if (categoryId) setIncludedCategoryIds((current) => { const next = new Set(current); next.delete(categoryId); return next; });
  };

  const toggleTopLevelCategory = (id: string) => {
    setIncludedCategoryIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    setIncludedIds((current) => new Set([...current].filter((subcategoryId) => categories.find((category) => category.id === subcategoryId)?.category_id !== id)));
  };

  const saveCategoryRule = async (subcategory: Subcategory, update: PlanCategoryRuleUpdate) => {
    const { subcategory: saved } = await updateSubcategory(userId, deviceId, subcategory.id, {
      minimum_amount_centavos: update.minimumAmountCentavos,
      fixed_amount_centavos: update.fixedAmountCentavos,
      always_in_budget: update.rule !== "FLEXIBLE",
    });
    setCategories((current) => current.map((item) => item.id === saved.id ? saved : item));
    if (update.rule !== "FLEXIBLE") setIncludedIds((current) => new Set([...current, saved.id]));
  };

  const saveTopLevelCategoryRule = async (category: Category, update: PlanCategoryRuleUpdate) => {
    const { category: saved } = await updateCategory(userId, deviceId, category.id, {
      minimum_amount_centavos: update.minimumAmountCentavos,
      fixed_amount_centavos: update.fixedAmountCentavos,
      always_in_budget: update.rule !== "FLEXIBLE",
    });
    setTopLevelCategories((current) => current.map((item) => item.id === saved.id ? saved : item));
    if (update.rule !== "FLEXIBLE") setIncludedCategoryIds((current) => new Set([...current, saved.id]));
  };

  const savePlan = async () => {
    if (!plan || state !== "ready") return;
    setState("saving");
    setError(null);
    try {
      const allocations = plan.recommendation.allocations.map(({ label: _label, ...allocation }) => allocation);
      const debtReservations = plan.recommendation.debtReservations.map(({ debtAccountId, creditCardStatementId, amountCentavos, dueDate }) => ({ debtAccountId, creditCardStatementId, amountCentavos, dueDate }));
      const savingsReservations = plan.recommendation.savingsReservations.filter((reservation) => reservation.savingsGoalId).map(({ savingsGoalId, amountCentavos, dueDate }) => ({ savingsGoalId: savingsGoalId!, amountCentavos, dueDate }));
      await createFinancialPlan(userId, deviceId, {
        periodStart: plan.period.start,
        periodEnd: plan.period.end,
        inputSnapshot: plan.inputSnapshot,
        recommendation: { ...plan.recommendation, allocations, debtReservations, savingsReservations },
        allocations,
        debtReservations,
        savingsReservations,
      });
      try { await onSyncRequested?.(); } catch {}
      setState("saved");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Your Financial Plan could not be saved.");
      setState("error");
    }
  };

  if (state === "loading") return <View style={{ paddingTop: 32, alignItems: "center" }}><ActivityIndicator color="#0E6D46" /><Text style={{ fontFamily: "Manrope", fontSize: 12, color: "#6B7A6F", marginTop: 10 }}>Preparing your next-month plan...</Text></View>;
  if (state === "selecting") return <PlanCategorySelection topLevelCategories={topLevelCategories} subcategories={categories} includedCategoryIds={includedCategoryIds} includedIds={includedIds} recommendedCategoryIds={recommendedCategoryIds} recommendedIds={recommendedIds} onToggle={toggleSubcategory} onToggleCategory={toggleTopLevelCategory} onSaveCategoryRule={saveTopLevelCategoryRule} onSaveRule={saveCategoryRule} plannedAmount={plannedAmount} availableMoneyCentavos={availableMoneyCentavos} planningAmountError={planningAmountError} onPlannedAmountChange={setPlannedAmount} onContinue={() => void loadRecommendation()} />;
  if (!plan) return <View style={{ marginTop: 16, backgroundColor: "#FBE9E7", borderRadius: 16, padding: 16 }}><Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 15, color: "#D9001F" }}>Plan unavailable</Text><Text style={{ fontFamily: "Manrope", fontSize: 12, color: "#414942", marginTop: 5 }}>{error ?? "Your Financial Plan could not be generated."}</Text><Pressable accessibilityRole="button" accessibilityLabel="Retry Financial Plan" onPress={() => void loadRecommendation()} style={{ marginTop: 12 }}><Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 12, color: "#0E6D46" }}>Try again</Text></Pressable></View>;

  const { recommendation } = plan;
  const remainingUnallocated = state === "saved" ? recommendation.availableFundsCentavos - planSpentCentavos : remainingUnallocatedCentavos(recommendation.availableFundsCentavos, recommendation.allocations, recommendation.debtSurplusCentavos, recommendation.savingsSurplusCentavos);
  const overAllocated = remainingUnallocated < 0;
  return (
    <View style={{ paddingBottom: 28 }}>
       <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 20, color: "#1B1C1A" }}>Financial Plan</Text>
       <Text style={{ fontFamily: "Manrope", fontSize: 12, color: "#6B7A6F", marginTop: 2 }}>Review your plan for {plan.period.start} to {plan.period.end}.</Text>
        <View style={{ marginTop: 16, borderRadius: 16, padding: 16, backgroundColor: "#013220" }}><Text style={{ fontFamily: "Manrope", fontSize: 12, color: "#D7EEE2" }}>Remaining Money in Plan</Text><Text accessibilityRole={overAllocated ? "alert" : undefined} style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 25, color: overAllocated ? "#FFB4AB" : "#FFFFFF", marginTop: 2 }}>{formatPeso(remainingUnallocated)}</Text><Text style={{ fontFamily: "Manrope", fontSize: 11.5, color: "#D7EEE2", marginTop: 4 }}>After category allocations, debt surplus, and savings surplus.</Text></View>
       {state === "infeasible" ? <View accessibilityRole="alert" style={{ marginTop: 16, borderRadius: 16, padding: 16, backgroundColor: "#FFF0F2" }}><Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 15, color: "#D9001F" }}>This plan cannot cover all requirements</Text><Text style={{ fontFamily: "Manrope", fontSize: 12, color: "#414942", marginTop: 5 }}>Shortfall: {formatPeso(recommendation.shortfallCentavos ?? 0)}. Fixed and minimum commitments were not reduced.</Text></View> : null}
         <PlanReservations title="Debt reservations" reservations={recommendation.debtReservations} surplusCentavos={recommendation.debtSurplusCentavos} onSurplusAmountChange={state === "saved" ? undefined : (amount) => updateSurplus("debtSurplusCentavos", amount)} />
         <PlanReservations title="Savings reservations" reservations={recommendation.savingsReservations} surplusCentavos={recommendation.savingsSurplusCentavos} onSurplusAmountChange={state === "saved" ? undefined : (amount) => updateSurplus("savingsSurplusCentavos", amount)} />
       {state !== "infeasible" && state !== "saved" ? <Pressable accessibilityRole="button" accessibilityLabel={state === "stale" ? "Refresh Financial Plan recommendation" : "Accept and save Financial Plan"} disabled={state === "saving" || overAllocated} onPress={() => state === "stale" ? void loadRecommendation() : void savePlan()} style={{ backgroundColor: "#013220", borderRadius: 14, padding: 14, marginTop: 18, opacity: state === "saving" || overAllocated ? 0.6 : 1 }}><Text style={{ fontFamily: "Manrope", fontWeight: "800", color: "#FFFFFF", textAlign: "center" }}>{state === "saving" ? "Saving..." : state === "stale" ? "Refresh recommendation" : "Accept and save plan"}</Text></Pressable> : null}
        <PlanAllocations allocations={recommendation.allocations} showSpendingProgress={state === "saved"} readOnly={state === "saved"} onFlexibleAmountChange={(index, amount) => { const value = toCentavos(amount); if (value != null) updateAllocation(index, { allocatedAmountCentavos: value }); }} onWeightChange={(index, weight) => { const value = Number(weight); if (Number.isFinite(value) && value >= 0 && value <= 100) updateAllocation(index, { subcategoryWeightBps: Math.round(value * 100) }); }} />
      {plan.explanations.map((explanation, index) => <Text key={`${explanation}-${index}`} style={{ fontFamily: "Manrope", fontSize: 11.5, color: "#6B7A6F", marginTop: 8 }}>{explanation}</Text>)}
      {state === "stale" ? <Text accessibilityRole="alert" style={{ fontFamily: "Manrope", fontSize: 12, color: "#B45309", marginTop: 16 }}>Your source data changed. Refresh this unaccepted recommendation before saving.</Text> : null}
       {overAllocated ? <Text accessibilityRole="alert" style={{ fontFamily: "Manrope", fontSize: 12, color: "#D9001F", marginTop: 16 }}>Reduce allocations or surplus amounts before saving this plan.</Text> : null}
       {error ? <Text accessibilityRole="alert" style={{ fontFamily: "Manrope", fontSize: 12, color: "#D9001F", marginTop: 16 }}>{error}</Text> : null}
      {state === "infeasible" ? <Pressable accessibilityRole="button" accessibilityLabel="Refresh Financial Plan" onPress={() => void loadRecommendation()} style={{ marginTop: 16 }}><Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 12, color: "#0E6D46", textAlign: "center" }}>Refresh plan</Text></Pressable> : null}
    </View>
  );
}
