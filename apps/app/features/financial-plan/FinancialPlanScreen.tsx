import { useCallback, useEffect, useRef, useState } from "react";
import { Sparkle } from "phosphor-react-native";
import { ActivityIndicator, Alert, Pressable, Text, TextInput, View } from "react-native";
import { createFinancialPlan, deleteFinancialPlan, getAcceptedFinancialPlanForPeriod, getCurrentFinancialPlanPeriod, getFinancialPlanAllocationSpending, getFinancialPlanLabels, getFinancialPlanSpentAmount, type AcceptedFinancialPlan } from "../../local-db/repositories/financialPlans";
import { listRecentExpenseCategoryIds, listRecentExpenseSubcategoryIds } from "../../local-db/repositories/forecastTransactions";
import { listCategories, listSubcategories, updateCategory, updateSubcategory, type Category, type Subcategory } from "../../local-db/repositories/taxonomy";
import { listFinancialAccounts } from "../../local-db/repositories/financialAccounts";
import { runSync } from "../../local-db/sync/runSync";
import { getPhilippineToday } from "../debt-manager/debtTrendRange";
import { requestFinancialPlanRecommendation, type ManualPlanAllocation, type ReservationSkips } from "./api";
import { PlanAllocations } from "./PlanAllocations";
import { PlanCategorySelection } from "./PlanCategorySelection";
import { PlanScheduledPayments } from "./PlanScheduledPayments";
import { PlanReservations } from "./PlanReservations";
import { applyFinancialPlanLabels, applyFinancialPlanSpending, formatPeso, remainingUnallocatedCentavos, toCentavos } from "./financialPlanPresentation";
import type { FinancialPlanAllocation, FinancialPlanRecommendation } from "./types";
import type { PlanCategoryRuleUpdate } from "./PlanCategoryRuleEditor";

type Props = { userId: string; deviceId: string; accessToken: string; syncVersion: number; onSyncRequested?: () => Promise<void>; onOpenPastPlans?: () => void };
type State = "loading" | "selecting" | "ready" | "infeasible" | "stale" | "saving" | "saved" | "error";

function getCurrentPeriodPlan(userId: string): Promise<AcceptedFinancialPlan | null> {
  const period = getCurrentFinancialPlanPeriod(getPhilippineToday());
  return getAcceptedFinancialPlanForPeriod(userId, period.start, period.end);
}

function savedPlanToRecommendation(savedPlan: AcceptedFinancialPlan): FinancialPlanRecommendation {
  return {
    status: "RECOMMENDATION_READY",
    period: { start: savedPlan.periodStart, end: savedPlan.periodEnd },
    inputSnapshot: savedPlan.inputSnapshot as FinancialPlanRecommendation["inputSnapshot"],
    recommendation: savedPlan.recommendation as FinancialPlanRecommendation["recommendation"],
    explanations: ["You are viewing your last accepted Financial Plan from this device."],
  };
}

