import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { CaretDown, Check } from "phosphor-react-native";
import { BottomSheet, styles as ui, v4, v4Font } from "../../components/BudgieForm";

type CategoryOption = { key: string; label: string };
type Props = { categories: CategoryOption[]; selected: CategoryOption; onSelect: (key: string) => void };

// The categories open in a bottom sheet rather than a list overlaid on the chart: Android drops touches on
// children drawn outside their parent's bounds, so an overlaid list could not scroll to its later categories.
export function ForecastCategoryPicker({ categories, selected, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  return <View style={{ marginTop: 12 }}>
    <Pressable accessibilityRole="button" accessibilityLabel={`Choose spending category: ${selected.label}`} accessibilityState={{ expanded: open }} onPress={() => setOpen(true)} style={{ flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: v4.hairline, backgroundColor: v4.surface, borderRadius: 10, paddingHorizontal: 12, minHeight: 48 }}>
      <Text style={{ flex: 1, fontFamily: v4Font, fontSize: 13, fontWeight: "700", color: v4.ink }}>{selected.label}</Text>
      <CaretDown color={v4.mut} size={16} weight="bold" />
    </Pressable>
    <BottomSheet visible={open} onClose={() => setOpen(false)} title="Spending category">
      <View style={ui.list}>
        {categories.map((category, index) => {
          const checked = category.key === selected.key;
          return <Pressable key={category.key} accessibilityRole="radio" accessibilityLabel={category.label} accessibilityState={{ checked }} onPress={() => { onSelect(category.key); setOpen(false); }} style={[ui.listRow, index > 0 ? ui.listRowDivider : null, checked ? ui.listRowSelected : null]}>
            <View style={ui.listRowMain}>
              <Text numberOfLines={1} style={[ui.listTitle, { flex: 1 }]}>{category.label}</Text>
              {checked ? <Check color={v4.brandMid} size={16} weight="bold" /> : null}
            </View>
          </Pressable>;
        })}
      </View>
    </BottomSheet>
  </View>;
}
