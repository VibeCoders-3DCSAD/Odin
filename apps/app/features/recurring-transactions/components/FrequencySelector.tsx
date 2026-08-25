import { Pressable, Text, View } from "react-native";
import type { RecurringScheduleFrequency } from "./RecurringScheduleFields";

type Props = {
  frequencies: readonly RecurringScheduleFrequency[];
  value: RecurringScheduleFrequency;
  onChange: (value: RecurringScheduleFrequency) => void;
  label?: string;
};

export default function FrequencySelector({ frequencies, value, onChange, label = "FREQUENCY" }: Props) {
  return (
    <View>
      <Text style={{ fontFamily: "Manrope", fontWeight: "600", fontSize: 12, color: "#414942", marginBottom: 6 }}>
        {label}
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {frequencies.map((frequency) => {
          const selected = value === frequency;
          const frequencyLabel = frequency === "semi_monthly" ? "semi monthly" : frequency;
          return (
            <Pressable
              key={frequency}
              onPress={() => onChange(frequency)}
              accessibilityRole="radio"
              accessibilityLabel={frequencyLabel}
              accessibilityState={{ checked: selected }}
              style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, backgroundColor: selected ? "#013220" : "#F1F0EB" }}
            >
              <Text style={{ fontSize: 13, fontFamily: "Manrope", fontWeight: "600", color: selected ? "#FFFFFF" : "#414942" }}>
                {frequencyLabel}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
