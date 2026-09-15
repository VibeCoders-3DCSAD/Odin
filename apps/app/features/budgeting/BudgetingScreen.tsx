import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { ArrowLeft, Plus } from "phosphor-react-native";
import { createBudgetDraft, deleteBudgetDraft, getBudgetDraftTracking, listBudgetDrafts, updateBudgetDraft, type Budget, type BudgetTracking, type CreateBudgetInput } from "../../local-db/repositories/budgets";
import CategorySelector from "../../components/CategorySelector";
import { calculateBudgetAllocatedAmount, calculateBudgetSpentAmount, calculateProvisionalPercentage } from "./constant";
import { getCategory, getSubcategory } from "../../local-db/repositories/taxonomy";
import { getRequiredDebtTotalForPeriod } from "../debt-manager/requiredDebtTotalQueries";
import type { RequiredDebtTotalForPeriod } from "../debt-manager/requiredDebtTotalQueries";
import { getRequiredSavingsContributionsForPeriod } from "../savings-goals/requiredSavingsContributionQueries";
import type { RequiredSavingsContributionsForPeriod } from "../savings-goals/requiredSavingsContributionQueries";
import { requestBudgetRecommendation, type BudgetRecommendation } from "./api";
import { loadBudgetRecommendationContext } from "./recommendationContext";

type Props = {
  userId: string;
  deviceId: string;
  accessToken: string;
  onSyncRequested?: () => Promise<void>;
};

const PERIOD_KINDS = ["WEEKLY", "MONTHLY", "CUSTOM", "INCOME_CYCLE"] as const;
const formPalette = { ink: "#1B1C1A", ink2: "#414942", mut: "#6B7A6F", line: "#EAEAE6", card: "#FCF8F0", error: "#D9001F" } as const;
type AllocationRow = { id: string; categoryId: string | null; subcategoryId: string | null; label: string; amount: string };
const emptyAllocationRow: AllocationRow = { id: "allocation-0", categoryId: null, subcategoryId: null, label: "", amount: "" };

function formatPeriodKind(value: string): string {
  return value.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function parseDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return year && month && day ? new Date(year, month - 1, day) : new Date();
}

function derivedPeriodEnd(kind: CreateBudgetInput["periodKind"], start: string): string {
  if (!start || (kind !== "WEEKLY" && kind !== "MONTHLY")) return "";
  const date = parseDate(start);
  if (kind === "WEEKLY") date.setDate(date.getDate() + 6);
  else {
    const nextMonthDays = new Date(date.getFullYear(), date.getMonth() + 2, 0).getDate();
    date.setMonth(date.getMonth() + 1, Math.min(date.getDate(), nextMonthDays));
  }
  return formatDate(date);
}

function parsePesoToCentavos(value: string): number {
  const amount = Number(value.trim());
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
}

