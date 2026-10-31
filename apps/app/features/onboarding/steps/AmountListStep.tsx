import { Text, TextInput, View } from "react-native";
import { CARD, INK, INK2, LINE, MUTED } from "../colors";
import type { StepConfig } from "../types";

export function AmountListStep({
  step,
  selected,
  values,
  onChange,
}: {
  step: StepConfig;
  selected: string[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
}) {
  const options = step.amountOptions?.filter((option) => selected.includes(option.key)) ?? [];
  if (options.length === 0) {
    return (
      <Text style={{ fontFamily: "Manrope", fontSize: 14, color: MUTED }}>
        No amounts are needed for your selection.
      </Text>
    );
  }
  return (
    <View className="gap-4">
      {options.map((option) => (
        <View key={option.key}>
          <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 14, color: INK2, marginBottom: 10 }}>
            {option.label} Monthly Amount
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", borderWidth: 1.5, borderColor: LINE, borderRadius: 14, backgroundColor: CARD }}>
            <Text style={{ fontFamily: "Manrope", fontWeight: "500", fontSize: 12, color: MUTED, paddingLeft: 16 }}>
              ₱
            </Text>
            <TextInput
              value={values[option.key] ? Number(values[option.key]).toLocaleString() : ""}
              onChangeText={(text) => onChange(option.key, text)}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={MUTED}
              style={{ flex: 1, fontFamily: "Manrope", fontWeight: "700", fontSize: 20, color: INK, padding: 16 }}
            />
          </View>
        </View>
      ))}
    </View>
  );
}
