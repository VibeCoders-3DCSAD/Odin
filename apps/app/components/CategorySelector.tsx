import { useEffect, useMemo, useState } from "react";
import { CaretLeft, CaretRight } from "phosphor-react-native";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { listCategories, listSubcategories, type Category, type Subcategory } from "../local-db/repositories/taxonomy";

const palette = {
  ink: "#1B1C1A",
  ink2: "#414942",
  mut: "#6B7A6F",
  line: "#EAEAE6",
  card: "#fff9ee",
  successTint: "#20c277",
  successCard: "#effff6",
  accent: "#f5b57d",
} as const;

export type CategorySelection = {
  tier: "category" | "subcategory" | null;
  categoryId: string | null;
  subcategoryId: string | null;
};

type Props = {
  categories: Category[];
  subcategories: Subcategory[];
  selection: CategorySelection;
  onSelect: (selection: CategorySelection) => void;
  emptyMessage?: string;
};

type PageProps = {
  userId: string;
  kind: "income" | "expense";
  initialSubcategoryId?: string;
  initialCategoryId?: string;
  allowCategorySelection?: boolean;
  onSelect: (selection: Subcategory | Category) => void;
  onClose: () => void;
};

type ViewState = { level: "categories" } | { level: "subcategories"; categoryId: string };

export function CategorySelectorTree({ categories, subcategories, selection, onSelect, emptyMessage = "No categories found." }: Props) {
  const subcategoriesByCategory = useMemo(() => {
    const map = new Map<string, Subcategory[]>();
    for (const subcategory of subcategories) {
      if (!subcategory.category_id) continue;
      const existing = map.get(subcategory.category_id) ?? [];
      existing.push(subcategory);
      map.set(subcategory.category_id, existing);
    }
    return map;
  }, [subcategories]);

  const availableCategories = useMemo(
    () => categories.filter((category) => (subcategoriesByCategory.get(category.id) ?? []).length > 0),
    [categories, subcategoriesByCategory],
  );
  const uncategorizedSubcategories = useMemo(
    () => subcategories.filter((subcategory) => !subcategory.category_id),
    [subcategories],
  );
  const [view, setView] = useState<ViewState>({ level: "categories" });

  useEffect(() => {
    if (selection.categoryId) {
      setView({ level: "subcategories", categoryId: selection.categoryId });
    }
  }, [selection.categoryId]);

  function renderSelectableRow({ label, selected, onPress, onCaretPress, id }: {
    label: string;
    selected: boolean;
    onPress: () => void;
    onCaretPress?: () => void;
    id: string;
  }) {
    return (
      <View key={id} style={{ borderRadius: 14, borderWidth: 1, borderColor: selected ? palette.successTint : palette.line, backgroundColor: selected ? palette.successCard : palette.card, flexDirection: "row", alignItems: "stretch" }}>
        <Pressable onPress={onPress} style={{ flex: 1, paddingHorizontal: 14, paddingVertical: 12 }}>
          <Text style={{ fontFamily: "Manrope", fontWeight: selected ? "700" : "600", fontSize: 14, color: palette.ink }}>{label}</Text>
        </Pressable>
        {onCaretPress ? <Pressable onPress={onCaretPress} accessibilityRole="button" accessibilityLabel={`Open ${label}`} style={{ width: 44, alignItems: "center", justifyContent: "center" }}><CaretRight color={palette.mut} size={16} weight="bold" /></Pressable> : null}
      </View>
    );
  }

  function renderHeader() {
    if (view.level === "categories") return null;
    const title = categories.find((category) => category.id === view.categoryId)?.label ?? "Subcategories";
    return (
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <Pressable onPress={() => setView({ level: "categories" })} accessibilityRole="button" accessibilityLabel="Back" style={{ width: 28, height: 28, alignItems: "center", justifyContent: "center" }}><CaretLeft color={palette.ink2} size={16} weight="bold" /></Pressable>
        <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 14, color: palette.ink2 }}>{title}</Text>
      </View>
    );
  }

  function renderCategories() {
    if (availableCategories.length === 0 && uncategorizedSubcategories.length === 0) {
      return <Text style={{ fontFamily: "Manrope", fontSize: 13, color: palette.mut }}>{emptyMessage}</Text>;
    }
    return <>
      {uncategorizedSubcategories.map((subcategory) => renderSelectableRow({ label: subcategory.label, selected: selection.subcategoryId === subcategory.id, onPress: () => onSelect({ tier: "subcategory", categoryId: null, subcategoryId: subcategory.id }), id: subcategory.id }))}
      {availableCategories.map((category) => renderSelectableRow({ label: category.label, selected: selection.tier === "category" && selection.categoryId === category.id, onPress: () => onSelect({ tier: "category", categoryId: category.id, subcategoryId: null }), onCaretPress: () => setView({ level: "subcategories", categoryId: category.id }), id: category.id }))}
    </>;
  }

  function renderSubcategories(categoryId: string) {
    const items = subcategoriesByCategory.get(categoryId) ?? [];
    if (items.length === 0) return <Text style={{ fontFamily: "Manrope", fontSize: 13, color: palette.mut }}>{emptyMessage}</Text>;
    return items.map((subcategory) => renderSelectableRow({ label: subcategory.label, selected: selection.subcategoryId === subcategory.id, onPress: () => onSelect({ tier: "subcategory", categoryId, subcategoryId: subcategory.id }), id: subcategory.id }));
  }

  return <View>{renderHeader()}<View style={{ gap: 12 }}>{view.level === "categories" ? renderCategories() : renderSubcategories(view.categoryId)}</View></View>;
}

