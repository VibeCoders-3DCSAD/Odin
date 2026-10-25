import { memo, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { DotsThreeVertical } from "phosphor-react-native";
import type { Category, Subcategory } from "../../local-db/repositories/taxonomy";
import type { ManualPlanAllocation } from "./api";
import type { PlanRecommendations } from "../../local-db/repositories/forecastTransactions";
import { formatPeso } from "./financialPlanPresentation";
import type { CommitmentPreview } from "./helpers/commitmentBudget";
import { recommendPlanAmount } from "./helpers/planAmountRecommendation";
import { PlanCategoryRuleEditor, type PlanCategoryRuleUpdate } from "./PlanCategoryRuleEditor";

type Props = {
  topLevelCategories: Category[];
  subcategories: Subcategory[];
  includedCategoryIds?: Set<string>;
  includedIds: Set<string>;
  recommendedCategoryIds?: Set<string>;
  recommendedIds: Set<string>;
  // Categories with spending in the past twelve months, which the plan budgets from that history.
  historyCategoryIds?: Set<string>;
  historyIds?: Set<string>;
  // Recommendations follow last year's seasons once there is a full year of history.
  seasonalRecommendations?: boolean;
  onToggle: (id: string) => void;
  onToggleCategory: (id: string) => void;
  onSaveCategoryRule?: (category: Category, update: PlanCategoryRuleUpdate) => Promise<void>;
  onSaveRule: (subcategory: Subcategory, update: PlanCategoryRuleUpdate) => Promise<void>;
  plannedAmount: string;
  availableMoneyCentavos: number;
  planningAmountError: string | null;
  onPlannedAmountChange: (amount: string) => void;
  onContinue: (manualAllocations: ManualPlanAllocation[]) => void;
  initialManualAllocations?: ManualPlanAllocation[];
  commitmentSection?: ReactNode;
  // With expected spending, a recommended planning amount is shown under the amount field.
  commitments?: CommitmentPreview | null;
  expectedSpend?: PlanRecommendations["expectedSpend"];
};

const EMPTY_IDS = new Set<string>();
const saveNothing = async () => {};

function requirement(category: { fixed_amount_centavos?: number | null; minimum_amount_centavos?: number | null }): "Fixed" | "Minimum" | null {
  if (category.fixed_amount_centavos != null) return "Fixed";
  if (category.minimum_amount_centavos != null) return "Minimum";
  return null;
}

type RowHandlers = {
  onToggle: (id: string) => void;
  onEdit: (id: string | null) => void;
  onManualAmountChange: (key: string, value: string) => void;
  onSaveRule: (id: string, update: PlanCategoryRuleUpdate) => Promise<void>;
};

const checkbox = (selected: boolean) => <View style={{ width: 20, height: 20, borderRadius: 5, borderWidth: 2, borderColor: selected ? "#0E6D46" : "#A8B0AA", backgroundColor: selected ? "#0E6D46" : "#FFFFFF", alignItems: "center", justifyContent: "center" }}><Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "800" }}>{selected ? "x" : ""}</Text></View>;

function parseManualAmount(value: string): number | null {
  const trimmed = value.trim();
  return /^\d+(\.\d{1,2})?$/.test(trimmed) ? Math.round(Number(trimmed) * 100) : null;
}

function ManualAmountField({ label, amountKey, value, onChange }: { label: string; amountKey: string; value: string; onChange: RowHandlers["onManualAmountChange"] }) {
  return <View style={{ marginTop: 7, marginLeft: 8 }}><Text style={{ color: "#416153", fontFamily: "Manrope", fontSize: 11 }}>You haven't used {label} before. How much do you want to set aside?</Text><TextInput accessibilityLabel={`One-time plan amount for ${label} in pesos`} value={value} onChangeText={(next) => onChange(amountKey, next)} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor="#8A938C" style={{ height: 40, marginTop: 6, backgroundColor: "#FFFFFF", borderColor: (parseManualAmount(value) ?? 0) <= 0 ? "#D7DDD8" : "#0E6D46", borderRadius: 9, borderWidth: 1, color: "#1B1C1A", fontFamily: "Manrope", fontSize: 13, paddingHorizontal: 11 }} /></View>;
}

