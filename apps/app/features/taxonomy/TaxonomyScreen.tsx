import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
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
  CaretRight,
  MagnifyingGlass,
  PencilSimple,
  Plus,
  TrashSimple,
  ArrowLeft,
  Globe,
} from "phosphor-react-native";
import {
  listCategoryGroups,
  listCategories,
  listSubcategories,
  deleteCategory,
  deleteSubcategory,
  type Category as RepoCategory,
  type Subcategory as RepoSubcategory,
} from "../../local-db/repositories/taxonomy";
import CategoryFormScreen from "./CategoryFormScreen";
import SubcategoryFormScreen from "./SubcategoryFormScreen";

type Subcategory = RepoSubcategory;
type Category = RepoCategory & { subcategories?: Subcategory[] };
type Group = {
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
  deviceId: string;
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

function CategoryRow({
  category,
  mutatingId,
  onEdit,
  onDelete,
  onNavigate,
}: {
  category: Category;
  mutatingId: string | null;
  onEdit: (cat: Category) => void;
  onDelete: (cat: Category) => void;
  onNavigate: (cat: Category) => void;
}) {
  const isSystem = category.is_system;
  const hasProtectedDefault = category.subcategories?.some((s) => s.is_protected) ?? false;
  const hasFilipinoContext = category.is_filipino_context;
  const subCount = category.subcategories?.length ?? 0;
  const isMutating = mutatingId === category.id;

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingVertical: 11,
        borderBottomWidth: 1,
        borderBottomColor: palette.line2,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${category.label}, ${subCount} subcategories`}
        onPress={() => onNavigate(category)}
        style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8 }}
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
              <Globe size={10} weight="fill" color={palette.sun700} />
            )}
          </View>
          <Text style={{ fontFamily: "Manrope", fontSize: 11, color: palette.mut, marginTop: 2 }}>
            {category.description}
          </Text>
          {subCount > 0 && (
            <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 11, color: palette.aqua700, marginTop: 2 }}>
              {subCount} subcategor{subCount === 1 ? "y" : "ies"}
            </Text>
          )}
        </View>
        <CaretRight size={14} weight="bold" color={palette.mut} />
      </Pressable>

      {!isSystem && (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Edit ${category.label}`}
            onPress={() => { onEdit(category); }}
            hitSlop={8}
            disabled={isMutating}
            style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: palette.aqua50, alignItems: "center", justifyContent: "center" }}
          >
            <PencilSimple size={14} color={palette.aqua700} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Delete ${category.label}`}
            onPress={() => { onDelete(category); }}
            hitSlop={8}
            disabled={isMutating}
            style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: "#FFF0F2", alignItems: "center", justifyContent: "center" }}
          >
            {isMutating ? (
              <ActivityIndicator size="small" color={palette.error} />
            ) : (
              <TrashSimple size={14} color={palette.error} />
            )}
          </Pressable>
        </>
      )}
    </View>
  );
}

function GroupCard({
  group,
  mutatingId,
  onEdit,
  onDelete,
  onNavigate,
}: {
  group: Group;
  mutatingId: string | null;
  onEdit: (cat: Category) => void;
  onDelete: (cat: Category) => void;
  onNavigate: (cat: Category) => void;
}) {
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
            <CategoryRow
              key={cat.id}
              category={cat}
              mutatingId={mutatingId}
              onEdit={onEdit}
              onDelete={onDelete}
              onNavigate={onNavigate}
            />
          ))}
        </View>
      )}
    </View>
  );
}

function SubcategoryRow({
  sub,
  mutatingId,
  onEdit,
  onDelete,
}: {
  sub: Subcategory;
  mutatingId: string | null;
  onEdit: (s: Subcategory) => void;
  onDelete: (s: Subcategory) => void;
}) {
  const isSystem = sub.is_system;
  const hasFilipinoContext = sub.is_filipino_context;
  const isProtected = sub.is_protected;
  const isMutating = mutatingId === sub.id;

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
            {sub.label}
          </Text>
          {isProtected && (
            <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, backgroundColor: palette.aqua50 }}>
              <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 9, color: palette.aqua800 }}>
                PROTECTED
              </Text>
            </View>
          )}
          {hasFilipinoContext && (
            <Globe size={10} weight="fill" color={palette.sun700} />
          )}
        </View>
        <Text style={{ fontFamily: "Manrope", fontSize: 11, color: palette.mut, marginTop: 2 }}>
          {sub.description}
        </Text>
      </View>
      {!isSystem && (
        <View style={{ flexDirection: "row", gap: 6 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Edit ${sub.label}`}
            onPress={() => onEdit(sub)}
            disabled={isMutating}
            style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: palette.aqua50, alignItems: "center", justifyContent: "center" }}
          >
            <PencilSimple size={14} color={palette.aqua700} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Delete ${sub.label}`}
            onPress={() => onDelete(sub)}
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

function assembleNested(
  localGroups: { id: string; slug: string; label: string; short_label: string | null; description: string; sort_order: number; is_active: boolean }[],
  localCategories: RepoCategory[],
  localSubcategories: RepoSubcategory[],
): Group[] {
  const subsByCat = new Map<string, Subcategory[]>();
  for (const s of localSubcategories) {
    if (!s.category_id) continue;
    const arr = subsByCat.get(s.category_id) ?? [];
    arr.push(s);
    subsByCat.set(s.category_id, arr);
  }

  const catsByGroup = new Map<string, Category[]>();
  for (const c of localCategories) {
    const arr = catsByGroup.get(c.category_group_id) ?? [];
    arr.push({ ...c, subcategories: subsByCat.get(c.id) ?? [] });
    catsByGroup.set(c.category_group_id, arr);
  }

  return localGroups.map((g) => ({ ...g, categories: catsByGroup.get(g.id) ?? [] }));
}

export default function TaxonomyScreen({ userId, deviceId, onBack }: TaxonomyScreenProps) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetched = useRef(false);

  const [viewingCategoryId, setViewingCategoryId] = useState<string | null>(null);
  const [viewingCategoryLabel, setViewingCategoryLabel] = useState("");

  const [categoryFormVisible, setCategoryFormVisible] = useState(false);
  const [categoryFormMode, setCategoryFormMode] = useState<"create" | "edit">("create");
  const [editingCategory, setEditingCategory] = useState<Category | undefined>(undefined);

  const [subcategoryFormVisible, setSubcategoryFormVisible] = useState(false);
  const [subcategoryFormMode, setSubcategoryFormMode] = useState<"create" | "edit">("create");
  const [editingSubcategory, setEditingSubcategory] = useState<Subcategory | undefined>(undefined);

  const [mutatingId, setMutatingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setError(null);
    try {
      const [localGroups, localCats, localSubs] = await Promise.all([
        listCategoryGroups(userId),
        listCategories(userId),
        listSubcategories(userId),
      ]);
      setGroups(assembleNested(localGroups, localCats, localSubs));
    } catch {
      setError("Failed to load categories.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (fetched.current) return;
    fetched.current = true;
    load();
  }, [load]);

  useEffect(() => {
    if (!viewingCategoryId) return;
    const back = BackHandler.addEventListener("hardwareBackPress", () => {
      setViewingCategoryId(null);
      setViewingCategoryLabel("");
      return true;
    });
    return () => back.remove();
  }, [viewingCategoryId]);

  function navigateToSubcategories(cat: Category) {
    setViewingCategoryId(cat.id);
    setViewingCategoryLabel(cat.label);
  }

  function goBack() {
    setViewingCategoryId(null);
    setViewingCategoryLabel("");
  }

  function openCategoryCreate() {
    setCategoryFormMode("create");
    setEditingCategory(undefined);
    setCategoryFormVisible(true);
  }

  function openCategoryEdit(cat: Category) {
    setCategoryFormMode("edit");
    setEditingCategory(cat);
    setCategoryFormVisible(true);
  }

  function handleCategoryDelete(cat: Category) {
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
              load();
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

  function openSubcategoryEdit(sub: Subcategory) {
    setSubcategoryFormMode("edit");
    setEditingSubcategory(sub);
    setSubcategoryFormVisible(true);
  }

  function handleSubcategoryDelete(sub: Subcategory) {
    Alert.alert(
      `Delete "${sub.label}"?`,
      "This subcategory will be hidden. Existing transactions using it are not affected.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setMutatingId(sub.id);
            try {
              await deleteSubcategory(userId, deviceId, sub.id);
              load();
            } catch (e) {
              Alert.alert("Error", e instanceof Error ? e.message : "Failed to delete subcategory");
            } finally {
              setMutatingId(null);
            }
          },
        },
      ],
    );
  }

  function handleCategoryFormSaved() {
    setCategoryFormVisible(false);
    setEditingCategory(undefined);
    load();
  }

  function handleSubcategoryFormSaved() {
    setSubcategoryFormVisible(false);
    setEditingSubcategory(undefined);
    load();
  }

  const viewingCategory = viewingCategoryId
    ? groups.flatMap((g) => g.categories ?? []).find((c) => c.id === viewingCategoryId)
    : undefined;

  const viewingSubs = viewingCategory?.subcategories ?? [];

  if (viewingCategoryId) {
    return (
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={{ paddingHorizontal: 22, paddingTop: 12 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to categories"
            onPress={goBack}
            style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 14 }}
          >
            <ArrowLeft size={18} color={palette.ink} weight="bold" />
            <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 14, color: palette.mut }}>
              Categories
            </Text>
            <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 14, color: palette.mut }}>
              /
            </Text>
            <Text style={{ fontFamily: "Manrope", fontWeight: "700", fontSize: 14, color: palette.ink }}>
              {viewingCategoryLabel}
            </Text>
          </Pressable>

          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View>
              <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 20, color: palette.ink }}>
                {viewingCategoryLabel}
              </Text>
              <Text style={{ fontFamily: "Manrope", fontSize: 12, color: palette.mut, marginTop: 2 }}>
                Subcategories
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add subcategory"
              onPress={() => {
                setSubcategoryFormMode("create");
                setEditingSubcategory(undefined);
                setSubcategoryFormVisible(true);
              }}
              style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: palette.brand, alignItems: "center", justifyContent: "center" }}
            >
              <Plus size={18} color="#fff" weight="bold" />
            </Pressable>
          </View>
        </View>

        <View style={{ paddingHorizontal: 22, paddingTop: 20 }}>
          {loading ? (
            <ActivityIndicator color={palette.aqua600} style={{ marginTop: 40 }} />
          ) : viewingSubs.length === 0 ? (
            <Text style={{ fontFamily: "Manrope", color: palette.mut, textAlign: "center", marginTop: 40 }}>
              No subcategories yet
            </Text>
          ) : (
            <View style={{ borderRadius: 16, borderWidth: 1, borderColor: palette.line, overflow: "hidden", paddingHorizontal: 14 }}>
              {viewingSubs.map((sub) => (
                <SubcategoryRow
                  key={sub.id}
                  sub={sub}
                  mutatingId={mutatingId}
                  onEdit={openSubcategoryEdit}
                  onDelete={handleSubcategoryDelete}
                />
              ))}
            </View>
          )}
        </View>

        <SubcategoryFormScreen
          visible={subcategoryFormVisible}
          mode={subcategoryFormMode}
          subcategory={editingSubcategory}
          categoryId={viewingCategoryId}
          categoryLabel={viewingCategoryLabel}
          userId={userId}
          deviceId={deviceId}
          onSaved={handleSubcategoryFormSaved}
          onCancel={() => {
            setSubcategoryFormVisible(false);
            setEditingSubcategory(undefined);
          }}
        />
      </ScrollView>
    );
  }

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={{ paddingHorizontal: 22, paddingTop: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={{ fontFamily: "Manrope", fontWeight: "800", fontSize: 20, color: palette.ink }}>
          Categories
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Create category"
          onPress={openCategoryCreate}
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
              onPress={() => { load(); }}
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
              onEdit={openCategoryEdit}
              onDelete={handleCategoryDelete}
              onNavigate={navigateToSubcategories}
            />
          ))
        )}
      </View>

      <CategoryFormScreen
        visible={categoryFormVisible}
        mode={categoryFormMode}
        category={editingCategory}
        groups={groups.map((g) => ({ id: g.id, slug: g.slug, label: g.label }))}
        userId={userId}
        deviceId={deviceId}
        onSaved={handleCategoryFormSaved}
        onCancel={() => {
          setCategoryFormVisible(false);
          setEditingCategory(undefined);
        }}
      />

      <SubcategoryFormScreen
        visible={subcategoryFormVisible && !!viewingCategoryId}
        mode={subcategoryFormMode}
        subcategory={editingSubcategory}
        categoryId={viewingCategoryId ?? ""}
        categoryLabel={viewingCategoryLabel}
        userId={userId}
        deviceId={deviceId}
        onSaved={handleSubcategoryFormSaved}
        onCancel={() => {
          if (subcategoryFormMode === "create" && !editingSubcategory && viewingCategoryId) {
            setViewingCategoryId(null);
            setViewingCategoryLabel("");
          }
          setSubcategoryFormVisible(false);
          setEditingSubcategory(undefined);
        }}
      />
    </ScrollView>
  );
}