function formatPeso(centavos: number): string {
  return `₱${(centavos / 100).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatCompactPeso(centavos: number): string {
  const pesos = centavos / 100;
  return pesos >= 1000 ? `₱${(pesos / 1000).toFixed(1)}k` : formatPeso(centavos);
}

type RecommendationAllocation = BudgetRecommendation["allocations"][number] & { id: string; label: string; amount: string };
type RecommendationReview = Omit<BudgetRecommendation, "allocations"> & { sourceKey: string; allocations: RecommendationAllocation[] };

export default function BudgetingScreen({ userId, deviceId, accessToken, onSyncRequested }: Props) {
  const [drafts, setDrafts] = useState<Budget[]>([]);
  const [selectedDraft, setSelectedDraft] = useState<BudgetTracking | null>(null);
  const [allocationLabels, setAllocationLabels] = useState<Record<string, string>>({});
  const [trackingError, setTrackingError] = useState<string | null>(null);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [retryDraftId, setRetryDraftId] = useState<string | null>(null);
  const [draftsError, setDraftsError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [periodKind, setPeriodKind] = useState<CreateBudgetInput["periodKind"]>("MONTHLY");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [debtBudgetAmount, setDebtBudgetAmount] = useState("");
  const [savingsBudgetAmount, setSavingsBudgetAmount] = useState("");
  const [allocationRows, setAllocationRows] = useState<AllocationRow[]>([emptyAllocationRow]);
  const [createError, setCreateError] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [datePicker, setDatePicker] = useState<"start" | "end" | null>(null);
  const [categoryPickerRowId, setCategoryPickerRowId] = useState<string | null>(null);
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [requiredDebtTotal, setRequiredDebtTotal] = useState<RequiredDebtTotalForPeriod | null>(null);
  const [requiredSavingsTotal, setRequiredSavingsTotal] = useState<RequiredSavingsContributionsForPeriod | null>(null);
  const [recommendation, setRecommendation] = useState<RecommendationReview | null>(null);
  const [recommendationState, setRecommendationState] = useState<"idle" | "generating" | "ready" | "accepted" | "stale" | "cancelled" | "unavailable" | "error">("idle");
  const recommendationAbort = useRef<AbortController | null>(null);

  const recommendationSourceKey = JSON.stringify({ periodKind, periodStart, periodEnd, totalAmount, debtBudgetAmount, savingsBudgetAmount, allocations: allocationRows.map(({ categoryId, subcategoryId, amount }) => ({ categoryId, subcategoryId, amount })) });

  const loadDrafts = useCallback(async () => {
    setLoading(true);
    setDraftsError(null);
    try {
      setDrafts(await listBudgetDrafts(userId));
    } catch {
      setDrafts([]);
      setDraftsError("Budget drafts could not be loaded. Check your local data and try again.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const openDraft = async (id: string) => {
    setTrackingLoading(true);
    setTrackingError(null);
    setRetryDraftId(id);
    try {
      const tracking = await getBudgetDraftTracking(userId, id);
      if (!tracking) throw new Error("Budget draft not found");
      const labels = await Promise.all(tracking.allocations.map(async (allocation) => {
        const taxonomy = allocation.categoryId
          ? await getCategory(userId, allocation.categoryId)
          : allocation.subcategoryId
            ? await getSubcategory(userId, allocation.subcategoryId)
            : null;
        return [allocation.id, taxonomy?.label ?? ""] as const;
      }));
      setAllocationLabels(Object.fromEntries(labels));
      setSelectedDraft(tracking);
    } catch (error) {
      setSelectedDraft(null);
      setAllocationLabels({});
      setTrackingError(error instanceof Error ? error.message : "Budget tracking could not be loaded.");
    } finally {
      setTrackingLoading(false);
    }
  };

  const editDraft = (draft: BudgetTracking) => {
    setSelectedDraft(null);
    setEditingDraftId(draft.id);
    setShowCreate(true);
    setPeriodKind(draft.periodKind);
    setPeriodStart(draft.periodStart);
    setPeriodEnd(draft.periodEnd);
    setTotalAmount((draft.totalAmountMinor / 100).toFixed(2));
    setDebtBudgetAmount((draft.debtBudgetAmountMinor / 100).toFixed(2));
    setSavingsBudgetAmount((draft.savingsBudgetAmountMinor / 100).toFixed(2));
    setAllocationRows(draft.allocations.map((allocation) => ({
      id: allocation.id,
      categoryId: allocation.categoryId,
      subcategoryId: allocation.subcategoryId,
      label: allocationLabels[allocation.id] ?? allocation.categoryId ?? allocation.subcategoryId ?? "",
      amount: (allocation.amountMinor / 100).toFixed(2),
    })));
  };

  useEffect(() => {
    void loadDrafts();
  }, [loadDrafts]);

  useEffect(() => {
    if (periodKind === "WEEKLY" || periodKind === "MONTHLY") {
      setPeriodEnd(derivedPeriodEnd(periodKind, periodStart));
    }
  }, [periodKind, periodStart]);

  useEffect(() => {
    if (!periodStart || !periodEnd) {
      setRequiredDebtTotal(null);
      setRequiredSavingsTotal(null);
      return;
    }
    let cancelled = false;
    void getRequiredDebtTotalForPeriod(userId, periodStart, periodEnd)
      .then((result) => {
        if (!cancelled) setRequiredDebtTotal(result);
      })
      .catch(() => {
        if (!cancelled) setRequiredDebtTotal(null);
      });
    void getRequiredSavingsContributionsForPeriod(userId, periodStart, periodEnd)
      .then((result) => {
        if (!cancelled) setRequiredSavingsTotal(result);
      })
      .catch(() => {
        if (!cancelled) setRequiredSavingsTotal(null);
      });
    return () => { cancelled = true; };
  }, [periodEnd, periodStart, userId]);

  useEffect(() => {
    if (recommendation && recommendation.sourceKey !== recommendationSourceKey && recommendationState !== "stale") setRecommendationState("stale");
  }, [recommendation, recommendationSourceKey, recommendationState]);

  useEffect(() => () => recommendationAbort.current?.abort(), []);

  if (categoryPickerRowId) {
    const selectedRow = allocationRows.find((row) => row.id === categoryPickerRowId);
    return (
      <CategorySelector
        userId={userId}
        kind="expense"
        initialCategoryId={selectedRow?.categoryId ?? undefined}
        initialSubcategoryId={selectedRow?.subcategoryId ?? undefined}
        allowCategorySelection
        onSelect={(subcategory) => {
          setAllocationRows((rows) => rows.map((row) => row.id === categoryPickerRowId
            ? "category_group_id" in subcategory
              ? { ...row, categoryId: subcategory.id, subcategoryId: null, label: subcategory.label }
              : { ...row, categoryId: null, subcategoryId: subcategory.id, label: subcategory.label }
            : row));
          setCategoryPickerRowId(null);
        }}
        onClose={() => setCategoryPickerRowId(null)}
      />
    );
  }

  const saveDraft = async () => {
    setCreating(true);
    setCreateError(null);
    setSyncError(null);
    try {
      const input = {
        periodKind,
        periodStart,
        periodEnd,
        totalAmountMinor: parsePesoToCentavos(totalAmount),
        debtBudgetAmountMinor: parsePesoToCentavos(debtBudgetAmount),
        savingsBudgetAmountMinor: parsePesoToCentavos(savingsBudgetAmount),
        allocations: allocationRows
          .filter((row) => row.categoryId || row.subcategoryId)
          .map((row) => ({ categoryId: row.categoryId, subcategoryId: row.subcategoryId, amountMinor: parsePesoToCentavos(row.amount) })),
      } satisfies CreateBudgetInput;
      if (editingDraftId) await updateBudgetDraft(userId, deviceId, editingDraftId, input);
      else await createBudgetDraft(userId, deviceId, input);
      await loadDrafts();
      try {
        await onSyncRequested?.();
        setShowCreate(false);
        setEditingDraftId(null);
        setAllocationRows([emptyAllocationRow]);
      } catch {
        setSyncError("Draft saved offline, but sync could not be completed.");
      }
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "Budget draft could not be saved.");
    } finally {
      setCreating(false);
    }
  };

  const canGenerateRecommendation = Boolean(
    periodStart && periodEnd && parsePesoToCentavos(totalAmount) > parsePesoToCentavos(debtBudgetAmount) + parsePesoToCentavos(savingsBudgetAmount)
      && allocationRows.some((row) => row.categoryId || row.subcategoryId)
      && requiredDebtTotal && requiredSavingsTotal
      && parsePesoToCentavos(debtBudgetAmount) >= requiredDebtTotal.totalRequiredCentavos
      && parsePesoToCentavos(savingsBudgetAmount) >= requiredSavingsTotal.totalRequiredCentavos,
  );

  const generateRecommendation = async () => {
    if (!canGenerateRecommendation) return;
    recommendationAbort.current?.abort();
    const controller = new AbortController();
    recommendationAbort.current = controller;
    setRecommendationState("generating");
    const rows = allocationRows.filter((row) => row.categoryId || row.subcategoryId);
    try {
      const context = await loadBudgetRecommendationContext({ userId, accessToken, signal: controller.signal });
      if (controller.signal.aborted) throw new DOMException("aborted", "AbortError");
      const result = await requestBudgetRecommendation(accessToken, {
        periodKind, periodStart, periodEnd,
        totalAmountMinor: parsePesoToCentavos(totalAmount), debtBudgetAmountMinor: parsePesoToCentavos(debtBudgetAmount), savingsBudgetAmountMinor: parsePesoToCentavos(savingsBudgetAmount),
        allocations: rows.map((row) => ({ categoryId: row.categoryId, subcategoryId: row.subcategoryId, preferredAmountMinor: parsePesoToCentavos(row.amount) })),
        ...context,
      }, controller.signal);
      if (!result.response.ok || !result.body.payload) {
        setRecommendationState(result.response.status >= 500 ? "unavailable" : "error");
        return;
      }
      setRecommendation({ ...result.body.payload, sourceKey: recommendationSourceKey, allocations: result.body.payload.allocations.map((allocation) => {
        const row = rows.find((candidate) => candidate.categoryId === allocation.categoryId && candidate.subcategoryId === allocation.subcategoryId)!;
        return { ...allocation, id: row.id, label: row.label, amount: (allocation.amountMinor / 100).toFixed(2) };
      }) });
      setRecommendationState("ready");
    } catch (error) {
      setRecommendationState(error instanceof Error && error.name === "AbortError" ? "cancelled" : "unavailable");
    } finally {
      if (recommendationAbort.current === controller) recommendationAbort.current = null;
    }
  };

  const applyRecommendation = () => {
    if (!recommendation || recommendationState !== "ready") return;
    const appliedRows = recommendation.allocations
      .filter((allocation) => parsePesoToCentavos(allocation.amount) > 0)
      .map(({ id, categoryId, subcategoryId, label, amount }) => ({ id, categoryId, subcategoryId, label, amount }));
    if (appliedRows.length === 0 || appliedRows.reduce((total, row) => total + parsePesoToCentavos(row.amount), 0) > recommendation.availableFundsMinor) {
      setCreateError("Recommended category amounts must be positive and cannot exceed available category funds.");
      return;
    }
    setCreateError(null);
    setAllocationRows(appliedRows);
    setRecommendation((current) => current ? {
      ...current,
      sourceKey: JSON.stringify({ periodKind, periodStart, periodEnd, totalAmount, debtBudgetAmount, savingsBudgetAmount, allocations: appliedRows.map(({ categoryId, subcategoryId, amount }) => ({ categoryId, subcategoryId, amount })) }),
    } : current);
    setRecommendationState("accepted");
  };

  const removeDraft = (draft: Budget) => {
    Alert.alert("Delete budget?", "This budget and its allocations will be deleted.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => void (async () => {
          try {
            await deleteBudgetDraft(userId, deviceId, draft.id);
            setSelectedDraft(null);
            await loadDrafts();
            await onSyncRequested?.();
          } catch (error) {
            setTrackingError(error instanceof Error ? error.message : "Budget could not be deleted.");
          }
        })(),
      },
    ]);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
      {showCreate || selectedDraft ? (
        <View>
          <Pressable accessibilityRole="button" accessibilityLabel="Back to budget drafts" onPress={() => {
            setShowCreate(false);
            setSelectedDraft(null);
            setAllocationLabels({});
            setEditingDraftId(null);
            setAllocationRows([emptyAllocationRow]);
          }} style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 }}>
            <ArrowLeft size={18} color={formPalette.ink} weight="bold" />
            <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 14, color: formPalette.mut }}>Budgeting</Text>
          </Pressable>
          <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 20, color: formPalette.ink }}>{selectedDraft ? "Budget" : editingDraftId ? "Edit Budget" : "Add Budget"}</Text>
        </View>
      ) : (
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 20, color: "#1B1C1A" }}>Budgeting</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Create budget draft"
            onPress={() => {
               setSelectedDraft(null);
               setAllocationLabels({});
               setAllocationRows([emptyAllocationRow]);
               setEditingDraftId(null);
               setPeriodKind("MONTHLY");
               setPeriodStart("");
               setPeriodEnd("");
                setTotalAmount("");
                 setDebtBudgetAmount("");
                 setSavingsBudgetAmount("");
                setCreateError(null);
                setSyncError(null);
                setRecommendation(null);
                setRecommendationState("idle");
               setShowCreate(true);
            }}
            style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: "#013220", alignItems: "center", justifyContent: "center" }}
          >
            <Plus size={18} color="#FFFFFF" weight="bold" />
          </Pressable>
        </View>
      )}
      {!showCreate && !selectedDraft ? (
        <Text style={{ fontFamily: "Manrope", fontSize: 12, color: "#6B7A6F", marginTop: 2 }}>
          Plan your money with offline budget drafts.
        </Text>
      ) : null}
      {!selectedDraft && !trackingLoading && !trackingError ? (
        <View style={{ marginTop: 16 }}>
          {showCreate ? (
            <View style={{ marginTop: 12, backgroundColor: "#F1F0EB", borderRadius: 16, padding: 16 }}>
              <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 12, color: formPalette.ink2 }}>PERIOD</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                {PERIOD_KINDS.map((kind) => <Pressable key={kind} accessibilityRole="radio" accessibilityLabel={`${formatPeriodKind(kind)} budget period`} accessibilityState={{ selected: periodKind === kind }} onPress={() => setPeriodKind(kind)} style={{ backgroundColor: periodKind === kind ? "#0E6D46" : "#FFFFFF", borderRadius: 10, padding: 8 }}><Text style={{ fontFamily: "Manrope", fontSize: 11, color: periodKind === kind ? "#FFFFFF" : "#414942" }}>{formatPeriodKind(kind)}</Text></Pressable>)}
              </View>
              <View style={{ marginTop: 14 }}>
                <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 12, color: formPalette.ink2, marginTop: 4, marginBottom: 6 }}>START DATE <Text style={{ color: formPalette.error }}>*</Text></Text>
                <Pressable onPress={() => setDatePicker("start")} accessibilityRole="button" accessibilityLabel="Choose start date" style={{ height: 46, borderRadius: 12, borderWidth: 1, borderColor: formPalette.line, paddingHorizontal: 14, justifyContent: "center", backgroundColor: formPalette.card }}><Text style={{ fontFamily: "Manrope", fontSize: 14, color: periodStart ? formPalette.ink : formPalette.mut }}>{periodStart || "Choose a date"}</Text></Pressable>
              </View>
              {periodKind === "WEEKLY" || periodKind === "MONTHLY" ? (
               <View>
                  <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 12, color: formPalette.ink2, marginTop: 4, marginBottom: 6 }}>END DATE</Text>
                  <View style={{ height: 46, borderRadius: 12, borderWidth: 1, borderColor: formPalette.line, paddingHorizontal: 14, justifyContent: "center", backgroundColor: formPalette.card }}>
                    <Text style={{ fontFamily: "Manrope", fontSize: 14, color: periodEnd ? formPalette.ink : formPalette.mut }}>{periodEnd || "Choose a start date first"}</Text>
                  </View>
                </View>
              ) : (
                <View>
                  <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 12, color: formPalette.ink2, marginTop: 4, marginBottom: 6 }}>END DATE <Text style={{ color: formPalette.error }}>*</Text></Text>
                  <Pressable onPress={() => setDatePicker("end")} accessibilityRole="button" accessibilityLabel="Choose end date" style={{ height: 46, borderRadius: 12, borderWidth: 1, borderColor: formPalette.line, paddingHorizontal: 14, justifyContent: "center", backgroundColor: formPalette.card }}><Text style={{ fontFamily: "Manrope", fontSize: 14, color: periodEnd ? formPalette.ink : formPalette.mut }}>{periodEnd || "Choose a date"}</Text></Pressable>
                </View>
              )}
              <View>
                <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 12, color: formPalette.ink2, marginTop: 4, marginBottom: 6 }}>TOTAL BUDGET <Text style={{ color: formPalette.error }}>*</Text></Text>
                <Text style={{ fontFamily: "Manrope", fontSize: 11, color: formPalette.mut, marginBottom: 6 }}>Enter peso amount.</Text>
                <TextInput value={totalAmount} onChangeText={setTotalAmount} placeholder="e.g. 10.53" placeholderTextColor={formPalette.mut} accessibilityLabel="Total budget in pesos" keyboardType="decimal-pad" style={{ height: 46, borderRadius: 12, borderWidth: 1, borderColor: formPalette.line, paddingHorizontal: 14, fontFamily: "Manrope", fontSize: 14, color: formPalette.ink, backgroundColor: formPalette.card }} />
               </View>
               <View>
                 <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 12, color: formPalette.ink2, marginTop: 12, marginBottom: 6 }}>DEBT PAYMENT BUDGET</Text>
                  <Text style={{ fontFamily: "Manrope", fontSize: 11, color: formPalette.mut, marginBottom: 6 }}>Reserve the amount available for credit-card and debt payments.</Text>
                  <TextInput value={debtBudgetAmount} onChangeText={setDebtBudgetAmount} placeholder="e.g. 10.53" placeholderTextColor={formPalette.mut} accessibilityLabel="Debt payment budget in pesos" keyboardType="decimal-pad" style={{ height: 46, borderRadius: 12, borderWidth: 1, borderColor: formPalette.line, paddingHorizontal: 14, fontFamily: "Manrope", fontSize: 14, color: formPalette.ink, backgroundColor: formPalette.card }} />
                   {requiredDebtTotal ? (
                    <View style={{ marginTop: 8 }}>
                      <Text style={{ fontFamily: "Manrope", fontSize: 11, color: formPalette.mut }}>Required debt payments: {formatPeso(requiredDebtTotal.totalRequiredCentavos)}</Text>
                      {requiredDebtTotal.obligations.map((obligation, index) => (
                        <View key={`${obligation.kind}-${obligation.accountId}-${index}`} style={{ marginTop: 7, paddingTop: 7, borderTopWidth: index === 0 ? 0 : 1, borderTopColor: formPalette.line }}>
                          <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                            <Text style={{ flex: 1, fontFamily: "Manrope", fontSize: 11, fontWeight: "600", color: formPalette.ink }}>
                              {requiredDebtTotal.accountNames[obligation.accountId] ?? "Debt payment"}{obligation.isEstimated ? " (estimated)" : ""}
                            </Text>
                            <Text style={{ fontFamily: "Manrope", fontSize: 11, fontWeight: "700", color: formPalette.ink }}>{formatPeso(obligation.remainingRequiredCentavos)}</Text>
                          </View>
                          <Text style={{ fontFamily: "Manrope", fontSize: 10.5, color: formPalette.mut, marginTop: 2 }}>
                            Due {obligation.scheduledDueDates.join(", ")}
                          </Text>
                        </View>
                      ))}
                      {parsePesoToCentavos(debtBudgetAmount) < requiredDebtTotal.totalRequiredCentavos ? (
                        <Text accessibilityRole="alert" style={{ fontFamily: "Manrope", fontSize: 11, color: formPalette.error, marginTop: 4 }}>
                          Debt payment deficit: {formatPeso(requiredDebtTotal.totalRequiredCentavos - parsePesoToCentavos(debtBudgetAmount))}
                        </Text>
                   ) : null}
                   </View>
                  ) : null}
                  </View>
                <View>
                  <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 12, color: formPalette.ink2, marginTop: 12, marginBottom: 6 }}>SAVINGS ENVELOPE</Text>
                  <Text style={{ fontFamily: "Manrope", fontSize: 11, color: formPalette.mut, marginBottom: 6 }}>Reserve enough for every scheduled contribution and to keep active goals on track. Savings Goals decides how any surplus is allocated.</Text>
                  <TextInput value={savingsBudgetAmount} onChangeText={setSavingsBudgetAmount} placeholder="e.g. 10.53" placeholderTextColor={formPalette.mut} accessibilityLabel="Savings envelope in pesos" keyboardType="decimal-pad" style={{ height: 46, borderRadius: 12, borderWidth: 1, borderColor: formPalette.line, paddingHorizontal: 14, fontFamily: "Manrope", fontSize: 14, color: formPalette.ink, backgroundColor: formPalette.card }} />
                  {requiredSavingsTotal ? (
                    <View style={{ marginTop: 8 }}>
                      <Text style={{ fontFamily: "Manrope", fontSize: 11, color: formPalette.mut }}>Minimum needed for scheduled contributions and target dates: {formatPeso(requiredSavingsTotal.totalRequiredCentavos)}</Text>
                      {requiredSavingsTotal.contributions.map((contribution, index) => (
                        <View key={contribution.savingsId} style={{ marginTop: 7, paddingTop: 7, borderTopWidth: index === 0 ? 0 : 1, borderTopColor: formPalette.line }}>
                          <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                            <Text style={{ flex: 1, fontFamily: "Manrope", fontSize: 11, fontWeight: "600", color: formPalette.ink }}>{requiredSavingsTotal.savingsNames[contribution.savingsId] ?? "Savings account"}</Text>
                            <Text style={{ fontFamily: "Manrope", fontSize: 11, fontWeight: "700", color: formPalette.ink }}>{formatPeso(contribution.remainingRequiredCentavos)}</Text>
                          </View>
                          <Text style={{ fontFamily: "Manrope", fontSize: 10.5, color: formPalette.mut, marginTop: 2 }}>Due {contribution.scheduledDates.join(", ")} · {formatPeso(contribution.recordedContributionCentavos)} contributed this cycle</Text>
                        </View>
                      ))}
                      {parsePesoToCentavos(savingsBudgetAmount) < requiredSavingsTotal.totalRequiredCentavos ? (
                        <Text accessibilityRole="alert" style={{ fontFamily: "Manrope", fontSize: 11, color: formPalette.error, marginTop: 4 }}>Savings schedule deficit: {formatPeso(requiredSavingsTotal.totalRequiredCentavos - parsePesoToCentavos(savingsBudgetAmount))}</Text>
                      ) : null}
                    </View>
                  ) : null}
                </View>
               <Text style={{ fontFamily: "Manrope", fontWeight: "700", color: "#1B1C1A", marginTop: 14 }}>Manual allocations</Text>
              {allocationRows.map((row, index) => (
                <View key={row.id} style={{ marginTop: 12 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 12, color: formPalette.ink2 }}>ALLOCATION {index + 1}</Text>
                    {allocationRows.length > 1 ? (
                      <Pressable accessibilityRole="button" accessibilityLabel={`Remove allocation ${index + 1}`} onPress={() => setAllocationRows((rows) => rows.filter((candidate) => candidate.id !== row.id))}>
                        <Text style={{ fontFamily: "Manrope", fontSize: 12, color: formPalette.error }}>Remove</Text>
                      </Pressable>
                    ) : null}
                  </View>
                  <Pressable accessibilityRole="button" accessibilityLabel={`Choose allocation ${index + 1} category`} onPress={() => setCategoryPickerRowId(row.id)} style={{ height: 46, borderRadius: 12, borderWidth: 1, borderColor: formPalette.line, paddingHorizontal: 14, justifyContent: "center", backgroundColor: formPalette.card, marginTop: 6 }}>
                    <Text style={{ fontFamily: "Manrope", fontSize: 14, color: row.label ? formPalette.ink : formPalette.mut }}>{row.label || "Choose a category"}</Text>
                  </Pressable>
                  <TextInput value={row.amount} onChangeText={(amount) => setAllocationRows((rows) => rows.map((candidate) => candidate.id === row.id ? { ...candidate, amount } : candidate))} placeholder="e.g. 5.00" placeholderTextColor={formPalette.mut} accessibilityLabel={`Allocation ${index + 1} amount in pesos`} keyboardType="decimal-pad" style={{ height: 46, borderRadius: 12, borderWidth: 1, borderColor: formPalette.line, paddingHorizontal: 14, marginTop: 8, fontFamily: "Manrope", fontSize: 14, color: formPalette.ink, backgroundColor: formPalette.card }} />
                </View>
              ))}
               <Pressable accessibilityRole="button" accessibilityLabel="Add allocation" onPress={() => setAllocationRows((rows) => [...rows, { ...emptyAllocationRow, id: `allocation-${Date.now()}-${rows.length}` }])} style={{ marginTop: 12 }}>
                <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 12, color: "#0E6D46" }}>+ Add allocation</Text>
               </Pressable>
               <Pressable accessibilityRole="button" accessibilityLabel={recommendationState === "generating" ? "Cancel recommendation generation" : "Generate budget recommendation"} disabled={!canGenerateRecommendation && recommendationState !== "generating"} onPress={() => recommendationState === "generating" ? recommendationAbort.current?.abort() : void generateRecommendation()} style={{ backgroundColor: canGenerateRecommendation || recommendationState === "generating" ? "#0E6D46" : "#9AA39D", borderRadius: 14, padding: 14, marginTop: 12 }}><Text style={{ fontFamily: "Manrope", fontWeight: "700", color: "#FFFFFF", textAlign: "center" }}>{recommendationState === "generating" ? "Cancel generation" : "Generate recommendation"}</Text></Pressable>
               {!canGenerateRecommendation ? <Text style={{ fontFamily: "Manrope", fontSize: 11, color: formPalette.mut, marginTop: 6 }}>Set valid dates, allocations, and required debt and savings reservations to generate a recommendation.</Text> : null}
               {recommendationState === "unavailable" ? <Text accessibilityRole="alert" style={{ fontFamily: "Manrope", fontSize: 12, color: "#D46B08", marginTop: 8 }}>The optimizer is temporarily unavailable. Your manual values are unchanged.</Text> : null}
               {recommendationState === "error" ? <Text accessibilityRole="alert" style={{ fontFamily: "Manrope", fontSize: 12, color: formPalette.error, marginTop: 8 }}>The recommendation could not be generated. Your manual values are unchanged.</Text> : null}
               {recommendationState === "cancelled" ? <Text style={{ fontFamily: "Manrope", fontSize: 12, color: formPalette.mut, marginTop: 8 }}>Recommendation generation was cancelled.</Text> : null}
               {recommendationState === "stale" ? <Text accessibilityRole="alert" style={{ fontFamily: "Manrope", fontSize: 12, color: "#D46B08", marginTop: 8 }}>This recommendation is stale because budget inputs changed. Generate a new one before applying.</Text> : null}
               {recommendation ? <View style={{ marginTop: 12, borderRadius: 12, padding: 12, backgroundColor: "#EEFFF8" }}>
                 <Text style={{ fontFamily: "Manrope", fontWeight: "700", color: formPalette.ink }}>Recommendation review</Text>
                 <Text style={{ fontFamily: "Manrope", fontSize: 11, color: formPalette.mut, marginTop: 4 }}>Category funds: {formatPeso(recommendation.availableFundsMinor)} · Debt: {formatPeso(recommendation.debtBudgetAmountMinor)} · Savings: {formatPeso(recommendation.savingsBudgetAmountMinor)}</Text>
                 {recommendation.allocations.map((allocation) => <View key={allocation.id} style={{ marginTop: 8 }}><Text style={{ fontFamily: "Manrope", fontSize: 12, color: formPalette.ink }}>{allocation.label}</Text><TextInput value={allocation.amount} onChangeText={(amount) => setRecommendation((current) => current ? { ...current, allocations: current.allocations.map((candidate) => candidate.id === allocation.id ? { ...candidate, amount } : candidate) } : current)} accessibilityLabel={`Recommended ${allocation.label} amount in pesos`} keyboardType="decimal-pad" style={{ height: 42, borderRadius: 10, borderWidth: 1, borderColor: formPalette.line, paddingHorizontal: 12, marginTop: 4, fontFamily: "Manrope", color: formPalette.ink, backgroundColor: "#FFFFFF" }} /></View>)}
                 {recommendationState === "ready" ? <Pressable accessibilityRole="button" accessibilityLabel="Apply recommendation" onPress={applyRecommendation} style={{ backgroundColor: "#013220", borderRadius: 12, padding: 12, marginTop: 12 }}><Text style={{ fontFamily: "Manrope", fontWeight: "700", color: "#FFFFFF", textAlign: "center" }}>Apply recommendation</Text></Pressable> : null}
                 {recommendationState === "ready" ? <Pressable accessibilityRole="button" accessibilityLabel="Cancel recommendation review" onPress={() => { setRecommendation(null); setRecommendationState("cancelled"); }} style={{ marginTop: 10 }}><Text style={{ fontFamily: "Manrope", fontWeight: "700", color: formPalette.mut, textAlign: "center" }}>Cancel review</Text></Pressable> : null}
                 {recommendationState === "accepted" ? <Text style={{ fontFamily: "Manrope", fontSize: 12, color: "#087A51", marginTop: 8 }}>Recommendation applied to the form. Save draft offline to persist it.</Text> : null}
               </View> : null}
              {createError ? <Text style={{ fontFamily: "Manrope", fontSize: 12, color: "#D9001F", marginTop: 8 }}>{createError}</Text> : null}
              {syncError ? <Text style={{ fontFamily: "Manrope", fontSize: 12, color: "#D46B08", marginTop: 8 }}>{syncError}</Text> : null}
              <Pressable disabled={creating} onPress={() => void saveDraft()} style={{ backgroundColor: "#013220", borderRadius: 14, padding: 14, marginTop: 12 }}><Text style={{ fontFamily: "Manrope", fontWeight: "700", color: "#FFFFFF", textAlign: "center" }}>{creating ? "Saving..." : "Save draft offline"}</Text></Pressable>
            </View>
          ) : null}
        </View>
      ) : null}

      {trackingLoading ? <ActivityIndicator color="#0E6D46" /> : trackingError ? (
        <View style={{ marginTop: 16, backgroundColor: "#FBE9E7", borderRadius: 16, padding: 16 }}>
          <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 14, color: "#D9001F" }}>Unable to load tracking</Text>
          <Text style={{ fontFamily: "Manrope", fontSize: 12, color: "#414942", marginTop: 6 }}>{trackingError}</Text>
          <Pressable onPress={() => retryDraftId && void openDraft(retryDraftId)} style={{ marginTop: 12 }}>
            <Text style={{ fontFamily: "Manrope", fontWeight: "700", color: "#0E6D46" }}>Try again</Text>
          </Pressable>
        </View>
      ) : selectedDraft ? (
        <View>
          {(() => {
            const spentAmount = calculateBudgetSpentAmount(selectedDraft.allocations.map((allocation) => allocation.actualAmountMinor));
            const percentage = selectedDraft.totalAmountMinor > 0 ? Math.min((spentAmount / selectedDraft.totalAmountMinor) * 100, 100) : 0;
            return (
              <>
                 <View style={{ marginTop: 16, backgroundColor: "#F7F0E1", borderRadius: 16, padding: 16 }}>
                   <Pressable accessibilityRole="button" accessibilityLabel="Edit budget draft" onPress={() => editDraft(selectedDraft)} style={{ alignSelf: "flex-end" }}><Text style={{ fontFamily: "Manrope", fontWeight: "700", color: "#0E6D46" }}>Edit</Text></Pressable>
                   <Text style={{ fontFamily: "Manrope", fontSize: 12, color: formPalette.mut }}>Draft budget · {selectedDraft.periodStart}–{selectedDraft.periodEnd}</Text>
                  <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 28, color: formPalette.ink, marginTop: 8 }}>{formatPeso(selectedDraft.totalAmountMinor)}</Text>
                  <View accessibilityRole="progressbar" accessibilityLabel={`${percentage.toFixed(1)} percent of budget spent`} style={{ height: 6, borderRadius: 3, backgroundColor: "#E4E8E2", overflow: "hidden", marginTop: 14 }}>
                    <View style={{ width: `${percentage}%`, height: "100%", backgroundColor: "#0E6D46" }} />
                  </View>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
                    <Text style={{ fontFamily: "Manrope", fontSize: 12, color: formPalette.mut }}>{formatPeso(spentAmount)} spent</Text>
                    <Text style={{ fontFamily: "Manrope", fontSize: 12, color: "#0E6D46" }}>{formatPeso(Math.max(selectedDraft.totalAmountMinor - spentAmount, 0))} left</Text>
                  </View>
                  <View style={{ flexDirection: "row", gap: 18, marginTop: 14 }}>
                    <Pressable accessibilityRole="button" accessibilityLabel="Edit budget" onPress={() => void editDraft(selectedDraft)}>
                      <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 12, color: "#0E6D46" }}>Edit budget</Text>
                    </Pressable>
                    <Pressable accessibilityRole="button" accessibilityLabel="Delete budget" onPress={() => removeDraft(selectedDraft)}>
                      <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 12, color: formPalette.error }}>Delete budget</Text>
                    </Pressable>
                  </View>
                </View>
                 <View style={{ marginTop: 10, padding: 12, borderRadius: 12, backgroundColor: "#EEFFF8" }}>
                    <Text style={{ fontFamily: "Manrope", fontSize: 12, color: "#087A51", textAlign: "center" }}>{formatPeso(selectedDraft.unallocatedAmountMinor)} unallocated</Text>
                 </View>
                <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 16, color: formPalette.ink, marginTop: 18 }}>Categories</Text>
                <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 22, marginTop: 10 }}>
                  <Text style={{ fontFamily: "Manrope", fontSize: 11, color: formPalette.mut }}>PLANNED</Text>
                  <Text style={{ fontFamily: "Manrope", fontSize: 11, color: formPalette.mut }}>LEFT</Text>
                </View>
                {selectedDraft.allocations.map((allocation) => {
                  const allocationPercentage = calculateProvisionalPercentage(allocation.actualAmountMinor, allocation.amountMinor);
                  return (
                    <View key={allocation.id} style={{ marginTop: 10 }}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                        <Text style={{ flex: 1, fontFamily: "Manrope", fontWeight: "700", fontSize: 13.5, color: formPalette.ink }}>{allocationLabels[allocation.id] || allocation.categoryId || allocation.subcategoryId}</Text>
                        <Text style={{ width: 64, textAlign: "right", fontFamily: "Manrope", fontSize: 11, color: formPalette.mut }}>{formatCompactPeso(allocation.amountMinor)}</Text>
                        <Text style={{ width: 64, textAlign: "right", fontFamily: "Manrope", fontSize: 11, color: formPalette.mut }}>{formatCompactPeso(Math.max(allocation.amountMinor - allocation.actualAmountMinor, 0))}</Text>
                      </View>
                      <View accessibilityRole="progressbar" accessibilityLabel={`${allocationPercentage.toFixed(1)} percent of ${allocationLabels[allocation.id] || "allocation"} spent`} style={{ height: 4, borderRadius: 2, backgroundColor: "#E4E8E2", overflow: "hidden", marginTop: 6 }}>
                        <View style={{ width: `${Math.min(allocationPercentage, 100)}%`, height: "100%", backgroundColor: "#0E6D46" }} />
                      </View>
                    </View>
                  );
                })}
              </>
            );
          })()}
        </View>
      ) : showCreate || editingDraftId ? null : loading ? <ActivityIndicator color="#0E6D46" /> : draftsError ? (
        <View style={{ marginTop: 16, backgroundColor: "#FBE9E7", borderRadius: 16, padding: 16 }}>
          <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 14, color: "#D9001F" }}>Unable to load drafts</Text>
          <Text style={{ fontFamily: "Manrope", fontSize: 12, color: "#414942", marginTop: 6 }}>{draftsError}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Retry loading budget drafts" onPress={() => void loadDrafts()} style={{ marginTop: 12 }}><Text style={{ fontFamily: "Manrope", fontWeight: "700", color: "#0E6D46" }}>Try again</Text></Pressable>
        </View>
      ) : drafts.length === 0 ? (
        <View style={{ marginTop: 16, backgroundColor: "#F1F0EB", borderRadius: 16, padding: 16 }}>
          <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 14, color: "#1B1C1A", marginBottom: 6 }}>
            No budget drafts yet
          </Text>
          <Text style={{ fontFamily: "Manrope", fontSize: 12, color: "#414942" }}>
            Create a manual draft to start allocating money across your categories.
          </Text>
        </View>
      ) : drafts.map((draft) => (
        <Pressable key={draft.id} onPress={() => void openDraft(draft.id)} style={{ marginTop: 16, backgroundColor: "#F1F0EB", borderRadius: 16, padding: 16 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 14, color: "#1B1C1A" }}>{formatPeriodKind(draft.periodKind)} draft</Text>
            <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 10, color: "#0E6D46" }}>DRAFT</Text>
          </View>
          <Text style={{ fontFamily: "Manrope", fontSize: 12, color: "#414942" }}>{draft.periodStart} to {draft.periodEnd}</Text>
          <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 12, color: "#1B1C1A", marginTop: 12 }}>{formatPeso(calculateBudgetAllocatedAmount(draft.allocatedAmountMinor, draft.debtBudgetAmountMinor, draft.savingsBudgetAmountMinor))} allocated</Text>
          <Text style={{ fontFamily: "Manrope", fontSize: 12, color: "#6B7A6F" }}>{formatPeso(draft.unallocatedAmountMinor)} unallocated</Text>
         </Pressable>
      ))}
      {datePicker ? (
        <DateTimePicker
          value={parseDate(datePicker === "start" ? periodStart : periodEnd)}
          mode="date"
          onChange={(_event, date) => {
            setDatePicker(null);
            if (!date) return;
            if (datePicker === "start") setPeriodStart(formatDate(date));
            else setPeriodEnd(formatDate(date));
          }}
        />
      ) : null}
    </ScrollView>
    </KeyboardAvoidingView>
  );
}