function CategorySelectorPage({ userId, kind, initialSubcategoryId, initialCategoryId, allowCategorySelection = false, onSelect, onClose }: PageProps) {
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [selection, setSelection] = useState<CategorySelection>({ tier: null, categoryId: null, subcategoryId: null });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const [localCategories, localSubcategories] = await Promise.all([listCategories(userId), listSubcategories(userId, undefined, kind)]);
      if (cancelled) return;
      setCategories(localCategories);
      setSubcategories(localSubcategories);
      const initialSubcategory = initialSubcategoryId ? localSubcategories.find((item) => item.id === initialSubcategoryId) ?? null : null;
      const initialCategory = initialSubcategory?.category_id ? localCategories.find((item) => item.id === initialSubcategory.category_id) ?? null : initialCategoryId ? localCategories.find((item) => item.id === initialCategoryId) ?? null : null;
      setSelection(initialSubcategory ? { tier: "subcategory", categoryId: initialCategory?.id ?? null, subcategoryId: initialSubcategory.id } : initialCategory ? { tier: "category", categoryId: initialCategory.id, subcategoryId: null } : { tier: null, categoryId: null, subcategoryId: null });
      setLoading(false);
    }
    load().catch(() => { if (!cancelled) { setCategories([]); setSubcategories([]); setLoading(false); } });
    return () => { cancelled = true; };
  }, [userId, kind, initialSubcategoryId, initialCategoryId]);

  const selectedSubcategory = selection.subcategoryId ? subcategories.find((item) => item.id === selection.subcategoryId) ?? null : null;
  const selectedCategory = selection.categoryId ? categories.find((item) => item.id === selection.categoryId) ?? null : null;

  return <View style={{ flex: 1, backgroundColor: "#fcf8f0", padding: 22 }}>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 18 }}><Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Back" style={{ width: 32, height: 32, alignItems: "center", justifyContent: "center" }}><CaretLeft color={palette.ink2} size={18} weight="bold" /></Pressable><Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 20, color: palette.ink }}>{allowCategorySelection ? "Select category or subcategory" : "Select subcategory"}</Text></View>
    {loading ? <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color={palette.ink2} /></View> : <ScrollView contentContainerStyle={{ paddingBottom: 18 }} showsVerticalScrollIndicator={false}><CategorySelectorTree categories={categories} subcategories={subcategories} selection={selection} onSelect={setSelection} emptyMessage="No categories found." /></ScrollView>}
    <Pressable onPress={() => { if (selectedSubcategory) onSelect(selectedSubcategory); else if (allowCategorySelection && selectedCategory) onSelect(selectedCategory); }} disabled={!selectedSubcategory && !(allowCategorySelection && selectedCategory)} style={{ height: 50, borderRadius: 14, backgroundColor: palette.successTint, alignItems: "center", justifyContent: "center", opacity: selectedSubcategory || (allowCategorySelection && selectedCategory) ? 1 : 0.5, marginTop: 12 }}><Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 14, color: "#fff" }}>Use selection</Text></Pressable>
  </View>;
}

export default CategorySelectorPage;
