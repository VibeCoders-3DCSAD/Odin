import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { CaretDown, CaretUp, Check } from "phosphor-react-native";
import { v4, v4Font } from "../../components/BudgieForm";

type CategoryOption = { key: string; label: string };
type Props = { categories: CategoryOption[]; selected: CategoryOption; onSelect: (key: string) => void };

export function ForecastCategoryPicker({ categories, selected, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const Caret = open ? CaretUp : CaretDown;
  return <View style={{ marginTop: 12 }}>
    <Pressable accessibilityRole="button" accessibilityLabel={`Choose spending category: ${selected.label}`} accessibilityState={{ expanded: open }} onPress={() => setOpen((value) => !value)} style={{ flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: v4.hairline, backgroundColor: v4.surface, borderRadius: 10, paddingHorizontal: 12, minHeight: 48 }}>
      <Text style={{ flex: 1, fontFamily: v4Font, fontSize: 13, fontWeight: "700", color: v4.ink }}>{selected.label}</Text>
      <Caret color={v4.mut} size={16} weight="bold" />
    </Pressable>
    {open ? <View style={{ marginTop: 6, borderWidth: 1, borderColor: v4.hairline, borderRadius: 10, overflow: "hidden", backgroundColor: v4.surface }}>
      {/* Keep about five touch-sized rows visible; longer category lists scroll within the card. */}
      <ScrollView nestedScrollEnabled style={{ maxHeight: 5 * 48 }}>
        {categories.map((category) => <Pressable key={category.key} accessibilityRole="radio" accessibilityLabel={category.label} accessibilityState={{ checked: category.key === selected.key }} onPress={() => { onSelect(category.key); setOpen(false); }} style={{ flexDirection: "row", alignItems: "center", gap: 8, minHeight: 48, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: category.key === selected.key ? "#EFFEF7" : v4.surface }}>
          <Text style={{ flex: 1, fontFamily: v4Font, fontSize: 13, color: v4.ink }}>{category.label}</Text>
          {category.key === selected.key ? <Check color={v4.brandMid} size={16} weight="bold" /> : null}
        </Pressable>)}
      </ScrollView>
    </View> : null}
  </View>;
}
