import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { DotsThreeVertical } from "phosphor-react-native";
import type { Category, Subcategory } from "../../local-db/repositories/taxonomy";
import type { ManualPlanAllocation, ReservationSkips } from "./api";
import { PlanCategoryRuleEditor, type PlanCategoryRuleUpdate } from "./PlanCategoryRuleEditor";

type Props = {
  topLevelCategories: Category[];
  subcategories: Subcategory[];
  includedCategoryIds?: Set<string>;
  includedIds: Set<string>;
  recommendedCategoryIds?: Set<string>;
  recommendedIds: Set<string>;
  onToggle: (id: string) => void;
  onToggleCategory: (id: string) => void;
  onSaveCategoryRule?: (category: Category, update: PlanCategoryRuleUpdate) => Promise<void>;
  onSaveRule: (subcategory: Subcategory, update: PlanCategoryRuleUpdate) => Promise<void>;
  plannedAmount: string;
  availableMoneyCentavos: number;
  planningAmountError: string | null;
  onPlannedAmountChange: (amount: string) => void;
  onContinue: (manualAllocations: ManualPlanAllocation[]) => void;
  reservationSkips?: ReservationSkips;
  onReservationSkipChange?: (type: keyof ReservationSkips, shouldSkip: boolean) => void;
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
const SubcategoryRow = memo(function SubcategoryRow({ subcategory, selected, recommended, editing, manualAmount, handlers }: { subcategory: Subcategory; selected: boolean; recommended: boolean; editing: boolean; manualAmount: string; handlers: RowHandlers }) {
  const rule = requirement(subcategory);
  const locked = rule !== null;
  return <View style={{ marginTop: 8, marginLeft: 12 }}><View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><Pressable accessibilityRole="checkbox" accessibilityState={{ checked: selected, disabled: locked }} accessibilityLabel={`Include ${subcategory.label} in Financial Plan`} disabled={locked} onPress={() => handlers.onToggle(subcategory.id)} style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: selected ? "#0E6D46" : "#EAEAE6", backgroundColor: selected ? "#EEFFF8" : "#FCF8F0", borderRadius: 13, padding: 13, opacity: locked ? 0.8 : 1 }}>
    {checkbox(selected)}
    <View style={{ flex: 1 }}><Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 13, color: "#1B1C1A" }}>{subcategory.label}</Text>{locked ? <Text style={{ fontFamily: "Manrope", fontSize: 11, color: "#416153", marginTop: 2 }}>{rule} requirement</Text> : recommended ? <Text style={{ fontFamily: "Manrope", fontSize: 11, color: "#416153", marginTop: 2 }}>Recommended from your past 6 months</Text> : null}</View>
    </Pressable><Pressable accessibilityRole="button" accessibilityLabel={`Configure Financial Plan rule for ${subcategory.label}`} onPress={() => handlers.onEdit(subcategory.id)} hitSlop={8} style={{ width: 32, height: 32, alignItems: "center", justifyContent: "center" }}><DotsThreeVertical size={20} color="#6B7A6F" weight="bold" /></Pressable></View>{selected && !locked && !recommended ? <ManualAmountField label={subcategory.label} amountKey={`subcategory:${subcategory.id}`} value={manualAmount} onChange={handlers.onManualAmountChange} /> : null}{editing ? <PlanCategoryRuleEditor category={subcategory} onClose={() => handlers.onEdit(null)} onSave={(update) => handlers.onSaveRule(subcategory.id, update)} /> : null}</View>;
});

