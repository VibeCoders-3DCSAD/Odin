import { useEffect, useMemo, useState } from "react";
import { CaretLeft, CaretRight } from "phosphor-react-native";
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { listCategories, listCategoryGroups, listSubcategories, type Category, type CategoryGroup, type Subcategory } from "../local-db/repositories/taxonomy";

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
  tier: "group" | "category" | "subcategory" | null;
  groupId: string | null;
  categoryId: string | null;
  subcategoryId: string | null;
};

type Props = {
  groups: CategoryGroup[];
  categories: Category[];
  subcategories: Subcategory[];
  selection: CategorySelection;
  onSelect: (selection: CategorySelection) => void;
  emptyMessage?: string;
};

type ModalProps = {
  visible: boolean;
  userId: string;
  kind: "income" | "expense";
  initialSubcategoryId?: string;
  onSelect: (subcategory: Subcategory) => void;
  onClose: () => void;
};

type ViewState =
  | { level: "groups" }
  | { level: "categories"; groupId: string }
  | { level: "subcategories"; groupId: string; categoryId: string };

export function CategorySelectorTree({ groups, categories, subcategories, selection, onSelect, emptyMessage = "No categories found." }: Props) {
  const categoriesByGroup = useMemo(() => {
    const map = new Map<string, Category[]>();
    for (const category of categories) {
      const existing = map.get(category.category_group_id) ?? [];
      existing.push(category);
      map.set(category.category_group_id, existing);
    }
    return map;
  }, [categories]);

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

  const availableGroups = useMemo(
    () => groups.filter((group) => availableCategories.some((category) => category.category_group_id === group.id)),
    [groups, availableCategories],
  );

  const uncategorizedSubcategories = useMemo(
    () => subcategories.filter((s) => !s.category_id),
    [subcategories],
  );

  const [view, setView] = useState<ViewState>({ level: "groups" });

  useEffect(() => {
    if (selection.categoryId && selection.groupId) {
      setView({ level: "subcategories", groupId: selection.groupId, categoryId: selection.categoryId });
      return;
    }
    if (selection.groupId) {
      setView({ level: "categories", groupId: selection.groupId });
      return;
    }
    setView({ level: "groups" });
  }, [selection.groupId, selection.categoryId]);

  function renderSelectableRow({
    label,
    selected,
    accented,
    onPress,
    onCaretPress,
    id,
  }: {
    label: string;
    selected: boolean;
    accented: boolean;
    onPress: () => void;
    onCaretPress?: () => void;
    id: string;
  }) {
    return (
      <View
        key={id}
        style={{
          borderRadius: 14,
          borderWidth: 1,
          borderColor: selected ? palette.successTint : accented ? palette.accent : palette.line,
          backgroundColor: selected ? palette.successCard : palette.card,
          flexDirection: "row",
          alignItems: "stretch",
        }}
      >
        <Pressable onPress={onPress} style={{ flex: 1, paddingHorizontal: 14, paddingVertical: 12 }}>
          <Text style={{ fontFamily: "Manrope", fontWeight: selected ? "700" : "600", fontSize: 14, color: palette.ink }}>
            {label}
          </Text>
        </Pressable>
        {onCaretPress ? (
          <Pressable onPress={onCaretPress} accessibilityRole="button" accessibilityLabel={`Open ${label}`} style={{ width: 44, alignItems: "center", justifyContent: "center" }}>
            <CaretRight color={palette.mut} size={16} weight="bold" />
          </Pressable>
        ) : null}
      </View>
    );
  }

  function renderHeader() {
    if (view.level === "groups") return null;

    const title = view.level === "categories"
      ? (groups.find((group) => group.id === view.groupId)?.label ?? "Categories")
      : (categories.find((category) => category.id === view.categoryId)?.label ?? "Subcategories");

    return (
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <Pressable
          onPress={() => {
            if (view.level === "subcategories") {
              setView({ level: "categories", groupId: view.groupId });
              return;
            }
            setView({ level: "groups" });
          }}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={{ width: 28, height: 28, alignItems: "center", justifyContent: "center" }}
        >
          <CaretLeft color={palette.ink2} size={16} weight="bold" />
        </Pressable>
        <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 14, color: palette.ink2 }}>
          {title}
        </Text>
      </View>
    );
  }

  function renderGroups() {
    const hasGroups = availableGroups.length > 0;
    const hasUncategorized = uncategorizedSubcategories.length > 0;

    if (!hasGroups && !hasUncategorized) {
      return <Text style={{ fontFamily: "Manrope", fontSize: 13, color: palette.mut }}>{emptyMessage}</Text>;
    }

    return (
      <>
        {uncategorizedSubcategories.map((sub) => renderSelectableRow({
          label: sub.label,
          selected: selection.subcategoryId === sub.id,
          accented: sub.is_filipino_context,
          onPress: () => onSelect({ tier: "subcategory", groupId: null, categoryId: null, subcategoryId: sub.id }),
          id: sub.id,
        }))}
        {availableGroups.map((group) => renderSelectableRow({
          label: group.label,
          selected: selection.tier === "group" && selection.groupId === group.id,
          accented: false,
          onPress: () => onSelect({ tier: "group", groupId: group.id, categoryId: null, subcategoryId: null }),
          onCaretPress: () => setView({ level: "categories", groupId: group.id }),
          id: group.id,
        }))}
      </>
    );
  }

  function renderCategories(groupId: string) {
    const groupCategories = (categoriesByGroup.get(groupId) ?? []).filter((category) => (subcategoriesByCategory.get(category.id) ?? []).length > 0);
    if (groupCategories.length === 0) {
      return <Text style={{ fontFamily: "Manrope", fontSize: 13, color: palette.mut }}>{emptyMessage}</Text>;
    }

    return groupCategories.map((category) => renderSelectableRow({
      label: category.label,
      selected: selection.tier === "category" && selection.categoryId === category.id,
      accented: category.is_filipino_context,
      onPress: () => onSelect({ tier: "category", groupId, categoryId: category.id, subcategoryId: null }),
      onCaretPress: () => setView({ level: "subcategories", groupId, categoryId: category.id }),
      id: category.id,
    }));
  }

  function renderSubcategories(categoryId: string, groupId: string) {
    const items = subcategoriesByCategory.get(categoryId) ?? [];
    if (items.length === 0) {
      return <Text style={{ fontFamily: "Manrope", fontSize: 13, color: palette.mut }}>{emptyMessage}</Text>;
    }

    return items.map((subcategory) => renderSelectableRow({
      label: subcategory.label,
      selected: selection.subcategoryId === subcategory.id,
      accented: subcategory.is_filipino_context,
      onPress: () => onSelect({ tier: "subcategory", groupId, categoryId, subcategoryId: subcategory.id }),
      id: subcategory.id,
    }));
  }

  return (
    <View>
      {renderHeader()}
      <View style={{ gap: 12 }}>
        {view.level === "groups" ? renderGroups() : null}
        {view.level === "categories" ? renderCategories(view.groupId) : null}
        {view.level === "subcategories" ? renderSubcategories(view.categoryId, view.groupId) : null}
      </View>
    </View>
  );
}

