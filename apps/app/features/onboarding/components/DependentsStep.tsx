import { Pressable, Text, View } from "react-native";

const palette = {
  brand: "#013220",
  ink: "#1B1C1A",
  mut: "#6B7A6F",
  line: "#EAEAE6",
  card: "#F1F0EB",
};

type DependentsStepProps = {
  value?: boolean;
  onChange: (value: boolean) => void;
};

export default function DependentsStep({ value, onChange }: DependentsStepProps) {
  return (
    <View className="gap-4">
      <Text
        className="text-lg"
        style={{ fontFamily: "Manrope", fontWeight: "700", color: palette.ink }}
      >
        Do you have any dependents?
      </Text>
      <Text
        className="text-sm"
        style={{ fontFamily: "Manrope", fontWeight: "400", color: palette.mut }}
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
              className="flex-1 min-h-[54px] rounded-[14px] items-center justify-center"
              style={{
                backgroundColor: selected ? palette.brand : palette.card,
                borderWidth: 1,
                borderColor: selected ? palette.brand : palette.line,
              }}
            >
              <Text
                className="text-sm"
                style={{
                  fontFamily: "Manrope",
                  fontWeight: "600",
                  color: selected ? "#FFFFFF" : palette.ink,
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
