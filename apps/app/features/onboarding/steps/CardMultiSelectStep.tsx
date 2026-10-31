import { Pressable, Text, View } from "react-native";
import { Check } from "phosphor-react-native";
import { AQUA50, AQUA600, AQUA950, CARD, INK2, LINE, MUTED } from "../colors";
import type { StepConfig } from "../types";

export function CardMultiSelectStep({
  step,
  selected,
  onToggle,
}: {
  step: StepConfig;
  selected: string[];
  onToggle: (key: string) => void;
}) {
  return (
    <View className="gap-3">
      {step.options?.map((opt) => {
        const active = selected.includes(opt.key);
        return (
          <Pressable
            key={opt.key}
            onPress={() => onToggle(opt.key)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: active }}
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
            <View style={{ flex: 1 }}>
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
              {opt.description ? (
                <Text
                  style={{
                    fontFamily: "Manrope",
                    fontWeight: "400",
                    fontSize: 13,
                    color: MUTED,
                    marginTop: 4,
                  }}
                >
                  {opt.description}
                </Text>
              ) : null}
            </View>
            {active && <Check size={18} color={AQUA600} weight="bold" />}
          </Pressable>
        );
      })}
    </View>
  );
}
