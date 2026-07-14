import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  ShoppingCart,
  Bank,
  Confetti,
  PiggyBank,
  CaretUp,
  CaretDown,
  MagnifyingGlass,
  PencilSimple,
  Plus,
  TrashSimple,
} from "phosphor-react-native";
import {
  listCategoryGroups,
  listCategories,
  listSubcategories,
<<<<<<< HEAD
} from "../../local-db/repositories/taxonomy";

type Subcategory = {
  id: string;
  category_id: string | null;
  slug: string;
  kind: "income" | "expense" | "transfer_adjustment";
  label: string;
  short_label: string | null;
  description: string;
  is_system: boolean;
  is_filipino_context: boolean;
  is_protected_default: boolean;
  sort_order: number;
  is_active: boolean;
};

type Category = {
  id: string;
  category_group_id: string;
  slug: string;
  label: string;
  short_label: string | null;
  description: string;
  is_system: boolean;
  is_filipino_context: boolean;
  sort_order: number;
  is_active: boolean;
  subcategories?: Subcategory[];
};

type CategoryGroup = {
  id: string;
  slug: string;
  label: string;
  short_label: string | null;
  description: string;
  sort_order: number;
  is_active: boolean;
  categories?: Category[];
};

type TaxonomyScreenProps = {
  userId: string;
=======
  deleteCategory,
  type Category as RepoCategory,
  type Subcategory as RepoSubcategory,
} from "../../local-db/repositories/taxonomy";
import type { CategoryGroup } from "./types";
import CategoryFormScreen from "./CategoryFormScreen";

interface CategoryWithSubs extends RepoCategory {
  subcategories?: RepoSubcategory[];
}

type TaxonomyScreenProps = {
  userId: string;
  deviceId: string;
>>>>>>> feat/vib-96-taxonomy-crud
  onBack: () => void;
};

const palette = {
  ink: "#1B1C1A",
  mut: "#6B7A6F",
  card: "#FCF8F0",
  line: "#EAEAE6",
  line2: "#EAEAE6",
  aqua50: "#EFFEF7",
  aqua600: "#08B16A",
  aqua700: "#0B8A55",
  aqua800: "#0B8A55",
  sun50: "#FFF8F0",
  sun700: "#C25E00",
  brand: "#013220",
  error: "#D9001F",
} as const;

const GROUP_ICONS: Record<string, React.ReactNode> = {
  essentials: <ShoppingCart size={17} weight="fill" color="#fff" />,
  obligatory: <Bank size={17} weight="fill" color="#4F57C4" />,
  discretionary: <Confetti size={17} weight="fill" color="#BE185D" />,
  financial_allocation: <PiggyBank size={17} weight="fill" color={palette.aqua700} />,
};

const GROUP_ICON_BG: Record<string, string> = {
  essentials: palette.aqua600,
  obligatory: "#E0E7FF",
  discretionary: "#FCE7F3",
  financial_allocation: palette.aqua50,
};

type CategoryRowProps = {
  category: CategoryWithSubs;
  mutatingId: string | null;
  onEdit: (cat: CategoryWithSubs) => void;
  onDelete: (cat: CategoryWithSubs) => void;
};

function CategoryRow({ category, mutatingId, onEdit, onDelete }: CategoryRowProps) {
  const isUserOwned = !category.is_system;
  const hasProtectedDefault = category.subcategories?.some((s) => s.is_protected) ?? false;
  const hasFilipinoContext = category.is_filipino_context;
  const hasCustomLabel = !!category.short_label;
  const isMutating = mutatingId === category.id;

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 11,
        paddingVertical: 11,
        borderBottomWidth: 1,
        borderBottomColor: palette.line2,
      }}
    >
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
          <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 13.5, color: palette.ink, flexShrink: 1 }}>
            {category.label}
          </Text>
          {hasProtectedDefault && (
            <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, backgroundColor: palette.aqua50 }}>
              <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 9, color: palette.aqua800 }}>
                DEFAULT PROTECTED
              </Text>
            </View>
          )}
          {hasFilipinoContext && (
            <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, backgroundColor: palette.sun50 }}>
              <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 9, color: palette.sun700 }}>
                {category.slug.toUpperCase()}
              </Text>
            </View>
          )}
        </View>
        <Text style={{ fontFamily: "Manrope", fontSize: 11, color: palette.mut, marginTop: 2 }}>
          {category.description}
        </Text>
        {hasCustomLabel && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 3 }}>
            <PencilSimple size={11} color={palette.aqua700} />
            <Text style={{ fontFamily: "Manrope", fontWeight: "500", fontSize: 11, color: palette.aqua700 }}>
              Custom label: "{category.short_label}"
            </Text>
          </View>
        )}
      </View>
      {isUserOwned && (
        <View style={{ flexDirection: "row", gap: 6 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Edit ${category.label}`}
            onPress={() => onEdit(category)}
            disabled={isMutating}
            style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: palette.aqua50, alignItems: "center", justifyContent: "center" }}
          >
            <PencilSimple size={14} color={palette.aqua700} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Delete ${category.label}`}
            onPress={() => onDelete(category)}
            disabled={isMutating}
            style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: "#FFF0F2", alignItems: "center", justifyContent: "center" }}
          >
            {isMutating ? (
              <ActivityIndicator size="small" color={palette.error} />
            ) : (
              <TrashSimple size={14} color={palette.error} />
            )}
          </Pressable>
        </View>
      )}
    </View>
  );
}