function CategorySelectorModal({ visible, userId, kind, initialSubcategoryId, onSelect, onClose }: ModalProps) {
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<CategoryGroup[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [selection, setSelection] = useState<CategorySelection>({ tier: null, groupId: null, categoryId: null, subcategoryId: null });

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      const [localGroups, localCategories, localSubcategories] = await Promise.all([
        listCategoryGroups(userId),
        listCategories(userId),
        listSubcategories(userId, undefined, kind),
      ]);
      if (cancelled) return;
      setGroups(localGroups);
      setCategories(localCategories);
      setSubcategories(localSubcategories);
      if (initialSubcategoryId) {
        const initialSubcategory = localSubcategories.find((item) => item.id === initialSubcategoryId) ?? null;
        const initialCategory = initialSubcategory?.category_id
          ? localCategories.find((item) => item.id === initialSubcategory.category_id) ?? null
          : null;
        const initialGroup = initialCategory
          ? localGroups.find((item) => item.id === initialCategory.category_group_id) ?? null
          : null;
        setSelection({
          tier: "subcategory",
          groupId: initialGroup?.id ?? null,
          categoryId: initialCategory?.id ?? null,
          subcategoryId: initialSubcategory?.id ?? null,
        });
      } else {
        setSelection({ tier: null, groupId: null, categoryId: null, subcategoryId: null });
      }
      setLoading(false);
    }

    load().catch(() => {
      if (cancelled) return;
      setGroups([]);
      setCategories([]);
      setSubcategories([]);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [visible, userId, kind, initialSubcategoryId]);

  const selectedSubcategory = selection.subcategoryId
    ? subcategories.find((item) => item.id === selection.subcategoryId) ?? null
    : null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1 }}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }}>
          <Pressable onPress={() => {}}>
            <View style={{ backgroundColor: "#fcf8f0", borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "88%" }}>
              <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: palette.line, alignSelf: "center", marginTop: 10 }} />
              <View style={{ padding: 22, gap: 16 }}>
                <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 18, color: palette.ink }}>
                  Select subcategory
                </Text>
                {loading ? (
                  <View style={{ alignItems: "center", paddingVertical: 30 }}>
                    <ActivityIndicator color={palette.ink2} />
                  </View>
                ) : (
                  <ScrollView contentContainerStyle={{ paddingBottom: 12 }} showsVerticalScrollIndicator={false}>
                    <CategorySelectorTree
                      groups={groups}
                      categories={categories}
                      subcategories={subcategories}
                      selection={selection}
                      onSelect={setSelection}
                      emptyMessage="No categories found."
                    />
                  </ScrollView>
                )}
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <Pressable onPress={onClose} style={{ flex: 1, height: 48, borderRadius: 12, borderWidth: 1, borderColor: palette.line, alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 14, color: palette.ink2 }}>
                      Cancel
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      if (selectedSubcategory) onSelect(selectedSubcategory);
                    }}
                    disabled={!selectedSubcategory}
                    style={{ flex: 1, height: 48, borderRadius: 12, backgroundColor: palette.successTint, alignItems: "center", justifyContent: "center", opacity: selectedSubcategory ? 1 : 0.5 }}
                  >
                    <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 14, color: "#fff" }}>
                      Use selection
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

export default function CategorySelector(props: Props | ModalProps) {
  if ("visible" in props) {
    return <CategorySelectorModal {...props} />;
  }

  return <CategorySelectorTree {...props} />;
}