const CategoryRow = memo(function CategoryRow({ category, selected, recommended, editing, manualAmount, handlers }: { category: Category; selected: boolean; recommended: boolean; editing: boolean; manualAmount: string; handlers: RowHandlers }) {
  const rule = requirement(category);
  const locked = rule !== null;
  return <>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><Pressable accessibilityRole="checkbox" accessibilityState={{ checked: selected, disabled: locked }} accessibilityLabel={`Include ${category.label} in Financial Plan`} disabled={locked} onPress={() => handlers.onToggle(category.id)} style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: selected ? "#0E6D46" : "#D7DDD8", backgroundColor: selected ? "#EEFFF8" : "#F6F2E9", borderRadius: 13, padding: 13, opacity: locked ? 0.8 : 1 }}>
      {checkbox(selected)}
      <View style={{ flex: 1 }}><Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 14, color: "#1B1C1A" }}>{category.label}</Text><Text style={{ fontFamily: "Manrope", fontSize: 11, color: "#416153", marginTop: 2 }}>{locked ? `${rule} requirement` : recommended ? "Recommended from category spending" : "Broad category only"}</Text></View>
    </Pressable><Pressable accessibilityRole="button" accessibilityLabel={`Configure Financial Plan rule for ${category.label}`} onPress={() => handlers.onEdit(category.id)} hitSlop={8} style={{ width: 32, height: 32, alignItems: "center", justifyContent: "center" }}><DotsThreeVertical size={20} color="#6B7A6F" weight="bold" /></Pressable></View>
    {selected && !locked && !recommended ? <ManualAmountField label={category.label} amountKey={`category:${category.id}`} value={manualAmount} onChange={handlers.onManualAmountChange} /> : null}
    {editing ? <PlanCategoryRuleEditor category={category} onClose={() => handlers.onEdit(null)} onSave={(update) => handlers.onSaveRule(category.id, update)} /> : null}
  </>;
});

// The first categories render with the page and the rest a few per frame, so the plan screen appears at once.
const INITIAL_CATEGORY_COUNT = 1;
const CATEGORIES_PER_FRAME = 2;