// Rows are memoized with primitive props and stable handlers: a plan can list well over a hundred
// subcategories, and re-rendering all of them on every toggle or keystroke took seconds on device.
const SubcategoryRow = memo(function SubcategoryRow({ subcategory, selected, recommended, recommendedNote, needsAmount, editing, manualAmount, handlers }: { subcategory: Subcategory; selected: boolean; recommended: boolean; recommendedNote: string; needsAmount: boolean; editing: boolean; manualAmount: string; handlers: RowHandlers }) {
  const rule = requirement(subcategory);
  const locked = rule !== null;
  return <View style={{ marginTop: 8, marginLeft: 12 }}><View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><Pressable accessibilityRole="checkbox" accessibilityState={{ checked: selected, disabled: locked }} accessibilityLabel={`Include ${subcategory.label} in Financial Plan`} disabled={locked} onPress={() => handlers.onToggle(subcategory.id)} style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: selected ? "#0E6D46" : "#EAEAE6", backgroundColor: selected ? "#EEFFF8" : "#FCF8F0", borderRadius: 13, padding: 13, opacity: locked ? 0.8 : 1 }}>
    {checkbox(selected)}
    <View style={{ flex: 1 }}><Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 13, color: "#1B1C1A" }}>{subcategory.label}</Text>{locked ? <Text style={{ fontFamily: "Manrope", fontSize: 11, color: "#416153", marginTop: 2 }}>{rule} requirement</Text> : recommended ? <Text style={{ fontFamily: "Manrope", fontSize: 11, color: "#416153", marginTop: 2 }}>{recommendedNote}</Text> : null}</View>
    </Pressable><Pressable accessibilityRole="button" accessibilityLabel={`Configure Financial Plan rule for ${subcategory.label}`} onPress={() => handlers.onEdit(subcategory.id)} hitSlop={8} style={{ width: 32, height: 32, alignItems: "center", justifyContent: "center" }}><DotsThreeVertical size={20} color="#6B7A6F" weight="bold" /></Pressable></View>{selected && !locked && needsAmount ? <ManualAmountField label={subcategory.label} amountKey={`subcategory:${subcategory.id}`} value={manualAmount} onChange={handlers.onManualAmountChange} /> : null}<PlanCategoryRuleEditor visible={editing} category={subcategory} onClose={() => handlers.onEdit(null)} onSave={(update) => handlers.onSaveRule(subcategory.id, update)} /></View>;
});

const CategoryRow = memo(function CategoryRow({ category, selected, recommended, needsAmount, editing, manualAmount, handlers }: { category: Category; selected: boolean; recommended: boolean; needsAmount: boolean; editing: boolean; manualAmount: string; handlers: RowHandlers }) {
  const rule = requirement(category);
  const locked = rule !== null;
  return <>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><Pressable accessibilityRole="checkbox" accessibilityState={{ checked: selected, disabled: locked }} accessibilityLabel={`Include ${category.label} in Financial Plan`} disabled={locked} onPress={() => handlers.onToggle(category.id)} style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: selected ? "#0E6D46" : "#D7DDD8", backgroundColor: selected ? "#EEFFF8" : "#F6F2E9", borderRadius: 13, padding: 13, opacity: locked ? 0.8 : 1 }}>
      {checkbox(selected)}
      <View style={{ flex: 1 }}><Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 14, color: "#1B1C1A" }}>{category.label}</Text><Text style={{ fontFamily: "Manrope", fontSize: 11, color: "#416153", marginTop: 2 }}>{locked ? `${rule} requirement` : recommended ? "Recommended from category spending" : "Broad category only"}</Text></View>
    </Pressable><Pressable accessibilityRole="button" accessibilityLabel={`Configure Financial Plan rule for ${category.label}`} onPress={() => handlers.onEdit(category.id)} hitSlop={8} style={{ width: 32, height: 32, alignItems: "center", justifyContent: "center" }}><DotsThreeVertical size={20} color="#6B7A6F" weight="bold" /></Pressable></View>
    {selected && !locked && needsAmount ? <ManualAmountField label={category.label} amountKey={`category:${category.id}`} value={manualAmount} onChange={handlers.onManualAmountChange} /> : null}
    <PlanCategoryRuleEditor visible={editing} category={category} onClose={() => handlers.onEdit(null)} onSave={(update) => handlers.onSaveRule(category.id, update)} />
  </>;
});

// The first categories render with the page and the rest a few per frame, so the plan screen appears at once.
const INITIAL_CATEGORY_COUNT = 1;
const CATEGORIES_PER_FRAME = 2;

