import { Pressable, Text, View } from "react-native";
import { COLORS } from "../constants";

const INCOME_OPTIONS = [
  { value: "salary", label: "Salary", description: "Regular employment income" },
  { value: "freelance", label: "Freelance", description: "Project-based or contract work" },
  { value: "business", label: "Business", description: "Own business or partnership" },
  { value: "gig", label: "Gig Worker", description: "Platform-based gigs" },
  { value: "investment", label: "Investment", description: "Passive or investment income" },
  { value: "other", label: "Other", description: "Other income sources" },
];

type IncomeTypeStepProps = {
  value?: string;
  onChange: (value: string) => void;
};

export default function IncomeTypeStep({ value, onChange }: IncomeTypeStepProps) {
  return (
    <View className="gap-2">
      <Text
        className="text-lg mb-1"
        style={{ fontFamily: "Manrope", fontWeight: "700", color: COLORS.ink }}
      >
        What type of income do you have?
      </Text>
      <Text
        className="text-sm mb-2"
        style={{ fontFamily: "Manrope", fontWeight: "400", color: COLORS.mut }}
      >
        Select the option that best describes your primary income source.
      </Text>
      {INCOME_OPTIONS.map((option) => {
        const selected = value === option.value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            className="min-h-[54px] rounded-[14px] px-4 flex-row items-center justify-between"
            style={{
              backgroundColor: selected ? COLORS.brand : COLORS.card,
              borderWidth: 1,
              borderColor: selected ? COLORS.brand : COLORS.line,
            }}
          >
            <View className="flex-1">
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
              <Text
                className="text-xs"
                style={{
                  fontFamily: "Manrope",
                  fontWeight: "400",
                  color: selected ? "rgba(255,255,255,0.7)" : COLORS.mut,
                }}
              >
                {option.description}
              </Text>
            </View>
            <View
              className="w-5 h-5 rounded-full items-center justify-center"
              style={{
                backgroundColor: selected ? "#FFFFFF" : "transparent",
                borderWidth: selected ? 0 : 2,
                borderColor: COLORS.mut,
              }}
            >
              {selected && (
                <View
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: COLORS.brand }}
                />
              )}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
