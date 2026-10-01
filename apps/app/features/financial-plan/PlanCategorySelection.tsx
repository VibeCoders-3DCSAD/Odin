import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { DotsThreeVertical } from "phosphor-react-native";
import type { Category, Subcategory } from "../../local-db/repositories/taxonomy";
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
  onContinue: () => void;
};

function requirement(category: { fixed_amount_centavos?: number | null; minimum_amount_centavos?: number | null }): "Fixed" | "Minimum" | null {
  if (category.fixed_amount_centavos != null) return "Fixed";
  if (category.minimum_amount_centavos != null) return "Minimum";
  return null;
}

export function PlanCategorySelection({ topLevelCategories, subcategories, includedCategoryIds = new Set(), includedIds, recommendedCategoryIds = new Set(), recommendedIds, onToggle, onToggleCategory, onSaveCategoryRule = async () => {}, onSaveRule, plannedAmount, availableMoneyCentavos, planningAmountError, onPlannedAmountChange, onContinue }: Props) {
  const uncategorizedSubcategories = subcategories.filter((subcategory) => !subcategory.category_id);
  const [editingId, setEditingId] = useState<string | null>(null);

  function renderSubcategory(subcategory: Subcategory) {
    const locked = requirement(subcategory) !== null;
    const selected = includedIds.has(subcategory.id);
    return <View key={subcategory.id} style={{ marginTop: 8, marginLeft: 12 }}><View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><Pressable accessibilityRole="checkbox" accessibilityState={{ checked: selected, disabled: locked }} accessibilityLabel={`Include ${subcategory.label} in Financial Plan`} disabled={locked} onPress={() => onToggle(subcategory.id)} style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: selected ? "#0E6D46" : "#EAEAE6", backgroundColor: selected ? "#EEFFF8" : "#FCF8F0", borderRadius: 13, padding: 13, opacity: locked ? 0.8 : 1 }}>
      <View style={{ width: 20, height: 20, borderRadius: 5, borderWidth: 2, borderColor: selected ? "#0E6D46" : "#A8B0AA", backgroundColor: selected ? "#0E6D46" : "#FFFFFF", alignItems: "center", justifyContent: "center" }}><Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "800" }}>{selected ? "x" : ""}</Text></View>
      <View style={{ flex: 1 }}><Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 13, color: "#1B1C1A" }}>{subcategory.label}</Text>{locked ? <Text style={{ fontFamily: "Manrope", fontSize: 11, color: "#416153", marginTop: 2 }}>{requirement(subcategory)} requirement</Text> : recommendedIds.has(subcategory.id) ? <Text style={{ fontFamily: "Manrope", fontSize: 11, color: "#416153", marginTop: 2 }}>Recommended from your past 6 months</Text> : null}</View>
      </Pressable><Pressable accessibilityRole="button" accessibilityLabel={`Configure Financial Plan rule for ${subcategory.label}`} onPress={() => setEditingId(subcategory.id)} hitSlop={8} style={{ width: 32, height: 32, alignItems: "center", justifyContent: "center" }}><DotsThreeVertical size={20} color="#6B7A6F" weight="bold" /></Pressable></View>{editingId === subcategory.id ? <PlanCategoryRuleEditor category={subcategory} onClose={() => setEditingId(null)} onSave={async (update) => { await onSaveRule(subcategory, update); setEditingId(null); }} /> : null}</View>;
  }

  function renderCategory(category: Category) {
    const children = subcategories.filter((subcategory) => subcategory.category_id === category.id);
    if (children.length === 0) return null;

    const locked = requirement(category) !== null;
    const selected = includedCategoryIds.has(category.id);

    return <View key={category.id} style={{ marginTop: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><Pressable accessibilityRole="checkbox" accessibilityState={{ checked: selected, disabled: locked }} accessibilityLabel={`Include ${category.label} in Financial Plan`} disabled={locked} onPress={() => onToggleCategory(category.id)} style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: selected ? "#0E6D46" : "#D7DDD8", backgroundColor: selected ? "#EEFFF8" : "#F6F2E9", borderRadius: 13, padding: 13, opacity: locked ? 0.8 : 1 }}>
        <View style={{ width: 20, height: 20, borderRadius: 5, borderWidth: 2, borderColor: selected ? "#0E6D46" : "#A8B0AA", backgroundColor: selected ? "#0E6D46" : "#FFFFFF", alignItems: "center", justifyContent: "center" }}><Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "800" }}>{selected ? "x" : ""}</Text></View>
        <View style={{ flex: 1 }}><Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 14, color: "#1B1C1A" }}>{category.label}</Text><Text style={{ fontFamily: "Manrope", fontSize: 11, color: "#416153", marginTop: 2 }}>{locked ? `${requirement(category)} requirement` : recommendedCategoryIds.has(category.id) ? "Recommended from broad-category spending" : "Broad category only"}</Text></View>
      </Pressable><Pressable accessibilityRole="button" accessibilityLabel={`Configure Financial Plan rule for ${category.label}`} onPress={() => setEditingId(category.id)} hitSlop={8} style={{ width: 32, height: 32, alignItems: "center", justifyContent: "center" }}><DotsThreeVertical size={20} color="#6B7A6F" weight="bold" /></Pressable></View>
      {editingId === category.id ? <PlanCategoryRuleEditor category={category} onClose={() => setEditingId(null)} onSave={async (update) => { await onSaveCategoryRule(category, update); setEditingId(null); }} /> : null}
      {children.map(renderSubcategory)}
    </View>;
  }

  return (
    <View style={{ paddingBottom: 28 }}>
      <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 20, color: "#1B1C1A" }}>Financial Plan</Text>
       <Text style={{ fontFamily: "Manrope", fontSize: 12, color: "#6B7A6F", marginTop: 4 }}>Choose broad categories or specific subcategories for your next-month plan. They are planned separately. Fixed and minimum categories are included automatically.</Text>
      <View style={{ marginTop: 16 }}>
        <Text style={{ color: "#1B1C1A", fontFamily: "Manrope", fontSize: 13, fontWeight: "800" }}>How much should we plan?</Text>
        <TextInput accessibilityLabel="How much should we plan in pesos" value={plannedAmount} onChangeText={onPlannedAmountChange} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor="#8A938C" style={{ backgroundColor: "#FFFFFF", borderColor: planningAmountError ? "#D9001F" : "#D7DDD8", borderRadius: 13, borderWidth: 1, color: "#1B1C1A", fontFamily: "Manrope", fontSize: 16, marginTop: 7, padding: 13 }} />
        <Text style={{ color: "#416153", fontFamily: "Manrope", fontSize: 11, marginTop: 5 }}>Available money: PHP {(availableMoneyCentavos / 100).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
        {planningAmountError ? <Text accessibilityRole="alert" style={{ color: "#D9001F", fontFamily: "Manrope", fontSize: 11, marginTop: 5 }}>{planningAmountError}</Text> : null}
      </View>
      {topLevelCategories.map(renderCategory)}
      {uncategorizedSubcategories.length > 0 ? <View style={{ marginTop: 16 }}><Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 14, color: "#1B1C1A" }}>Other expense categories</Text>{uncategorizedSubcategories.map(renderSubcategory)}</View> : null}
        <Pressable accessibilityRole="button" accessibilityLabel="Create Financial Plan recommendation" disabled={includedIds.size + includedCategoryIds.size === 0 || planningAmountError !== null} onPress={onContinue} style={{ backgroundColor: "#013220", borderRadius: 14, padding: 14, marginTop: 18, opacity: includedIds.size + includedCategoryIds.size === 0 || planningAmountError !== null ? 0.5 : 1 }}><Text style={{ fontFamily: "Manrope", fontWeight: "800", color: "#FFFFFF", textAlign: "center" }}>Create recommendation</Text></Pressable>
    </View>
  );
}
