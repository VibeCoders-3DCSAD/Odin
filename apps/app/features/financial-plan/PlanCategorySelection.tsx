import { Pressable, Text, View } from "react-native";
import type { Category, Subcategory } from "../../local-db/repositories/taxonomy";

type Props = {
  topLevelCategories: Category[];
  subcategories: Subcategory[];
  includedIds: Set<string>;
  recommendedIds: Set<string>;
  onToggle: (id: string) => void;
  onToggleCategory: (subcategoryIds: string[]) => void;
  onContinue: () => void;
};

function requirement(category: Subcategory): "Fixed" | "Minimum" | null {
  if ((category.fixed_amount_centavos ?? 0) > 0) return "Fixed";
  if ((category.minimum_amount_centavos ?? 0) > 0) return "Minimum";
  return null;
}

export function PlanCategorySelection({ topLevelCategories, subcategories, includedIds, recommendedIds, onToggle, onToggleCategory, onContinue }: Props) {
  const uncategorizedSubcategories = subcategories.filter((subcategory) => !subcategory.category_id);

  function renderSubcategory(subcategory: Subcategory) {
    const locked = requirement(subcategory) !== null;
    const selected = includedIds.has(subcategory.id);
    return <Pressable key={subcategory.id} accessibilityRole="checkbox" accessibilityState={{ checked: selected, disabled: locked }} accessibilityLabel={`Include ${subcategory.label} in Financial Plan`} disabled={locked} onPress={() => onToggle(subcategory.id)} style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8, borderWidth: 1, borderColor: selected ? "#0E6D46" : "#EAEAE6", backgroundColor: selected ? "#EEFFF8" : "#FCF8F0", borderRadius: 13, padding: 13, marginLeft: 12, opacity: locked ? 0.8 : 1 }}>
      <View style={{ width: 20, height: 20, borderRadius: 5, borderWidth: 2, borderColor: selected ? "#0E6D46" : "#A8B0AA", backgroundColor: selected ? "#0E6D46" : "#FFFFFF", alignItems: "center", justifyContent: "center" }}><Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "800" }}>{selected ? "x" : ""}</Text></View>
      <View style={{ flex: 1 }}><Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 13, color: "#1B1C1A" }}>{subcategory.label}</Text>{locked ? <Text style={{ fontFamily: "Manrope", fontSize: 11, color: "#416153", marginTop: 2 }}>{requirement(subcategory)} requirement</Text> : recommendedIds.has(subcategory.id) ? <Text style={{ fontFamily: "Manrope", fontSize: 11, color: "#416153", marginTop: 2 }}>Recommended from your past 6 months</Text> : null}</View>
    </Pressable>;
  }

  function renderCategory(category: Category) {
    const children = subcategories.filter((subcategory) => subcategory.category_id === category.id);
    if (children.length === 0) return null;

    const selectableChildren = children.filter((subcategory) => requirement(subcategory) === null);
    const allSelected = children.every((subcategory) => includedIds.has(subcategory.id));
    const partiallySelected = !allSelected && children.some((subcategory) => includedIds.has(subcategory.id));

    return <View key={category.id} style={{ marginTop: 16 }}>
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: allSelected, disabled: selectableChildren.length === 0 }} accessibilityLabel={`Include all ${category.label} in Financial Plan`} disabled={selectableChildren.length === 0} onPress={() => onToggleCategory(children.map((subcategory) => subcategory.id))} style={{ flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: allSelected || partiallySelected ? "#0E6D46" : "#D7DDD8", backgroundColor: allSelected ? "#EEFFF8" : "#F6F2E9", borderRadius: 13, padding: 13, opacity: selectableChildren.length === 0 ? 0.8 : 1 }}>
        <View style={{ width: 20, height: 20, borderRadius: 5, borderWidth: 2, borderColor: allSelected || partiallySelected ? "#0E6D46" : "#A8B0AA", backgroundColor: allSelected || partiallySelected ? "#0E6D46" : "#FFFFFF", alignItems: "center", justifyContent: "center" }}><Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "800" }}>{allSelected ? "x" : partiallySelected ? "-" : ""}</Text></View>
        <View style={{ flex: 1 }}><Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 14, color: "#1B1C1A" }}>{category.label}</Text><Text style={{ fontFamily: "Manrope", fontSize: 11, color: "#416153", marginTop: 2 }}>Include all {children.length} subcategories</Text></View>
      </Pressable>
      {children.map(renderSubcategory)}
    </View>;
  }

  return (
    <View style={{ paddingBottom: 28 }}>
      <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 20, color: "#1B1C1A" }}>Financial Plan</Text>
      <Text style={{ fontFamily: "Manrope", fontSize: 12, color: "#6B7A6F", marginTop: 4 }}>Choose the expense categories for your next-month plan. Select a top-level category to include all of its subcategories. Fixed and minimum categories are included automatically.</Text>
      {topLevelCategories.map(renderCategory)}
      {uncategorizedSubcategories.length > 0 ? <View style={{ marginTop: 16 }}><Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 14, color: "#1B1C1A" }}>Other expense categories</Text>{uncategorizedSubcategories.map(renderSubcategory)}</View> : null}
      <Pressable accessibilityRole="button" accessibilityLabel="Create Financial Plan recommendation" disabled={includedIds.size === 0} onPress={onContinue} style={{ backgroundColor: "#013220", borderRadius: 14, padding: 14, marginTop: 18, opacity: includedIds.size === 0 ? 0.5 : 1 }}><Text style={{ fontFamily: "Manrope", fontWeight: "800", color: "#FFFFFF", textAlign: "center" }}>Create recommendation</Text></Pressable>
    </View>
  );
}
