import { Pressable, Text, View } from "react-native";
import { MONTH_NAMES } from "./recurrenceOptions";

const C = { brand: "#013220", border: "#D8D8D2", selected: "#E6EFE9" };

type Props = { months: number[]; onChange: (months: number[]) => void; disabled?: boolean };

// The twelve months as toggles, for a payment that comes back in certain months.
export default function MonthPicker({ months, onChange, disabled = false }: Props) {
  function toggle(month: number) {
    onChange(months.includes(month) ? months.filter((item) => item !== month) : [...months, month].sort((left, right) => left - right));
  }
  return <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
    {MONTH_NAMES.map((name, index) => {
      const month = index + 1;
      const selected = months.includes(month);
      return <Pressable key={name} accessibilityRole="checkbox" accessibilityLabel={name} accessibilityState={{ checked: selected }} onPress={() => toggle(month)} disabled={disabled} style={{ width: "22%", flexGrow: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: selected ? C.brand : C.border, backgroundColor: selected ? C.selected : "transparent", alignItems: "center" }}>
        <Text style={{ fontFamily: "Manrope", fontWeight: selected ? "800" : "600", color: C.brand }}>{name.slice(0, 3)}</Text>
      </Pressable>;
    })}
  </View>;
}