export function PlanCategorySelection({ topLevelCategories, subcategories, includedCategoryIds = EMPTY_IDS, includedIds, recommendedCategoryIds = EMPTY_IDS, recommendedIds, historyCategoryIds = EMPTY_IDS, historyIds = EMPTY_IDS, seasonalRecommendations = false, onToggle, onToggleCategory, onSaveCategoryRule = saveNothing, onSaveRule, plannedAmount, availableMoneyCentavos, planningAmountError, onPlannedAmountChange, onContinue, initialManualAllocations = [], commitmentSection, commitments = null, expectedSpend }: Props) {
  const uncategorizedSubcategories = subcategories.filter((subcategory) => !subcategory.category_id);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [manualAmounts, setManualAmounts] = useState<Record<string, string>>(() => Object.fromEntries(initialManualAllocations.map(({ target, id, amountCentavos }) => [`${target}:${id}`, (amountCentavos / 100).toFixed(2)])));
  const [visibleCategoryCount, setVisibleCategoryCount] = useState(INITIAL_CATEGORY_COUNT);

  useEffect(() => {
    if (visibleCategoryCount >= topLevelCategories.length) return;
    const frame = requestAnimationFrame(() => setVisibleCategoryCount((count) => count + CATEGORIES_PER_FRAME));
    return () => cancelAnimationFrame(frame);
  }, [visibleCategoryCount, topLevelCategories.length]);

  // The parent passes new callbacks every render; rows read the latest ones through this ref so their
  // handlers stay stable and memoization holds.
  const latest = useRef({ onToggle, onToggleCategory, onSaveRule, onSaveCategoryRule, subcategories, topLevelCategories });
  latest.current = { onToggle, onToggleCategory, onSaveRule, onSaveCategoryRule, subcategories, topLevelCategories };
  const subcategoryHandlers = useMemo<RowHandlers>(() => ({
    onToggle: (id) => latest.current.onToggle(id),
    onEdit: setEditingId,
    onManualAmountChange: (key, value) => setManualAmounts((current) => ({ ...current, [key]: value })),
    onSaveRule: async (id, update) => {
      const subcategory = latest.current.subcategories.find((item) => item.id === id);
      if (subcategory) await latest.current.onSaveRule(subcategory, update);
      setEditingId(null);
    },
  }), []);
  const categoryHandlers = useMemo<RowHandlers>(() => ({
    ...subcategoryHandlers,
    onToggle: (id) => latest.current.onToggleCategory(id),
    onSaveRule: async (id, update) => {
      const category = latest.current.topLevelCategories.find((item) => item.id === id);
      if (category) await latest.current.onSaveCategoryRule(category, update);
      setEditingId(null);
    },
  }), [subcategoryHandlers]);
  const childrenByCategory = useMemo(() => {
    const groups = new Map<string, Subcategory[]>();
    for (const subcategory of subcategories) {
      if (!subcategory.category_id) continue;
      const group = groups.get(subcategory.category_id);
      if (group) group.push(subcategory);
      else groups.set(subcategory.category_id, [subcategory]);
    }
    return groups;
  }, [subcategories]);

  const recommendedNote = seasonalRecommendations ? "Recommended from this time last year and your past 12 months" : "Recommended from your past 6 months";
  // Only a category the plan has no spending for needs a one-time amount.
  const subcategoryNeedsAmount = (id: string) => !recommendedIds.has(id) && !historyIds.has(id);
  const categoryNeedsAmount = (id: string) => !recommendedCategoryIds.has(id) && !historyCategoryIds.has(id);
  const manualAmount = (target: ManualPlanAllocation["target"], id: string) => manualAmounts[`${target}:${id}`] ?? "";
  const parsedManualAmount = (target: ManualPlanAllocation["target"], id: string) => parseManualAmount(manualAmount(target, id));
  const manualAllocations = (): ManualPlanAllocation[] => [
    ...subcategories.filter((subcategory) => includedIds.has(subcategory.id) && requirement(subcategory) === null && subcategoryNeedsAmount(subcategory.id)).map((subcategory) => ({ target: "subcategory" as const, id: subcategory.id, amountCentavos: parsedManualAmount("subcategory", subcategory.id) ?? 0 })),
    ...topLevelCategories.filter((category) => includedCategoryIds.has(category.id) && requirement(category) === null && categoryNeedsAmount(category.id)).map((category) => ({ target: "category" as const, id: category.id, amountCentavos: parsedManualAmount("category", category.id) ?? 0 })),
  ];
  const hasInvalidManualAmount = manualAllocations().some((allocation) => allocation.amountCentavos <= 0);
  const cannotContinue = includedIds.size + includedCategoryIds.size === 0 || planningAmountError !== null || hasInvalidManualAmount;
  const recommendation = expectedSpend ? recommendPlanAmount({ commitments, topLevelCategories, subcategories, includedCategoryIds, includedIds, expectedSpend, manualAllocations: manualAllocations() }) : null;
  const recommendedCentavos = recommendation ? Math.min(recommendation.totalCentavos, availableMoneyCentavos) : 0;

  function renderSubcategory(subcategory: Subcategory) {
    return <SubcategoryRow key={subcategory.id} subcategory={subcategory} selected={includedIds.has(subcategory.id)} recommended={recommendedIds.has(subcategory.id)} recommendedNote={recommendedNote} needsAmount={subcategoryNeedsAmount(subcategory.id)} editing={editingId === subcategory.id} manualAmount={manualAmount("subcategory", subcategory.id)} handlers={subcategoryHandlers} />;
  }

  function renderCategory(category: Category) {
    const children = childrenByCategory.get(category.id);
    if (!children) return null;
    return <View key={category.id} style={{ marginTop: 16 }}>
      <CategoryRow category={category} selected={includedCategoryIds.has(category.id)} recommended={recommendedCategoryIds.has(category.id)} needsAmount={categoryNeedsAmount(category.id)} editing={editingId === category.id} manualAmount={manualAmount("category", category.id)} handlers={categoryHandlers} />
      {children.map(renderSubcategory)}
    </View>;
  }

  return (
    <View style={{ paddingBottom: 28 }}>
      <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 20, color: "#1B1C1A" }}>Financial Plan</Text>
       <Text style={{ fontFamily: "Manrope", fontSize: 12, color: "#6B7A6F", marginTop: 4 }}>Choose broad categories or specific subcategories for your plan. They are planned separately. Fixed and minimum categories are included automatically.</Text>
       <View style={{ marginTop: 16 }}>
        <Text style={{ color: "#1B1C1A", fontFamily: "Manrope", fontSize: 13, fontWeight: "800" }}>How much should we plan?</Text>
        <TextInput accessibilityLabel="How much should we plan in pesos" value={plannedAmount} onChangeText={onPlannedAmountChange} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor="#8A938C" style={{ backgroundColor: "#FFFFFF", borderColor: planningAmountError ? "#D9001F" : "#D7DDD8", borderRadius: 13, borderWidth: 1, color: "#1B1C1A", fontFamily: "Manrope", fontSize: 16, marginTop: 7, padding: 13 }} />
        {recommendation && recommendation.totalCentavos > 0 ? <View style={{ marginTop: 7 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Text style={{ flex: 1, color: "#1B1C1A", fontFamily: "Manrope", fontSize: 12, fontWeight: "800" }}>Recommended: {formatPeso(recommendedCentavos)}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Use the recommended planning amount" onPress={() => onPlannedAmountChange((recommendedCentavos / 100).toFixed(2))} style={{ paddingHorizontal: 10, paddingVertical: 6 }}><Text style={{ color: "#0E6D46", fontFamily: "Manrope", fontSize: 12, fontWeight: "800" }}>Use this</Text></Pressable>
          </View>
          <Text style={{ color: "#6B7A6F", fontFamily: "Manrope", fontSize: 11 }}>{formatPeso(recommendation.commitmentsCentavos)} commitments + {formatPeso(recommendation.spendingCentavos)} expected spending</Text>
          {recommendation.totalCentavos > availableMoneyCentavos ? <Text style={{ color: "#B45309", fontFamily: "Manrope", fontSize: 11, marginTop: 2 }}>Your available money is {formatPeso(recommendation.totalCentavos - availableMoneyCentavos)} short of this month's needs.</Text> : null}
        </View> : null}
        <Text style={{ color: "#416153", fontFamily: "Manrope", fontSize: 11, marginTop: 5 }}>Available money: PHP {(availableMoneyCentavos / 100).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
        {planningAmountError ? <Text accessibilityRole="alert" style={{ color: "#D9001F", fontFamily: "Manrope", fontSize: 11, marginTop: 5 }}>{planningAmountError}</Text> : null}
       </View>
       {commitmentSection}
       {topLevelCategories.slice(0, visibleCategoryCount).map(renderCategory)}
      {visibleCategoryCount >= topLevelCategories.length && uncategorizedSubcategories.length > 0 ? <View style={{ marginTop: 16 }}><Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 14, color: "#1B1C1A" }}>Other expense categories</Text>{uncategorizedSubcategories.map(renderSubcategory)}</View> : null}
        {hasInvalidManualAmount ? <Text accessibilityRole="alert" style={{ color: "#D9001F", fontFamily: "Manrope", fontSize: 11, marginTop: 10 }}>Enter an amount greater than zero for each new category.</Text> : null}
        <Pressable accessibilityRole="button" accessibilityLabel="Continue to Plan" disabled={cannotContinue} onPress={() => onContinue(manualAllocations())} style={{ backgroundColor: "#013220", borderRadius: 14, padding: 14, marginTop: 18, opacity: cannotContinue ? 0.5 : 1 }}><Text style={{ fontFamily: "Manrope", fontWeight: "800", color: "#FFFFFF", textAlign: "center" }}>Continue to Plan</Text></Pressable>
    </View>
  );
}
