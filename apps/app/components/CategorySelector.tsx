import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CaretLeft, CaretRight, Check } from "phosphor-react-native";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { styles as ui, v4, v4Font } from "./BudgieForm";
import { listCategories, listSubcategories, type Category, type Subcategory } from "../local-db/repositories/taxonomy";
import { DEFAULT_TAXONOMY_COLOR, TaxonomyIcon } from "../features/taxonomy/taxonomyVisuals";

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

  function renderSelectableRow({ label, subtitle, iconKey, colorHex, selected, onPress, onCaretPress, id, index }: {
    label: string;
    subtitle?: string;
    iconKey?: string;
    colorHex?: string;
    selected: boolean;
    onPress: () => void;
    onCaretPress?: () => void;
    id: string;
    index: number;
  }) {
    return (
      <View key={id} style={[ui.listRow, index > 0 ? ui.listRowDivider : null, selected ? ui.listRowSelected : null]}>
        <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`Select ${label}`} accessibilityState={{ selected }} style={ui.listRowMain}>
          <View style={[ui.listTile, { backgroundColor: colorHex ?? DEFAULT_TAXONOMY_COLOR }]}><TaxonomyIcon iconKey={iconKey} color="#fff" size={16} weight="fill" /></View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={[ui.listTitle, selected ? { fontWeight: "700" } : null]}>{label}</Text>
            {subtitle ? <Text numberOfLines={1} style={ui.listSubtitle}>{subtitle}</Text> : null}
          </View>
          {selected && !onCaretPress ? <Check color={v4.brandMid} size={16} weight="bold" /> : null}
        </Pressable>
        {onCaretPress ? <Pressable onPress={onCaretPress} accessibilityRole="button" accessibilityLabel={`Open ${label}`} style={ui.listCaret}><CaretRight color={v4.mut} size={16} weight="bold" /></Pressable> : null}
      </View>
    );
  }

  function renderHeader() {
    if (view.level === "categories") return null;
    const title = categories.find((category) => category.id === view.categoryId)?.label ?? "Subcategories";
    return (
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 }}>
        <Pressable onPress={() => setView({ level: "categories" })} accessibilityRole="button" accessibilityLabel="Back to categories" hitSlop={8} style={{ width: 32, height: 32, alignItems: "center", justifyContent: "center" }}><CaretLeft color={v4.ink} size={18} weight="bold" /></Pressable>
        <Text numberOfLines={1} style={{ flex: 1, fontFamily: v4Font, fontWeight: "800", fontSize: 16, color: v4.ink }}>{title}</Text>
      </View>
    );
  }

  function renderEmpty() {
    return <Text style={{ fontFamily: v4Font, fontSize: 13, color: v4.mut, textAlign: "center", paddingVertical: 20 }}>{emptyMessage}</Text>;
  }

  function renderCategories() {
    if (availableCategories.length === 0 && uncategorizedSubcategories.length === 0) return renderEmpty();
    const rows = [
      ...uncategorizedSubcategories.map((subcategory) => ({ kind: "subcategory" as const, subcategory })),
      ...availableCategories.map((category) => ({ kind: "category" as const, category })),
    ];
    return (
      <View style={ui.list}>
        {rows.map((row, index) => {
          if (row.kind === "subcategory") {
            const { subcategory } = row;
            return renderSelectableRow({ label: subcategory.label, subtitle: subcategory.description || undefined, iconKey: subcategory.icon_key, colorHex: subcategory.color_hex, selected: selection.subcategoryId === subcategory.id, onPress: () => onSelect({ tier: "subcategory", categoryId: null, subcategoryId: subcategory.id }), id: subcategory.id, index });
          }
          const { category } = row;
          const count = subcategoriesByCategory.get(category.id)?.length ?? 0;
          return renderSelectableRow({ label: category.label, subtitle: `${count} ${count === 1 ? "subcategory" : "subcategories"}`, iconKey: category.icon_key, colorHex: category.color_hex, selected: selection.tier === "category" && selection.categoryId === category.id, onPress: () => onSelect({ tier: "category", categoryId: category.id, subcategoryId: null }), onCaretPress: () => setView({ level: "subcategories", categoryId: category.id }), id: category.id, index });
        })}
      </View>
    );
  }

  function renderSubcategories(categoryId: string) {
    const items = subcategoriesByCategory.get(categoryId) ?? [];
    if (items.length === 0) return renderEmpty();
    const category = categories.find((item) => item.id === categoryId);
    return (
      <View style={{ gap: 14 }}>
        <View style={ui.list}>
          {items.map((subcategory, index) => renderSelectableRow({ label: subcategory.label, subtitle: subcategory.description || undefined, iconKey: subcategory.icon_key, colorHex: subcategory.color_hex ?? category?.color_hex, selected: selection.subcategoryId === subcategory.id, onPress: () => onSelect({ tier: "subcategory", categoryId, subcategoryId: subcategory.id }), id: subcategory.id, index }))}
        </View>
        {category ? (
          <Pressable onPress={() => onSelect({ tier: "category", categoryId, subcategoryId: null })} accessibilityRole="button" accessibilityLabel={`Use ${category.label}`} accessibilityState={{ selected: selection.tier === "category" && selection.categoryId === categoryId }} style={[ui.button, ui.buttonGhost]}>
            <Text style={[ui.buttonText, ui.buttonGhostText]}>Use {category.label}</Text>
          </Pressable>
        ) : null}
        <Text style={ui.note}>Tap a name to select it. Tap the arrow to open the level below.</Text>
      </View>
    );
  }

  return <View>{renderHeader()}{view.level === "categories" ? renderCategories() : renderSubcategories(view.categoryId)}</View>;
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

  const canUseSelection = Boolean(selectedSubcategory || (allowCategorySelection && selectedCategory));

  return <View style={{ flex: 1, backgroundColor: v4.shell, padding: 20 }}>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 }}>
      <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Back" hitSlop={8} style={{ width: 32, height: 32, alignItems: "center", justifyContent: "center" }}><ArrowLeft color={v4.ink} size={20} weight="bold" /></Pressable>
      <Text numberOfLines={1} style={{ flex: 1, fontFamily: v4Font, fontWeight: "800", fontSize: 16.5, color: v4.ink }}>{allowCategorySelection ? "Select category or subcategory" : "Select subcategory"}</Text>
    </View>
    {loading ? <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color={v4.brand} /></View> : <ScrollView contentContainerStyle={{ paddingBottom: 18 }} showsVerticalScrollIndicator={false}><CategorySelectorTree categories={categories} subcategories={subcategories} selection={selection} onSelect={setSelection} emptyMessage="No categories found." /></ScrollView>}
    <Pressable onPress={() => { if (selectedSubcategory) onSelect(selectedSubcategory); else if (allowCategorySelection && selectedCategory) onSelect(selectedCategory); }} disabled={!canUseSelection} accessibilityRole="button" accessibilityLabel="Use selection" accessibilityState={{ disabled: !canUseSelection }} style={[ui.button, { marginTop: 12, opacity: canUseSelection ? 1 : 0.5 }]}><Text style={ui.buttonText}>Use selection</Text></Pressable>
  </View>;
}

export default CategorySelectorPage;
