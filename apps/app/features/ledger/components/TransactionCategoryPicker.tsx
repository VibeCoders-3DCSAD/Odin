import { Pressable, ScrollView, Text, View } from "react-native";
import { Check } from "phosphor-react-native";
import { DEFAULT_TAXONOMY_COLOR, TaxonomyIcon } from "../../taxonomy/taxonomyVisuals";
import { Note, styles as ui, v4, v4Font } from "../../../components/BudgieForm";
import { CategorySelectorTree, type CategorySelection } from "../../../components/CategorySelector";
import type { Category, Subcategory } from "../../../local-db/repositories/ledger/taxonomy";
import type { TransactionType } from "./TransactionTypeSelector";

type Props = {
  txType: TransactionType;
  categories: Category[];
  subcategories: Subcategory[];
  selection: CategorySelection;
  selectionLabel: string;
  selectedVisual: Category | Subcategory | null;
  hasSelection: boolean;
  onSelect: (selection: CategorySelection) => void;
};

// The full-page category list. Income has no category tier, so it lists subcategories flat.
export default function TransactionCategoryPicker({ txType, categories, subcategories, selection, selectionLabel, selectedVisual, hasSelection, onSelect }: Props) {
  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 28, gap: 14 }} showsVerticalScrollIndicator={false}>
      <Note>Pick from your full {txType} category list.</Note>

      {hasSelection ? (
        <View style={{ borderRadius: 16, borderWidth: 1, borderColor: v4.okBorder, backgroundColor: v4.okBg, paddingHorizontal: 15, paddingVertical: 14, gap: 4 }}>
          <Text style={{ fontFamily: v4Font, fontSize: 10.5, fontWeight: "700", color: v4.okInk, letterSpacing: 0.6 }}>
            CURRENT SELECTION
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={[ui.listTile, { backgroundColor: selectedVisual?.color_hex ?? DEFAULT_TAXONOMY_COLOR }]}>
              <TaxonomyIcon iconKey={selectedVisual?.icon_key} color="#fff" size={16} weight="fill" />
            </View>
            <Text style={{ flex: 1, fontFamily: v4Font, fontWeight: "700", fontSize: 14, color: v4.ink }}>
              {selectionLabel}
            </Text>
          </View>
        </View>
      ) : null}

      {txType === "income" ? (
        subcategories.length === 0 ? (
          <Text style={{ fontFamily: v4Font, fontSize: 13, color: v4.mut, textAlign: "center", paddingVertical: 20 }}>
            No income categories found.
          </Text>
        ) : (
          <View style={ui.list}>
            {subcategories.map((sub, index) => {
              const selected = selection.subcategoryId === sub.id;
              return (
                <Pressable
                  key={sub.id}
                  onPress={() => onSelect({ tier: "subcategory", categoryId: null, subcategoryId: sub.id })}
                  accessibilityRole="button"
                  accessibilityLabel={sub.label}
                  accessibilityState={{ selected }}
                  style={[ui.listRow, index > 0 ? ui.listRowDivider : null, selected ? ui.listRowSelected : null]}
                >
                  <View style={ui.listRowMain}>
                    <View style={[ui.listTile, { backgroundColor: sub.color_hex ?? DEFAULT_TAXONOMY_COLOR }]}><TaxonomyIcon iconKey={sub.icon_key} color="#fff" size={16} weight="fill" /></View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text numberOfLines={1} style={[ui.listTitle, selected ? { fontWeight: "700" } : null]}>{sub.label}</Text>
                      {sub.description ? <Text numberOfLines={1} style={ui.listSubtitle}>{sub.description}</Text> : null}
                    </View>
                    {selected ? <Check color={v4.brandMid} size={16} weight="bold" /> : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        )
      ) : (
        <CategorySelectorTree
          categories={categories}
          subcategories={subcategories}
          selection={selection}
          onSelect={onSelect}
          emptyMessage="No categories found for this transaction type."
        />
      )}
    </ScrollView>
  );
}