export function PlanCategorySelection({ topLevelCategories, subcategories, includedCategoryIds = EMPTY_IDS, includedIds, recommendedCategoryIds = EMPTY_IDS, recommendedIds, onToggle, onToggleCategory, onSaveCategoryRule = saveNothing, onSaveRule, plannedAmount, availableMoneyCentavos, planningAmountError, onPlannedAmountChange, onContinue, reservationSkips = { debtRepayments: false, savingsContributions: false }, onReservationSkipChange = () => {} }: Props) {
  const uncategorizedSubcategories = subcategories.filter((subcategory) => !subcategory.category_id);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [manualAmounts, setManualAmounts] = useState<Record<string, string>>({});
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

  const manualAmount = (target: ManualPlanAllocation["target"], id: string) => manualAmounts[`${target}:${id}`] ?? "";
  const parsedManualAmount = (target: ManualPlanAllocation["target"], id: string) => parseManualAmount(manualAmount(target, id));
  const manualAllocations = (): ManualPlanAllocation[] => [
    ...subcategories.filter((subcategory) => includedIds.has(subcategory.id) && requirement(subcategory) === null && !recommendedIds.has(subcategory.id)).map((subcategory) => ({ target: "subcategory" as const, id: subcategory.id, amountCentavos: parsedManualAmount("subcategory", subcategory.id) ?? 0 })),
    ...topLevelCategories.filter((category) => includedCategoryIds.has(category.id) && requirement(category) === null && !recommendedCategoryIds.has(category.id)).map((category) => ({ target: "category" as const, id: category.id, amountCentavos: parsedManualAmount("category", category.id) ?? 0 })),
  ];
  const hasInvalidManualAmount = manualAllocations().some((allocation) => allocation.amountCentavos <= 0);

  function renderSubcategory(subcategory: Subcategory) {
    return <SubcategoryRow key={subcategory.id} subcategory={subcategory} selected={includedIds.has(subcategory.id)} recommended={recommendedIds.has(subcategory.id)} editing={editingId === subcategory.id} manualAmount={manualAmount("subcategory", subcategory.id)} handlers={subcategoryHandlers} />;
  }

  function renderCategory(category: Category) {
    const children = childrenByCategory.get(category.id);
    if (!children) return null;
    return <View key={category.id} style={{ marginTop: 16 }}>
      <CategoryRow category={category} selected={includedCategoryIds.has(category.id)} recommended={recommendedCategoryIds.has(category.id)} editing={editingId === category.id} manualAmount={manualAmount("category", category.id)} handlers={categoryHandlers} />
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
        <Text style={{ color: "#416153", fontFamily: "Manrope", fontSize: 11, marginTop: 5 }}>Available money: PHP {(availableMoneyCentavos / 100).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
        {planningAmountError ? <Text accessibilityRole="alert" style={{ color: "#D9001F", fontFamily: "Manrope", fontSize: 11, marginTop: 5 }}>{planningAmountError}</Text> : null}
       </View>
       <View style={{ backgroundColor: "#FFF8E7", borderColor: "#F2D9A3", borderRadius: 13, borderWidth: 1, marginTop: 16, padding: 13 }}>
         <Text style={{ color: "#6F4A00", fontFamily: "Manrope", fontSize: 13, fontWeight: "800" }}>Plan commitments</Text>
         <Text style={{ color: "#414942", fontFamily: "Manrope", fontSize: 11, lineHeight: 16, marginTop: 4 }}>Debt repayments and savings contributions are included unless you explicitly skip them.</Text>
         <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: reservationSkips.debtRepayments }} accessibilityLabel="Skip Debt Repayments" onPress={() => onReservationSkipChange("debtRepayments", !reservationSkips.debtRepayments)} style={{ alignItems: "center", backgroundColor: reservationSkips.debtRepayments ? "#EEFFF8" : "#FCF8F0", borderColor: reservationSkips.debtRepayments ? "#0E6D46" : "#EAEAE6", borderRadius: 13, borderWidth: 1, flexDirection: "row", gap: 10, marginTop: 12, padding: 13 }}><View style={{ alignItems: "center", backgroundColor: reservationSkips.debtRepayments ? "#0E6D46" : "#FFFFFF", borderColor: reservationSkips.debtRepayments ? "#0E6D46" : "#A8B0AA", borderRadius: 5, borderWidth: 2, height: 20, justifyContent: "center", width: 20 }}><Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "800" }}>{reservationSkips.debtRepayments ? "x" : ""}</Text></View><Text style={{ color: "#1B1C1A", flex: 1, fontFamily: "Manrope", fontSize: 13, fontWeight: "700" }}>Skip debt repayments for this plan</Text></Pressable>
         <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: reservationSkips.savingsContributions }} accessibilityLabel="Skip Savings Contributions" onPress={() => onReservationSkipChange("savingsContributions", !reservationSkips.savingsContributions)} style={{ alignItems: "center", backgroundColor: reservationSkips.savingsContributions ? "#EEFFF8" : "#FCF8F0", borderColor: reservationSkips.savingsContributions ? "#0E6D46" : "#EAEAE6", borderRadius: 13, borderWidth: 1, flexDirection: "row", gap: 10, marginTop: 10, padding: 13 }}><View style={{ alignItems: "center", backgroundColor: reservationSkips.savingsContributions ? "#0E6D46" : "#FFFFFF", borderColor: reservationSkips.savingsContributions ? "#0E6D46" : "#A8B0AA", borderRadius: 5, borderWidth: 2, height: 20, justifyContent: "center", width: 20 }}><Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "800" }}>{reservationSkips.savingsContributions ? "x" : ""}</Text></View><Text style={{ color: "#1B1C1A", flex: 1, fontFamily: "Manrope", fontSize: 13, fontWeight: "700" }}>Skip savings contributions for this plan</Text></Pressable>
       </View>
       {topLevelCategories.slice(0, visibleCategoryCount).map(renderCategory)}
      {visibleCategoryCount >= topLevelCategories.length && uncategorizedSubcategories.length > 0 ? <View style={{ marginTop: 16 }}><Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 14, color: "#1B1C1A" }}>Other expense categories</Text>{uncategorizedSubcategories.map(renderSubcategory)}</View> : null}
        {hasInvalidManualAmount ? <Text accessibilityRole="alert" style={{ color: "#D9001F", fontFamily: "Manrope", fontSize: 11, marginTop: 10 }}>Enter an amount greater than zero for each new category.</Text> : null}
        <Pressable accessibilityRole="button" accessibilityLabel="Create Financial Plan recommendation" disabled={includedIds.size + includedCategoryIds.size === 0 || planningAmountError !== null || hasInvalidManualAmount} onPress={() => onContinue(manualAllocations())} style={{ backgroundColor: "#013220", borderRadius: 14, padding: 14, marginTop: 18, opacity: includedIds.size + includedCategoryIds.size === 0 || planningAmountError !== null || hasInvalidManualAmount ? 0.5 : 1 }}><Text style={{ fontFamily: "Manrope", fontWeight: "800", color: "#FFFFFF", textAlign: "center" }}>Create recommendation</Text></Pressable>
    </View>
  );
}