type GroupCardProps = {
  group: CategoryGroup;
  mutatingId: string | null;
  onEdit: (cat: CategoryWithSubs) => void;
  onDelete: (cat: CategoryWithSubs) => void;
};

function GroupCard({ group, mutatingId, onEdit, onDelete }: GroupCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={{ borderRadius: 16, borderWidth: 1, borderColor: palette.line, overflow: "hidden" }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${group.label}, ${group.categories?.length ?? 0} categories, ${expanded ? "expanded" : "collapsed"}`}
        accessibilityState={{ expanded }}
        onPress={() => setExpanded(!expanded)}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 11,
          padding: 14,
          backgroundColor: palette.aqua50,
        }}
      >
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            backgroundColor: GROUP_ICON_BG[group.slug] || palette.aqua600,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {GROUP_ICONS[group.slug] || <ShoppingCart size={17} weight="fill" color="#fff" />}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 14, color: palette.ink }}>
            {group.label}
          </Text>
          <Text style={{ fontFamily: "Manrope", fontSize: 11, color: palette.aqua800 }}>
            {group.categories?.length ?? 0} categories
          </Text>
        </View>
        {expanded ? (
          <CaretUp size={15} weight="bold" color={palette.aqua700} />
        ) : (
          <CaretDown size={15} weight="bold" color={palette.mut} />
        )}
      </Pressable>
      {expanded && (
        <View style={{ paddingHorizontal: 14, paddingTop: 6, paddingBottom: 12 }}>
          {group.categories?.map((cat) => (
            <CategoryRow key={cat.id} category={cat} mutatingId={mutatingId} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </View>
      )}
    </View>
  );
}

<<<<<<< HEAD
function assembleNested(
  localGroups: { id: string; slug: string; label: string; short_label: string | null; description: string; sort_order: number; is_active: boolean }[],
  localCategories: { id: string; category_group_id: string; slug: string; label: string; short_label: string | null; description: string; is_system: boolean; is_filipino_context: boolean; sort_order: number; is_active: boolean }[],
  localSubcategories: { id: string; category_id: string | null; slug: string; kind: "income" | "expense" | "transfer_adjustment"; label: string; short_label: string | null; description: string; is_system: boolean; is_filipino_context: boolean; is_protected: boolean; sort_order: number; is_active: boolean }[],
): CategoryGroup[] {
  const subsByCat = new Map<string, Subcategory[]>();
  for (const s of localSubcategories) {
    if (!s.category_id) continue;
    const arr = subsByCat.get(s.category_id) ?? [];
    arr.push({ ...s, is_protected_default: s.is_protected });
    subsByCat.set(s.category_id, arr);
  }

  const catsByGroup = new Map<string, Category[]>();
  for (const c of localCategories) {
    const arr = catsByGroup.get(c.category_group_id) ?? [];
    arr.push({ ...c, subcategories: subsByCat.get(c.id) });
    catsByGroup.set(c.category_group_id, arr);
  }

  return localGroups.map((g) => ({ ...g, categories: catsByGroup.get(g.id) }));
}

export default function TaxonomyScreen({ userId, onBack }: TaxonomyScreenProps) {
  const [groups, setGroups] = useState<CategoryGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetched = useRef(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [localGroups, localCats, localSubs] = await Promise.all([
=======
export default function TaxonomyScreen({ userId, deviceId, onBack }: TaxonomyScreenProps) {
  const [groups, setGroups] = useState<CategoryGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formVisible, setFormVisible] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editingCategory, setEditingCategory] = useState<CategoryWithSubs | undefined>(undefined);
  const [mutatingId, setMutatingId] = useState<string | null>(null);

  const loadTaxonomy = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const [categoryGroups, categories, subcategories] = await Promise.all([
>>>>>>> feat/vib-96-taxonomy-crud
        listCategoryGroups(userId),
        listCategories(userId),
        listSubcategories(userId),
      ]);
<<<<<<< HEAD
      setGroups(assembleNested(localGroups, localCats, localSubs));
    } catch {
      setError("Failed to load categories.");
=======

      const catMap = new Map<string, CategoryWithSubs>(
        categories.map((c) => [c.id, { ...c, subcategories: undefined }]),
      );
      for (const sub of subcategories) {
        if (sub.category_id) {
          const cat = catMap.get(sub.category_id);
          if (cat) {
            if (!cat.subcategories) cat.subcategories = [];
            cat.subcategories.push(sub);
          }
        }
      }

      const nested: CategoryGroup[] = categoryGroups.map((g) => ({
        ...g,
        categories: [...catMap.values()].filter((c) => c.category_group_id === g.id),
      }));

      setGroups(nested);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load categories");
>>>>>>> feat/vib-96-taxonomy-crud
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
<<<<<<< HEAD
    if (fetched.current) return;
    fetched.current = true;
    load();
  }, [load]);
=======
    loadTaxonomy();
  }, [loadTaxonomy]);

  function openCreate() {
    setFormMode("create");
    setEditingCategory(undefined);
    setFormVisible(true);
  }

  function openEdit(cat: CategoryWithSubs) {
    setFormMode("edit");
    setEditingCategory(cat);
    setFormVisible(true);
  }

  function handleDelete(cat: CategoryWithSubs) {
    Alert.alert(
      `Delete "${cat.label}"?`,
      "This category will be hidden. Existing transactions using it are not affected.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setMutatingId(cat.id);
            try {
              await deleteCategory(userId, deviceId, cat.id);
              loadTaxonomy();
            } catch (e) {
              Alert.alert("Error", e instanceof Error ? e.message : "Failed to delete category");
            } finally {
              setMutatingId(null);
            }
          },
        },
      ],
    );
  }

  function handleFormSaved() {
    setFormVisible(false);
    setEditingCategory(undefined);
    loadTaxonomy();
  }

  function handleFormCancel() {
    setFormVisible(false);
    setEditingCategory(undefined);
  }
>>>>>>> feat/vib-96-taxonomy-crud

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={{ paddingHorizontal: 22, paddingTop: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 20, color: palette.ink }}>
          Categories
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Create category"
          onPress={openCreate}
          style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: palette.brand, alignItems: "center", justifyContent: "center" }}
        >
          <Plus size={18} color="#fff" weight="bold" />
        </Pressable>
      </View>

      <View style={{ paddingHorizontal: 22, paddingTop: 16 }}>
        <View
          style={{
            height: 46,
            borderRadius: 13,
            backgroundColor: "#E7E5DF",
            borderWidth: 1,
            borderColor: palette.line,
            flexDirection: "row",
            alignItems: "center",
            gap: 9,
            paddingHorizontal: 14,
          }}
        >
          <MagnifyingGlass size={17} color={palette.mut} />
          <TextInput
            placeholder="Search categories"
            placeholderTextColor={palette.mut}
            style={{ fontFamily: "Manrope", fontWeight: "500", fontSize: 14, color: palette.ink, flex: 1, height: 46 }}
            editable={false}
          />
        </View>
      </View>

      <View style={{ paddingHorizontal: 22, paddingTop: 16, gap: 12 }}>
        {loading ? (
          <ActivityIndicator color={palette.aqua600} style={{ marginTop: 40 }} />
        ) : error ? (
          <View style={{ alignItems: "center", marginTop: 40, gap: 8 }}>
            <Text style={{ fontFamily: "Manrope", color: palette.mut, textAlign: "center" }}>{error}</Text>
            <Pressable
<<<<<<< HEAD
              onPress={() => { fetched.current = false; load(); }}
=======
              onPress={loadTaxonomy}
>>>>>>> feat/vib-96-taxonomy-crud
              style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, backgroundColor: palette.aqua600 }}
            >
              <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 13, color: "#fff" }}>Retry</Text>
            </Pressable>
          </View>
        ) : groups.length === 0 ? (
          <View style={{ alignItems: "center", marginTop: 40 }}>
            <Text style={{ fontFamily: "Manrope", color: palette.mut }}>No categories yet</Text>
          </View>
        ) : (
          groups.map((group) => (
            <GroupCard
              key={group.id}
              group={group}
              mutatingId={mutatingId}
              onEdit={openEdit}
              onDelete={handleDelete}
            />
          ))
        )}
      </View>

      <CategoryFormScreen
        visible={formVisible}
        mode={formMode}
        category={editingCategory}
        groups={groups}
        userId={userId}
        deviceId={deviceId}
        onSaved={handleFormSaved}
        onCancel={handleFormCancel}
      />
    </ScrollView>
  );
}