export default function FinancialPlanScreen({ userId, deviceId, accessToken, syncVersion, onSyncRequested, onOpenPastPlans }: Props) {
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
  const [manualAllocations, setManualAllocations] = useState<ManualPlanAllocation[]>([]);
  const [reservationSkips, setReservationSkips] = useState<ReservationSkips>({ debtRepayments: false, savingsContributions: false });
  const [savedPlanId, setSavedPlanId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const requestAbort = useRef<AbortController | null>(null);
  const observedSyncVersion = useRef(syncVersion);

  const plannedAmountCentavos = toCentavos(plannedAmount);
  const planningAmountError = plannedAmountCentavos === null || plannedAmountCentavos <= 0
    ? "Enter an amount greater than zero."
    : plannedAmountCentavos > availableMoneyCentavos
      ? "Your planning amount cannot exceed available money."
      : null;

  const loadRecommendation = useCallback(async (nextManualAllocations: ManualPlanAllocation[] = manualAllocations, nextReservationSkips: ReservationSkips = reservationSkips) => {
    if (plannedAmountCentavos === null || planningAmountError) return;
    requestAbort.current?.abort();
    const controller = new AbortController();
    requestAbort.current = controller;
    setState("loading");
    setError(null);
    try {
      // The server plan excludes synced unusual-spending evaluations from its forecast history.
      const syncResult = await runSync(userId, deviceId, accessToken);
      if (!syncResult.successful) throw new Error("Sync your recent spending insights before generating a Financial Plan.");
      const { response, body } = await requestFinancialPlanRecommendation(accessToken, [...includedIds], [...includedCategoryIds], plannedAmountCentavos, nextManualAllocations, nextReservationSkips, controller.signal);
      if (!response.ok || !body.payload) throw new Error(body.message ?? "Your Financial Plan could not be generated.");
      const labels = await getFinancialPlanLabels(userId, { recommendation: body.payload.recommendation });
      setManualAllocations(nextManualAllocations);
      setReservationSkips(nextReservationSkips);
      setPlan({ ...body.payload, recommendation: applyFinancialPlanLabels(body.payload.recommendation, labels) });
      setState(body.payload.status === "INFEASIBLE" ? "infeasible" : "ready");
    } catch (cause) {
      if (cause instanceof Error && cause.name === "AbortError") return;
      const savedPlan = await getCurrentPeriodPlan(userId);
      if (savedPlan) {
        const savedRecommendation = savedPlanToRecommendation(savedPlan);
        const [labels, spending, spentAmount] = await Promise.all([getFinancialPlanLabels(userId, savedPlan), getFinancialPlanAllocationSpending(userId, savedPlan.id), getFinancialPlanSpentAmount(userId, savedPlan.id)]);
        setPlan({ ...savedRecommendation, recommendation: applyFinancialPlanLabels({ ...savedRecommendation.recommendation, allocations: applyFinancialPlanSpending(savedRecommendation.recommendation.allocations, spending) }, labels) });
        setPlanSpentCentavos(spentAmount);
        setSavedPlanId(savedPlan.id);
        setState("saved");
        return;
      }
      setError(cause instanceof Error ? cause.message : "Your Financial Plan could not be generated.");
      setState("error");
    } finally {
      if (requestAbort.current === controller) requestAbort.current = null;
    }
  }, [accessToken, deviceId, includedCategoryIds, includedIds, manualAllocations, plannedAmountCentavos, planningAmountError, reservationSkips, userId]);

  useEffect(() => {
    let active = true;
    void Promise.all([listCategories(userId), listSubcategories(userId, undefined, "expense"), listRecentExpenseSubcategoryIds(userId), listRecentExpenseCategoryIds(userId), getCurrentPeriodPlan(userId), listFinancialAccounts(userId, "active")]).then(async ([topLevelResult, result, recentIds, recentCategoryIds, savedPlan, accounts]) => {
      if (!active) return;
      if (savedPlan) {
        const savedRecommendation = savedPlanToRecommendation(savedPlan);
        const [labels, spending, spentAmount] = await Promise.all([getFinancialPlanLabels(userId, savedPlan), getFinancialPlanAllocationSpending(userId, savedPlan.id), getFinancialPlanSpentAmount(userId, savedPlan.id)]);
        if (!active) return;
        setPlan({ ...savedRecommendation, recommendation: applyFinancialPlanLabels({ ...savedRecommendation.recommendation, allocations: applyFinancialPlanSpending(savedRecommendation.recommendation.allocations, spending) }, labels) });
        setPlanSpentCentavos(spentAmount);
        setSavedPlanId(savedPlan.id);
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
      const parentIdsWithHistory = result.filter((subcategory) => validRecentIds.has(subcategory.id)).flatMap((subcategory) => subcategory.category_id ? [subcategory.category_id] : []);
      setRecommendedCategoryIds(new Set([...validRecentCategoryIds, ...parentIdsWithHistory]));
       setIncludedIds(new Set([...requiredIds, ...validRecentIds]));
       setIncludedCategoryIds(new Set([...requiredCategoryIds, ...validRecentCategoryIds]));
        setManualAllocations([]);
       setReservationSkips({ debtRepayments: false, savingsContributions: false });
      const available = accounts
        .filter((account) => account.kind !== "savings" && account.kind !== "credit_card")
        .reduce((sum, account) => sum + account.current_balance_centavos, 0);
      setAvailableMoneyCentavos(available);
      setPlannedAmount((current) => current || (available / 100).toFixed(2));
      setState("selecting");
    }).catch((cause) => {
      if (!active) return;
      setError(cause instanceof Error ? cause.message : "Your expense categories could not be loaded.");
      setState("error");
    });
    return () => { active = false; requestAbort.current?.abort(); };
  }, [reloadKey, userId]);

  useEffect(() => {
    if (observedSyncVersion.current === syncVersion) return;
    observedSyncVersion.current = syncVersion;
    if (state !== "saved") {
      setState((current) => current === "ready" ? "stale" : current);
      return;
    }
    void getCurrentPeriodPlan(userId).then(async (savedPlan) => {
      if (!savedPlan) return;
      const savedRecommendation = savedPlanToRecommendation(savedPlan);
      const [labels, spending, spentAmount] = await Promise.all([getFinancialPlanLabels(userId, savedPlan), getFinancialPlanAllocationSpending(userId, savedPlan.id), getFinancialPlanSpentAmount(userId, savedPlan.id)]);
      setPlan({ ...savedRecommendation, recommendation: applyFinancialPlanLabels({ ...savedRecommendation.recommendation, allocations: applyFinancialPlanSpending(savedRecommendation.recommendation.allocations, spending) }, labels) });
      setPlanSpentCentavos(spentAmount);
      setSavedPlanId(savedPlan.id);
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
      const { id } = await createFinancialPlan(userId, deviceId, {
        periodStart: plan.period.start,
        periodEnd: plan.period.end,
        inputSnapshot: plan.inputSnapshot,
        recommendation: { ...plan.recommendation, allocations, debtReservations, savingsReservations },
        allocations,
        debtReservations,
        savingsReservations,
      });
      try { await onSyncRequested?.(); } catch {}
      setSavedPlanId(id);
      setState("saved");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Your Financial Plan could not be saved.");
      setState("error");
    }
  };

  const resetPlan = () => {
    if (!savedPlanId) return;
    Alert.alert("Reset Financial Plan?", "This permanently removes this plan's allocations, debt reservations, savings reservations, biller and remittance reservations, and forecast data. You can create a new plan afterward, but this action cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reset plan",
        style: "destructive",
        onPress: () => {
          void deleteFinancialPlan(userId, deviceId, savedPlanId)
            .then(async () => {
              try { await onSyncRequested?.(); } catch {}
              setPlan(null);
              setPlanSpentCentavos(0);
              setSavedPlanId(null);
              setError(null);
              setState("loading");
              setReloadKey((current) => current + 1);
            })
            .catch((cause) => setError(cause instanceof Error ? cause.message : "Your Financial Plan could not be reset."));
        },
      },
    ]);
  };

  const confirmReservationSkip = (type: keyof ReservationSkips, regenerate = true) => {
    const debtRepayments = type === "debtRepayments" ? plan?.recommendation.debtReservations ?? [] : [];
    const message = type === "debtRepayments"
      ? `Debt payments are underfunded and may result in missed payments. ${debtRepayments.length} debt payment${debtRepayments.length === 1 ? "" : "s"} will be excluded from this plan.`
      : "Savings contributions will be excluded from this plan. Missing a contribution may delay when your savings goals are met.";
    Alert.alert(type === "debtRepayments" ? "Skip debt repayments?" : "Skip savings contributions?", message, [
      { text: "Cancel", style: "cancel" },
       { text: "Skip for this plan", style: "destructive", onPress: () => {
         const nextReservationSkips = { ...reservationSkips, [type]: true };
         setReservationSkips(nextReservationSkips);
         if (regenerate) void loadRecommendation(manualAllocations, nextReservationSkips);
       } },
    ]);
  };

  if (state === "loading") return <View style={{ paddingTop: 32, alignItems: "center" }}><ActivityIndicator color="#0E6D46" /><Text style={{ fontFamily: "Manrope", fontSize: 12, color: "#6B7A6F", marginTop: 10 }}>Preparing this month's plan...</Text></View>;
  const pastPlansAction = onOpenPastPlans ? <Pressable accessibilityRole="button" accessibilityLabel="View past Financial Plans" onPress={onOpenPastPlans} style={{ alignSelf: "flex-end", paddingVertical: 4 }}><Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 12, color: "#0E6D46" }}>Past plans</Text></Pressable> : null;
  if (state === "selecting") return <View>{pastPlansAction}<PlanCategorySelection topLevelCategories={topLevelCategories} subcategories={categories} includedCategoryIds={includedCategoryIds} includedIds={includedIds} recommendedCategoryIds={recommendedCategoryIds} recommendedIds={recommendedIds} onToggle={toggleSubcategory} onToggleCategory={toggleTopLevelCategory} onSaveCategoryRule={saveTopLevelCategoryRule} onSaveRule={saveCategoryRule} plannedAmount={plannedAmount} availableMoneyCentavos={availableMoneyCentavos} planningAmountError={planningAmountError} onPlannedAmountChange={setPlannedAmount} onContinue={(manualAllocations) => void loadRecommendation(manualAllocations)} reservationSkips={reservationSkips} onReservationSkipChange={(type, shouldSkip) => shouldSkip ? confirmReservationSkip(type, false) : setReservationSkips((current) => ({ ...current, [type]: false }))} /></View>;
  if (!plan) return <View style={{ marginTop: 16, backgroundColor: "#FBE9E7", borderRadius: 16, padding: 16 }}><Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 15, color: "#D9001F" }}>Plan unavailable</Text><Text style={{ fontFamily: "Manrope", fontSize: 12, color: "#414942", marginTop: 5 }}>{error ?? "Your Financial Plan could not be generated."}</Text><Pressable accessibilityRole="button" accessibilityLabel="Retry Financial Plan" onPress={() => void loadRecommendation()} style={{ marginTop: 12 }}><Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 12, color: "#0E6D46" }}>Try again</Text></Pressable></View>;

  const { recommendation } = plan;
  const remainingUnallocated = state === "saved" ? recommendation.availableFundsCentavos - planSpentCentavos : remainingUnallocatedCentavos(recommendation.availableFundsCentavos, recommendation.allocations, recommendation.debtSurplusCentavos, recommendation.savingsSurplusCentavos);
  const overAllocated = remainingUnallocated < 0;
  const surplusGuidance = recommendation.surplusRecommendation;
  const assessmentOutput = surplusGuidance?.assessmentEvidence?.outputSnapshot as Record<string, { value?: unknown; threshold?: unknown }> | undefined;
  const assessmentRule = surplusGuidance?.reasonCode === "EMERGENCY_FUND_INADEQUATE" ? assessmentOutput?.emergency_savings : surplusGuidance?.reasonCode === "DEBT_SIGNAL" ? assessmentOutput?.debt_burden : surplusGuidance?.reasonCode === "NEGATIVE_FINANCIAL_MARGIN" ? assessmentOutput?.financial_margin : undefined;
  const assessmentDetail = typeof assessmentRule?.value === "number" && typeof assessmentRule.threshold === "number" ? ` Measured value: ${assessmentRule.value}; threshold: ${assessmentRule.threshold}.` : "";
  const surplusGuidanceText = surplusGuidance?.reasonCode === "EMERGENCY_FUND_INADEQUATE"
    ? "Your current assessment indicates that your emergency fund is below its measured threshold. You can choose an amount for savings below."
    : surplusGuidance?.reasonCode === "DEBT_SIGNAL"
      ? "Your current assessment identifies a debt burden signal. You can choose an amount for debt below."
      : surplusGuidance?.reasonCode === "NEGATIVE_FINANCIAL_MARGIN"
        ? "Your current assessment identifies a negative financial margin, so the optional surplus is held for review."
        : surplusGuidance?.assessmentStatus === "stale"
          ? "Financial condition guidance is stale, so the optional surplus remains user-directed."
          : surplusGuidance?.assessmentStatus === "insufficient_data"
            ? "Financial condition data is incomplete, so the optional surplus remains user-directed."
            : "Optional surplus remains user-directed until you choose how to allocate it.";
  return (
    <View style={{ paddingBottom: 28 }}>
       {pastPlansAction}
       <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 20, color: "#1B1C1A" }}>Financial Plan</Text>
       <Text style={{ fontFamily: "Manrope", fontSize: 12, color: "#6B7A6F", marginTop: 2 }}>Review your plan for {plan.period.start} to {plan.period.end}.</Text>
        {state === "saved" ? <Pressable accessibilityRole="button" accessibilityLabel="Reset Financial Plan" onPress={resetPlan} style={{ alignSelf: "flex-start", marginTop: 12 }}><Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 12, color: "#D9001F" }}>Reset plan</Text></Pressable> : null}
         <View style={{ marginTop: 16, borderRadius: 16, padding: 16, backgroundColor: "#013220" }}><Text style={{ fontFamily: "Manrope", fontSize: 12, color: "#D7EEE2" }}>Remaining Money in Plan</Text><Text accessibilityRole={overAllocated ? "alert" : undefined} style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 25, color: overAllocated ? "#FFB4AB" : "#FFFFFF", marginTop: 2 }}>{formatPeso(remainingUnallocated)}</Text><Text style={{ fontFamily: "Manrope", fontSize: 11.5, color: "#D7EEE2", marginTop: 4 }}>After savings, debt, billers and remittances, and category allocations.</Text></View>
        {plan.explanations.length ? <View style={{ backgroundColor: "#F0F7F3", borderColor: "#C8E2D4", borderRadius: 14, borderWidth: 1, marginTop: 16, padding: 14 }}>
         <View style={{ alignItems: "center", flexDirection: "row", gap: 7 }}>
           <Sparkle color="#0E6D46" size={18} weight="fill" />
           <Text style={{ color: "#0E6D46", fontFamily: "Manrope", fontSize: 13, fontWeight: "800" }}>Plan insights</Text>
         </View>
         {plan.explanations.map((explanation, index) => <Text key={`${explanation}-${index}`} style={{ color: "#414942", fontFamily: "Manrope", fontSize: 11.5, lineHeight: 18, marginTop: 8 }}>{explanation}</Text>)}
        </View> : null}
         {surplusGuidance && surplusGuidance.unallocatedSurplusCentavos > 0 ? <View style={{ backgroundColor: "#FFF8E7", borderColor: "#F2D9A3", borderRadius: 14, borderWidth: 1, marginTop: 16, padding: 14 }}><Text style={{ color: "#6F4A00", fontFamily: "Manrope", fontSize: 13, fontWeight: "800" }}>Optional surplus guidance</Text><Text style={{ color: "#414942", fontFamily: "Manrope", fontSize: 11.5, lineHeight: 18, marginTop: 6 }}>{formatPeso(surplusGuidance.unallocatedSurplusCentavos)} is available after required reservations and category allocations. {surplusGuidanceText}{surplusGuidance.advisoryDestination?.label ? ` Suggested destination: ${surplusGuidance.advisoryDestination.label}.` : ""}{assessmentDetail}</Text></View> : null}
         {reservationSkips.debtRepayments || reservationSkips.savingsContributions ? <View accessibilityRole="alert" style={{ backgroundColor: "#FFF8E7", borderColor: "#F2D9A3", borderRadius: 14, borderWidth: 1, marginTop: 16, padding: 14 }}><Text style={{ color: "#6F4A00", fontFamily: "Manrope", fontSize: 13, fontWeight: "800" }}>Skipped plan commitments</Text>{reservationSkips.debtRepayments ? <Text style={{ color: "#414942", fontFamily: "Manrope", fontSize: 11.5, lineHeight: 18, marginTop: 6 }}>Debt payments are underfunded and may result in missed payments.</Text> : null}{reservationSkips.savingsContributions ? <Text style={{ color: "#414942", fontFamily: "Manrope", fontSize: 11.5, lineHeight: 18, marginTop: 6 }}>Savings contributions are not included in this plan. Missing a contribution may delay when your savings goals are met.</Text> : null}</View> : null}
          {state === "infeasible" ? <View accessibilityRole="alert" style={{ marginTop: 16, borderRadius: 16, padding: 16, backgroundColor: "#FFF0F2" }}><Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 15, color: "#D9001F" }}>This plan cannot cover all requirements</Text><Text style={{ fontFamily: "Manrope", fontSize: 12, color: "#414942", marginTop: 5 }}>Shortfall: {formatPeso(recommendation.shortfallCentavos ?? 0)}. Fixed and minimum commitments were not reduced.</Text>{!reservationSkips.debtRepayments && recommendation.debtReservations.length ? <Pressable accessibilityRole="button" accessibilityLabel="Skip Debt Repayments" onPress={() => confirmReservationSkip("debtRepayments")} style={{ borderColor: "#B45309", borderRadius: 11, borderWidth: 1, marginTop: 14, padding: 12 }}><Text style={{ color: "#B45309", fontFamily: "Manrope", fontWeight: "800", textAlign: "center" }}>Skip Debt Repayments</Text></Pressable> : null}{!reservationSkips.savingsContributions && recommendation.savingsReservations.length ? <Pressable accessibilityRole="button" accessibilityLabel="Skip Savings Contributions" onPress={() => confirmReservationSkip("savingsContributions")} style={{ borderColor: "#B45309", borderRadius: 11, borderWidth: 1, marginTop: 10, padding: 12 }}><Text style={{ color: "#B45309", fontFamily: "Manrope", fontWeight: "800", textAlign: "center" }}>Skip Savings Contributions</Text></Pressable> : null}<Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 13, color: "#1B1C1A", marginTop: 14 }}>Have another number in mind?</Text><TextInput accessibilityLabel="New planning amount in pesos" value={plannedAmount} onChangeText={setPlannedAmount} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor="#8A938C" style={{ backgroundColor: "#FFFFFF", borderColor: planningAmountError ? "#D9001F" : "#D7DDD8", borderRadius: 10, borderWidth: 1, color: "#1B1C1A", fontFamily: "Manrope", fontSize: 15, marginTop: 7, padding: 11 }} />{planningAmountError ? <Text accessibilityRole="alert" style={{ color: "#D9001F", fontFamily: "Manrope", fontSize: 11, marginTop: 5 }}>{planningAmountError}</Text> : null}<Pressable accessibilityRole="button" accessibilityLabel="Refresh plan with new amount" disabled={planningAmountError !== null} onPress={() => void loadRecommendation()} style={{ backgroundColor: "#013220", borderRadius: 11, padding: 12, marginTop: 10, opacity: planningAmountError ? 0.5 : 1 }}><Text style={{ fontFamily: "Manrope", fontWeight: "800", color: "#FFFFFF", textAlign: "center" }}>Refresh plan</Text></Pressable></View> : null}
          <Text accessibilityRole="header" style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 16, color: "#1B1C1A", marginTop: 16 }}>Savings &amp; Debt</Text>
          <PlanReservations title="Savings reservations" reservations={recommendation.savingsReservations} surplusCentavos={recommendation.savingsSurplusCentavos} onSurplusAmountChange={state === "saved" ? undefined : (amount) => updateSurplus("savingsSurplusCentavos", amount)} />
          <PlanReservations title="Debt reservations" reservations={recommendation.debtReservations} surplusCentavos={recommendation.debtSurplusCentavos} onSurplusAmountChange={state === "saved" ? undefined : (amount) => updateSurplus("debtSurplusCentavos", amount)} />
          <PlanScheduledPayments obligations={plan.inputSnapshot.obligations} />
       {state !== "infeasible" && state !== "saved" ? <Pressable accessibilityRole="button" accessibilityLabel={state === "stale" ? "Refresh Financial Plan recommendation" : "Accept and save Financial Plan"} disabled={state === "saving" || overAllocated} onPress={() => state === "stale" ? void loadRecommendation() : void savePlan()} style={{ backgroundColor: "#013220", borderRadius: 14, padding: 14, marginTop: 18, opacity: state === "saving" || overAllocated ? 0.6 : 1 }}><Text style={{ fontFamily: "Manrope", fontWeight: "800", color: "#FFFFFF", textAlign: "center" }}>{state === "saving" ? "Saving..." : state === "stale" ? "Refresh recommendation" : "Accept and save plan"}</Text></Pressable> : null}
        <PlanAllocations allocations={recommendation.allocations} showSpendingProgress={state === "saved"} readOnly={state === "saved"} onFlexibleAmountChange={(index, amount) => { const value = toCentavos(amount); if (value != null) updateAllocation(index, { allocatedAmountCentavos: value }); }} onWeightChange={(index, weight) => { const value = Number(weight); if (Number.isFinite(value) && value >= 0 && value <= 100) updateAllocation(index, { subcategoryWeightBps: Math.round(value * 100) }); }} />
       {state === "stale" ? <Text accessibilityRole="alert" style={{ fontFamily: "Manrope", fontSize: 12, color: "#B45309", marginTop: 16 }}>Your source data changed. Refresh this unaccepted recommendation before saving.</Text> : null}
       {overAllocated ? <Text accessibilityRole="alert" style={{ fontFamily: "Manrope", fontSize: 12, color: "#D9001F", marginTop: 16 }}>Reduce allocations or surplus amounts before saving this plan.</Text> : null}
       {error ? <Text accessibilityRole="alert" style={{ fontFamily: "Manrope", fontSize: 12, color: "#D9001F", marginTop: 16 }}>{error}</Text> : null}
    </View>
  );
}
