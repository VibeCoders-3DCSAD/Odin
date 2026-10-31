import { Pressable, Text, View } from "react-native";
import { Check } from "phosphor-react-native";
import { AQUA50, AQUA600, AQUA950, CARD, INK2, LINE } from "../colors";
import type { StepConfig } from "../types";

export function DropdownStep({
  step,
  selected,
  onSelect,
}: {
  step: StepConfig;
  selected: string | undefined;
  onSelect: (key: string) => void;
}) {
  return (
    <View className="gap-3">
      {step.options?.map((opt) => {
        const active = selected === opt.key;
        return (
          <Pressable
            key={opt.key}
            onPress={() => onSelect(opt.key)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={opt.label}
            style={{
              borderWidth: 1.5,
              borderColor: active ? AQUA600 : LINE,
              borderRadius: 14,
              padding: 16,
              backgroundColor: active ? AQUA50 : CARD,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Text
              style={{
                fontFamily: "Manrope",
                fontWeight: "600",
                fontSize: 15,
                color: active ? AQUA950 : INK2,
              }}
            >
              {opt.label}
            </Text>
            {active && <Check size={18} color={AQUA600} weight="bold" />}
          </Pressable>
        );
      })}
    </View>
  );
}
