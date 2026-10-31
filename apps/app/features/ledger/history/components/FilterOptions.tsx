import { Pressable, Text, View } from "react-native";
import { dashboardColors as P } from "../../../dashboard/dashboardAppearance";
import { CHIP_ON } from "../constants";

export function Radio({ label, hint, selected, onPress }: { label: string; hint?: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="radio" accessibilityState={{ selected }} onPress={onPress} style={{ flexDirection: "row", alignItems: "center", gap: 11, minHeight: 44, paddingVertical: 6 }}>
      <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: selected ? P.brand : P.border, alignItems: "center", justifyContent: "center", backgroundColor: P.surface }}>
        {selected ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: P.brand }} /> : null}
      </View>
      <View>
        <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 13, color: P.ink }}>{label}</Text>
        {hint ? <Text style={{ fontFamily: "Manrope", fontSize: 11, color: P.secondary, marginTop: 1 }}>{hint}</Text> : null}
      </View>
    </Pressable>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={{ paddingHorizontal: 13, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: selected ? P.brand : P.border, backgroundColor: selected ? CHIP_ON : P.surface }}
    >
      <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 12, color: selected ? P.brand : P.secondary }}>{label}</Text>
    </Pressable>
  );
}
