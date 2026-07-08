import { Pressable, Text, View } from "react-native";
import { COLORS } from "../constants";

type DependentsStepProps = {
  value?: boolean;
  onChange: (value: boolean) => void;
};

export default function DependentsStep({ value, onChange }: DependentsStepProps) {
  return (
    <View className="gap-4">
      <Text
        className="text-lg"
        style={{ fontFamily: "Manrope", fontWeight: "700", color: COLORS.ink }}
      >
        Do you have any dependents?
      </Text>
      <Text
        className="text-sm"
        style={{ fontFamily: "Manrope", fontWeight: "400", color: COLORS.mut }}
      >
        Dependents are people who rely on your income for their basic needs.
      </Text>
      <View className="flex-row gap-3">
        {[
          { value: true, label: "Yes" },
          { value: false, label: "No" },
        ].map((option) => {
          const selected = value === option.value;
          return (
            <Pressable
              key={String(option.value)}
              onPress={() => onChange(option.value)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              className="flex-1 min-h-[54px] rounded-[14px] items-center justify-center"
              style={{
                backgroundColor: selected ? COLORS.brand : COLORS.card,
                borderWidth: 1,
                borderColor: selected ? COLORS.brand : COLORS.line,
              }}
            >
              <Text
                className="text-sm"
                style={{
                  fontFamily: "Manrope",
                  fontWeight: "600",
                  color: selected ? "#FFFFFF" : COLORS.ink,
                }}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
